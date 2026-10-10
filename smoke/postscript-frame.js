// postscript-scenario.js's frame: waits for the figures to settle, then says
// what each one drew — the colours in it (a PostScript picture lost is a
// picture with none of its colours), whether anything is turned, and the
// faces it embeds (Families.md).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = Date.now() + 120000;
let pending = -1;
while (Date.now() < deadline) {
	pending = window.__clewFiguresPending?.() ?? -1;
	if (pending === 0) break;
	await sleep(250);
}
// When the last figure settled, counted from the preview's own load (a cold
// page: the engines, Ghostscript, a named family's files and their parse).
console.log(`smoke-ps-frame: pending=${pending} settled-at=${(performance.now() / 1000).toFixed(2)}s`);

/** Every colour an SVG paints with, as rgb() strings, deduplicated. */
function colours(svg) {
	const seen = new Set();
	for (const el of svg.querySelectorAll('*')) {
		const style = getComputedStyle(el);
		for (const value of [el.getAttribute('fill'), el.getAttribute('stroke'), style.fill, style.stroke]) {
			if (!value || value === 'none' || value.startsWith('url(')) continue;
			const probe = document.createElement('span');
			probe.style.color = value;
			document.body.append(probe);
			const rgb = getComputedStyle(probe).color;
			probe.remove();
			if (rgb && rgb !== 'rgb(0, 0, 0)' && rgb !== 'rgba(0, 0, 0, 0)') seen.add(rgb);
		}
	}
	return [...seen].sort();
}

/** Is anything turned — a rotate(), or a matrix with a shear/rotation part? */
function rotated(svg) {
	return [...svg.querySelectorAll('[transform]')].some((el) => {
		const t = el.getAttribute('transform');
		if (/rotate\(\s*-?[1-9]/.test(t)) return true;
		const m = /matrix\(\s*([^,\s]+)[,\s]+([^,\s]+)[,\s]+([^,\s]+)/.exec(t);
		return !!m && (Math.abs(Number(m[2])) > 0.01 || Math.abs(Number(m[3])) > 0.01);
	});
}

for (const el of document.querySelectorAll('tikz-diagram, metapost-diagram')) {
	const host = el.querySelector('.mpw-figure');
	const svg = el.querySelector('svg');
	const faces = svg ? [...svg.querySelectorAll('style')].map((s) => s.textContent).join('').match(/@font-face/g)?.length ?? 0 : 0;
	const families = svg ? [...new Set([...svg.querySelectorAll('text, tspan')].map((t) => getComputedStyle(t).fontFamily))] : [];
	console.log(`smoke-ps-frame: ${el.tagName.toLowerCase()} state=${host ? host.className.replace('mpw-figure ', '') : 'NO-HOST'}`
		+ ` paths=${el.querySelectorAll('svg path').length} colours=${JSON.stringify(svg ? colours(svg) : [])}`
		+ ` rotated=${svg ? rotated(svg) : false} fontfaces=${faces} families=${JSON.stringify(families)}`
		+ ` error=${JSON.stringify(el.querySelector('.mpw-console')?.textContent.slice(0, 240) ?? null)}`);
}
