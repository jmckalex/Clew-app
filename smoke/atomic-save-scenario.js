// Smoke scenario: type into a real editor, let the 1s auto-save fire, and
// leave the vault for the harness to inspect (atomic write end-to-end).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool } = window.__clew;
workspaceStore.openNote('Test.md');
let entry = null;
for (let i = 0; i < 100 && !entry?.view; i++) {
	await sleep(100);
	const tab = workspaceStore.activeTab();
	entry = tab ? editorPool.get(tab.id) : null;
}
if (!entry?.view) { console.log('smoke-scenario: NO EDITOR MOUNTED'); return; }
const doc = entry.view.state.doc;
entry.view.dispatch({ changes: { from: doc.length, insert: '\nAppended by the atomic-save smoke run.\n' } });
console.log('smoke-scenario: edit dispatched');
await sleep(2500);
const tab = workspaceStore.activeTab();
console.log('smoke-scenario: dirty-after-autosave=' + editorPool.isDirty(tab.id));
