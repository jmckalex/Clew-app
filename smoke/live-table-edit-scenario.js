// Tables edited IN PLACE in live edit (docs/dev/live-edit.md §5.5c): the
// table stays drawn while a cell editor, mounted in the cell, forwards
// every keystroke to the note — the one document, the one undo history.
//
// Fixture: `node smoke/make-live-vault.mjs <dir>` (Cells.md; the run edits
// it — regenerate before each run).
//
// Real input, then — for the whole-table steps, whose targets move as the
// table changes — the same commands the toolbar and the menu run.
//   1. click b1          → `editing=true active=1,1 focus-in-cell=true widget-kept=true`,
//                           `cell-height-ok=true` (no taller than its row)
//   2. type xyz          → `typed line="| a1 | b1xyz | c1 |" same-node=true` — the
//                           table NOT revealed, and the cell editor the SAME
//                           element as in step 1 (CodeMirror patches the table
//                           widget in place; the cell is never re-mounted)
//   3. ⌘Z                → `undone=true still-active=true` (the note's history)
//   4. Tab               → `tab active=1,2`; Tab ×3 → the last cell; Tab →
//                           `appended rows=4 active=3,0` (a row added)
//   5. type a|b, ⇧⏎, c   → `escaped cell="a\\|b<br>c"` in the note
//   6. Esc               → `escaped-out revealed=true cursor-in-cell=true`
//                           (the table as source, the caret where it was); drawn
//                           again, that cell RENDERS its escapes:
//                           `rendered-cell="a|b\nc" br-elements=1 no-backslash=true`
// Then by command:
//   7. edit the cell under the cursor in place; Table: delete row →
//      `deleted rows=3 still-editing=true`
//   8. the note's selection moves below the table → `left=true formatted=true`,
//      and ONE undo takes back only the reflow: `reflow-one-step=true`
//   9. a cell active, Cells.md rewritten on disk (that cell only) →
//      `resynced=true` (the cell editor shows the new text)
//  10. ⌥-click a cell → `alt-click revealed=true`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, registry, ipc } = window.__clew;
const log = (s) => console.log('smoke-te: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Cells.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-table'));
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.length } });
await sleep(500);

const doc = () => view.state.doc.toString();
const tableLines = () => doc().split('\n').filter((l) => l.startsWith('|'));
const active = () => { const a = document.querySelector('[data-le-active]'); return a ? `${a.dataset.leRow},${a.dataset.leCol}` : 'none'; };
const cellEditor = () => document.querySelector('.le-cell-editor');
const revealed = () => !document.querySelector('.le-table') && doc().includes('| --- |') || view.contentDOM.textContent.includes('| A');
const center = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
const td = (text) => [...document.querySelectorAll('.le-table td')].find((t) => t.textContent === text);

const META = 4;
const SHIFT = 8;
window.__clewSmokeInput = [
	{ click: center(td('b1')) },                           // t≈0
	{ wait: 900 },
	{ text: 'xyz' },                                       // t≈1.0
	{ wait: 900 },
	{ combo: { key: 'z', modifiers: META } },              // t≈2.0
	{ wait: 900 },
	{ combo: { key: 'Tab', modifiers: 0 } },               // t≈2.9
	{ wait: 900 },
	{ combo: { key: 'Tab', modifiers: 0 } },
	{ combo: { key: 'Tab', modifiers: 0 } },
	{ combo: { key: 'Tab', modifiers: 0 } },
	{ wait: 600 },
	{ combo: { key: 'Tab', modifiers: 0 } },               // t≈4.6 → appended
	{ wait: 900 },
	{ text: 'a|b' },                                       // t≈5.6
	{ combo: { key: 'Enter', modifiers: SHIFT } },
	{ text: 'c' },
	{ wait: 900 },
	{ combo: { key: 'Escape', modifiers: 0 } },            // t≈6.8
	{ wait: 10000 },                                       // the command phase
];

let node0 = null;
setTimeout(() => {
	node0 = cellEditor();
	log(`editing=${Boolean(node0)} active=${active()} focus-in-cell=${Boolean(node0?.contains(document.activeElement))} widget-kept=${Boolean(document.querySelector('.le-table'))}`);
	// The cell editor sits inside the note's editor, whose theme rules reach
	// it; it must not stand taller than its row (it did — ~40vh — until
	// live-edit.css won the cell's box back).
	const cellTd = document.querySelector('[data-le-active]');
	const sibling = cellTd?.parentElement.querySelector('td:not([data-le-active])');
	log(`cell-height-ok=${Boolean(cellTd && sibling) && Math.abs(cellTd.getBoundingClientRect().height - sibling.getBoundingClientRect().height) < 3}`);
}, 600);
setTimeout(() => log(`typed line=${JSON.stringify(doc().split('\n').find((l) => l.includes('a1')))} same-node=${Boolean(node0) && cellEditor() === node0} widget-kept=${Boolean(document.querySelector('.le-table'))}`), 1600);
setTimeout(() => log(`undone=${doc().includes('| b1 |') && !doc().includes('xyz')} still-active=${active() === '1,1'}`), 2600);
setTimeout(() => log(`tab active=${active()}`), 3500);
setTimeout(() => log(`appended rows=${tableLines().length - 1} active=${active()}`), 5300);
setTimeout(() => log(`escaped cell=${JSON.stringify((doc().split('\n').find((l) => l.includes('a\\|b')) ?? '').split(' | ')[0].replace(/^\| /, '').trim())}`), 6600);
setTimeout(async () => { try {
	const head = view.state.selection.main.head;
	const line = view.state.doc.lineAt(head).text;
	log(`escaped-out revealed=${!document.querySelector('.le-table')} cursor-in-cell=${line.includes('a\\|b')}`);

	// 6b. Drawn again (the selection below the table), the cell must RENDER
	// its escapes: `\|` as `|`, `<br>` as a line break — not their source.
	const cmv = editorPool.get(tab.id).view;
	cmv.dispatch({ selection: { anchor: cmv.state.doc.length } });
	await sleep(500);
	const drawn = [...document.querySelectorAll('.le-table td')].find((t) => t.textContent.includes('a|b'));
	log(`rendered-cell=${JSON.stringify(drawn?.innerText)} br-elements=${drawn?.querySelectorAll('br').length ?? 0} no-backslash=${Boolean(drawn) && !drawn.textContent.includes('\\')}`);
	cmv.dispatch({ selection: { anchor: doc().indexOf('a\\|b') + 1 } });

	// 7. Back into the cell by command, then delete its row.
	registry.runCommand('editor:table-edit-cell');
	await sleep(400);
	const before = tableLines().length;
	registry.runCommand('format:table-delete-row');
	await sleep(500);
	log(`deleted rows=${tableLines().length - 1} (was ${before - 1}) still-editing=${active() !== 'none'} widget=${Boolean(document.querySelector('.le-table'))}`);

	// 8. Leave by moving the note's selection below the table, and type a
	// ragged edit first so the reflow has something to do.
	const cm = editorPool.get(tab.id).view;
	registry.runCommand('editor:table-source');
	await sleep(300);
	cm.dispatch({ selection: { anchor: doc().indexOf('b2') + 2 } });
	registry.runCommand('editor:table-edit-cell');
	await sleep(300);
	const cellView = window.__clew.activeCellView(cm);
	cellView.dispatch({ changes: { from: cellView.state.doc.length, insert: 'LONGER' }, userEvent: 'input.type' });
	await sleep(300);
	const ragged = tableLines().join('\n');
	cm.dispatch({ selection: { anchor: cm.state.doc.length } });
	await sleep(600);
	const after = tableLines();
	const widths = new Set(after.map((l) => l.length));
	log(`left=${active() === 'none'} formatted=${widths.size === 1 && after.join('\n') !== ragged}`);
	registry.runCommand('edit:undo');
	await sleep(300);
	log(`reflow-one-step=${tableLines().join('\n') === ragged}`);
	registry.runCommand('edit:redo');
	await sleep(300);

	// 9. A cell active; the file rewritten on disk in that cell only.
	editorPool.flush(tab.id);
	await sleep(1500);
	cm.dispatch({ selection: { anchor: doc().indexOf('a2') + 1 } });
	registry.runCommand('editor:table-edit-cell');
	await sleep(400);
	const disk = doc().replace('a2', 'FROMDISK');
	await ipc.invoke('clew:note-write', { path: 'Cells.md', content: disk });
	await until(() => cellEditor()?.textContent === 'FROMDISK', 4000);
	log(`resynced=${cellEditor()?.textContent === 'FROMDISK'} still-editing=${active() !== 'none'}`);

	// 10. ⌥-click a cell: the table as source at that cell.
	registry.runCommand('editor:table-source');
	cm.dispatch({ selection: { anchor: cm.state.doc.length } });
	await sleep(500);
	const target = td('c2') ?? document.querySelector('.le-table td');
	target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, altKey: true }));
	await sleep(400);
	log(`alt-click revealed=${!document.querySelector('.le-table')}`);
} catch (err) { log(`ERROR ${err.message}`); } }, 7800);
