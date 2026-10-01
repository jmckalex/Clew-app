// Each reading frame's citations (bib-reading-scenario.js).
const note = decodeURIComponent(location.pathname.split('/').pop()).replace(/\.html$/, '');
const cites = [...document.querySelectorAll('p')].filter((p) => / here\.$/.test(p.textContent.trim())).map((p) => {
	const span = p.querySelector('[data-bibtex]');
	return span ? span.textContent.replace(/\s+/g, ' ').trim() : p.textContent.replace(/^\w /, '').replace(/ here\.$/, '').trim();
});
console.log(`smoke-br2-frame: ${note} ${JSON.stringify(cites.filter((c) => /Lewis|later|\[/.test(c)))}`);
