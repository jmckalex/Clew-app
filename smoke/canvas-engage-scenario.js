// An ENGAGED canvas node (double-clicked: its content owns the pointer)
// draws no resize handles or connection anchors, and its ring shows on a
// COLOURED node too — the selected style used to outrank it there. Real
// input over the fixture from make-canvas-vault.mjs:
//
//   node smoke/make-canvas-vault.mjs /tmp/canvas-vault
//
// Expect, card `a` (coloured) then card `b` (plain):
//   click a      → `selected handles=8 anchors=4`
//   triple-click → `engaged handles=0 anchors=0 ring=3px accent=true`
//                  (a triple click is the harness's double click: the
//                  second press is the dblclick that engages)
//   click b      → `moved a-engaged=false b-selected=true handles=8 anchors=4`
//   triple-click → `plain engaged handles=0 anchors=0 ring=3px`
// Every observation waits for its condition; input starts only after this
// script returns.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
const log = (s) => console.log('smoke-ce: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};

workspaceStore.openCanvas('Board.canvas', { newTab: true });
const card = (id) => document.querySelector(`.canvas-view .canvas-node[data-id="${id}"]`);
await until(() => card('a') && card('b'));
await sleep(800); // the camera settles and the cards' previews load
const centre = (id) => {
	const r = card(id).getBoundingClientRect();
	return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
};
const overlay = () => document.querySelector('.canvas-view .canvas-overlay');
const counts = () => `handles=${overlay().querySelectorAll('.canvas-handle').length}`
	+ ` anchors=${overlay().querySelectorAll('.canvas-anchor').length}`;
// The engaged ring is `0 0 0 3px <accent at 45%>`; computed, the colour
// comes first and the lengths after.
const ring = (id) => {
	const shadow = getComputedStyle(card(id)).boxShadow;
	return (/ 0px 0px 0px (\d+px)/.exec(shadow) ?? [])[1] ?? 'none';
};
const accent = getComputedStyle(document.body).getPropertyValue('--clew-accent').trim();
log(`fixture a-colour=${card('a').dataset.color ?? 'none'} b-colour=${card('b').dataset.color ?? 'none'} accent=${accent}`);

const a = centre('a');
const b = centre('b');
window.__clewSmokeInput = [
	{ click: a }, { wait: 900 },
	{ tripleClick: a }, { wait: 1200 },
	{ click: b }, { wait: 900 },
	{ tripleClick: b }, { wait: 1200 },
];

(async () => {
	const is = (id, cls) => card(id)?.classList.contains(cls);
	if (!await until(() => is('a', 'is-selected'))) return log('selected TIMEOUT');
	await sleep(150);
	log(`selected ${counts()}`);
	if (!await until(() => is('a', 'is-engaged'))) return log('engaged TIMEOUT');
	await sleep(150);
	const shadow = getComputedStyle(card('a')).boxShadow;
	log(`engaged ${counts()} ring=${ring('a')} accent=${shadow.includes('0px 0px 0px 3px') && !shadow.includes('0px 0px 0px 2px')}`);
	if (!await until(() => !is('a', 'is-engaged') && is('b', 'is-selected'))) return log('moved TIMEOUT');
	await sleep(150);
	log(`moved a-engaged=${is('a', 'is-engaged')} b-selected=${is('b', 'is-selected')} ${counts()}`);
	if (!await until(() => is('b', 'is-engaged'))) return log('plain TIMEOUT');
	await sleep(150);
	log(`plain engaged ${counts()} ring=${ring('b')}`);
})();
