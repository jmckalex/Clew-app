await new Promise((r) => setTimeout(r, 500));
const h = [...document.querySelectorAll('h2, h3')].find((x) => x.textContent.startsWith('How much frame'));
h?.scrollIntoView({ block: 'start' });
window.scrollBy(0, -28);
console.log('smoke-manual: scrolled-to=' + JSON.stringify(h?.textContent ?? null)
	+ ' embeds=' + document.querySelectorAll('.internal-embed').length);
