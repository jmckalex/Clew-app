// Runs inside the preview iframe for figures-scenario.js: waits for the
// figures to settle, then reports what each one actually rendered.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// window.__clewFiguresPending is the preview client's own readiness count
// (client.js), the one print-pdf.js polls. Give the engines a generous
// window: a cold first figure loads the wasm and its TeX files.
const deadline = Date.now() + 40000;
let pending = -1;
while (Date.now() < deadline) {
	pending = window.__clewFiguresPending?.() ?? -1;
	if (pending === 0) break;
	await sleep(500);
}
console.log('smoke-figures-frame: pending=' + pending
	+ ' waited=' + Math.round((40000 - (deadline - Date.now())) / 100) / 10 + 's');

for (const el of document.querySelectorAll('tikz-diagram, metapost-diagram')) {
	const host = el.querySelector('.mpw-figure');
	const svgs = el.querySelectorAll('svg');
	const box = svgs[0]?.getBoundingClientRect();
	console.log('smoke-figures-frame: ' + el.tagName.toLowerCase()
		+ ' key=' + el.dataset.figKey
		+ ' state=' + (host ? host.className.replace('mpw-figure ', '') : 'NO-HOST')
		+ ' svgs=' + svgs.length
		+ ' paths=' + el.querySelectorAll('svg path').length
		+ ' size=' + (box ? Math.round(box.width) + 'x' + Math.round(box.height) : 'none')
		// the SVG's own box, in pt: the crop the engines chose, before CSS sizing
		+ ' viewBox=' + JSON.stringify(svgs[0]?.getAttribute('viewBox') ?? null)
		+ ' error=' + JSON.stringify(el.querySelector('.mpw-console')?.textContent.slice(0, 300) ?? null));
}

// The result cache, probed rather than assumed: the same request twice must
// report `from=cache` the second time, and on a SECOND app run over the same
// CLEW_USER_DATA the FIRST call must already say cache (IndexedDB is per
// origin, so it outlives the window). A run that logs `from=engine` twice has
// no cache — which is how a failed IndexedDB open shows up.
const probe = { kind: 'tikz', source: '\\draw (0,0) circle (1);', attrs: {} };
try {
	const a = await window.mpTikzWasm.render(probe);
	const b = await window.mpTikzWasm.render(probe);
	console.log('smoke-figures-frame: cache-probe first=' + a.from + ' second=' + b.from
		+ ' hash=' + a.hash + ' ok=' + a.ok);
} catch (err) {
	console.log('smoke-figures-frame: cache-probe FAILED ' + (err?.message ?? err));
}
