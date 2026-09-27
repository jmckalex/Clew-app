// Line formats on an EMPTY line (the owner's report, 2026-09-27): the list
// buttons and `//` → Center / Right did nothing there — the line commands
// only rewrote lines that had text. Real clicks and typing, in live edit.
//
// Fixture (any disposable vault):
//   mkdir -p /tmp/el-vault && printf '%s\n' '# Empty lines' '' 'Last line.' \
//     > /tmp/el-vault/Empty.md
//
// Expect: `bullet="- one" numbered="1. two" task="- [ ] three"`, then
// `center=">> mid <<" right=">> end"` — each started on an empty line, the
// typing landing where the text goes.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool } = window.__clew;
const log = (s) => console.log('smoke-el: ' + s);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Empty.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await sleep(2000);
const view = editorPool.get(tab.id).view;
const btn = (label) => [...document.querySelectorAll('clew-editor-toolbar button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith(label));
const c = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
// Five empty lines to work on, the cursor on the first.
view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '# Empty lines\n\n\n\n\n\n\nLast line.\n' }, selection: { anchor: 15 } });
view.focus();
await sleep(400);
const line = (n) => view.state.doc.line(n).text;
const down = { combo: { key: 'ArrowDown', modifiers: 0 } };
const enter = { combo: { key: 'Enter', modifiers: 0 } };
window.__clewSmokeInput = [
	{ click: c(btn('Bullet list')) }, { wait: 300 }, { text: 'one' }, { wait: 300 }, down, { combo: { key: 'Home', modifiers: 0 } },
	{ click: c(btn('Numbered list')) }, { wait: 300 }, { text: 'two' }, { wait: 300 }, down, { combo: { key: 'Home', modifiers: 0 } },
	{ click: c(btn('Task list')) }, { wait: 300 }, { text: 'three' }, { wait: 300 }, down, { combo: { key: 'Home', modifiers: 0 } },
	{ text: '//center' }, { wait: 700 }, enter, { wait: 400 }, { text: 'mid' }, { wait: 300 }, down, { combo: { key: 'Home', modifiers: 0 } },
	{ text: '//right' }, { wait: 700 }, enter, { wait: 400 }, { text: 'end' }, { wait: 5000 },
];
setTimeout(() => {
	log(`bullet=${JSON.stringify(line(3))} numbered=${JSON.stringify(line(4))} task=${JSON.stringify(line(5))}`);
	log(`center=${JSON.stringify(line(6))} right=${JSON.stringify(line(7))}`);
}, 8000);
