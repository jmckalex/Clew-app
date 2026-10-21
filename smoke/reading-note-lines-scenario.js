// Reading view after a multi-paragraph inline note (jmarkdown 74cf2b1 +
// 551485a): the engine lifts such a note out of the source before the parse,
// and until then every block after it was stamped early by the note's lines —
// data-source-line, which reading view's scroll sync and ⌘-click inverse
// search read — so a reader scrolled to, and clicked through to, the wrong
// line. Writes its own NoteLines.md into any vault (CLEW_SMOKE_VAULT=<an
// empty folder>, CLEW_SMOKE_LOG=1, CLEW_SMOKE_FRAME_SCRIPT=smoke/reading-
// note-lines-frame.js, CLEW_SMOKE_FRAME_MATCH=NoteLines.md): the engine's own
// fixture (tests/source-lines/notes.md — a note at the top level, in a quote,
// in a list item), each target paragraph marked by an empty <span id="tN">
// that moves no line, and filler past the window. For N = 6, 13, 21 (the
// paragraphs after each note), as a reader does it:
//   scroll N reading-line=N   a `scroll-to-line` posted into the frame (the
//                             reading-scroll arrangement): the block the
//                             preview puts at the top, by its stamp
//   click N line=N "Line N: …"   a REAL ⌘-click on that paragraph — found in
//                             the frame by its marker, wherever it is — flips
//                             the tab to source at the line it names
// With the stamps early (before jmarkdown 74cf2b1) the scroll put a later
// block at the top, the paragraph above the window, and the click found
// nothing on screen: `click 21 line=none`. The frame half
// (smoke-note-lines-frame:) logs every stamp.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-note-lines: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};

await ipc.invoke('clew:note-write', { path: 'NoteLines.md', content: [
	'A top-level claim.[fn: Its first paragraph.',
	'',
	'    Its second paragraph.',
	'] More text.',
	'',
	'Line 6: the paragraph after the top-level note.<span id="t6"></span>',
	'',
	'> Line 8: a quoted claim[fn: Quote note one.',
	'',
	'    Quote note two.',
	'] in a blockquote.',
	'',
	'Line 13: the paragraph after the blockquote.<span id="t13"></span>',
	'',
	'- Line 15: an item[fn: Item note one.',
	'',
	'    Item note two.',
	']',
	'- Line 19: the next item.',
	'',
	'Line 21: the paragraph after the list.<span id="t21"></span>',
	'',
	'# Line 23: a heading',
	'',
	...Array.from({ length: 40 }, (_, i) => [`Filler paragraph ${i + 1}, at line ${25 + 2 * i}.`, '']).flat(),
].join('\n') });
const tab = workspaceStore.openNote('NoteLines.md', { newTab: true });
workspaceStore.setTabMode(tab.id, 'reading');
const mode = () => workspaceStore.findTab(tab.id)?.tab.view.mode;
const frame = () => document.querySelector('clew-preview-view iframe');
await until(() => frame());
await sleep(5000);   // the engine's render and the preview's boot

const scrollTo = async (line) => {
	frame().contentWindow.postMessage({ source: 'clew-preview-host', type: 'scroll-to-line', line, behavior: 'auto' }, '*');
	await sleep(800);
	log(`scroll ${line} reading-line=${workspaceStore.findTab(tab.id)?.tab.view.readingLine}`);
};
const TARGETS = [6, 13, 21];
await scrollTo(TARGETS[0]);
window.__clewSmokeInput = TARGETS.flatMap((n) => [
	{ frameClick: { match: 'NoteLines.md', selector: `p:has(#t${n})` }, modifiers: 4 }, { wait: 7000 },
]);
setTimeout(async () => {
	for (const [i, n] of TARGETS.entries()) {
		const flipped = await until(() => mode() !== 'reading', 5000);
		const view = editorPool.get(tab.id)?.view;
		const line = flipped && view ? view.state.doc.lineAt(view.state.selection.main.head) : null;
		log(`click ${n} line=${line ? line.number : 'none'}${line ? ` "${line.text.replace(/<span.*$/, '')}"` : ''}`);
		workspaceStore.setTabMode(tab.id, 'reading');
		await until(() => frame());
		await sleep(3000);
		if (TARGETS[i + 1]) await scrollTo(TARGETS[i + 1]);
	}
	log('done');
}, 0);
