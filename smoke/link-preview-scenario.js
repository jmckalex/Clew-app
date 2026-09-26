// Link hover previews (docs/dev/live-edit.md §5.11) with REAL pointer moves
// (`{move:{x,y}}`), over `Hover.md` in a scratch copy of the demo vault.
//
// Fixture: `node smoke/make-hover-vault.mjs <dir>`. Run with
// `CLEW_SMOKE_FRAME_SCRIPT=smoke/link-preview-frame.js
//  CLEW_SMOKE_FRAME_MATCH=__clew_block__` for the section check.
//
// Live edit:
//   1. onto [[Welcome]]          → `visible=true path=Welcome.md ready=true height>80=true`
//                                   and `focus-kept=true` (the editor keeps focus)
//   2. away                      → `hidden=true` (after the grace)
//   3. 30 s later                → `blanked=true` (src about:blank), `one-frame=true`
//   4. onto [[Welcome#The guide]] → `section label="Welcome › The guide"`
//   5. along the line to [[Nowhere]] → `card="No note called Nowhere"` (no second wait)
//   6. [[sample.pdf|external]], then [site](https://…) → `external none=true`, `url none=true`
//   7. hover, Escape             → `escape hidden=true`
// Source mode:
//   8. the raw [[Welcome]]       → `source visible=true`
// linkPreview = 'mod', live edit:
//   9. plain hover → `mod-plain none=true`; with ⌘ → `mod-held visible=true`
// Reading mode:
//  10. the long-aliased link     → `reading visible=true over-frame=true`; the frame
//      script then reports from inside the popover's document:
//      `section-only=true bare=true` (the h2, not the note's h1; no embed chrome)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, settingsStore, linkPreview } = window.__clew;
const log = (s) => console.log('smoke-lp: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
settingsStore.set('linkPreview', 'hover');
const tab = workspaceStore.openNote('Hover.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-wikilink'));
await sleep(800);
const view = editorPool.get(tab.id).view;
const doc = () => view.state.doc.toString();
const P = () => linkPreview().describe();
const mid = (r) => ({ x: Math.round((r.left + r.right) / 2), y: Math.round((r.top + r.bottom) / 2) });
const byText = (sel, text) => [...document.querySelectorAll(sel)].find((e) => e.textContent === text);

// Where everything is, measured before the queue (it is read once).
const W = mid(document.querySelector('.le-wikilink[data-le-target="Welcome"]').getBoundingClientRect());
const S = mid(byText('.le-wikilink[data-le-target="Welcome#The guide"]', 'The guide').getBoundingClientRect());
const N = mid(byText('.le-wikilink', 'Nowhere').getBoundingClientRect());
const X = mid(document.querySelector('.le-wikilink[data-le-external]').getBoundingClientRect());
const U = mid(document.querySelector('.le-link').getBoundingClientRect());
const longRects = [...document.querySelector('.le-wikilink').getClientRects()];
const R = { x: Math.round(longRects[2].left + 60), y: Math.round((longRects[2].top + longRects[2].bottom) / 2) };
const edge = view.scrollDOM.getBoundingClientRect();
const E = { x: Math.round(edge.right - 30), y: Math.round(edge.top + 12) };
workspaceStore.setTabMode(tab.id, 'source');
await sleep(500);
const srcPos = doc().indexOf('\n[[Welcome]]') + 5;
const sc = view.coordsAtPos(srcPos);
const Wsrc = { x: Math.round(sc.left + 2), y: Math.round((sc.top + sc.bottom) / 2) };
workspaceStore.setTabMode(tab.id, 'live');
await sleep(600);
view.focus();

const META = 4;
window.__clewSmokeInput = [
	{ move: W }, { wait: 1500 },                           // 1
	{ move: E }, { wait: 1000 },                           // 2
	{ wait: 31500 },                                       // 3
	{ move: S }, { wait: 2000 },                           // 4
	{ move: N }, { wait: 1200 },                           // 5
	{ move: E }, { wait: 800 }, { move: X }, { wait: 1500 },
	{ move: U }, { wait: 1500 },                           // 6
	{ move: W }, { wait: 1500 },
	{ combo: { key: 'Escape', modifiers: 0 } }, { wait: 1800 }, // 7; → source
	{ move: Wsrc }, { wait: 1800 },                        // 8
	{ move: E }, { wait: 2000 },                           // → mod, live
	{ move: W }, { wait: 1500 },                           // 9 plain
	{ move: { x: W.x + 2, y: W.y }, modifiers: META }, { wait: 1500 }, // 9 with ⌘
	{ move: E }, { wait: 3500 },                           // → reading
	{ move: R }, { wait: 2500 },                           // 10
];

(async () => { try {
	await until(() => P().visible && P().ready);
	await sleep(300);
	const p1 = P();
	log(`visible=${p1.visible} path=${p1.path} ready=${p1.ready} height>80=${p1.height >= 80} focus-kept=${view.contentDOM.contains(document.activeElement)}`);

	await until(() => !P().visible);
	log(`hidden=${!P().visible}`);
	await until(() => P().src === 'about:blank', 40000);
	log(`blanked=${P().src === 'about:blank'} one-frame=${document.querySelectorAll('clew-link-preview').length === 1 && document.querySelectorAll('clew-link-preview iframe').length === 1}`);

	await until(() => P().visible && P().label?.includes('The guide') && P().ready);
	log(`section label=${JSON.stringify(P().label)} ready=${P().ready}`);
	await until(() => P().card);
	log(`card=${JSON.stringify(P().card)}`);

	await until(() => !P().visible);
	await sleep(1300);
	log(`external none=${!P().visible}`);
	await sleep(1400);
	log(`url none=${!P().visible}`);

	await until(() => P().visible);
	await until(() => !P().visible);
	log(`escape hidden=${!P().visible}`);
	workspaceStore.setTabMode(tab.id, 'source');

	await until(() => P().visible);
	log(`source visible=${P().visible} path=${P().path}`);
	settingsStore.set('linkPreview', 'mod');
	await until(() => !P().visible);
	workspaceStore.setTabMode(tab.id, 'live');
	await sleep(2600);
	log(`mod-plain none=${!P().visible}`);
	await until(() => P().visible);
	log(`mod-held visible=${P().visible}`);

	await until(() => !P().visible);
	settingsStore.set('linkPreview', 'hover');
	workspaceStore.setTabMode(tab.id, 'reading');
	await until(() => P().visible, 9000);
	const frame = document.querySelector('clew-preview-view iframe')?.getBoundingClientRect();
	const box = document.querySelector('clew-link-preview').getBoundingClientRect();
	log(`reading visible=${P().visible} label=${JSON.stringify(P().label)} over-frame=${Boolean(frame) && box.top >= frame.top && box.left >= frame.left - 1}`);
	await until(() => P().ready);
} catch (err) { log('ERROR ' + err.stack); } })();
