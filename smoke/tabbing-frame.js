// Runs INSIDE every preview frame; see tabbing-scenario.js.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(500);
const blocks = [...document.querySelectorAll('.clew-tabbing')];
const near = (a, b) => Math.abs(a - b) <= 1;
const pieces = (block) => [...block.querySelectorAll('.tb-t')];
const find = (block, text) => pieces(block).find((p) => p.textContent.trim() === text);
const L = (el) => el.getBoundingClientRect().left;
const R = (el) => el.getBoundingClientRect().right;
if (location.pathname.includes('__clew_block__')) {
	for (const b of blocks) console.log(`smoke-tb-frame frame ${pieces(b)[0]?.textContent.trim().slice(0, 12)}: laid=${b.classList.contains('tb-laid')}`);
} else if (blocks.length) {
	const log = (s) => console.log('smoke-tb-frame ' + s);
	const block = (id) => document.getElementById(id)?.querySelector('.clew-tabbing');
	let b = block('ruler');
	log(`ruler laid=${b.classList.contains('tb-laid')} tue=${near(L(find(b, '9:00')), L(find(b, '10:00–11:00')))}`
		+ ` lab=${near(L(find(b, 'Lab')), L(find(b, 'Room 12')))} overrun=${near(L(find(b, '14:00')), L(find(b, '10:00–11:00')))}`);
	b = block('margin');
	log(`margin plus=${near(L(find(b, 'body one')), L(find(b, 'xxxx')))} minus=${near(L(find(b, 'end')), L(b))}`);
	b = block('label');
	const sep = parseFloat(getComputedStyle(b).fontSize) * 0.5;
	log(`label ends-before-column=${near(R(find(b, 'Name')), L(find(b, 'Text')) - sep)} text-at-column=${near(L(find(b, 'is right')), L(find(b, 'Text')))}`);
	b = block('right');
	log(`right flush=${near(R(find(b, 'right')), b.getBoundingClientRect().right)}`);
	b = block('push');
	log(`push swapped=${near(L(find(b, 'q')), L(find(b, 'x')))} restored=${near(L(find(b, 'r')), L(find(b, 'B')))}`);
	b = block('latex');
	const [bold, math, italic, a2, bb, c] = pieces(b);
	log(`latex columns=${near(L(bb), L(math)) && near(L(c), L(italic))} bold=${Boolean(bold.querySelector('strong'))}`
		+ ` italic=${Boolean(italic.querySelector('em'))} math=${Boolean(math.querySelector('mjx-container, svg'))}`);
}
