// Wait for every figure on the page (window.__clewFiguresPending is the
// preview client's readiness count), then scroll to the section heading.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = Date.now() + 120000;
let pending = -1;
while (Date.now() < deadline) {
	pending = window.__clewFiguresPending?.() ?? -1;
	if (pending === 0) break;
	await sleep(500);
}
console.log('smoke-manual: pending=' + pending + ' figures=' + document.querySelectorAll('tikz-diagram, metapost-diagram').length);
await sleep(500);
const h = [...document.querySelectorAll('h2')].find((x) => x.textContent.startsWith('Showing the source instead'));
h?.scrollIntoView({ block: 'start' });
window.scrollBy(0, -28);
console.log('smoke-manual: scrolled-to=' + JSON.stringify(h?.textContent ?? null));
