// Inside every preview document at the end of crossref-scenario.js: the
// reading-mode one of Crossrefs.md (the engine's own numbers, in the shape
// the scenario prints Clew's) and the link popover's.
const refs = [...document.querySelectorAll('.xref-ref, .xref-cref')].map((e) => e.textContent);
// Every number the engine printed. Its generated headings (an endnotes
// title, the bibliography's) and `{-}` headings take none since jmarkdown
// b212e82 — before it the generated Endnotes <h1> was numbered and had to be
// left out here, and a mid-note @endnotes shifted every later heading.
const targets = [...document.querySelectorAll('[data-xref-number], .header-label')].map((e) => (e.classList.contains('header-label')
	? `heading:${e.textContent.replace(/\.$/, '')}`
	: `${e.dataset.xrefType}:${e.dataset.xrefNumber}`));
if (SMOKE_FRAME.endsWith('.html')) {
	console.log(`smoke-xr-frame: engine-refs=${JSON.stringify(refs)}`);
	console.log(`smoke-xr-frame: engine-targets=${JSON.stringify(targets)}`);
} else {
	// The popover's document: the previewed theorem, its own lone-fragment
	// "Theorem 1." label hidden (the header carries the real number).
	// (Whichever the last hover previewed: a theorem's "Theorem 1." or an
	// equation's "(1)".)
	const label = document.querySelector('.theorem-label, .eqn-number');
	console.log(`smoke-xr-frame ${SMOKE_FRAME.slice(0, 6)}: previewed=${label?.className ?? 'none'} frame-label-hidden=${Boolean(label) && getComputedStyle(label).display === 'none'}`);
}
