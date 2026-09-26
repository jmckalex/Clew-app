// Live edit's Tier B widgets (plan §5.5a/b): tables drawn as <table>, images
// drawn in place. Fixture: `node smoke/make-live-vault.mjs <dir>` (Tables.md;
// the run types into it — regenerate before each run).
//
// Expect (cursor parked on the last line): `table-widget=1 rows=3 cols=3`;
// `align=left,center,right`; `strong-cell=true` (a cell's HTML holds
// <strong>), `math-cell=svg`, `link-cell="a link"`, `code-cell=code`;
// `images=3 loaded=3` — the sized wikilink (`width=120`), the markdown path,
// the inline one; `remote-chip=true`, `missing-chip="Image not found: nowhere.png"`.
// Then REAL input: click the cell holding `two` → it is edited IN PLACE
// (`in-place=true active=2,0 cursor-line="| two | ..."` — the table stays
// drawn; live-table-edit-scenario.js covers editing in depth); Tab →
// `after-tab active=2,1 cell="[[Blocks\|a link]]"` (the note's text of the
// cell now being edited). The fixture escapes the pipe inside the wikilink,
// as a GFM table requires — a bare one splits the cell, in Obsidian too.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool } = window.__clew;
const log = (s) => console.log('smoke-lt: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
const tab = workspaceStore.openNote('Tables.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-table'));
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.length } });
await until(() => document.querySelector('.le-table svg') && [...document.querySelectorAll('.le-image img')].every((i) => i.complete), 8000);
await sleep(400);

const q = (s) => document.querySelector(s);
const qa = (s) => [...document.querySelectorAll(s)];
const table = q('.le-table');
log(`table-widget=${qa('.le-table').length} rows=${table.rows.length} cols=${table.rows[0].cells.length}`);
log(`align=${[...table.rows[0].cells].map((c) => c.style.textAlign || 'none').join(',')}`);
log(`strong-cell=${Boolean(table.querySelector('td strong'))} math-cell=${table.querySelector('td svg') ? 'svg' : 'none'} link-cell=${JSON.stringify(table.querySelector('td .le-wikilink')?.textContent)} code-cell=${table.querySelector('td code') ? 'code' : 'none'}`);
const imgs = qa('.le-image img');
log(`images=${imgs.length} loaded=${imgs.filter((i) => i.complete && i.naturalWidth > 0).length} widths=${imgs.map((i) => i.getAttribute('width') ?? '-').join(',')}`);
log(`remote-chip=${qa('.le-image-chip').some((c) => c.textContent.startsWith('Remote'))} missing-chip=${JSON.stringify(qa('.le-image-chip').map((c) => c.textContent).find((t) => t.startsWith('Image not found')))}`);

const cell = [...table.querySelectorAll('td')].find((td) => td.textContent === 'two');
const r = cell.getBoundingClientRect();
window.__clewSmokeInput = [
	{ click: { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } },
	{ wait: 800 },
	{ combo: { key: 'Tab', modifiers: 0 } },
	{ wait: 800 },
];
const cursorLine = () => view.state.doc.lineAt(view.state.selection.main.head).text;
const activeCell = () => { const a = q('[data-le-active]'); return a ? `${a.dataset.leRow},${a.dataset.leCol}` : 'none'; };
setTimeout(() => log(`in-place=${Boolean(q('.le-table') && q('.le-cell-editor'))} active=${activeCell()} cursor-line=${JSON.stringify(cursorLine())}`), 600);
setTimeout(() => {
	const head = view.state.selection.main;
	const cell = window.__clew.activeCellView(view)?.state.doc.toString();
	log(`after-tab active=${activeCell()} cell=${JSON.stringify(cell)}`);
}, 1500);
