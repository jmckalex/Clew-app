// The quieter page navigator (preview-client/pdf-quiet-nav.js; the owner's
// ask, 2026-10-03) — EmbedPDF's "‹ 2 18 ›" pill. Over `node
// smoke/make-pdf-link-vault.mjs <dir> live single` (Papers/Five.pdf, five
// pages), the PDF in a tab and REAL input: a rest, three wheel ticks over
// the page, a move into the band just above the pill, a move onto it, a
// move far away; then the focus put in its page field and taken out. The
// pill's opacity is polled throughout (the viewer's `test-nav` hook) and
// every change is logged with the phase it fell in:
//   `nav: <phase> t=<ms> opacity=<o> focused=<bool>`
// then one line per phase with the opacity it ENDED on:
//   `nav-phases: rest=0 scroll=0 band=1 on=1 click=1 away=0 focus=1 blur=0`
// plus `nav: page before=1 after=3` (the click turned the page) and, for a
// touch screen, `nav: tap-band opacity=1 tap-elsewhere opacity=0`.
// (what the owner asked for; EmbedPDF's own behaviour shows scroll=1 and
// away=1 — it hides four seconds after the last scroll or leave).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
const log = (s) => console.log('smoke-nav: ' + s);
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};
const PDF = 'Papers/Five.pdf';
workspaceStore.openFile(PDF);
const frame = () => [...document.querySelectorAll('clew-file-view')].find((v) => v.path === PDF)?.querySelector('iframe.pdf-frame');
let seq = 0;
const ask = (extra = {}) => new Promise((resolve) => {
	const win = frame()?.contentWindow;
	if (!win) { resolve(null); return; }
	const requestId = ++seq;
	const on = (e) => {
		if (e.source !== win || e.data?.type !== 'test-nav' || e.data.requestId !== requestId) return;
		window.removeEventListener('message', on);
		resolve(e.data);
	};
	window.addEventListener('message', on);
	win.postMessage({ source: 'clew-pdf-host', type: 'test-nav', requestId, ...extra }, '*');
	setTimeout(() => { window.removeEventListener('message', on); resolve(null); }, 2000);
});
await until(async () => (await ask())?.rect?.width > 0, 20000);
await sleep(1500);
const first = await ask();
const f = frame().getBoundingClientRect();
const pill = { x: f.left + first.rect.x + first.rect.width / 2, y: f.top + first.rect.y + first.rect.height / 2 };
const page = { x: Math.round(f.left + f.width / 2), y: Math.round(f.top + f.height * 0.4) };
log(`pill: at=${Math.round(pill.x)},${Math.round(pill.y)} size=${Math.round(first.rect.width)}x${Math.round(first.rect.height)} opacity=${first.opacity}`);
// Phases, each a wait long enough to show where it settles (EmbedPDF's own
// hide timer is 4 s; ours fades 0.7 s after leaving).
const PHASES = [
	['rest', [{ move: page }, { wait: 1500 }]],
	['scroll', [{ wheel: { ...page, deltaY: 120 } }, { wait: 120 }, { wheel: { ...page, deltaY: 120 } }, { wait: 120 }, { wheel: { ...page, deltaY: 120 } }, { wait: 1500 }]],
	['band', [{ move: { x: Math.round(pill.x + 40), y: Math.round(pill.y - first.rect.height / 2 - 30) } }, { wait: 1500 }]],
	['on', [{ move: { x: Math.round(pill.x), y: Math.round(pill.y) } }, { wait: 1200 }]],
	// A real click on its own "›" (the right end): the page turns — a scroll
	// — and the pill stays, under the pointer.
	['click', [{ click: { x: Math.round(pill.x + first.rect.width / 2 - 20), y: Math.round(pill.y) } }, { wait: 1200 }]],
	['away', [{ move: { x: page.x, y: Math.round(f.top + 40) } }, { wait: 2000 }]],
];
window.__clewSmokeInput = PHASES.flatMap(([, evs]) => evs).concat([{ wait: 6000 }]);
const spans = [];
let at = 0;
for (const [name, evs] of PHASES) {
	const len = evs.reduce((n, e) => n + (e.wait ?? 0), 0);
	spans.push({ name, from: at, to: at + len });
	at += len;
}
(async () => {
	const pageNow = () => new Promise((resolve) => {
		const win = frame()?.contentWindow;
		const id = 7000 + seq++;
		const on = (e) => { if (e.source === win && e.data?.type === 'pdf-current-page' && e.data.requestId === id) { window.removeEventListener('message', on); resolve(e.data.page); } };
		window.addEventListener('message', on);
		win.postMessage({ source: 'clew-pdf-host', type: 'pdf-current-page', requestId: id }, '*');
		setTimeout(() => { window.removeEventListener('message', on); resolve(null); }, 2000);
	});
	const pageBefore = await pageNow();
	let pageAfterClick = null;
	const t0 = Date.now();
	const ended = {};
	let last = null;
	const phaseAt = (t) => spans.find((s) => t >= s.from && t < s.to)?.name ?? 'after';
	while (Date.now() - t0 < at + 300) {
		const s = await ask();
		const t = Date.now() - t0;
		const o = s ? Math.round(s.opacity * 100) / 100 : null;
		const key = `${o}/${s?.focused}`;
		if (key !== last) { log(`nav: ${phaseAt(t)} t=${t} opacity=${o} focused=${s?.focused}`); last = key; }
		ended[phaseAt(t)] = o;
		if (phaseAt(t) === 'click' && t > spans.find((x) => x.name === 'click').to - 400 && pageAfterClick === null) pageAfterClick = await pageNow();
		await sleep(80);
	}
	// The keyboard: the focus into the page field, then out.
	await ask({ focus: true });
	await sleep(600);
	const focus = await ask();
	log(`nav: focus opacity=${focus?.opacity} focused=${focus?.focused}`);
	await ask({ blur: true });
	await sleep(1400);
	const blur = await ask();
	log(`nav: blur opacity=${blur?.opacity} focused=${blur?.focused}`);
	// A touch screen has no hover: a TAP in the band shows it, a tap
	// elsewhere hides it (synthetic touch pointerdowns — the harness has none).
	const inFrame = { x: first.rect.x + first.rect.width / 2, y: first.rect.y - 20 };
	await ask({ tap: inFrame });
	await sleep(500);
	const tapIn = await ask();
	await ask({ tap: { x: inFrame.x, y: 60 } });
	await sleep(500);
	const tapOut = await ask();
	log(`nav: tap-band opacity=${tapIn?.opacity} tap-elsewhere opacity=${tapOut?.opacity}`);
	log(`nav: page before=${pageBefore} after=${pageAfterClick}`);
	log(`nav-phases: ${spans.map((s) => `${s.name}=${Math.round(ended[s.name] ?? -1)}`).join(' ')} focus=${Math.round(focus?.opacity ?? -1)} blur=${Math.round(blur?.opacity ?? -1)}`);
})();
