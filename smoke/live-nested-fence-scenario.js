// Two live-edit bugs from the owner's testing, 2026-09-27:
//   - emphasis nested inside emphasis drew bold but upright: `.cmt-emphasis`
//     (lezer's class for `*x*`) set `font-style: normal`, un-slanting the
//     italic span around it; and the scanner never saw an italic inside
//     strong (`*` was not a boundary);
//   - a code fence showed a blank line under its code: the concealed
//     closer was a full-height line holding an empty widget.
//
// Fixture: `node smoke/make-live-vault.mjs <dir>` (Nested.md).
//
//   1. `strong-in-italic style=italic weight=650`, `italic-in-strong …` and
//      `in-a-task …` the same (computed style of the innermost span, the
//      line concealed; the old `.cmt-emphasis` rule reads `normal` here)
//   2. `fence-foot concealed-height=10 line=23` — the closer a pad, not a line
//   3. caret on the closer → `revealed-height=23 shows-backticks=true foot-class=false`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool } = window.__clew;
const log = (s) => console.log('smoke-nf: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Nested.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-fence-foot-line'));
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.length } });
await sleep(600);

// 1. The innermost element holding each word, and its computed style.
const styleOf = (word) => {
	const walker = document.createTreeWalker(view.contentDOM, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		if (n.textContent.includes(word)) {
			const cs = getComputedStyle(n.parentElement);
			return `style=${cs.fontStyle} weight=${cs.fontWeight} text=${JSON.stringify(n.parentElement.closest('.cm-line').textContent.includes('/') ? 'SLASH-SHOWN' : 'concealed')}`;
		}
	}
	return 'missing';
};
log(`strong-in-italic ${styleOf('italics,') === 'missing' ? styleOf('italics') : styleOf('italics,')}`);
log(`italic-in-strong ${styleOf('strong italics')}`);
log(`in-a-task ${styleOf('tasked')}`);

// 2. The concealed closer, against an ordinary code line.
const foot = document.querySelector('.le-fence-foot-line');
const codeLine = [...document.querySelectorAll('.cm-line.le-fence')].find((l) => l.textContent.includes('let i'));
const lineH = Math.round(codeLine.getBoundingClientRect().height);
log(`fence-foot concealed-height=${Math.round(foot.getBoundingClientRect().height)} line=${lineH}`);

// 3. The caret on the closer: the backticks, at full height.
const closer = view.state.doc.line(view.state.doc.lines - 3);
view.dispatch({ selection: { anchor: closer.from } });
view.focus();
await sleep(500);
const shown = [...document.querySelectorAll('.cm-line.le-fence-close')][0];
log(`revealed-height=${Math.round(shown?.getBoundingClientRect().height ?? 0)} shows-backticks=${shown?.textContent === '```'} foot-class=${Boolean(document.querySelector('.le-fence-foot-line'))}`);
view.dispatch({ selection: { anchor: view.state.doc.length } });
await sleep(400);
