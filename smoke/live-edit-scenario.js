// Live edit in the editor itself (docs/dev/live-edit-plan.md §5): concealment,
// rendering in place, and the reveal rule under REAL input. Over a scratch
// copy of the demo vault — its Projects/Dialect Demo.md is the dialect's
// showcase:
//
//   rm -rf /tmp/le-vault && rsync -a --exclude .clew demo-vault/ /tmp/le-vault/
//
// The run clicks a wikilink last, which navigates the tab; nothing is
// typed, so the fixture survives — but its .clew/ should go between runs.
//
// Expect (concealed, cursor parked on the last line):
//   `mode=live`, `prose="Some italics, strong, intense, and highlighted text with a"`
//     — the dialect's delimiters gone from the line's visible text;
//   `classes` lists le-italic / le-strong / le-intense / le-highlight;
//   `wikilink="the design"`, `tag-chips>=1`, `math-widgets>=2 svg=all`,
//   `footnote=1 title="With a footnote."`, `cite=` a chip (the key, or
//     Author Year when a .bib defines it).
// Then REAL input:
//   click inside *strong*   → `revealed-line` shows `*strong*` and only that
//                             construct (`/italics/` still concealed);
//                             `line-height-stable=true`;
//   ArrowRight ×8           → `after-arrows concealed=true`;
//   ⌥-click "the design"    → `alt-click path=Projects/Dialect Demo.md`
//                             and the source `[[Clew Design|the design]]`;
//   click "Welcome"         → `followed path=Welcome.md`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool } = window.__clew;
const log = (s) => console.log('smoke-le: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
const PATH = 'Projects/Dialect Demo.md';
const tab = workspaceStore.openNote(PATH, { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .cm-content')?.textContent.includes('Dialect Demo'));
const view = editorPool.get(tab.id).view;
const doc = () => view.state.doc.toString();
// Park the cursor on the last line, away from everything under test.
view.dispatch({ selection: { anchor: view.state.doc.length } });
await until(() => document.querySelectorAll('.le-math svg').length >= 2, 8000);
await sleep(300);

const lineEl = (prefix) => [...document.querySelectorAll('.cm-line')].find((l) => l.textContent.startsWith(prefix));
log(`mode=${workspaceStore.findTab(tab.id).tab.view.mode}`);
log(`prose=${JSON.stringify(lineEl('Some')?.textContent)}`);
log(`classes=${['le-italic', 'le-strong', 'le-intense', 'le-highlight'].filter((c) => document.querySelector('.' + c)).join(',')}`);
log(`wikilink=${JSON.stringify([...document.querySelectorAll('.le-wikilink')].map((e) => e.textContent).find((t) => t.includes('design')))}`);
log(`tag-chips=${document.querySelectorAll('.le-tag').length}`);
const maths = [...document.querySelectorAll('.le-math')];
log(`math-widgets=${maths.length} svg=${maths.every((m) => m.querySelector('svg')) ? 'all' : 'MISSING'}`);
// Each widget shows its SVG and nothing else: MathJax's assistive MathML
// beside it must stay hidden (it showed — every formula twice — until
// lib/mathjax.js installed MathJax's stylesheet).
log(`math-svg-only=${maths.every((m) => Math.abs(m.getBoundingClientRect().width - m.querySelector('svg').getBoundingClientRect().width) < 3)}`);
const fn = document.querySelector('.le-fn');
log(`footnote=${fn?.textContent} title=${JSON.stringify(fn?.title)}`);
log(`cite=${JSON.stringify(document.querySelector('.le-cite')?.textContent)}`);

const at = (pos) => {
	const r = view.coordsAtPos(pos);
	return { x: Math.round(r.left + 1), y: Math.round((r.top + r.bottom) / 2) };
};
// Every point is taken NOW, in the concealed layout; the queue below only
// clicks a line while it is concealed again (the cursor has left it).
const strongAt = doc().indexOf('*strong*') + 3;           // inside the word
const designPoint = at(doc().indexOf('the design') + 3);
const welcomePoint = at(doc().indexOf('[[Welcome]]') + 4);
const heightBefore = lineEl('Some').getBoundingClientRect().height;
const pathNow = () => workspaceStore.findTab(tab.id)?.tab.path;
window.__clewSmokeInput = [
	{ click: at(strongAt) },
	{ wait: 1200 },                                          // t≈1.2  revealed
	...Array.from({ length: 6 }, () => ({ combo: { key: 'ArrowRight', modifiers: 0 } })),
	{ wait: 1200 },                                          // t≈2.8  concealed again
	{ click: designPoint, modifiers: 1 },                    // ⌥-click
	{ wait: 1200 },                                          // t≈4.2
	{ combo: { key: 'ArrowUp', modifiers: 0 } },             // leave that line
	{ wait: 1200 },
	{ click: welcomePoint },                                 // follow
	{ wait: 2500 },
];
setTimeout(() => {
	const line = lineEl('Some');
	log(`revealed-line=${JSON.stringify(line?.textContent)}`);
	log(`line-height-stable=${Math.abs(line.getBoundingClientRect().height - heightBefore) < 0.5}`);
}, 800);
setTimeout(() => {
	log(`after-arrows concealed=${!lineEl('Some')?.textContent.includes('*')} line=${JSON.stringify(lineEl('Some')?.textContent)}`);
}, 2300);
setTimeout(() => {
	log(`alt-click path=${pathNow()} source=${JSON.stringify(lineEl('#demo')?.textContent)}`);
}, 3800);
setTimeout(() => log(`followed path=${pathNow()}`), 7500);
