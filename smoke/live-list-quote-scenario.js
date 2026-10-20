// A blockquote inside a list item, in live edit as reading view draws it
// (the owner's report, 2026-10-19: in live edit its border stood at the
// note's margin, left of the bullets, and the spaces before its `>` showed).
// Writes its own ListQuote.md into any vault (CLEW_SMOKE_VAULT=<an empty
// folder>, CLEW_SMOKE_LOG=1, CLEW_SMOKE_FRAME_SCRIPT=smoke/live-list-quote-
// frame.js, CLEW_SMOKE_FRAME_MATCH=ListQuote.md). For each quote, px:
//   <name> border-from-item-text=<the border's left edge less the left edge
//          of its item's text: 0 when the quote stands under the text>
//          text-from-border=<its text's start less the border's>
//          colour=<the quote text's colour as one of quote|muted|normal|other>
//          bar=<the border's colour: border (reading view's grey)|quote|other>
// for `bullet` (`* item` then a quote 4 spaces in, as the owner's), `numbered`
// (`1.` then 3), `nested` (an item in an item), `deep` (three levels),
// `tabbed` (an item indented by a tab, its quote by two), `nine` and `ten`
// (`9)` and `10)`, a list of its own: one digit and two), and `top` (no list:
// border-from-item-text is its distance from the margin's text instead).
// Every one 0, as reading view's: a nested item's first line is indented by
// its DRAWN whitespace, its quote and later lines by CSS counting the same
// columns in the font's space (live/columns.js, --le-col); until 2026-10-20 a
// fixed 0.3em made `nested` 2 (Clew-iOS's measure), `deep` 3, `tabbed` 3.
//   nested-cont item-text-aligned=0 ten-cont item-text-aligned=0
//          the nested item's and item ten's text past their first lines
//   item-text-x 46.4,46.4,46.4,51.4,54.4,62.4
//          where each item's text starts (bullet, 1., 9), 10), nested, tabbed):
//          a numbered item's hang counts its number, and its own line never
//          moves for it — the same before the change and after
//   mono col=0.6021em (was 0.25em) border-from-item-text bullet=0 numbered=0 nested=0 deep=0 tabbed=0 nine=0 ten=0 nested-cont=0 ten-cont=0
//   mono item-text-x 46.4,52.9,52.9,62.5,65.7,84.9
//          the same in Menlo, whose space is 0.6em: the column is measured,
//          and so are the digits and `.`/`)` — a numbered item's lines hang
//          by its number's box (columns.js#numberWidth); with a fixed 1.4em,
//          numbered=-6 nine=-6 ten=-16 here and ten=-5 in Avenir Next
//          (Clew-iOS, 2026-10-20)
// Every quote reads as reading view's: colour=muted bar=border (the owner's
// choice, 2026-10-19; source mode's quote green until then).
// Then REAL input: a click in the bullet's quote reveals its `>`, the line
// staying where it is — `revealed=true moved=0`; a click 30px into item
// ten's text puts the caret at `ten-click=8`; a click in item ten's quote
// reveals it in place — `ten-quote revealed=true moved=0`. The tab ends in
// reading view, where the frame script measures the same, nine and ten
// included (smoke-list-quote-frame:).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-list-quote: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};

await ipc.invoke('clew:note-write', { path: 'ListQuote.md', content: [
	'# Quotes in lists',
	'',
	'* I think it would be helpful if you included a quote showing what it means',
	'  for a modeller to be opaque.',
	'* I worry that this demands too much:',
	'    > “What are the success conditions for a model playing the predictive',
	'    > function and why do existing ABMs not meet them?”',
	'',
	'    Taken literally,',
	'',
	'1. A numbered item:',
	'   > a quote in a numbered item',
	'',
	'9) Ninth item:',
	'   > a quote in item nine',
	'',
	'10) Tenth item:',
	'    more of item ten',
	'    > a quote in item ten',
	'',
	'* Outer item',
	'  * Inner item:',
	'    more of the inner item',
	'    > a quote in a nested item',
	'    * Third level:',
	'      > a quote three deep',
	'',
	'* Tab outer',
	'\t* Tab inner:',
	'\t\t> a quote in a tabbed item',
	'',
	'Prose between.',
	'',
	'> A top-level quote.',
	'',
	'End.',
	'',
].join('\n') });
const tab = workspaceStore.openNote('ListQuote.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-quote'));
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.length } });
await sleep(300);

const lines = () => [...view.contentDOM.querySelectorAll('.cm-line')];
const lineWith = (s) => lines().find((l) => l.textContent.includes(s));
// Where a line's visible text starts: the first non-blank character drawn,
// past an item's bullet or number.
const textLeft = (line) => {
	const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const i = n.textContent.search(/\S/);
		if (i < 0 || n.parentElement.closest('.le-bullet, .le-num')) continue;
		const range = document.createRange();
		range.setStart(n, i);
		range.setEnd(n, i + 1);
		const r = range.getBoundingClientRect();
		if (r.width > 0) return r.left;
	}
	return NaN;
};
const textEl = (line) => {
	const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.trim()) return n.parentElement;
	return line;
};
const probe = (cls) => {
	const el = document.createElement('span');
	el.style.color = `var(${cls})`;
	view.contentDOM.append(el);
	const c = getComputedStyle(el).color;
	el.remove();
	return c;
};
const colours = { quote: probe('--clew-quote'), muted: probe('--clew-text-muted'), normal: probe('--clew-text-normal'), border: probe('--clew-border') };
const nameOf = (c) => Object.entries(colours).find(([, v]) => v === c)?.[0] ?? `other(${c})`;
const colourOf = (el) => nameOf(getComputedStyle(el).color);
// The note is taller than the window, and CodeMirror draws only what is in
// view: each pair is measured with its lines scrolled into view.
const show = async (text) => {
	const n = view.state.doc.toString().split('\n').findIndex((l) => l.includes(text)) + 1;
	view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(view.state.doc.line(n).from).top - 120);
	await until(() => lineWith(text), 3000);
	await sleep(50);
};
// A quote's border less its item's text (`top`: less the margin's text).
const quoteOffset = async (q, i) => {
	await show(i ?? 'Prose between.');
	return lineWith(q).getBoundingClientRect().left - textLeft(lineWith(i ?? 'Prose between.'));
};
const measure = async (name, q, i) => {
	const offset = await quoteOffset(q, i);
	const quote = lineWith(q);
	const border = quote.getBoundingClientRect().left;
	log(`${name} border-from-item-text=${Math.round(offset)} text-from-border=${Math.round(textLeft(quote) - border)}`
		+ ` colour=${colourOf(textEl(quote))} bar=${nameOf(getComputedStyle(quote).borderLeftColor)}`);
};
const PAIRS = {
	bullet: ['success conditions', 'I worry that'], numbered: ['a quote in a numbered item', 'A numbered item'],
	nested: ['a quote in a nested item', 'Inner item'], deep: ['a quote three deep', 'Third level'],
	tabbed: ['a quote in a tabbed item', 'Tab inner'], nine: ['a quote in item nine', 'Ninth item'], ten: ['a quote in item ten', 'Tenth item'],
};
for (const [name, [q, i]] of Object.entries(PAIRS)) await measure(name, q, i);
await measure('top', 'A top-level quote', null);
const textOffset = async (a, b) => {
	await show(b);
	return Math.round(textLeft(lineWith(a)) - textLeft(lineWith(b)));
};
log(`after-quote item-text-aligned=${await textOffset('Taken literally', 'I worry that')}`);
const nestedCont = () => textOffset('more of the inner item', 'Inner item');
const tenCont = () => textOffset('more of item ten', 'Tenth item');
log(`nested-cont item-text-aligned=${await nestedCont()} ten-cont item-text-aligned=${await tenCont()}`);
// Where each item's text starts, from the content's edge (px, to 0.1): a
// numbered item's hang counts its number's width, and its own line must not
// move for it.
const itemX = async () => {
	const xs = [];
	for (const s of ['I worry that', 'A numbered item', 'Ninth item', 'Tenth item', 'Inner item', 'Tab inner']) {
		await show(s);
		xs.push((textLeft(lineWith(s)) - view.contentDOM.getBoundingClientRect().left).toFixed(1));
	}
	return xs.join(',');
};
log(`item-text-x ${await itemX()}`);

// The same in a face whose space is not Avenir Next's 0.25em — Menlo's is
// 0.6em: the column is MEASURED (live/columns.js), not assumed. A nested
// item's first line draws its whitespace; its quote and later lines are
// indented by CSS that must agree with it.
const col = () => getComputedStyle(view.scrollDOM).getPropertyValue('--le-col').trim();
const colBefore = col();
document.body.style.setProperty('--clew-editor-font', 'Menlo, monospace');
await until(() => col() && col() !== colBefore, 5000);
await sleep(300);
const mono = [];
for (const [name, [q, i]] of Object.entries(PAIRS)) mono.push(`${name}=${Math.round(await quoteOffset(q, i))}`);
log(`mono col=${col()} (was ${colBefore}) border-from-item-text ${mono.join(' ')} nested-cont=${await nestedCont()} ten-cont=${await tenCont()}`);
log(`mono item-text-x ${await itemX()}`);
document.body.style.removeProperty('--clew-editor-font');
await until(() => col() === colBefore, 5000);
await sleep(300);
view.scrollDOM.scrollTop = 0;
await until(() => lineWith('a quote in item ten'), 3000);
await sleep(100);

// REAL input: click into the bullet's quote — its `>` shows, the line stays
// (revealed=true moved=0); then into item ten's text, 30px past its start —
// the caret's offset in the line (ten-click=…, the same before and after a
// change to the hang) — and into item ten's quote, which reveals in place too.
const r = lineWith('success conditions').getBoundingClientRect();
const before = r.left;
const tenText = lineWith('Tenth item');
const tenY = Math.round(tenText.getBoundingClientRect().top + tenText.getBoundingClientRect().height / 2);
const tq = lineWith('a quote in item ten').getBoundingClientRect();
window.__clewSmokeInput = [
	{ click: { x: Math.round(r.left + 200), y: Math.round(r.top + r.height / 2) } }, { wait: 800 },
	{ click: { x: Math.round(textLeft(tenText) + 30), y: tenY } }, { wait: 800 },
	{ click: { x: Math.round(tq.left + 120), y: Math.round(tq.top + tq.height / 2) } }, { wait: 3000 },
];
const lineOfHead = () => view.state.doc.lineAt(view.state.selection.main.head);
setTimeout(async () => {
	await until(() => lineWith('success conditions')?.textContent.includes('>'), 3000);
	const line = lineWith('success conditions');
	log(`revealed=${line.textContent.includes('>')} moved=${Math.round(line.getBoundingClientRect().left - before)}`);
	await until(() => lineOfHead().text.includes('Tenth item'), 3000);
	log(`ten-click=${view.state.selection.main.head - lineOfHead().from}`);
	await until(() => lineWith('a quote in item ten')?.textContent.includes('>'), 3000);
	const quote = lineWith('a quote in item ten');
	log(`ten-quote revealed=${quote.textContent.includes('>')} moved=${Math.round(quote.getBoundingClientRect().left - tq.left)}`);
	workspaceStore.setTabMode(tab.id, 'reading');
	log('done');
}, 300);
