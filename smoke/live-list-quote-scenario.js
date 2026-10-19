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
// (`1.` then 3), `nested` (an item in an item), and `top` (no list:
// border-from-item-text is its distance from the margin's text instead).
// Every quote reads as reading view's: colour=muted bar=border (the owner's
// choice, 2026-10-19; source mode's quote green until then).
// Then REAL input: a click in the bullet's quote reveals its `>`, the line
// staying where it is — `revealed=true moved=0`. The tab ends in reading
// view, where the frame script measures the same (smoke-list-quote-frame:).
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
	'* Outer item',
	'  * Inner item:',
	'    > a quote in a nested item',
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
const measure = (name, quote, item) => {
	const border = quote.getBoundingClientRect().left;
	const itemText = item ? textLeft(item) : textLeft(lineWith('Prose between.'));
	log(`${name} border-from-item-text=${Math.round(border - itemText)} text-from-border=${Math.round(textLeft(quote) - border)}`
		+ ` colour=${colourOf(textEl(quote))} bar=${nameOf(getComputedStyle(quote).borderLeftColor)}`);
};
const bulletQuote = lineWith('success conditions');
measure('bullet', bulletQuote, lineWith('I worry that'));
measure('numbered', lineWith('a quote in a numbered item'), lineWith('A numbered item'));
measure('nested', lineWith('a quote in a nested item'), lineWith('Inner item'));
measure('top', lineWith('A top-level quote'), null);
log(`after-quote item-text-aligned=${Math.round(textLeft(lineWith('Taken literally')) - textLeft(lineWith('I worry that')))}`);

// REAL input: click into the bullet's quote — its `>` shows, the line stays.
const before = bulletQuote.getBoundingClientRect().left;
const r = bulletQuote.getBoundingClientRect();
window.__clewSmokeInput = [{ click: { x: Math.round(r.left + 200), y: Math.round(r.top + r.height / 2) } }, { wait: 4000 }];
setTimeout(async () => {
	await until(() => lineWith('success conditions')?.textContent.includes('>'), 2000);
	const line = lineWith('success conditions');
	log(`revealed=${line.textContent.includes('>')} moved=${Math.round(line.getBoundingClientRect().left - before)}`);
	workspaceStore.setTabMode(tab.id, 'reading');
	log('done');
}, 300);
