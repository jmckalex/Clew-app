// The vault's `normalSyntax` switch reaching an OPEN editor's grammar
// (vault-settings-store.js → pool.js → editor.js#markdownCompartment).
//
// In the dialect `_x_` is subscript-x plus a literal underscore
// (jmd/subsup-parser.js), so lang-markdown paints NO `cmt-emphasis`; under
// normalSyntax it is emphasis again. The flip must reconfigure the editor
// in place — same EditorView, an unsaved edit still in the document —
// rather than rebuild it.
//
// Fixture (any disposable vault):
//
//   mkdir -p /tmp/ns-vault && printf '%s\n' '# Normal' '' \
//     'Plain _emphasis_ here, and H_2O.' > /tmp/ns-vault/Normal.md
//
// Expect: `dialect emphasis=0`, `normal emphasis=3 same-view=true
// edit-kept=true` (the two marks and the body), `back emphasis=0`. The run
// leaves normalSyntax false.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, vaultSettingsStore } = window.__clew;
await vaultSettingsStore.ready();
if (vaultSettingsStore.get('normalSyntax') === true) await vaultSettingsStore.set('normalSyntax', false);
workspaceStore.openNote('Normal.md', { newTab: true, defaultMode: 'source' });
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
await until(() => document.querySelector('.cm-content')?.textContent.includes('Plain'));
await sleep(300);
const emphasis = () => document.querySelectorAll('.cm-content .cmt-emphasis').length;
console.log(`smoke-normal: dialect emphasis=${emphasis()}`);

const tabId = workspaceStore.activeTab().id;
const view = editorPool.get(tabId)?.view;
view.dispatch({ changes: { from: view.state.doc.length, insert: '\nEDITED' } });
await vaultSettingsStore.set('normalSyntax', true);
await until(() => emphasis() > 0, 3000);
const after = editorPool.get(tabId)?.view;
console.log(`smoke-normal: normal emphasis=${emphasis()} same-view=${after === view} edit-kept=${after.state.doc.toString().includes('EDITED')}`);

await vaultSettingsStore.set('normalSyntax', false);
await until(() => emphasis() === 0, 3000);
console.log(`smoke-normal: back emphasis=${emphasis()}`);
