// File-explorer disclosure state, run 1 of 2: every folder starts CLOSED (the
// owner's ask, 2026-11-17), open some and let the workspace persist. Pair with
// folder-state-restore-scenario.js over the SAME vault — the state lives in
// <vault>/.clew/workspace.json, so the second run is the actual assertion (it
// survives a restart).
//
// Fixture (disposable, one line):
//   mkdir -p V/Guide/Deep V/Archive/2025 V/Notes && \
//     echo '# R' > V/Root.md && echo '# A' > V/Guide/A.md && \
//     echo '# B' > V/Guide/Deep/B.md && echo '# C' > V/Archive/2025/C.md && \
//     echo '# D' > V/Notes/D.md
//
// Expect rows-at-start to be the top level alone (Archive, Guide, Notes,
// Root.md), rows-after-click to gain Guide/*, Guide/Deep/* and
// Archive/2025/* but no Notes/*, and the store to read
// ["Guide","Guide/Deep","Archive","Archive/2025"]. Then a CLOSED folder's
// "New note": `new-note-in-closed folder-open=true renaming=Notes/Untitled.md`
// — the folder opens so the new note's name can be typed in its row — and the
// store gains "Notes".
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
const explorer = document.querySelector('clew-file-explorer');
const rows = () => [...explorer.querySelectorAll('.tree-item')].map((r) => r.dataset.path);
const rowFor = (p) => explorer.querySelector(`.tree-item.is-folder[data-path="${CSS.escape(p)}"]`);

await sleep(1500);
console.log('smoke-fold: rows-at-start=' + JSON.stringify(rows()));
for (const path of ['Guide', 'Guide/Deep', 'Archive', 'Archive/2025']) {
	rowFor(path)?.click();
	await sleep(150);
}
console.log('smoke-fold: rows-after-click=' + JSON.stringify(rows()));
console.log('smoke-fold: store=' + JSON.stringify(workspaceStore.expandedFolders));

// A closed folder's own "New note", through its real context menu.
rowFor('Notes').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 60, clientY: 120 }));
await sleep(200);
[...document.querySelectorAll('.clew-menu .menu-item')].find((b) => b.textContent === 'New note')?.click();
let input = null;
for (let i = 0; i < 40 && !input; i++) { await sleep(100); input = explorer.querySelector('.tree-rename-input'); }
console.log(`smoke-fold: new-note-in-closed folder-open=${workspaceStore.expandedFolders.includes('Notes')} renaming=${input?.closest('.tree-item')?.dataset.path ?? 'none'}`);
input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await sleep(300);
console.log('smoke-fold: store-after-new=' + JSON.stringify(workspaceStore.expandedFolders));
await sleep(1500); // outlast the workspace store's 500ms persist debounce
