// File-explorer disclosure state, run 2 of 2 (see folder-state-scenario.js):
// the same vault, restarted. restored-store must equal run 1's
// store-after-new, and restored-rows hold every open folder's contents — the
// open folders come back open, with no click from anyone.
//
// Then the remap half: rename an OPEN folder through its real context menu
// and watch its own entry and its open children follow (Guide → Manual,
// Guide/Deep → Manual/Deep). This leaves the vault renamed, so regenerate the
// fixture before running the pair again.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
const explorer = document.querySelector('clew-file-explorer');
const rows = () => [...explorer.querySelectorAll('.tree-item')].map((r) => r.dataset.path);
const rowFor = (p) => explorer.querySelector(`.tree-item.is-folder[data-path="${CSS.escape(p)}"]`);

await sleep(2000);
console.log('smoke-fold: restored-store=' + JSON.stringify(workspaceStore.expandedFolders));
console.log('smoke-fold: restored-rows=' + JSON.stringify(rows()));

rowFor('Guide').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 60, clientY: 120 }));
await sleep(200);
[...document.querySelectorAll('.clew-menu .menu-item')]
	.find((b) => b.textContent.startsWith('Rename'))?.click();
await sleep(200);
const input = explorer.querySelector('.tree-rename-input');
input.value = 'Manual';
input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await sleep(2000);
console.log('smoke-fold: after-rename=' + JSON.stringify(workspaceStore.expandedFolders));
console.log('smoke-fold: rows=' + JSON.stringify(rows()));
await sleep(1200);
