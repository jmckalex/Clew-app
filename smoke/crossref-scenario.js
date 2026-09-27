// Cross-references (docs/dev/live-edit.md §5.13) over Crossrefs.md.
// Fixture: `node smoke/make-crossref-vault.mjs <dir>` (the run edits it).
// Run with `CLEW_SMOKE_FRAME_SCRIPT=smoke/crossref-frame.js
// CLEW_SMOKE_FRAME_MATCH=vault/` — the frame script runs in every preview
// document: the reading-mode one (the ENGINE's numbers) and the popover's.
//
//   1. live edit → `initial-refs=[…]`, the chips as first drawn
//   3. a real click on the @cref[thm-main] chip → `jumped=true revealed=true`;
//      ⌘[ → `back=true`
//   4. a new theorem typed ABOVE it by real input → `renumbered=true` (the chip
//      now says theorem 2, the lemma's lemma 3)
//   5. `@ref[thm` typed → `completion=[…]` listing the labels; Enter →
//      `completed=true` (@ref[thm-main] in the text)
//   6. a real pointer move onto the @cref[thm-main] chip →
//      `preview=visible label="Theorem 2 — Fundamental Triviality"`; the frame
//      script then reports `frame-label-hidden=true` from the popover's
//      document (the lone fragment's own "Theorem 1." hidden)
//   7. source mode, a move onto `@ref[eq-b]` → `source-preview=visible`
//   PARITY: `clew-refs=[…]` / `clew-targets=[…]` (live edit, after the edits),
//      then the tab goes to reading mode and the frame script prints the
//      ENGINE's `engine-refs=[…]` / `engine-targets=[…]` from its own
//      document — the README's recipe compares them: `numbers-match=true`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, numbering } = window.__clew;
const log = (s) => console.log('smoke-xr: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Crossrefs.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-ref'));
await sleep(800);
const view = editorPool.get(tab.id).view;
// The references sit near the end: bring them on screen before measuring.
view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true });
await sleep(400);

const doc = () => view.state.doc.toString();
const chipTexts = () => [...document.querySelectorAll('.cm-content .le-ref')].map((e) => e.textContent);
const P = () => window.__clew.linkPreview().describe();
const lineOf = (pos) => view.state.doc.lineAt(pos);
const center = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
const chip = (key) => document.querySelector(`.cm-content .le-ref[data-le-ref="${key}"]`);
log(`initial-refs=${JSON.stringify(chipTexts())}`);
const heads = [...document.querySelectorAll('.le-env-numbered')].map((e) => e.textContent);
const tags = [...document.querySelectorAll('.le-math-block[data-le-tag]')].map((e) => e.dataset.leTag);
const prefixes = [...document.querySelectorAll('.le-heading-number')].map((e) => e.textContent);
log(`shown heads=${JSON.stringify(heads)} equation-tags=${JSON.stringify(tags)} heading-prefixes=${JSON.stringify(prefixes)}`);

// Every pointer position must be known before the queue runs (it is read
// once), and typing moves things: so the hovers and the click come first,
// the typing after. Source mode's position is measured by a quick flip.
const W = center(chip('thm-main'));
workspaceStore.setTabMode(tab.id, 'source');
await sleep(500);
const eqb = doc().indexOf('@ref[eq-b]') + 6;
const sc = view.coordsAtPos(eqb);
const SRC = { x: Math.round(sc.left + 2), y: Math.round((sc.top + sc.bottom) / 2) };
workspaceStore.setTabMode(tab.id, 'live');
await sleep(600);
view.dispatch({ selection: { anchor: doc().length }, scrollIntoView: true });
await sleep(300);

const META = 4;
const key = (k, modifiers = 0) => ({ combo: { key: k, modifiers } });
window.__clewSmokeInput = [
	{ move: W }, { wait: 1500 },                                   // 6
	{ move: { x: 5, y: 300 } }, { wait: 1200 },                    // → source mode
	{ move: SRC }, { wait: 1500 },                                 // 7
	{ move: { x: 5, y: 300 } }, { wait: 1500 },                    // → live
	{ click: W }, { wait: 1200 },                                  // 3
	key('[', META), { wait: 1500 },                                // 3: back
	{ wait: 1000 },                                                // the scenario: caret above the theorem
	{ text: '@begin(theorem)' }, key('Enter'), { text: 'A new first theorem.' }, key('Enter'),
	{ text: '@end(theorem)' }, key('Enter'), key('Enter'), { wait: 1500 }, // 4
	{ wait: 1000 },                                                // the scenario: caret at the end
	{ text: ' @ref[thm' }, { wait: 1200 },                         // 5
	key('Enter'), { wait: 2000 },
];

(async () => { try {
	// 6
	await until(() => P().visible && P().ready);
	await sleep(400);
	log(`preview=${P().visible ? 'visible' : 'none'} label=${JSON.stringify(P().label)} pane-frame=${(P().src ?? '').split('/').pop().slice(0, 6)}`);
	await until(() => !P().visible);
	workspaceStore.setTabMode(tab.id, 'source');

	// 7
	await until(() => P().visible, 5000);
	log(`source-preview=${P().visible ? 'visible' : 'none'} label=${JSON.stringify(P().label)}`);
	await until(() => !P().visible);
	workspaceStore.setTabMode(tab.id, 'live');
	await sleep(300);
	view.dispatch({ selection: { anchor: doc().length }, scrollIntoView: true });

	// 3
	const before = lineOf(view.state.selection.main.head).number;
	await until(() => lineOf(view.state.selection.main.head).text.startsWith('@begin(theorem)'), 6000);
	await sleep(300);
	const onTheorem = lineOf(view.state.selection.main.head).text.startsWith('@begin(theorem)');
	log(`jumped=${onTheorem} revealed=${onTheorem && [...document.querySelectorAll('.cm-line')].some((l) => l.textContent.startsWith('@begin(theorem)'))}`);
	await until(() => lineOf(view.state.selection.main.head).number === before, 3000);
	log(`back=${lineOf(view.state.selection.main.head).number === before}`);
	view.dispatch({ selection: { anchor: doc().indexOf('@begin(theorem)[Fundamental') } });
	view.focus();

	// 4
	await until(() => doc().includes('@end(theorem)\n\n@begin(theorem)[Fundamental'), 10000);
	view.dispatch({ selection: { anchor: doc().indexOf('Last line.') + 'Last line.'.length } });
	view.focus();
	await sleep(500);
	const renum = chipTexts();
	log(`renumbered=${renum.includes('theorem\u00a02') && renum.includes('lemma\u00a03')} refs=${JSON.stringify(renum)}`);

	// 5
	await until(() => document.querySelector('.cm-tooltip-autocomplete'), 6000);
	await sleep(300);
	const offered = [...document.querySelectorAll('.cm-tooltip-autocomplete li')].map((li) => `${li.querySelector('.cm-completionLabel')?.textContent}|${li.querySelector('.cm-completionDetail')?.textContent ?? ''}`);
	log(`completion=${JSON.stringify(offered)}`);
	await until(() => doc().includes('@ref[thm-main]'), 4000);
	log(`completed=${doc().includes('@ref[thm-main]')}`);

	// PARITY: what live edit shows now, then the engine's document.
	view.dispatch({ selection: { anchor: doc().length } });
	await sleep(800);
	log(`clew-refs=${JSON.stringify(chipTexts())}`);
	const n = numbering.numberDocument(view.state.doc);
	log(`clew-targets=${JSON.stringify([...n.lines.entries()].sort((a, b) => a[0] - b[0]).map(([, e]) => `${e.kind === 'heading' ? 'heading' : e.type}:${e.number}`))}`);
	workspaceStore.setTabMode(tab.id, 'reading');
	await sleep(5000);
} catch (err) { log('ERROR ' + err.stack); } })();
