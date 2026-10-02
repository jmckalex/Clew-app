// Reading view's half of custom-callout-scenario.js: the same fields.
const iconOf = (svg) => (svg ? `${svg.getAttribute('viewBox')}|${svg.querySelector('path')?.getAttribute('d').slice(0, 24)}` : 'none');
[...document.querySelectorAll('.callout')].forEach((c, n) => {
	const cs = getComputedStyle(c);
	const head = c.querySelector('.callout-title');
	const inner = c.querySelector('.callout-title-inner');
	console.log(`smoke-cc-read: ${n} title=${JSON.stringify(inner?.textContent.trim())} border=${cs.borderLeftColor} bg=${cs.backgroundColor}`
		+ ` accent=${getComputedStyle(head.querySelector('svg') ?? head).color} title-color=${getComputedStyle(inner).color}`
		+ ` icon=${iconOf(head.querySelector('svg'))} folded=${c.tagName === 'DETAILS' && !c.open}`);
});
console.log(`smoke-cc-read: style-urls=${[...document.querySelectorAll('[style]')].filter((el) => /url\(/i.test(el.getAttribute('style'))).length}`);
console.log(`smoke-cc-read: theme=${document.documentElement.dataset.theme ?? 'dark'}`);
