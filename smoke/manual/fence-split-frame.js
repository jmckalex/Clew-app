// The reading pane of fence-split.js: wait for the figures, then scroll to
// the show=both block's code (the first pre holding the triangle's \\draw).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = Date.now() + 120000;
let pending = -1;
while (Date.now() < deadline) {
	pending = window.__clewFiguresPending?.() ?? -1;
	if (pending === 0) break;
	await sleep(500);
}
const pre = [...document.querySelectorAll('pre')].find((x) => x.textContent.includes('fill=blue!10'));
pre?.scrollIntoView({ block: 'start' });
window.scrollBy(0, -28);
console.log('smoke-manual: pending=' + pending + ' scrolled-to-pre=' + !!pre);
