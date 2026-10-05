// A list item that goes on past its first line, in live edit: a hard break
// (two spaces, a backslash), a lazy line, a second and third paragraph, a
// nested item, a numbered item, a task, an item in a quote. Every line after
// an item's first is the item's text: it reads as prose (source mode's list
// colour is gone, as on the first line) and starts where the item's text
// starts — under it, not at the margin.
//
// Fixture: `node smoke/make-live-vault.mjs <dir>` (Lists.md).
//
// Logged, cursor parked on the last line, one line per continuation:
//   `<label> item-x=… cont-x=… dx=… color=same|<rgb> class=…` — dx is the
//   continuation's first character against the item's (|dx| ≤ 2 to pass),
//   color its text's colour against the item's first line (prose's, or a
//   quote's in a quote; before the fix, the list face rgb(139, 126, 200));
// then the caret put on each continuation line in turn (REAL clicks):
//   `<label> revealed dx=… height-stable=…` — neither the line's place nor
//   its height changes when the caret enters it (in a quote the line's `>`
//   reveals, as on every quote line, and moves the text: dx is logged only).
// Also `maths=svg fence=<the code line's classes>`: a display formula and a
// fence inside an item still draw as themselves. Last: `ok=true|false`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool } = window.__clew;
const log = (s) => console.log('smoke-lp: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
const tab = workspaceStore.openNote('Lists.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-bullet'));
const view = editorPool.get(tab.id).view;
const doc = view.state.doc;
view.dispatch({ selection: { anchor: doc.length } });
await sleep(400);

// [label, the item's first line (a substring), its text's first word, the continuation (a substring)]
const PAIRS = [
	['two-spaces', 'First item', 'First', 'after the two spaces'],
	['backslash', 'Second item', 'Second', 'after the backslash'],
	['lazy', 'Third item', 'Third', 'lazily continued'],
	['paragraph-2', 'Fourth item', 'Fourth', 'Its second paragraph'],
	['paragraph-3', 'Fourth item', 'Fourth', 'And a third.'],
	['nested', 'nested item', 'nested', 'nested continuation'],
	['numbered', 'Numbered item', 'Numbered', 'numbered continuation'],
	['task', 'a task', 'a', 'task continuation'],
	['quoted', 'quoted item', 'quoted', 'quoted continuation'],
	['after-maths', 'Sixth', 'Sixth', 'and a fence:'],
];
const lineWith = (s) => { for (let n = 1; n <= doc.lines; n += 1) if (doc.line(n).text.includes(s)) return doc.line(n); return null; };
const colorAt = (pos) => {
	const { node } = view.domAtPos(pos + 1);
	const el = node.nodeType === 3 ? node.parentElement : node;
	return getComputedStyle(el).color;
};
const lineEl = (pos) => { let el = view.domAtPos(pos).node; if (el.nodeType === 3) el = el.parentElement; return el.closest('.cm-line'); };
const measure = (label, itemText, word, contText) => {
	const item = lineWith(itemText);
	const cont = lineWith(contText);
	const itemX = view.coordsAtPos(item.from + item.text.indexOf(word), 1)?.left;
	const contX = view.coordsAtPos(cont.from + cont.text.indexOf(contText), 1)?.left;
	const color = colorAt(cont.from + cont.text.indexOf(contText));
	const itemColor = colorAt(item.from + item.text.indexOf(word));
	const el = lineEl(cont.from + cont.text.indexOf(contText));
	return { label, itemX, contX, dx: Math.round(contX - itemX), color, itemColor, el, height: el.getBoundingClientRect().height, cont };
};
await until(() => document.querySelector('.le-math-block svg'), 8000);
const codeLine = lineEl(lineWith('let x = 1;').from + 3);
log(`maths=${document.querySelector('.le-math-block svg') ? 'svg' : 'none'} fence=${JSON.stringify(codeLine?.className)}`);
let ok = true;
const before = {};
for (const [label, a, w, b] of PAIRS) {
	const m = measure(label, a, w, b);
	before[label] = m;
	const same = m.color === m.itemColor;
	if (!same || Math.abs(m.dx) > 2) ok = false;
	log(`${label} item-x=${Math.round(m.itemX)} cont-x=${Math.round(m.contX)} dx=${m.dx} color=${same ? 'same' : m.color} class=${JSON.stringify(m.el.className)}`);
}

// The caret into each continuation line, by a real click at its text.
const queue = [];
for (const [label, , , b] of PAIRS) {
	const cont = lineWith(b);
	const r = view.coordsAtPos(cont.from + cont.text.indexOf(b) + 3, 1);
	queue.push({ click: { x: Math.round(r.left), y: Math.round((r.top + r.bottom) / 2) } }, { wait: 400 });
}
queue.push({ wait: 1500 });
window.__clewSmokeInput = queue;
// The queue runs only once this script has returned: the reveal half runs beside it.
(async () => {
	for (const [label, a, w, b] of PAIRS) {
		const line = lineWith(b);
		await until(() => doc.lineAt(view.state.selection.main.head).number === line.number, 4000);
		await sleep(200);
		const m = measure(label, a, w, b);
		const stable = Math.abs(m.height - before[label].height) < 0.5;
		if (!stable || (label !== 'quoted' && Math.abs(m.dx) > 2)) ok = false;
		log(`${label} revealed dx=${m.dx} height-stable=${stable}`);
	}
	log(`ok=${ok}`);
})();
