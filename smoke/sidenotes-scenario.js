// Sidenotes (docs/dev/live-edit.md §5.16) over Sidenotes.md — three notes,
// the last two on one line. Fixture: `node smoke/make-live-vault.mjs <dir>`.
// Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/sidenotes-frame.js
// CLEW_SMOKE_FRAME_MATCH=Sidenotes.md — the reading-mode half is measured
// inside the preview document.
//
// Live edit (a wide pane, sidebars closed):
//   `live sidenotes=3 aligned=true` (each note's top within 2 px of its
//   badge's, the colliding one excepted), `collision-resolved=true`;
//   the caret into the first note → `revealed-hides=true` (2 left)
// Reading mode (the frame script):
//   `reading sidenotes=3 aligned=true collision-resolved=true
//   end-list-hidden=true`, then the page made narrow → `narrow sidenotes=0
//   end-list-visible=true`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, settingsStore } = window.__clew;
const log = (s) => console.log('smoke-sn: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
settingsStore.set('sidenotes', 'auto');
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Sidenotes.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelectorAll('.le-sidenote').length === 3);
await sleep(400);
const view = editorPool.get(tab.id).view;
const measure = () => {
	const notes = [...document.querySelectorAll('.le-sidenote')];
	const badges = [...document.querySelectorAll('.cm-content .le-fn')];
	return notes.map((n) => ({ n: Number(n.dataset.number), top: n.getBoundingClientRect().top, bottom: n.getBoundingClientRect().bottom, shift: Number(n.dataset.shift) }))
		.map((s) => ({ ...s, badge: badges.find((b) => Number(b.textContent) === s.n)?.getBoundingClientRect().top }));
};
const m = measure();
const aligned = m.filter((s) => s.shift === 0).every((s) => Math.abs(s.top - s.badge) <= 2);
const shifted = m.find((s) => s.shift > 0);
const prev = shifted && m.find((s) => s.n === shifted.n - 1);
log(`live sidenotes=${m.length} aligned=${aligned} collision-resolved=${Boolean(shifted) && shifted.top >= prev.bottom + 7}`);
view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf('The first note') + 3 } });
view.focus();
await sleep(500);
log(`revealed-hides=${document.querySelectorAll('.le-sidenote').length === 2 && ![...document.querySelectorAll('.le-sidenote')].some((n) => n.dataset.number === '1')}`);
view.dispatch({ selection: { anchor: view.state.doc.length } });
workspaceStore.setTabMode(tab.id, 'reading');
await sleep(4000);
