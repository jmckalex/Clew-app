await new Promise((r) => setTimeout(r, 700));
for (const el of document.querySelectorAll('.internal-embed')) {
	const cs = getComputedStyle(el);
	console.log('smoke-chrome-frame: ' + el.tagName
		+ ' class=' + JSON.stringify(el.className)
		+ ' title=' + JSON.stringify(el.querySelector('.embed-title')?.textContent.trim() ?? null)
		+ ' stripe=' + cs.borderLeftWidth + ' box=' + cs.borderTopWidth
		+ ' radius=' + cs.borderTopLeftRadius + ' padLeft=' + cs.paddingLeft);
}
// The seam test: a bare embed's first block must sit where the same block
// written inline sits, and the prose after it must follow at the same distance.
const firstOf = (h) => {
	const next = h.nextElementSibling;
	return next?.classList?.contains('internal-embed')
		? next.querySelector('.embed-content > *') : next;
};
for (const h of document.querySelectorAll('h2')) {
	const inner = firstOf(h);
	if (!inner) continue;
	console.log('smoke-chrome-frame: gap-above ' + JSON.stringify(h.textContent.slice(0, 22))
		+ ' = ' + Math.round(inner.getBoundingClientRect().top - h.getBoundingClientRect().bottom));
}
for (const p of [...document.querySelectorAll('p')].filter((x) => /read as one flow/.test(x.textContent))) {
	const prev = p.previousElementSibling;
	const above = prev?.classList?.contains('internal-embed')
		? prev.querySelector('.embed-content > :last-child') : prev;
	console.log('smoke-chrome-frame: gap-below ' + (prev?.className || prev?.tagName)
		+ ' = ' + Math.round(p.getBoundingClientRect().top - above.getBoundingClientRect().bottom));
}
