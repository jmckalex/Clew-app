// Where the watcher's descriptor budget goes (fs-utils.js#watchOrder /
// #watchPlan). The vault is shaped like the one that earned the policy: a
// 12,000-file icon set that sorts FIRST, and the notes last. Under
// chokidar's own walk order the library took the whole budget and every
// note went unwatched — which is invisible until a note changes on disk
// and nothing happens.
//
// Fixture (the run needs it fresh — it edits two notes):
//
//   python3 - <<'PY'
//   import pathlib, shutil
//   root = pathlib.Path('/tmp/watch-order-vault')
//   shutil.rmtree(root, ignore_errors=True)
//   deep = root / 'aaa-library' / 'vendor' / 'icons' / 'set' / 'regular'
//   deep.mkdir(parents=True)
//   for i in range(12000): (deep / f'icon-{i:05d}.svg').write_text('<svg/>')
//   notes = root / 'zzz-notes'; notes.mkdir()
//   for i in range(1, 21): (notes / f'Note {i:02d}.md').write_text(f'# Note {i}\n')
//   (root / 'Top.md').write_text('# Top\n')
//   (root / 'refs.bib').write_text('@book{a, title={A}}\n')
//   PY
//
// Expect: `notice` present and naming an icon file as the first casualty
// (the budget bit, and said so); `events` containing BOTH
// `zzz-notes/Note 20.md` — the last note in the vault, the one the old
// order lost — and `Top.md`; and `new-file-seen=true`, the post-settle
// path (a file created during the session is in no plan and must be
// watched anyway; a budget that stayed shut is how a capped vault once
// went blind to new notes).
//
// The watch-capped event is NOT asserted on: the renderer's own listener is
// registered at module load, before this script is injected, so the notice
// is already in the DOM by the time a scenario could listen. The DOM is
// where to look for it.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { ipc, vaultStore } = window.__clew;
const events = [];
ipc.on('clew:ev-file-changed', ({ path }) => events.push(path));
for (let i = 0; i < 120 && !vaultStore.vault; i++) await sleep(250);
await sleep(6000);   // let the scan finish and 'ready' fire

console.log('smoke-watch: notice=' + JSON.stringify(
	[...document.querySelectorAll('.clew-notice')].map((n) => n.textContent)));

await ipc.invoke('clew:note-write', { path: 'zzz-notes/Note 20.md', content: '# Note 20\n\nEdited.\n' });
await ipc.invoke('clew:note-write', { path: 'Top.md', content: '# Top\n\nEdited.\n' });
await sleep(4000);
console.log('smoke-watch: events=' + JSON.stringify(events));

// A file created after the scan is in no plan at all.
const fresh = await ipc.invoke('clew:note-create', { path: 'zzz-notes/Fresh.md' });
await sleep(1500);
await ipc.invoke('clew:note-write', { path: fresh, content: '# Fresh\n\nSecond write.\n' });
await sleep(4000);
console.log('smoke-watch: new-file=' + JSON.stringify(fresh)
	+ ' new-file-seen=' + events.includes(fresh));
