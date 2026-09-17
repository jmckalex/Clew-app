// Inside the preview for fonts-scenario.js: wait for the figures, then report
// how each one was drawn — text or outlines, and which faces it embeds.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = Date.now() + 150000;
let pending = -1;
while (Date.now() < deadline) {
	pending = window.__clewFiguresPending?.() ?? -1;
	if (pending === 0) break;
	await sleep(500);
}
const loader = document.querySelector('script[src*="auto.js"]');
// Cold-page cost: when the last figure settled, counted from the preview
// document's own load. What the engines fetched is NOT visible here — they
// run in a Worker, whose requests never reach this document's resource
// timings — so protocol.js counts them under CLEW_SMOKE_LOG instead
// (`smoke-asset:` lines; grep -c 'bundles/opentype' the run's log).
console.log('smoke-fonts-frame: pending=' + pending + ' loader bundles=' + JSON.stringify(loader?.dataset.bundles ?? null)
	+ ' marked=' + document.querySelectorAll('[data-opentype]').length
	+ ' settled-at=' + (performance.now() / 1000).toFixed(1) + 's');
for (const el of document.querySelectorAll('tikz-diagram, metapost-diagram, div[data-opentype]')) {
	const svg = el.querySelector('svg');
	const style = svg?.querySelector('style')?.textContent ?? '';
	const families = [...style.matchAll(/font-family:\s*"?([^;"}]+)/g)].map((m) => m[1].trim());
	const heading = el.previousElementSibling?.closest('h2') ?? el.parentElement?.previousElementSibling;
	console.log('smoke-fonts-frame: ' + (el.dataset.opentype ? 'opentype' : 'control')
		+ ' engine=' + (el.dataset.engine ?? 'auto') + ' fonts=' + (el.dataset.fonts ?? 'paths')
		+ ' state=' + (el.querySelector('.mpw-figure')?.className.replace('mpw-figure ', '') ?? 'NONE')
		+ ' text=' + el.querySelectorAll('svg text').length
		+ ' paths=' + el.querySelectorAll('svg path').length
		+ ' fontfaces=' + (style.match(/@font-face/g) ?? []).length
		+ ' families=' + JSON.stringify([...new Set(families)].slice(0, 6))
		+ ' woff2=' + /woff2/.test(style)
		+ ' size=' + (svg ? Math.round(svg.getBoundingClientRect().width) + 'x' + Math.round(svg.getBoundingClientRect().height) : 'none')
		+ ' error=' + JSON.stringify(el.querySelector('.mpw-console')?.textContent.slice(0, 200) ?? null));
}
