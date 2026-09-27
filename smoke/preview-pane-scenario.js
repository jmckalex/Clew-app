// The live preview pane (docs/dev/live-edit.md §5.12) with real typing, over
// `Pane.md`. Fixture: `node smoke/make-live-vault.mjs <dir>` (the run edits
// Pane.md — regenerate before each run). Run with
// `CLEW_SMOKE_FRAME_SCRIPT=smoke/preview-pane-frame.js
//  CLEW_SMOKE_FRAME_MATCH=__clew_block__`.
//
// Live edit:
//   1. click the $$ formula     → `pane=visible kind=math-display side=below same-as-widget=true`
//   2. type ` + 1`              → `updated=true` (a new picture after the pause)
//   3. ArrowDown ×2, out        → `hidden=true widget-new=true` (the widget shows
//                                  what the pane last showed — the cache, no flicker)
//   4. into the mermaid fence, Enter + a node → `kind=fence lang=mermaid ready=true`
//   5. Enter + another node, fast → `generation-latest=true` (ONE render for the
//      burst); the frame script reports `has-Zed=true` from the pane's document
//   6. ` \frac{` in the formula → `error-shown=true` (the last good picture kept)
//   7. Escape → `escape hidden=true`; out (ArrowDown ×2) and back in (ArrowUp)
//      → `re-entry=visible`
// Source mode (⌘⇧E):
//   8. into the inline $…$      → `kind=math-inline side=above`
//   9. setting off              → `off none=true`
//  10. into the tikz fence      → `tikz ready=true` (typeset where mp-tikz-wasm
//      is staged, refused by name where not); then back into the mermaid
//      fence, whose document the frame script reads: `has-Zed=true
//      svg-has-Zed=true` (the morph re-drew the diagram)
// And `focus-kept=true` at every step: the pane never takes focus.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, settingsStore, previewPane } = window.__clew;
const log = (s) => console.log('smoke-pp: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
settingsStore.set('previewPane', 'on');
const tab = workspaceStore.openNote('Pane.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-math-display svg'), 10000);
await sleep(800);
const view = editorPool.get(tab.id).view;
const doc = () => view.state.doc.toString();
const P = () => previewPane().describe();
const focusKept = () => view.contentDOM.contains(document.activeElement);
const widgetSvg = () => document.querySelector('.cm-content .le-math-display svg')?.outerHTML ?? null;
const select = (pos) => { view.dispatch({ selection: { anchor: pos } }); view.focus(); };
const originalWidget = widgetSvg();
const r = document.querySelector('.cm-content .le-math-display').getBoundingClientRect();

const META = 4;
const SHIFT = 8;
const key = (k, modifiers = 0) => ({ combo: { key: k, modifiers } });
window.__clewSmokeInput = [
	{ click: { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } }, { wait: 1200 }, // 1
	{ wait: 800 },                                         // the scenario puts the cursor after `x = 1`
	{ text: ' + 1' }, { wait: 1200 },                      // 2
	key('ArrowDown'), key('ArrowDown'), { wait: 1500 },    // 3; then into the fence
	{ wait: 1500 },
	key('Enter'), { text: 'B --> C[Added]' }, { wait: 2500 }, // 4
	key('Enter'), { text: 'C --> Zed' }, { wait: 2500 },  // 5
	{ wait: 1500 },                                        // the scenario: back into the formula
	{ text: ' \\frac{' }, { wait: 1200 },                  // 6
	key('Escape'), { wait: 1000 },                         // 7
	key('ArrowDown'), key('ArrowDown'), { wait: 800 },
	// ArrowUp walks INTO the redrawn formula (live/keys.js; CodeMirror alone
	// carried the cursor clean past a block widget).
	key('ArrowUp'), { wait: 1500 },
	key('e', META | SHIFT), { wait: 2000 },                // 8
	{ wait: 2000 },                                        // 9
	{ wait: 22000 },                                       // 10, then back to mermaid
];

(async () => { try {
	// 1
	await until(() => P().visible && P().svg);
	await sleep(200);
	const first = P();
	log(`pane=${first.visible ? 'visible' : 'hidden'} kind=${first.kind} side=${first.side} same-as-widget=${first.svg === originalWidget} focus-kept=${focusKept()}`);
	select(doc().indexOf('x = 1') + 5);

	// 2
	await until(() => doc().includes('x = 1 + 1'));
	await sleep(600);
	const updated = P();
	log(`updated=${Boolean(updated.svg) && updated.svg !== first.svg} focus-kept=${focusKept()}`);

	// 3
	await until(() => !P().visible);
	await sleep(400);
	log(`hidden=${!P().visible} widget-new=${widgetSvg() === updated.svg && widgetSvg() !== originalWidget}`);
	select(doc().indexOf('B[End]') + 'B[End]'.length);

	// 4
	await until(() => doc().includes('C[Added]'));
	await until(() => P().visible && P().kind === 'fence' && P().ready, 6000);
	await sleep(1500);
	const four = P();
	log(`kind=${four.kind} lang=${four.lang} ready=${four.ready} focus-kept=${focusKept()} pane-frame=${(four.src ?? '').split('/').pop().slice(0, 6)}`);

	// 5
	const before = P().renders;
	await until(() => doc().includes('C --> Zed'));
	await sleep(1500);
	log(`generation-latest=${P().renders === before + 1} renders=${P().renders - before}`);

	// 6
	await sleep(600);
	select(doc().indexOf('x = 1 + 1') + 'x = 1 + 1'.length);
	await until(() => doc().includes('\\frac{'));
	await sleep(700);
	const six = P();
	log(`error-shown=${Boolean(six.error)} kept-picture=${six.svg === updated.svg} error=${JSON.stringify(six.error)}`);

	// 7
	await until(() => !P().visible);
	log(`escape hidden=${!P().visible} focus-kept=${focusKept()}`);
	await sleep(1000);
	await until(() => P().visible, 4000);
	log(`re-entry=${P().visible ? 'visible' : 'hidden'}`);

	// 8
	await until(() => !view.contentDOM.closest('.cm-editor').classList.contains('cm-live'));
	await sleep(300);
	select(doc().indexOf('$a^2') + 2);
	await until(() => P().visible && P().kind === 'math-inline');
	await sleep(300);
	log(`kind=${P().kind} side=${P().side} focus-kept=${focusKept()}`);

	// 9
	settingsStore.set('previewPane', 'off');
	select(doc().indexOf('$a^2') + 3);
	await sleep(500);
	log(`off none=${!P().visible}`);
	settingsStore.set('previewPane', 'on');

	// 10: last, and then back into the mermaid fence, so the pane's one
	// iframe ends the run holding the mermaid document the frame script
	// reads (the same text again: a morph from the fragment cache). No gate
	// on mp-tikz-wasm being staged: the pane renders the block either way —
	// the figure, or the engine's refusal by name, as reading mode would.
	select(doc().indexOf('\\draw'));
	await until(() => P().visible && P().lang === 'tikz' && P().ready, 12000);
	log(`tikz ready=${P().ready} kind=${P().kind}`);
	select(doc().indexOf('C --> Zed'));
	await until(() => P().visible && P().lang === 'mermaid', 5000);
	await sleep(1500);
	log(`back-to-mermaid=${P().lang === 'mermaid'} visible=${P().visible}`);
} catch (err) { log('ERROR ' + err.stack); } })();
