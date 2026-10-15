// A live table at a narrow column wraps its cells at WORDS, as reading view
// does — never a letter a line. The table widget sits inside the note's
// .cm-content, whose .cm-lineWrapping (`word-break: break-word;
// overflow-wrap: anywhere`) the cells inherited: a column's narrowest width
// was one letter, and beside a long cell a short one stood "A / h / e / a…"
// (Clew-iOS, the owner's note at an iPad's column, 2026-10-15). A table wider
// than the column scrolls sideways (.le-table-wrap's overflow-x).
//
// Fixture: any vault (`node smoke/make-live-vault.mjs <dir>`); the run writes
// Wrap.md. At a split with both sidebars open (a ~275px column), per table:
// `cols=[…]` the columns' widths, `broken=[…]` the words drawn over more
// than one line (expect none), `scrolls=` whether the table scrolls
// sideways; then the long cell edited in place: `editing … broken=[]` and
// `lines>1` (it still wraps, at words).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-tw: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);

const long = 'A long description of the second option that runs on over several lines at this width';
await ipc.invoke('clew:note-write', {
	path: 'Wrap.md',
	content: '# Wrap\n\nA table:\n\n'
		+ `| Name | Ahead | Description |\n| --- | --- | --- |\n| first | yes | short |\n| second | no | ${long} |\n\n`
		+ 'And one with a long unbroken word:\n\n'
		+ '| Key | Value |\n| --- | --- |\n| url | https://example.org/an/extremely/long/path/without/any/spaces/at/all/in/it |\n',
});
await sleep(600);
const tab = workspaceStore.openNote('Wrap.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
const group = workspaceStore.activeGroupId;
workspaceStore.splitWithClone(group, 'right', tab.id);
workspaceStore.openNote('Welcome.md', { defaultMode: 'source' });
workspaceStore.setSidebar('left', { open: true });
workspaceStore.setSidebar('right', { open: true });
workspaceStore.setActiveGroup(group);
const liveEditor = () => [...document.querySelectorAll('.cm-editor.cm-live')].find((e) => e.getBoundingClientRect().width > 0);
const narrow = () => (liveEditor()?.querySelector('.cm-content').getBoundingClientRect().width ?? 9999) < 420;
for (let i = 0; i < 100 && !(liveEditor()?.querySelectorAll('.le-table').length >= 2 && narrow()); i++) await sleep(100);
await sleep(800);
if (!narrow()) log('not-narrow: the split and sidebars did not narrow the column');

/** Every word in `el` drawn over more than one line. */
function brokenWords(el) {
	const out = [];
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		for (const m of node.data.matchAll(/\S+/g)) {
			const range = document.createRange();
			range.setStart(node, m.index);
			range.setEnd(node, m.index + m[0].length);
			const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
			if (tops.size > 1) out.push(m[0]);
		}
	}
	return out;
}
const lines = (el) => {
	const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
	const style = getComputedStyle(el);
	return Math.round((el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)) / lh);
};

const editor = liveEditor();
const column = Math.round(editor.querySelector('.cm-content').getBoundingClientRect().width);
[...editor.querySelectorAll('.le-table')].forEach((table, i) => {
	const wrap = table.closest('.le-table-wrap') ?? table.parentElement;
	const cols = [...table.rows[0].cells].map((c) => Math.round(c.getBoundingClientRect().width));
	const cells = [...table.querySelectorAll('td, th')];
	log(`table${i + 1} column=${column} cols=${JSON.stringify(cols)} width=${Math.round(table.getBoundingClientRect().width)}`
		+ ` broken=${JSON.stringify(cells.flatMap(brokenWords))} long-cell-lines=${Math.max(...cells.map(lines))}`
		+ ` scrolls=${wrap.scrollWidth > wrap.clientWidth + 1}`);
});

// The long cell, edited in place (a real click): the nested editor wraps it too.
const target = [...editor.querySelectorAll('.le-table td')].find((td) => td.textContent.startsWith('A long'));
const r = target.getBoundingClientRect();
window.__clewSmokeInput = [{ click: { x: Math.round(r.left + 12), y: Math.round(r.top + 10) } }, { wait: 1200 }];
(async () => {
	for (let i = 0; i < 40 && !document.querySelector('.le-table .le-cell-editor'); i++) await sleep(100);
	const cell = document.querySelector('.le-table .le-cell-editor .cm-content');
	log(`editing active=${Boolean(cell)} broken=${JSON.stringify(cell ? brokenWords(cell) : null)} lines=${cell ? lines(cell) : -1}`
		+ ` width=${Math.round(cell?.getBoundingClientRect().width ?? 0)}`);
})();
