// The `//` menu (editor/complete/slash-commands.js) with real typing, in live
// edit over `Slash.md`.
//
// Fixture: `node smoke/make-live-vault.mjs <dir>` (the run edits Slash.md —
// regenerate before each run).
//
//   1. a new line, `//`     → `open=true sections=8 first="Strong"` (the
//                              Format menu, in its sections and order)
//   2. `head`               → `filtered first="Heading 1" sections=0` (one list
//                              ranked by the match)
//   3. ` 2`, Enter          → `accepted line="## " slashes-gone=true`
//   4. `//`, Escape         → `escaped menu=false kept=true` (the text stays)
//   5. `see https://`       → `url menu=false`
//   6. `//` in a code fence → `code menu=false`
//   7. setting off, `//`    → `setting-off menu=false`
//   8. in a table cell, ` //str` → `cell open=true inline-only=true`; Enter →
//      `cell-accepted cell="b1 **"` (Strong, in the cell; no `//` left)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, settingsStore, registry } = window.__clew;
const log = (s) => console.log('smoke-slash: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
settingsStore.set('slashCommands', true);
const tab = workspaceStore.openNote('Slash.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live'));
await sleep(600);
const view = editorPool.get(tab.id).view;
const doc = () => view.state.doc.toString();
const lineAtCursor = () => view.state.doc.lineAt(view.state.selection.main.head).text;
const menu = () => document.querySelector('.cm-tooltip-autocomplete');
const labels = () => [...(menu()?.querySelectorAll('.cm-completionLabel') ?? [])].map((e) => e.textContent);
const sections = () => menu()?.querySelectorAll('completion-section').length ?? 0;

const proseEnd = doc().indexOf('Some prose here.') + 'Some prose here.'.length;
const at = view.coordsAtPos(proseEnd);

window.__clewSmokeInput = [
	{ click: { x: Math.round(at.right + 4), y: Math.round((at.top + at.bottom) / 2) } },
	{ wait: 300 },
	{ combo: { key: 'Enter', modifiers: 0 } },
	{ text: '//' },
	{ wait: 1200 },
	{ text: 'head' },
	{ wait: 1000 },
	{ text: ' 2' },
	{ wait: 600 },
	{ combo: { key: 'Enter', modifiers: 0 } },
	{ wait: 1200 },
	{ combo: { key: 'Enter', modifiers: 0 } },
	{ text: '//' },
	{ wait: 1000 },
	{ combo: { key: 'Escape', modifiers: 0 } },
	{ wait: 1000 },
	{ combo: { key: 'Enter', modifiers: 0 } },
	{ text: 'see https://' },
	{ wait: 2000 },                        // the scenario moves into the fence
	{ text: '//' },
	{ wait: 2000 },                        // … turns the setting off
	{ text: '//' },
	{ wait: 2500 },                        // … puts a table cell in edit
	{ text: ' //str' },
	{ wait: 1200 },
	{ combo: { key: 'Enter', modifiers: 0 } },
	{ wait: 1500 },
];

(async () => { try {
	await until(() => menu());
	await sleep(200);
	log(`open=${Boolean(menu())} sections=${sections()} first=${JSON.stringify(labels()[0])}`);

	await until(() => lineAtCursor().endsWith('//head'));
	await sleep(400);
	log(`filtered first=${JSON.stringify(labels()[0])} sections=${sections()}`);

	await until(() => lineAtCursor().startsWith('## '));
	await sleep(200);
	log(`accepted line=${JSON.stringify(lineAtCursor())} slashes-gone=${!doc().includes('//head')}`);

	await until(() => lineAtCursor() === '//' && menu());
	await until(() => !menu(), 3000);
	await sleep(200);
	log(`escaped menu=${Boolean(menu())} kept=${lineAtCursor() === '//'}`);

	await until(() => lineAtCursor() === 'see https://');
	await sleep(600);
	log(`url menu=${Boolean(menu())}`);

	const inFence = doc().indexOf('const x = 1;') + 'const x = 1;'.length;
	view.dispatch({ selection: { anchor: inFence } });
	view.focus();
	await until(() => doc().includes('const x = 1;//'));
	await sleep(600);
	log(`code menu=${Boolean(menu())}`);

	settingsStore.set('slashCommands', false);
	view.dispatch({ selection: { anchor: doc().indexOf('Last line.') + 'Last line.'.length } });
	view.focus();
	await until(() => doc().includes('Last line.//'));
	await sleep(600);
	log(`setting-off menu=${Boolean(menu())}`);
	settingsStore.set('slashCommands', true);

	view.dispatch({ selection: { anchor: doc().indexOf('b1') + 2 } });
	registry.runCommand('editor:table-edit-cell');
	await until(() => document.querySelector('.le-cell-editor'));
	window.__clew.activeCellView(view)?.focus();
	await until(() => menu() && doc().includes('b1 //str'));
	await sleep(300);
	const offered = labels();
	log(`cell open=${Boolean(menu())} offered=${JSON.stringify(offered)} inline-only=${offered.length > 0 && !offered.some((l) => /Heading|List|Table|Block/.test(l))}`);
	await until(() => !doc().includes('//str'));
	await sleep(300);
	const row = doc().split('\n').find((l) => l.includes('a1')) ?? '';
	log(`cell-accepted row=${JSON.stringify(row)} cell=${JSON.stringify(row.split('|')[2]?.trim())}`);
} catch (err) { log('ERROR ' + err.stack); } })();
