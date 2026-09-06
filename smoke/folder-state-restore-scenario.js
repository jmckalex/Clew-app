// File-explorer disclosure state, run 2 of 2 (see folder-state-scenario.js):
// the same vault, restarted. restored-rows must equal run 1's rows-after-click
// — the closed folders come back closed, with no click from anyone.
//
// Then the remap half: rename a CLOSED folder through its real context menu
// and watch its own entry and its closed children follow. This leaves the
// vault renamed, so regenerate the fixture before running the pair again.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
const explorer = document.querySelector('clew-file-explorer');
const rows = () => [...explorer.querySelectorAll('.tree-item')].map((r) => r.dataset.path);
const rowFor = (p) => explorer.querySelector(`.tree-item.is-folder[data-path="${CSS.escape(p)}"]`);

await sleep(2000);
console.log('smoke-fold: restored-store=' + JSON.stringify(workspaceStore.collapsedFolders));
console.log('smoke-fold: restored-rows=' + JSON.stringify(rows()));

// Close a nested folder too, so the rename has descendants to carry.
rowFor('Guide')?.click(); await sleep(150);        // open it
rowFor('Guide/Deep')?.click(); await sleep(150);   // close the child
rowFor('Guide')?.click(); await sleep(150);        // close the parent again
console.log('smoke-fold: before-rename=' + JSON.stringify(workspaceStore.collapsedFolders));

rowFor('Guide').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 60, clientY: 120 }));
await sleep(200);
[...document.querySelectorAll('.clew-menu .menu-item')]
	.find((b) => b.textContent.startsWith('Rename'))?.click();
await sleep(200);
const input = explorer.querySelector('.tree-rename-input');
input.value = 'Manual';
input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await sleep(2000);
console.log('smoke-fold: after-rename=' + JSON.stringify(workspaceStore.collapsedFolders));
console.log('smoke-fold: rows=' + JSON.stringify(rows()));
await sleep(1200);
