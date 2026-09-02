// Smoke scenario: build two history snapshots through real edits + auto-save
// (vault-settings sets minIntervalMinutes: 0), open the history modal, then
// restore the oldest version through the modal's own buttons.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, registry } = window.__clew;
workspaceStore.openNote('Test.md');
let entry = null;
for (let i = 0; i < 100 && !entry?.view; i++) {
	await sleep(100);
	const tab = workspaceStore.activeTab();
	entry = tab ? editorPool.get(tab.id) : null;
}
if (!entry?.view) { console.log('smoke-history: NO EDITOR'); return; }
const type = (text) => entry.view.dispatch({
	changes: { from: entry.view.state.doc.length, insert: text } });

type('\nSecond version paragraph.\n');
await sleep(1600); // auto-save (snapshots "Original body" pre-image)
type('\nThird version paragraph.\n');
await sleep(1600); // auto-save (snapshots the second version)

registry.runCommand('file:history');
await sleep(600);
const rows = [...document.querySelectorAll('.history-versions .modal-result')];
console.log('smoke-history: versions=' + rows.length);
if (rows.length === 0) return;
// Select the OLDEST snapshot and let the preview load.
rows[rows.length - 1].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
await sleep(500);
const preview = document.querySelector('.history-preview')?.textContent ?? '';
console.log('smoke-history: preview-has-original=' + preview.includes('Original body.'));
console.log('smoke-history: preview-has-second=' + preview.includes('Second version'));
window.__historyModalShot = true;
