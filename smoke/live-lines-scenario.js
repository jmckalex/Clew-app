// Live edit's LINE and BLOCK constructs (plan §5.1, §5.4, §5.5): headings,
// lists and tasks, quotes and callouts (with folding), alignment, fences and
// directive frames, and the block field's rule / math / TOC / properties.
//
// Fixture: `node smoke/make-live-vault.mjs <dir>` (writes Blocks.md; the run
// EDITS it — regenerate before every run).
//
// Expect (cursor parked on the last line):
//   `heading le-h1=true text="Heading one"`; `toc=2`; `props=3`;
//   `bullets=2 tasks=2 checked=1`; `quote=true`; `callouts=2`;
//   `folded-body-hidden=true`; `align=center`; `hr=1`; `math-block=svg`;
//   `fence-head=js`; and, scrolled to the end at the close of the run,
//   `env-head="theorem Pythagoras" term=Term`.
// Then REAL input:
//   click the unchecked task's box    → `task: - [x] a task`, and on disk
//                                        after the save `task-saved=true`;
//   click inside the heading           → `heading revealed="# Heading one"
//                                        height-stable=true` (1px off until CodeMirror's
//                                        widget buffers were tamed, live-edit.css);
//   click the folded callout's chevron → `unfolded=true`;
//   triple-click `priority`, type 5, ⏎ → `priority: 5` in the document.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-ll: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
const tab = workspaceStore.openNote('Blocks.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-props'));
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.length } });
await until(() => document.querySelector('.le-math-block svg'), 8000);
await sleep(300);

const q = (sel) => document.querySelector(sel);
const qa = (sel) => [...document.querySelectorAll(sel)];
const h1 = qa('.cm-line.le-h1')[0];
log(`heading le-h1=${Boolean(h1)} text=${JSON.stringify(h1?.textContent)}`);
log(`toc=${qa('.le-toc li').length}`);
log(`props=${qa('.le-props-row').length}`);
log(`bullets=${qa('.le-bullet').length} tasks=${qa('.le-task').length} checked=${qa('.le-task').filter((b) => b.checked).length}`);
log(`quote=${Boolean(q('.le-quote:not(.le-callout)'))}`);
log(`callouts=${qa('.le-callout-head').length}`);
log(`folded-body-hidden=${!view.contentDOM.textContent.includes('Hidden body')}`);
log(`align=${q('.le-align-center') ? 'center' : 'none'}`);
log(`hr=${qa('.le-hr').length}`);
log(`math-block=${q('.le-math-block svg') ? 'svg' : 'none'}`);
log(`fence-head=${q('.le-fence-lang')?.textContent}`);

const center = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
const box = qa('.le-task').find((b) => !b.checked);
const headingPoint = (() => { const r = h1.getBoundingClientRect(); return { x: Math.round(r.left + 120), y: Math.round(r.top + r.height / 2) }; })();
const headingHeight = h1.getBoundingClientRect().height;
const chevron = q('.le-callout-fold.is-folded');
const priority = qa('.le-props-row').find((r) => r.textContent.startsWith('priority'))?.querySelector('input');
window.__clewSmokeInput = [
	{ click: center(box) },
	{ wait: 2200 },                // t≈2.2 (auto-save is 1s)
	{ click: headingPoint },
	{ wait: 800 },                 // t≈3.0
	{ click: center(chevron) },
	{ wait: 800 },                 // t≈3.8
	{ tripleClick: center(priority) },
	{ text: '5' },
	{ combo: { key: 'Enter', modifiers: 0 } },
	{ wait: 1500 },
];
setTimeout(async () => {
	log(`task: ${view.state.doc.toString().split('\n').find((l) => l.includes('a task') && !l.includes('done'))}`);
	const disk = await ipc.invoke('clew:note-read', { path: 'Blocks.md' });
	log(`task-saved=${disk.includes('- [x] a task')}`);
}, 1900);
setTimeout(() => {
	const line = qa('.cm-line.le-h1')[0];
	log(`heading revealed=${JSON.stringify(line?.textContent)} height-stable=${Math.abs(line.getBoundingClientRect().height - headingHeight) < 0.5}`);
}, 2700);
setTimeout(() => log(`unfolded=${view.contentDOM.textContent.includes('Hidden body')}`), 3600);
setTimeout(() => {
	log(`properties: ${view.state.doc.toString().split('\n').find((l) => l.startsWith('priority'))}`);
	// The bottom of the note is below the fold, and CodeMirror draws only
	// what is in view: scroll there, then look.
	view.scrollDOM.scrollTop = view.scrollDOM.scrollHeight;
	setTimeout(() => {
		const name = q('.le-env-name')?.textContent;
		const caption = q('.le-env-caption')?.textContent;
		log(`env-head="${name} ${caption}" term=${q('.le-dt')?.textContent}`);
	}, 400);
}, 5800);
