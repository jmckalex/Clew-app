// Manual screenshot: the Diagrams note split — source (the ```tikz both
// fence highlighted as TeX) beside reading mode (the same block: its code
// then the figure). Right sidebar closed so both panes get their width.
// manual/images/fence-split.png — editing.html / diagrams.html.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, actions } = window.__clew;
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Features/Diagrams.md', { newTab: true, defaultMode: 'source' });
await sleep(2500);
const entry = editorPool.get(tab.id);
const lines = entry.view.state.doc.toString().split('\n');
const line = lines.findIndex((l) => l.startsWith('```tikz both')) + 1;
console.log('smoke-manual: fence-line=' + line);
actions.jumpToLine(tab.id, line);
await sleep(1300);
const before = new Set(workspaceStore.allGroups().map((g) => g.id));
actions.splitActive('right');
await sleep(600);
const fresh = workspaceStore.allGroups().find((g) => !before.has(g.id));
if (fresh) workspaceStore.setActiveGroup(fresh.id);
await sleep(200);
const active = workspaceStore.activeTab();
console.log('smoke-manual: active-mode=' + active?.view?.mode + ' groups=' + workspaceStore.allGroups().length);
if (active?.view?.mode !== 'reading') actions.toggleReadingMode();
await sleep(12000);
// Splitting re-parents the editor's DOM, which resets its scroll — so
// scroll the source pane to the fence AFTER everything has settled (the
// pool keeps the same EditorView; fence-split-frame.js does the reading
// pane).
const view = editorPool.get(tab.id).view;
const pos = view.state.doc.line(line).from;
view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(pos).top - 28);
await sleep(800);
console.log('smoke-manual: editor-top-line=' + view.state.doc.lineAt(view.posAtCoords({ x: view.scrollDOM.getBoundingClientRect().left + 8, y: view.scrollDOM.getBoundingClientRect().top + 4 }, false)).number);
