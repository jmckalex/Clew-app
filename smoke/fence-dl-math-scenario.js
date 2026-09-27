// Three fixes from the owner's report (2026-09-27), in live edit:
//   1. a ```javascript fence is highlighted → `js keyword=true number=true
//      distinct-colours=true` (the keyword's colour is not the plain code's)
//   2. the description-list insert writes the engine's `Term:: definition`
//      → `dl source="Term:: Definition of the term." dt=true sep=true
//      colons-hidden=true`
//   3. the preview pane of an inline formula has no vertical scrollbar
//      (its thumb looked like a cursor after the formula) →
//      `pane-scrollbar=false`
//
// Fixture (any disposable vault):
//   mkdir -p /tmp/fdm && printf '%s\n' '# Fixes' '' '```javascript' \
//     'let i = 10;' 'function foo() {}' '```' '' 'Consider which $10\alpha+$ holds.' \
//     '' '' 'Last line.' > /tmp/fdm/Fixes.md
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, registry } = window.__clew;
const log = (s) => console.log('smoke-fdm: ' + s);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Fixes.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await sleep(2000);
const view = editorPool.get(tab.id).view;
const doc = () => view.state.doc.toString();

// 1
const kw = [...document.querySelectorAll('.cm-code-token.jmd-keyword')].find((e) => e.textContent === 'let');
const num = [...document.querySelectorAll('.cm-code-token.jmd-number')].find((e) => e.textContent === '10');
const plain = [...document.querySelectorAll('.cm-line')].find((l) => l.textContent.includes('let i'));
log(`js keyword=${Boolean(kw)} number=${Boolean(num)} distinct-colours=${Boolean(kw) && getComputedStyle(kw).color !== getComputedStyle(plain).color}`);

// 2: the insert command, on the empty line before "Last line."
view.dispatch({ selection: { anchor: doc().indexOf('\n\nLast line.') + 1 } });
view.focus();
registry.runCommand('format:description-list');
await sleep(300);
const line = view.state.doc.lineAt(doc().indexOf('Term::')).text;
view.dispatch({ selection: { anchor: doc().length } });
await sleep(400);
const dtLine = [...document.querySelectorAll('.cm-line')].find((l) => l.querySelector('.le-dt'));
log(`dl source=${JSON.stringify(line)} dt=${Boolean(dtLine)} sep=${Boolean(dtLine?.querySelector('.le-dt-sep'))} colons-hidden=${Boolean(dtLine) && !dtLine.textContent.includes('::')}`);

// 3: into the inline formula by a real click, then look at the pane.
const m = document.querySelector('.cm-content .le-math').getBoundingClientRect();
window.__clewSmokeInput = [{ click: { x: Math.round(m.left + m.width / 2), y: Math.round(m.top + m.height / 2) } }, { wait: 300 }, { combo: { key: 'ArrowRight', modifiers: 0 } }, { wait: 1200 }];
setTimeout(() => {
	const math = document.querySelector('clew-preview-pane .preview-pane-math');
	const body = document.querySelector('clew-preview-pane .preview-pane-body');
	const scrolls = (el) => getComputedStyle(el).overflowY !== 'hidden' && el.scrollHeight > el.clientHeight;
	log(`pane-visible=${!document.querySelector('clew-preview-pane').hidden} pane-scrollbar=${scrolls(math) || scrolls(body)}`);
}, 1200);
