// Smoke scenario (second run over the same vault): open the history modal,
// select the OLDEST snapshot, and click Restore. The screenshot should show
// the editor silently reloaded with the original text.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, registry } = window.__clew;
workspaceStore.openNote('Test.md');
let entry = null;
for (let i = 0; i < 100 && !entry?.view; i++) {
	await sleep(100);
	const tab = workspaceStore.activeTab();
	entry = tab ? editorPool.get(tab.id) : null;
}
if (!entry?.view) { console.log('smoke-restore: NO EDITOR'); return; }

registry.runCommand('file:history');
await sleep(600);
const rows = [...document.querySelectorAll('.history-versions .modal-result')];
console.log('smoke-restore: versions=' + rows.length);
rows[rows.length - 1]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
await sleep(400);
document.querySelector('.history-restore')?.click();
await sleep(1500); // restore write + watcher round-trip + editor reload
const text = editorPool.get(workspaceStore.activeTab().id)?.view?.state.doc.toString() ?? '(no editor)';
console.log('smoke-restore: editor-has-original=' + text.includes('Original body.'));
console.log('smoke-restore: editor-has-third=' + text.includes('Third version'));
console.log('smoke-restore: modal-closed=' + !document.querySelector('.clew-modal'));
