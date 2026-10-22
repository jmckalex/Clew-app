// Reading view's half of live-list-quote-scenario.js: each blockquote's left
// edge against its list item's text, its text against its edge, and its
// colour (smoke-list-quote-frame:).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => console.log('smoke-list-quote-frame: ' + s);
for (let i = 0; i < 200 && !document.querySelector('blockquote'); i++) await sleep(50);
const textLeft = (el) => {
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const i = n.textContent.search(/\S/);
		if (i < 0) continue;
		const range = document.createRange();
		range.setStart(n, i);
		range.setEnd(n, i + 1);
		const r = range.getBoundingClientRect();
		if (r.width > 0) return r.left;
	}
	return NaN;
};
const named = (s) => [...document.querySelectorAll('blockquote')].find((b) => b.textContent.includes(s));
const top = getComputedStyle(document.body).color;
for (const [name, s] of [['bullet', 'How many of the parts'], ['numbered', 'numbered item'], ['nested', 'nested item'], ['deep', 'three deep'], ['tabbed', 'tabbed item'], ['nine', 'item nine'], ['ten', 'item ten'], ['top', 'top-level']]) {
	const quote = named(s);
	const item = quote?.closest('li');
	const border = quote.getBoundingClientRect().left;
	const itemText = item ? textLeft(item) : textLeft([...document.querySelectorAll('p')].find((p) => p.textContent.includes('Prose between')));
	log(`${name} border-from-item-text=${Math.round(border - itemText)} text-from-border=${Math.round(textLeft(quote) - border)}`
		+ ` colour=${getComputedStyle(quote).color === top ? 'normal' : getComputedStyle(quote).color} bar=${getComputedStyle(quote).borderLeftColor}`);
}
