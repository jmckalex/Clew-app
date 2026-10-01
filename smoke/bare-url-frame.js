// Reading view's half of bare-url-scenario.js: each keyed block's italics
// and links, in the scenario's format.
const fmt = (el) => {
	const em = [...el.querySelectorAll('em')].map((e) => e.textContent);
	// Not the footnote's own back-reference arrows.
	const links = [...el.querySelectorAll('a[href]')].filter((a) => !/^#/.test(a.getAttribute('href')))
		.map((a) => `${a.textContent}→${a.getAttribute('href')}`);
	return `em=${JSON.stringify(em)} links=${JSON.stringify(links)}`;
};
const blocks = [...document.querySelectorAll('p, li')];
for (let k = 1; k <= 22; k++) {
	const key = `K${k}`;
	if (k === 21) {
		const cells = [...document.querySelectorAll('td')];
		const holder = document.createElement('div');
		for (const td of cells) holder.append(td.cloneNode(true));
		console.log(`smoke-url-read: ${key} ${cells.length ? fmt(holder) : 'MISSING'}`);
		continue;
	}
	if (k === 22) {
		// The footnote's own text, wherever the engine puts it.
		const note = [...document.querySelectorAll('li, aside, .footnote, [id^="fn"]')].find((el) => el.textContent.includes('inside.'));
		console.log(`smoke-url-read: ${key} ${note ? fmt(note) : 'MISSING'}`);
		continue;
	}
	const el = k === 18
		? blocks.find((b) => b.textContent.includes('at the start and at the end'))
		: blocks.find((b) => b.textContent.includes(`${key}:`));
	console.log(`smoke-url-read: ${key} ${el ? fmt(el) : 'MISSING'}`);
}
console.log(`smoke-url-read: reveal-frame=${Boolean(document.querySelector('iframe[src*="localhost:8888"]'))}`);
