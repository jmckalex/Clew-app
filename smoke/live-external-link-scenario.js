// A wikilink's `|external` in live edit (the owner's report, 2026-11-23, on
// dev.21): the alias's `|external` was drawn as part of the link's text
// ("Open the essay …|external"), and an underscore in the link's PATH drew
// the next character as a subscript, concealed or revealed — the markdown
// tree knows no wikilinks, so `_2026` in `Course_2026/…` was `_2` + "026".
// Live edit now hides `|external` as reading view drops it
// (live/model.js#externalHidden, the engine's rule in engine/wikilinks.js)
// and draws no inline node of the tree inside what the engine reads as text
// (a wikilink or embed, maths, a citation, a {{var}}, a literal directive's
// bracket — model.js#insideOwned).
//
// Fixture (disposable; the scenario writes its own note):
//   mkdir -p V/Course_2026 && cp demo-vault/Attachments/sample.pdf "V/Course_2026/Week_1 notes.pdf"
// Run with CLEW_SMOKE_VAULT=V, CLEW_SMOKE_LOG=1 and a CLEW_USER_DATA of its own.
// Logs (smoke-extlink:):
//   concealed links=["Read the notes (PDF)","Course_2026/Week_1 notes.pdf"] subs-in-links=0 external=2
//          each link's text as drawn, with `|external` gone (the second has
//          no caption: its target's name, as reading view's label); no
//          subscript in either line; both marked to open outside Clew
//   revealed text-ok=true subs=0
//          the cursor in the first link: its whole source, and still no
//          subscript in the path
//   paragraph subs=1   `H_2O` outside any link is still a subscript
//   table cell="In a table" external=true
//          a link in a table cell (live/inline-dom.js): the same text, the
//          same mark
// and main's `smoke-open-path: <V>/Course_2026/Week_1 notes.pdf` after a
// REAL click on the first link (nothing is launched under CLEW_SMOKE).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-extlink: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(20)) if (test()) return true;
	return false;
};

const LINK = '[[Course_2026/Week_1 notes.pdf|Read the notes (PDF)|external]]';
await ipc.invoke('clew:note-write', { path: 'Links.md', content: [
	'# Links',
	'',
	`Open ${LINK} here.`,
	'',
	'[[Course_2026/Week_1 notes.pdf|external]]',
	'',
	'| Kind | Link |',
	'| --- | --- |',
	'| PDF | [[Course_2026/Week_1 notes.pdf\\|In a table\\|external]] |',
	'',
	'End H_2O.',
	'',
].join('\n') });
const tab = workspaceStore.openNote('Links.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-wikilink'));
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.length } });
await sleep(400);

const lineEl = (s) => [...view.contentDOM.querySelectorAll('.cm-line')].find((l) => l.textContent.includes(s));
const linkLines = () => [lineEl('Open '), lineEl('Week_1') ?? lineEl('notes.pdf')].filter(Boolean);
const subsIn = (els) => els.reduce((n, el) => n + el.querySelectorAll('.le-sub, sub').length, 0);

const links = [...view.contentDOM.querySelectorAll('.cm-line > .le-wikilink, .cm-line .le-wikilink')]
	.filter((a) => !a.closest('table'));
log(`concealed links=${JSON.stringify(links.map((a) => a.textContent))} subs-in-links=${subsIn(linkLines())}`
	+ ` external=${links.filter((a) => a.dataset.leExternal).length}`);

const at = view.state.doc.toString().indexOf(LINK) + 10;
view.dispatch({ selection: { anchor: at } });
view.focus();
await sleep(300);
const open = lineEl('Open ');
log(`revealed text-ok=${open?.textContent === `Open ${LINK} here.`} subs=${subsIn([open])}`);

view.dispatch({ selection: { anchor: view.state.doc.length } });
await sleep(300);
log(`paragraph subs=${subsIn([lineEl('End ')])}`);

const cell = document.querySelector('.cm-editor.cm-live table .le-wikilink');
log(`table cell=${JSON.stringify(cell?.textContent ?? null)} external=${Boolean(cell?.dataset.leExternal)}`);

window.__clewSmokeInput = [{ click: { selector: '.cm-editor.cm-live .cm-line .le-wikilink[data-le-external]' } }, { wait: 800 }];
await until(() => !window.__clewSmokeInput?.length, 5000);
await sleep(1000);
log('clicked');
