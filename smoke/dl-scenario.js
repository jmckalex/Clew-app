// `Key:: value` is a description list in this dialect, not a Dataview
// inline field (owner's decision, 2026-09-17: the engine claims such a line
// as a term, the two readings cannot coexist, and description lists win).
// Pair with dl-frame.js.
//
// Writes DL.md into the vault (pass a disposable one), opens it in reading
// mode, and leaves the frame script to report what rendered: the own-line
// form, the bracketed form in prose, and a ```query table over the vault
// with a `mark` column.
//
// Expect from the frame: `dl>=1 dt="mark" dd="65"` (the own-line form is a
// description list), `bracket-dt=true prose-intact=false` (the bracketed
// form made its sentence a term — the documented cost), and
// `query-mark=""` with `query-rows>0` (the table lists DL.md with an EMPTY
// mark cell: no field was read from either line).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, ipc } = window.__clew;
await ipc.invoke('clew:note-write', {
	path: 'DL.md',
	content: '# DL\n\nmark:: 65\n\nThe essay scored [grade:: 71] overall.\n\n```query\ntable: mark\n```\n',
});
await sleep(2000);
workspaceStore.openNote('DL.md', { defaultMode: 'reading' });
await sleep(10000);
console.log('smoke-dl: frame=' + !!document.querySelector('clew-preview-view iframe'));
