// Kanban boards wider than the text column (the manual's screenshot showed 3
// of 4 columns): every column must be on screen or reachable. Fixture:
//
//   node smoke/make-kanban-vault.mjs <dir>
//
// Two panes: Board4.md and Board7.md in reading mode, sidebars closed (or,
// with `printf single > <dir>/layout.txt`, Board4 alone in one pane). Run
// with CLEW_SMOKE_FRAME_SCRIPT=smoke/kanban-width-frame.js
// CLEW_SMOKE_FRAME_MATCH=Board. Each frame reports its pane width, the
// board's, how many columns are FULLY visible without scrolling, whether it
// scrolls, whether the scrollbar takes room (a classic, always-visible bar),
// and whether the last column comes fully into view when scrolled to the end.
// Expect — single: `Board4 … board=862 cols=4 visible=4 scrolls=false`
// (before: board=704 visible=3 — the manual's 3 of 4); split (636 px panes):
// both `scrolls=true scrollbar=true last-reachable=true`; always
// `hit-test=true`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, actions } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const open = (path) => {
	const t = workspaceStore.openNote(path, { newTab: true, defaultMode: 'reading' });
	workspaceStore.setTabMode(t.id, 'reading');
};
// `layout.txt` in the vault: `single` puts Board4 alone in a full-width pane;
// otherwise (default) two panes side by side.
const read = await window.__clew.ipc.invoke('clew:note-read', { path: 'layout.txt' }).catch(() => '');
const layout = String((typeof read === 'string' ? read : read?.content) ?? '').trim();
open('Board4.md');
if (layout !== 'single') {
	actions.splitActive('right');
	open('Board7.md');
}
await sleep(6000);
console.log('smoke-kb: opened');
