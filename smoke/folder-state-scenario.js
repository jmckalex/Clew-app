// File-explorer disclosure state, run 1 of 2: close two folders and let the
// workspace persist. Pair with folder-state-restore-scenario.js over the SAME
// vault — the state lives in <vault>/.clew/workspace.json, so the second run
// is the actual assertion (it survives a restart).
//
// Fixture (disposable, one line):
//   mkdir -p V/Guide/Deep V/Archive/2025 V/Notes && \
//     echo '# R' > V/Root.md && echo '# A' > V/Guide/A.md && \
//     echo '# B' > V/Guide/Deep/B.md && echo '# C' > V/Archive/2025/C.md && \
//     echo '# D' > V/Notes/D.md
//
// Expect rows-after-click to lose every Guide/* and Archive/2025/* row, and
// the store to read ["Guide","Archive/2025"].
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
const explorer = document.querySelector('clew-file-explorer');
const rows = () => [...explorer.querySelectorAll('.tree-item')].map((r) => r.dataset.path);
const rowFor = (p) => explorer.querySelector(`.tree-item.is-folder[data-path="${CSS.escape(p)}"]`);

await sleep(1500);
console.log('smoke-fold: rows-at-start=' + JSON.stringify(rows()));
for (const path of ['Guide', 'Archive/2025']) {
	rowFor(path)?.click();
	await sleep(150);
}
console.log('smoke-fold: rows-after-click=' + JSON.stringify(rows()));
console.log('smoke-fold: store=' + JSON.stringify(workspaceStore.collapsedFolders));
await sleep(1500); // outlast the workspace store's 500ms persist debounce
