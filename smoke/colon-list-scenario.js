// "Convert this vault"'s biggest folded list, opened and filled
// (renderer/colon-conversion.js#noteList) — Clew-iOS's candidate 3,
// 2026-10-15: in WebKit, once a <details> holding thousands of children has
// been laid out, each append into it cost 6–9 ms and the relayout after it
// 20–42 ms, so the 4,001-note list took 41–67 s of ~63 ms frames to fill.
// The folds now go into a div of their own inside it. Over `node
// smoke/make-colon-vault.mjs <dir>` (5,000 notes; CLEW_SMOKE_VAULT=<dir>,
// CLEW_SMOKE_LOG=1). `colon-list-cv.txt` in the vault root holding `on` puts
// back the folds' `content-visibility: auto` (main.css's until 2026-10-15)
// for the run, to compare. Logs (smoke-colon-list:):
//   list folds=<the summary's count> direct=<folds that are children of the
//        <details> itself — 0, or the old structure> wrapped=<a .clew-colon-rows
//        holds them>
//   fill ms=<click to the last fold appended> frames n=… median=… p95=… max=…
//        over16=… over50=…
//   scroll px=<scrolled> frames …    the sheet's body scrolled top to bottom,
//        600px a frame, once filled
//   find "<the last fold's path>" offscreen=<true> found=<window.find's answer>
//   cv=<on|off>   whether the folds had content-visibility: auto
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, registry, ipc } = window.__clew;
const log = (s) => console.log('smoke-colon-list: ' + s);
const until = async (test, ms = 600000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(20)) if (test()) return true;
	return false;
};
const sheet = () => document.querySelector('.clew-colon-sheet');
const state = () => sheet()?.dataset.state ?? null;
const stats = (xs) => {
	const s = [...xs].sort((a, b) => a - b);
	const at = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
	return `n=${s.length} median=${at(0.5).toFixed(1)} p95=${at(0.95).toFixed(1)} max=${(s[s.length - 1] ?? 0).toFixed(1)}`
		+ ` over16=${s.filter((x) => x > 16.7).length} over50=${s.filter((x) => x > 50).length}`;
};

for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const cv = await ipc.invoke('clew:note-read', { path: 'colon-list-cv.txt' }).then((r) => String(r?.content ?? r ?? '').trim()).catch(() => '');
if (cv === 'on') {
	const style = document.createElement('style');
	style.textContent = '.clew-colon-note { content-visibility: auto; contain-intrinsic-size: auto 22px; }';
	document.head.append(style);
}
log(`cv=${cv === 'on' ? 'on' : 'off'}`);
registry.runCommand('vault:convert-colons');
await until(() => state() === 'ready');
const folded = [...sheet().querySelectorAll('details.clew-colon-list:not([open])')];
const countOf = (list) => parseInt(list.querySelector('summary').textContent.replace(/,/g, ''), 10);
const list = folded.sort((a, b) => countOf(b) - countOf(a))[0];
if (!list) {
	log('no folded list');
} else {
	const count = countOf(list);
	const folds = () => list.querySelectorAll('details.clew-colon-note').length;
	// The fill: every frame from the click until the last fold is in.
	const dts = [];
	let last = null;
	let done = false;
	const loop = (t) => {
		if (last !== null) dts.push(t - last);
		last = t;
		if (!done) requestAnimationFrame(loop);
	};
	requestAnimationFrame(loop);
	const t0 = performance.now();
	list.querySelector('summary').click();
	await until(() => folds() >= count, 300000);
	const ms = performance.now() - t0;
	done = true;
	const direct = [...list.children].filter((c) => c.matches('details.clew-colon-note')).length;
	log(`list folds=${count} direct=${direct} wrapped=${Boolean(list.querySelector(':scope > .clew-colon-rows > details.clew-colon-note'))}`);
	log(`fill ms=${Math.round(ms)} frames ${stats(dts)}`);
	await sleep(500);

	// The scroll: the sheet's body, top to bottom, 600px a frame.
	const body = sheet().querySelector('.clew-colon-body');
	body.scrollTop = 0;
	await sleep(300);
	const sdts = [];
	let prev = null;
	const start = body.scrollTop;
	await new Promise((resolve) => {
		const step = (t) => {
			if (prev !== null) sdts.push(t - prev);
			prev = t;
			if (body.scrollTop + body.clientHeight >= body.scrollHeight - 1) return resolve();
			body.scrollTop += 600;
			requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	});
	log(`scroll px=${Math.round(body.scrollTop - start)} frames ${stats(sdts)}`);

	// The find: the last fold's path, from the top, where it is off screen.
	body.scrollTop = 0;
	await sleep(300);
	const lastFold = [...list.querySelectorAll('details.clew-colon-note')].pop();
	const path = lastFold.dataset.path;
	const r = lastFold.getBoundingClientRect();
	const b = body.getBoundingClientRect();
	const offscreen = r.top > b.bottom || r.bottom < b.top;
	getSelection().removeAllRanges();
	const found = window.find(path, true, false, true);
	log(`find "${path}" offscreen=${offscreen} found=${found}`);
}
// The sheet stays open for the screenshot (the harness exits hard).
log('done');
