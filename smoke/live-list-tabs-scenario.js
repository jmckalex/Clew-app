// A TAB-indented list in live edit (2026-10-20, Clew-boss's approval of the
// narrower fix): an item's leading tab is drawn as the columns it fills
// (live/columns.js#tabbedIndent: the indentation a box of its own, in both
// states) — CSS draws a tab to a stop counted from the edge of its box, and a
// line's is moved by the item's hang, so `\t* item` stood 6px in, not four columns' 16, and its
// quote 10px right of its text (live-list-quote-scenario.js's `tabbed`).
// Obsidian indents lists with tabs by default. Writes its own Tabs.md into any
// vault (CLEW_SMOKE_VAULT=<an empty folder>, CLEW_SMOKE_LOG=1). Logs
// (smoke-list-tabs:), px:
//   bullets space-step=16 tab-step1=16 tab-step2=16 mixed-vs-tab=0
//          each nested level four columns in, by spaces or by tabs; ` \t`
//          (a space, then a tab to its stop) where `\t` is
//   tab width=16 (the tab's drawn width: four columns)
//   mono bullets space-step=39 tab-step1=39 tab-step2=39 mixed-vs-tab=0
//          the same in Menlo (its space is 0.6em)
//   caret clicks=[0,1] keys=[1,2,1] x-after-tab=0
//          by REAL input on `\t* Tab inner`: a click on the tab's left half
//          lands before it (0), on its right half after it (1) — positions
//          from the line's start — then from 0: → → ← land at 1, 2, 1; the
//          caret after the tab is drawn at the tab's right edge. As before
//          the fix (measured on 12cff10: clicks=[0,1] keys=[1,2,1]): the tab
//          is still a character, only its box is new. (A widget in its place
//          took every click on it as after it — measured, and not used.)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-list-tabs: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(20)) if (test()) return true;
	return false;
};

await ipc.invoke('clew:note-write', { path: 'Tabs.md', content: [
	'# Tabs',
	'',
	'* Space outer',
	'    * Space inner',
	'',
	'* Tab outer',
	'\t* Tab inner',
	'\t\t* Tab third',
	'',
	'* Mixed outer',
	' \t* Mixed inner',
	'',
	'End.',
	'',
].join('\n') });
const tab = workspaceStore.openNote('Tabs.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-bullet'));
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.length } });
await sleep(300);

const lineEl = (s) => [...view.contentDOM.querySelectorAll('.cm-line')].find((l) => l.textContent.includes(s));
const bullet = (s) => lineEl(s).querySelector('.le-bullet').getBoundingClientRect().left;
const bullets = () => {
	const space = bullet('Space inner') - bullet('Space outer');
	return `space-step=${Math.round(space)} tab-step1=${Math.round(bullet('Tab inner') - bullet('Tab outer'))}`
		+ ` tab-step2=${Math.round(bullet('Tab third') - bullet('Tab inner'))} mixed-vs-tab=${Math.round(bullet('Mixed inner') - bullet('Tab inner'))}`;
};
const docLine = (s) => view.state.doc.line(view.state.doc.toString().split('\n').findIndex((l) => l.includes(s)) + 1);
log(`bullets ${bullets()}`);
const inner = docLine('Tab inner');
// The tab character's own box, by a DOM range over it (it stays a character).
const tabRect = () => {
	const walker = document.createTreeWalker(lineEl('Tab inner'), NodeFilter.SHOW_TEXT);
	for (let t = walker.nextNode(); t; t = walker.nextNode()) {
		const i = t.textContent.indexOf('\t');
		if (i < 0) continue;
		const range = document.createRange();
		range.setStart(t, i);
		range.setEnd(t, i + 1);
		return range.getBoundingClientRect();
	}
	return null;
};
const tabLeft = () => tabRect().left;
const tabRight = () => tabRect().right;
log(`tab width=${Math.round(tabRight() - tabLeft())}`);

const col = () => getComputedStyle(view.scrollDOM).getPropertyValue('--le-col').trim();
const colBefore = col();
document.body.style.setProperty('--clew-editor-font', 'Menlo, monospace');
await until(() => col() && col() !== colBefore, 5000);
await sleep(300);
log(`mono bullets ${bullets()}`);
document.body.style.removeProperty('--clew-editor-font');
await until(() => col() === colBefore, 5000);
await sleep(300);

// REAL input on the tab: a click on each half, then → → ← from the line's start.
const y = Math.round((view.coordsAtPos(inner.from + 2).top + view.coordsAtPos(inner.from + 2).bottom) / 2);
const left = Math.round(tabLeft() + 2), right = Math.round(tabRight() - 2);
// Every caret position in turn, from where it stood before the input.
const headAt = () => view.state.selection.main.head - docLine('Tab inner').from;
const heads = [headAt()];
const watch = setInterval(() => {
	if (heads.at(-1) !== headAt()) heads.push(headAt());
}, 5);
const key = (k) => ({ combo: { key: k, code: k, modifiers: 0 } });
window.__clewSmokeInput = [
	{ click: { x: left, y } }, { wait: 400 },
	{ click: { x: right, y } }, { wait: 400 },
	{ click: { x: left, y } }, { wait: 400 },
	key('ArrowRight'), { wait: 300 }, key('ArrowRight'), { wait: 300 }, key('ArrowLeft'), { wait: 600 },
	{ wait: 2500 },   // the checks below run before the harness ends
];
setTimeout(async () => {
	await until(() => heads.length >= 7, 4000);
	await sleep(300);
	clearInterval(watch);
	const after = view.coordsAtPos(docLine('Tab inner').from + 1, -1).left;
	log(`caret clicks=${JSON.stringify(heads.slice(1, 3))} keys=${JSON.stringify(heads.slice(4, 7))} x-after-tab=${Math.round(after - tabRight())}`);
	log(`raw heads=${JSON.stringify(heads)}`);
	log('done');
}, 0);
