// The reading-mode half of sidenotes-scenario.js, inside the preview.
const measure = () => {
	const refs = [...document.querySelectorAll('sup.footnote-ref a')];
	return [...document.querySelectorAll('.clew-sidenote')].map((n) => {
		const r = n.getBoundingClientRect();
		const ref = refs.find((a) => a.getAttribute('href') === `#${n.dataset.for}`);
		return { top: r.top, bottom: r.bottom, shift: Number(n.dataset.shift), ref: ref?.getBoundingClientRect().top };
	});
};
const m = measure();
const aligned = m.filter((s) => s.shift === 0).every((s) => Math.abs(s.top - s.ref) <= 2);
const i = m.findIndex((s) => s.shift > 0);
const endList = document.querySelector('section.footnotes');
console.log(`smoke-sn-frame: reading sidenotes=${m.length} aligned=${aligned} collision-resolved=${i > 0 && m[i].top >= m[i - 1].bottom + 7} end-list-hidden=${endList ? getComputedStyle(endList).display === 'none' : 'no-list'}`);
// Narrow: the body given the whole width leaves no margin.
document.body.style.maxWidth = 'none';
window.dispatchEvent(new Event('resize'));
await new Promise((r) => setTimeout(r, 300));
console.log(`smoke-sn-frame: narrow sidenotes=${document.querySelectorAll('.clew-sidenote').length} end-list-visible=${endList ? getComputedStyle(endList).display !== 'none' : 'no-list'}`);
