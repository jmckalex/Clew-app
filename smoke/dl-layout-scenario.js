// Description lists in reading mode: the two-column layout (the owner's
// ask, 2026-09-18 — a term and its definition belong on one line). Nothing
// in the pipeline styled `dl` before: the engine emits a bare
// <dl><dt>…</dt><dd>…</dd></dl> and the browser's default stacked the
// definition under its term with a 40px indent. preview.css now makes the
// list a grid, `auto 1fr`.
//
// Pair with dl-layout-frame.js. Note the OTHER dl pair in this folder —
// `dl-scenario.js` — is about `Key:: value` being a description list at
// all rather than a Dataview field; this one is only about how it lays out.
//
// Writes its own note into the vault (pass a disposable one), so no fixture
// recipe: five entries, one of them several paragraphs plus a list.
//
// Expect from the frame: `display=grid`, `cols=` two tracks; `row0
// dt-top=N dd-top=N` — EQUAL, which is the whole point; `dd-margin=0px`
// (the browser's 40px indent is the grid's job now); `blocks-per-dd`
// ending `[…,3,…]` for the multi-paragraph entry, and `ul-in-dd=1` — a
// list inside a definition survives, PROVIDED its markers are indented by
// two spaces. Four spaces or a tab make it a lazy continuation of the
// paragraph instead (plain CommonMark inside the <dd>, measured
// 2026-09-18) — which is why the fixture's list is indented by two.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, registry, ipc } = window.__clew;
await ipc.invoke('clew:note-write', {
	path: 'DL-layout.md',
	content: [
		'# Definition lists',
		'',
		'$S$:: A rigid designator picking out the subject undergoing belief revision,',
		'  so that it picks out the same person in all possible worlds.',
		'',
		'$R(S)$:: The belief revision of $S$.',
		'',
		'A much longer term than the others:: Short.',
		'',
		'Multi-paragraph:: The first paragraph of the definition, which runs on for',
		'  a while so that it wraps onto a second line of its own.',
		'',
		'  The second paragraph of the same definition.',
		'',
		'  - and a list item',
		'  - and another',
		'',
		'Term with no first line::',
		'  The definition starts on the next line instead.',
		'',
		'Ordinary prose after the list, to close it.',
		'',
	].join('\n'),
});
await sleep(1500);
workspaceStore.openNote('DL-layout.md', { newTab: true, defaultMode: 'source' });
await sleep(1500);
registry.runCommand('workspace:toggle-mode');
await sleep(8000);
console.log('smoke-dl-layout: frame=' + !!document.querySelector('clew-preview-view iframe'));
