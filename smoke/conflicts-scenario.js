// Edit-conflict safety (renderer/conflicts.js, main/write-guard.js) over
// `node smoke/make-conflict-vault.mjs <dir>`, with CLEW_WATCH_BUDGET=10 and
// the runner playing the other device — it writes "theirs" when the log asks:
//
//   ( for w in target watched mine; do
//       until grep -q "smoke-cf: write $w" <log>; do sleep 0.1; done
//       case $w in target) f='Deep/Er/Target.md';; watched) f='A Watched.md';; mine) f='A Mine.md';; esac
//       printf '# Theirs\n\nTHEIRS-%s from another device.\n' $w > "<dir>/$f"
//     done ) &
//
//   open:     dropbox-notice=true dropbox-notices=1 git-notice=true
//   target:   (unwatched — the watcher never says) control conflict=false, then
//             the autosave is REFUSED: conflict=true kind=save disk-untouched=true
//             history-has-both=true; banner choices=[mine,theirs,both,compare];
//             Compare… → sheet diff-theirs=1 diff-mine=1; Keep both →
//             sibling=… sibling-is-theirs=true note-is-mine=true
//   watched:  unsaved edits + a change on disk → conflict=true kind=disk;
//             Keep theirs → editor-is-theirs=true unsaved-kept=true
//   mine:     the same → Keep mine → disk-is-mine=true theirs-kept=true
//   dropbox:  Review… → Keep the copy → note-is-copy=true trashed=… history-has-both=true
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-cf: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};
const notices = () => [...document.querySelectorAll('.clew-notice')].map((n) => n.textContent);
const read = (path) => ipc.invoke('clew:note-read', { path }).catch(() => null);
/** Every kept version's text. */
const history = async (path) => {
	const list = await ipc.invoke('clew:history-list', { path }).catch(() => []);
	return Promise.all(list.map((e) => ipc.invoke('clew:history-read', { path, id: e.id }).catch(() => '')));
};
const open = async (path) => {
	const tab = workspaceStore.openNote(path, { newTab: true, defaultMode: 'source' });
	workspaceStore.setTabMode(tab.id, 'source');
	await until(() => editorPool.get(tab.id)?.view);
	await sleep(300);
	return tab;
};
const type = (tab, text) => {
	const view = editorPool.get(tab.id).view;
	view.dispatch({ changes: { from: view.state.doc.length, insert: text } });
};
const banner = () => [...document.querySelectorAll('clew-editor-view')].find((v) => v.offsetParent)?.querySelector(':scope > .conflict-banner');

for (let i = 0; i < 300 && !window.__clew.vaultStore.vault?.sessionId; i++) await sleep(100);
await sleep(1500);

// ---- at open: the Dropbox copy and the git markers -------------------------
await open('Merge.md');
await sleep(500);
log(`open: dropbox-notice=${notices().some((t) => /Dropbox kept a conflicted copy of “Plan”/.test(t))} dropbox-notices=${notices().filter((t) => /Dropbox kept a conflicted copy/.test(t)).length} git-notice=${notices().some((t) => /“Merge” holds git conflict markers/.test(t))}`);

// ---- target: unwatched, so only the guard can catch it ---------------------
const target = await open('Deep/Er/Target.md');
log('write target');
await sleep(1500);
log(`target-control: conflict=${Boolean(editorPool.get(target.id).conflict)} editor-still-original=${editorPool.get(target.id).view.state.doc.toString().includes('The original text.')}`);
type(target, '\nMINE-TARGET, typed here.\n');
await until(() => editorPool.get(target.id).conflict, 6000);
{
	const entry = editorPool.get(target.id);
	const disk = await read('Deep/Er/Target.md');
	const kept = await history('Deep/Er/Target.md');
	log(`target: conflict=${Boolean(entry.conflict)} kind=${entry.conflictKind} disk-untouched=${disk?.includes('THEIRS-target') && !disk.includes('MINE-TARGET')} history-has-both=${kept.some((t) => t.includes('THEIRS-target')) && kept.some((t) => t.includes('MINE-TARGET'))} held-notice=${notices().some((t) => /“Target” was changed elsewhere — your save was held/.test(t))}`);
	log(`target-banner: choices=${JSON.stringify([...(banner()?.querySelectorAll('button') ?? [])].map((b) => b.dataset.choice))} text=${JSON.stringify(banner()?.querySelector('span')?.textContent ?? '')}`);
}
banner()?.querySelector('button[data-choice="compare"]')?.click();
await until(() => document.querySelector('.clew-conflict-sheet'), 3000);
{
	const sheet = document.querySelector('.clew-conflict-sheet');
	log(`target-sheet: shown=${Boolean(sheet)} title=${JSON.stringify(sheet?.querySelector('h2')?.textContent ?? '')} diff-theirs=${sheet?.querySelectorAll('.clew-diff-line.is-theirs').length} diff-mine=${sheet?.querySelectorAll('.clew-diff-line.is-mine').length}`);
	await sleep(400);   // for a screenshot of it, should the run be watched
	sheet?.querySelector('button[data-choice="both"]')?.click();
}
await until(() => !editorPool.get(target.id).conflict, 5000);
await sleep(800);
{
	const day = new Date();
	const stamp = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
	const siblingPath = `Deep/Er/Target (conflict ${stamp}).md`;
	const sibling = await read(siblingPath);
	const note = await read('Deep/Er/Target.md');
	log(`target-both: sibling=${JSON.stringify(siblingPath)} sibling-is-theirs=${Boolean(sibling?.includes('THEIRS-target'))} note-is-mine=${Boolean(note?.includes('MINE-TARGET') && !note.includes('THEIRS'))} banner-gone=${!banner()} dirty=${editorPool.isDirty(target.id)}`);
}

// ---- watched: unsaved edits, then a change on disk → Keep theirs ------------
const watched = await open('A Watched.md');
type(watched, '\nMINE-WATCHED, unsaved.\n');
log('write watched');
await until(() => editorPool.get(watched.id).conflict, 6000);
log(`watched: conflict=${Boolean(editorPool.get(watched.id).conflict)} kind=${editorPool.get(watched.id).conflictKind}`);
banner()?.querySelector('button[data-choice="theirs"]')?.click();
await until(() => !editorPool.get(watched.id).conflict, 5000);
await sleep(500);
{
	const text = editorPool.get(watched.id).view.state.doc.toString();
	const kept = await history('A Watched.md');
	log(`watched-theirs: editor-is-theirs=${text.includes('THEIRS-watched') && !text.includes('MINE-WATCHED')} unsaved-kept=${kept.some((t) => t.includes('MINE-WATCHED'))} dirty=${editorPool.isDirty(watched.id)}`);
}
// A later save must NOT be refused: "theirs" was read afresh, so main has seen it.
type(watched, '\nAfter keeping theirs.\n');
await sleep(2000);
log(`watched-after: conflict=${Boolean(editorPool.get(watched.id).conflict)} saved=${(await read('A Watched.md'))?.includes('After keeping theirs.')}`);

// ---- mine: the same → Keep mine --------------------------------------------
const mine = await open('A Mine.md');
type(mine, '\nMINE-MINE, unsaved.\n');
log('write mine');
await until(() => editorPool.get(mine.id).conflict, 6000);
log(`mine: conflict=${Boolean(editorPool.get(mine.id).conflict)} kind=${editorPool.get(mine.id).conflictKind}`);
banner()?.querySelector('button[data-choice="mine"]')?.click();
await until(() => !editorPool.get(mine.id).conflict, 5000);
await sleep(800);
{
	const disk = await read('A Mine.md');
	const kept = await history('A Mine.md');
	log(`mine-mine: disk-is-mine=${Boolean(disk?.includes('MINE-MINE') && !disk.includes('THEIRS'))} theirs-kept=${kept.some((t) => t.includes('THEIRS-mine'))}`);
}

// ---- dropbox: Review… → Keep the copy ----------------------------------------
const review = [...document.querySelectorAll('.clew-conflict-notice')].find((n) => /“Plan”/.test(n.textContent))?.querySelector('.clew-trust-button');
review?.click();
await until(() => document.querySelector('.clew-conflict-sheet'), 3000);
document.querySelector('.clew-conflict-sheet button[data-choice="theirs"]')?.click();
await sleep(2000);
{
	const note = await read('Plan.md');
	const copy = await read("Plan (Jane's conflicted copy 2026-10-03).md");
	const kept = await history('Plan.md');
	log(`dropbox: note-is-copy=${Boolean(note?.includes("Jane's laptop"))} copy-gone=${copy === null} history-has-both=${kept.some((t) => t.includes("Jane's laptop")) && kept.some((t) => t.includes('this Mac'))}`);
}
