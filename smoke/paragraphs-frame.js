// paragraphs-scenario.js's reading-view half: each paragraph's first words,
// its first-line indent and the space above it, as the document lays it out.
const rows = [...document.querySelectorAll('p')].filter((p) => !p.closest('.clew-sidenote')).map((p) => {
	const cs = getComputedStyle(p);
	const prev = p.previousElementSibling;
	const gap = prev ? Math.round(p.getBoundingClientRect().top - prev.getBoundingClientRect().bottom) : null;
	return `${p.textContent.trim().split(/\s+/).slice(0, 2).join(' ')}|indent=${Math.round(parseFloat(cs.textIndent))}|gap=${gap}${p.classList.contains('jmd-continued') ? '|continued' : ''}`;
});
// Each quote: its gap to the text above and below, and how it is joined.
const quotes = [...document.querySelectorAll('blockquote')].map((q) => {
	const r = q.getBoundingClientRect();
	const above = q.previousElementSibling?.getBoundingClientRect();
	const below = q.nextElementSibling?.getBoundingClientRect();
	const inner = q.firstElementChild?.getBoundingClientRect();
	const innerLast = q.lastElementChild?.getBoundingClientRect();
	const joined = [...q.classList].filter((c) => c.startsWith('jmd-joined-')).map((c) => c.slice(11)).join('+') || 'none';
	return `${q.textContent.trim().split(/\s+/).slice(0, 2).join(' ')}|joined=${joined}|above=${above ? Math.round(inner.top - above.bottom) : null}|below=${below ? Math.round(below.top - innerLast.bottom) : null}`;
});
console.log(`smoke-paragraphs-frame: quotes ${JSON.stringify(quotes)}`);
console.log(`smoke-paragraphs-frame: style=${document.documentElement.dataset.paragraphs} ${JSON.stringify(rows)}`);
