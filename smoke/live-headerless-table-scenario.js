// The engine's HEADERLESS tables in live edit (docs/dev/live-edit.md §5.5a):
// pure pipe rows, and a separator row first — which lezer parses as a
// paragraph, and which live edit showed as bare pipes until 2026-09-27 (the
// owner's grades table). Drawn and edited in place like a GFM table.
//
// Fixture: `node smoke/make-live-vault.mjs <dir>` (Headerless.md; the run
// edits it — regenerate before each run).
//
//   1. drawn             → `drawn tables=2 th=0,0 rows=3,2 strong=true right=true`
//                           (no header row in either; `*Description*` drawn
//                           strong; the separator's `---:` right-aligns)
//   2. click "65", type 0 → `typed line="| Reasonable | 650 |" active=2,1 widget-kept=true`
//   3. Tab (last cell)   → `appended rows=4 active=3,0`
// Then by command, the cell in row 0 active:
//   4. row above         → `row-above first-blank=true rows=5 active=0,0`
//      delete row        → `delete-row rows=4 first="*Description*"` (the
//                           active cell, so its editor shows the source)
//   5. column right, then delete it → `cols=3` then `cols=2`
//   6. align right       → `aligned separator=true th=0 right=true` — the
//                           pure-pipe table gains a separator row, still headerless
//   7. leave             → `left=true formatted=true th=0` (the reflow keeps it headerless)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, registry } = window.__clew;
const log = (s) => console.log('smoke-hl: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Headerless.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelectorAll('.cm-editor.cm-live .le-table').length === 2);
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.length } });
await sleep(500);

const doc = () => view.state.doc.toString();
const firstTable = () => doc().split('\n').slice(4).filter((l, i, a) => a.slice(0, i + 1).every((x) => x.startsWith('|')));
const tables = () => [...document.querySelectorAll('.le-table')];
const active = () => { const a = document.querySelector('[data-le-active]'); return a ? `${a.dataset.leRow},${a.dataset.leCol}` : 'none'; };
const center = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
const td = (text) => [...document.querySelectorAll('.le-table td')].find((t) => t.textContent === text);
const cols = () => tables()[0]?.querySelector('tr')?.children.length ?? 0;

// 1. Drawn.
{
	const [a, b] = tables();
	const strong = [...(a?.querySelectorAll('td') ?? [])].find((t) => t.textContent === 'Description');
	const rightCell = td('1');
	log(`drawn tables=${tables().length} th=${tables().map((t) => t.querySelectorAll('th').length).join(',')} rows=${tables().map((t) => t.querySelectorAll('tr').length).join(',')} strong=${Boolean(strong?.querySelector('strong, b, .le-strong, .jmd-strong'))} right=${rightCell?.style.textAlign === 'right'}`);
	void b;
}

window.__clewSmokeInput = [
	{ click: center(td('65')) },
	{ wait: 900 },
	{ text: '0' },
	{ wait: 900 },
	{ combo: { key: 'Tab', modifiers: 0 } },
	{ wait: 8000 },
];

setTimeout(() => log(`typed line=${JSON.stringify(doc().split('\n').find((l) => l.includes('Reasonable')))} active=${active()} widget-kept=${tables().length === 2}`), 1500);
setTimeout(async () => { try {
	log(`appended rows=${firstTable().length} active=${active()}`);

	// 4. Row 0 active; a row above it, then that row deleted again.
	registry.runCommand('editor:table-source');
	await sleep(200);
	view.dispatch({ selection: { anchor: doc().indexOf('Description') + 2 } });
	registry.runCommand('editor:table-edit-cell');
	await sleep(400);
	registry.runCommand('format:table-row-above');
	await sleep(500);
	log(`row-above first-blank=${/^\|\s*\|\s*\|$/.test(firstTable()[0])} rows=${firstTable().length} active=${active()}`);
	registry.runCommand('format:table-delete-row');
	await sleep(500);
	log(`delete-row rows=${firstTable().length} first=${JSON.stringify(tables()[0]?.querySelector('td')?.textContent)}`);

	// 5. A column to the right, then gone again.
	registry.runCommand('format:table-col-right');
	await sleep(500);
	const three = cols();
	registry.runCommand('format:table-delete-col');
	await sleep(500);
	log(`cols=${three} then cols=${cols()}`);

	// 6. Right-align the grade column: a separator row appears, no header.
	registry.runCommand('editor:table-source');
	await sleep(200);
	view.dispatch({ selection: { anchor: doc().indexOf('| 80') + 2 } });
	registry.runCommand('editor:table-edit-cell');
	await sleep(300);
	registry.runCommand('format:table-align-right');
	await sleep(500);
	const t0 = tables()[0];
	log(`aligned separator=${/^\|\s*-+\s*\|\s*-+:\s*\|$/.test(firstTable()[0])} th=${t0?.querySelectorAll('th').length} right=${td('80')?.style.textAlign === 'right'}`);

	// 7. Leave: the reflow keeps it headerless and drawn.
	view.dispatch({ selection: { anchor: view.state.doc.length } });
	await sleep(600);
	const lines = firstTable();
	log(`left=${active() === 'none'} formatted=${new Set(lines.map((l) => l.length)).size === 1} th=${tables()[0]?.querySelectorAll('th').length} lines=${JSON.stringify(lines)}`);
} catch (err) { log(`ERROR ${err.message}`); } }, 3200);
