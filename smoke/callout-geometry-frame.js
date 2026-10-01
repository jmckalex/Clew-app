// Reading view's half of callout-geometry-scenario.js: the same keys.
const textRect = (el, needle, k = 0) => {
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const i = n.data.indexOf(needle);
		if (i === -1) continue;
		const range = document.createRange();
		range.setStart(n, i + k); range.setEnd(n, i + k + 1);
		return range.getBoundingClientRect();
	}
	return null;
};
const col = textRect(document.body, 'Before the callouts');
const c = document.querySelector('.callout');
const box = c.getBoundingClientRect();
const icon = c.querySelector('.callout-icon').getBoundingClientRect();
const summary = c.querySelector('summary, .callout-title').getBoundingClientRect();
const title = textRect(c, 'Argument');
const ol = c.querySelector('ol');
const li1 = ol.querySelector('li');
const t1 = textRect(li1, 'Identity research');
const li2 = ol.querySelectorAll('li')[1];
const r2 = document.createRange(); r2.selectNodeContents(li2);
const rects2 = [...r2.getClientRects()].filter((r) => r.width > 0).sort((p, q) => p.top - q.top || p.left - q.left);
const wrap = rects2.find((r) => r.top > rects2[0].top + 4) ?? { left: NaN };
const last = textRect(c, 'that framework.', 14);
const concl = textRect(c, 'Conclusion:');
const lastText = textRect(c, 'personal identity.', 17);
const cs = getComputedStyle(c);
// The marker is li::marker — not measurable; its right edge sits just left of the li.
// The chevron is summary::after — 6px + 2px borders at the summary's end: centre = end − 4.
const f = (v) => Math.round(v);
console.log(`smoke-cg-frame: reading box-left=${f(box.left - col.left)} box-width=${f(box.width)} radius=${cs.borderTopLeftRadius} border=${cs.borderLeftWidth}`
	+ ` pad-top=${f(title.top - box.top)} pad-bottom=${f(box.bottom - lastText.bottom)}`
	+ ` icon-left=${f(icon.left - box.left)} icon=${f(icon.width)} title-left=${f(title.left - box.left)}`
	+ ` chevron-centre=${f(box.right - (summary.right - 4))}`
	+ ` num-left=${f(ol.getBoundingClientRect().left - box.left)}(ol) item-left=${f(t1.left - box.left)} wrap-left=${f(wrap.left - box.left)}`
	+ ` gap=${f(concl.top - last.bottom)} body-left=${f(concl.left - box.left)}`);
