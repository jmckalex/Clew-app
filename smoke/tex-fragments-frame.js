// Inside the preview for tex-fragments-scenario.js: wait for the figures,
// then report what each block became and — the point of the exercise —
// WHICH preamble text reached it.
//
// The text is readable two ways, because the insertion point differs by
// kind: a ```latex or ```tex block carries it in the element's own source
// (the element's text is the document the engine will typeset), while a
// ```tikz picture carries it in data-preamble, which is where the library's
// own wrapper reads it from. Both are reported.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = Date.now() + 150000;
let pending = -1;
while (Date.now() < deadline) {
	pending = window.__clewFiguresPending?.() ?? -1;
	if (pending === 0) break;
	await sleep(500);
}
console.log('smoke-frag-frame: pending=' + pending
	+ ' figures=' + document.querySelectorAll('tikz-diagram, metapost-diagram').length
	+ ' refused=' + document.querySelectorAll('.clew-figure-refused').length);

// Each h2 in the fixture owns the block under it.
for (const heading of document.querySelectorAll('h2')) {
	let el = heading.nextElementSibling;
	while (el && !el.matches('tikz-diagram, metapost-diagram, .clew-figure-refused, h2')) el = el.nextElementSibling;
	if (!el || el.tagName === 'H2') { console.log('smoke-frag-frame: ' + JSON.stringify(heading.textContent) + ' NOTHING'); continue; }
	const title = JSON.stringify(heading.textContent);
	if (el.classList.contains('clew-figure-refused')) {
		console.log('smoke-frag-frame: ' + title + ' refused=' + JSON.stringify(el.textContent.slice(0, 120)));
		continue;
	}
	const svg = el.querySelector('svg');
	// The source the library was handed: everything before the figure it
	// built (the library appends its <figure> to the element).
	const source = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
	// VAULTFRAG2 before VAULTFRAG: phase three's edit is the difference
	// between them, and the first is a prefix of the second.
	const marks = ['GLOBALFRAG', 'VAULTFRAG2', 'VAULTFRAG', 'PLAINFRAG', 'mathbb{R}', 'mathbf{R}', 'definecolor', 'mathtools']
		.filter((m) => source.includes(m) || (el.dataset.preamble ?? '').includes(m));
	// A figure that HAS typeset no longer holds its source in the DOM (the
	// library replaced the element's content with the SVG), so `in` is empty
	// for a successful ```latex block and the documents themselves are read
	// from <vault>/.clew/cache/html/<hash>.html. A tikz figure's fragments
	// ride in data-preamble, which survives.
	console.log('smoke-frag-frame: ' + title
		+ ' state=' + (el.querySelector('.mpw-figure')?.className.replace('mpw-figure ', '') ?? 'NONE')
		+ ' paths=' + el.querySelectorAll('svg path').length
		+ ' text=' + el.querySelectorAll('svg text').length
		+ ' size=' + (svg ? Math.round(svg.getBoundingClientRect().width) + 'x' + Math.round(svg.getBoundingClientRect().height) : 'none')
		+ ' in=' + JSON.stringify(marks)
		+ ' preamble=' + JSON.stringify((el.dataset.preamble ?? '').slice(0, 140))
		+ ' error=' + JSON.stringify(el.querySelector('.mpw-console')?.textContent.slice(0, 120) ?? null));
}
