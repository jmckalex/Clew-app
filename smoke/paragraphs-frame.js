// paragraphs-scenario.js's reading-view half: each paragraph's first words,
// its first-line indent and the space above it, as the document lays it out.
const rows = [...document.querySelectorAll('p')].filter((p) => !p.closest('.clew-sidenote')).map((p) => {
	const cs = getComputedStyle(p);
	const prev = p.previousElementSibling;
	const gap = prev ? Math.round(p.getBoundingClientRect().top - prev.getBoundingClientRect().bottom) : null;
	return `${p.textContent.trim().split(/\s+/).slice(0, 2).join(' ')}|indent=${Math.round(parseFloat(cs.textIndent))}|gap=${gap}`;
});
console.log(`smoke-paragraphs-frame: style=${document.documentElement.dataset.paragraphs} ${JSON.stringify(rows)}`);
