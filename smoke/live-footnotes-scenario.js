// Multi-paragraph footnotes in live edit (docs/dev/live-edit.md §5.2 as
// corrected): concealed to a badge like a one-line note, revealed whole.
// Fixture: `node smoke/make-live-vault.mjs <dir>` (Footnotes.md; the run
// edits it).
//
//   1. `fn-numbers=[1,2,3]` (document order), `long-badge=true`,
//      `paragraph-lines-collapsed=true` (fewer drawn lines than source lines),
//      `long-title` = the first paragraph + "…"
//   2. a real click on the long badge → `revealed=true source-lines=6`, the
//      list inside drawn as a list (`inner-bullets=2`)
//   3. real typing in the first paragraph, ArrowUp out → `concealed=true
//      title-updated=true`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool } = window.__clew;
const log = (s) => console.log('smoke-fn: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Footnotes.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-fn'));
await sleep(600);
const view = editorPool.get(tab.id).view;
const doc = () => view.state.doc.toString();
view.dispatch({ selection: { anchor: doc().length } });
await sleep(400);

// 1
const badges = () => [...document.querySelectorAll('.cm-content .le-fn')];
const long = () => document.querySelector('.cm-content .le-fn-long');
const drawnLines = () => document.querySelectorAll('.cm-content .cm-line').length;
log(`fn-numbers=${JSON.stringify(badges().map((b) => Number(b.textContent)))} long-badge=${Boolean(long())}`);
log(`paragraph-lines-collapsed=${drawnLines() < view.state.doc.lines} drawn=${drawnLines()} source=${view.state.doc.lines}`);
const title0 = long()?.title ?? '';
log(`long-title=${JSON.stringify(title0)} first-paragraph=${title0.startsWith('The first paragraph of the long note.')} ellipsis=${title0.endsWith('…')}`);

const r = long().getBoundingClientRect();
window.__clewSmokeInput = [
	{ click: { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } }, { wait: 1200 }, // 2
	{ wait: 800 },                                         // the scenario: caret in the first paragraph
	{ text: ' EDITED' }, { wait: 600 },
	{ combo: { key: 'ArrowUp', modifiers: 0 } }, { wait: 1200 },  // 3
];

(async () => { try {
	// 2
	await until(() => !long());
	await sleep(300);
	const noteLines = [...document.querySelectorAll('.cm-content .cm-line')]
		.filter((l) => /long note|an item|another item|third paragraph/.test(l.textContent) || l.textContent === '');
	const inner = document.querySelectorAll('.cm-content .le-bullet').length;
	log(`revealed=${!long() && drawnLines() === view.state.doc.lines} source-lines=${view.state.doc.lineAt(doc().indexOf('The third')).number - view.state.doc.lineAt(doc().indexOf('[^long')).number + 1} inner-bullets=${inner}`);
	view.dispatch({ selection: { anchor: doc().indexOf('long note.') + 'long note'.length } });
	view.focus();

	// 3
	await until(() => doc().includes('long note EDITED.'));
	await until(() => long(), 4000);
	await sleep(300);
	log(`concealed=${Boolean(long())} title-updated=${(long()?.title ?? '').includes('EDITED')} title=${JSON.stringify(long()?.title)}`);
} catch (err) { log('ERROR ' + err.stack); } })();
