// Esc and an ENGAGED note card (builtin.js: one press per step — leave the
// engaged node, then clear the selection). Focus is inside the card's
// clew-preview iframe, so the press has to come up from client.js, which
// forwards a bare Esc only when nothing in the document used it. Real input
// over make-canvas-vault.mjs's fixture:
//
//   node smoke/make-canvas-vault.mjs /tmp/canvas-vault
//   … CLEW_SMOKE_FRAME_SCRIPT=smoke/canvas-esc-frame.js CLEW_SMOKE_FRAME_MATCH=vault/
//
// Expect:
//   card a (plain note): `esc-1 engaged=false selected=true` then
//     `esc-2 engaged=false selected=false`
//   card c (one big textarea, the third click lands in it):
//     `field-esc engaged=true` — the field owns its Esc
//   card d (a block whose script preventDefaults Esc):
//     `owner-esc engaged=true` — whatever consumed the press keeps it
// and from the frames, where focus was: `Field.md active=TEXTAREA`,
// `Owner.md active=DIV#esc-owner`.
// Before the fix (at 69ee318) card a said `esc-1 engaged=true` — a bare Esc
// never left the card.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
const log = (s) => console.log('smoke-cx: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
workspaceStore.openCanvas('Board.canvas', { newTab: true });
const card = (id) => document.querySelector(`.canvas-view .canvas-node[data-id="${id}"]`);
await until(() => ['a', 'b', 'c', 'd'].every(card));
await sleep(1200); // the camera settles and the cards' previews load
const centre = (id) => {
	const r = card(id).getBoundingClientRect();
	return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
};
const is = (id, cls) => card(id)?.classList.contains(cls);
const state = (id) => `engaged=${is(id, 'is-engaged')} selected=${is(id, 'is-selected')} active=${document.activeElement?.tagName}`;
const Esc = { combo: { key: 'Escape' } };
// After each triple click (which engages), a SEPARATE click puts the caret
// inside the card: the triple click's last press can reach the canvas before
// the content takes pointer events, leaving focus on the canvas — where Esc
// always worked, and where it would prove nothing here.
const inside = (id) => [{ tripleClick: centre(id) }, { wait: 1000 }, { click: centre(id) }, { wait: 800 }];
window.__clewSmokeInput = [
	{ click: centre('a') }, { wait: 800 },
	...inside('a'),
	Esc, { wait: 1500 },
	Esc, { wait: 1500 },
	{ click: centre('c') }, { wait: 800 },
	...inside('c'),
	Esc, { wait: 1500 },
	{ click: centre('d') }, { wait: 800 },
	...inside('d'),
	Esc, { wait: 1500 },
];
(async () => {
	if (!await until(() => is('a', 'is-engaged'))) return log('a never engaged');
	await sleep(2700); // the triple click's 1000, the click inside, its 800, Esc, then ~800
	log(`esc-1 ${state('a')}`);
	await sleep(1500);
	log(`esc-2 ${state('a')}`);
	if (!await until(() => is('c', 'is-engaged'))) return log('c never engaged');
	await sleep(2700);
	log(`field-esc ${state('c')}`);
	if (!await until(() => is('d', 'is-engaged'))) return log('d never engaged');
	await sleep(2700);
	log(`owner-esc ${state('d')}`);
})();
