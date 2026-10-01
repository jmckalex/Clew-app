// A split layout leaves panes it does not change ALONE (clew-split.js /
// clew-workspace.js): no pane's frames reload, and no editor loses its
// scroll, selection or toolbar, because of something done in ANOTHER pane.
// Fixture: smoke/make-mode-vault.sh. Panes: L = Long.md in live edit
// (scrolled, a selection set), R = Other.md in reading view (its iframe),
// F = Frames.md in live edit (a mermaid block frame). Each operation logs
// `smoke-ss: <op> reloads=<n> detached=<n> L-top=<Δlines> F-top=<Δlines>
// L-sel=<kept> toolbars=<L>/<F> frames=<n>` — reloads and detached counted
// over the frames that existed BEFORE the operation in panes it does not
// touch; L-top/F-top the change in the line at the top of each editor (its
// scroll position as a reader sees it — a pane whose WIDTH changes keeps its
// top line while CodeMirror moves scrollTop for the new wrapping):
//   mode     L live → source → live
//   tab      R opens N01, then back to Other (R's own frame is new — not
//            counted; L's and F's are)
//   split    L split right (a clone of Long in a new pane)
//   close    that new pane closed (the split collapses back)
//   reorder  a tab of F's moved into a new pane right of L (R and F shift)
// Want reloads=0 detached=0 L-top=0 F-top=0 L-sel=kept toolbars=true/true.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, editorPool, settingsStore, registry, actions } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
settingsStore.set('editorToolbar', 'live');

const L = workspaceStore.openNote('Long.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(L.id, 'live');
await sleep(800);
registry.runCommand('workspace:split-right');
await sleep(400);
const R = workspaceStore.openNote('Other.md', { newTab: false, defaultMode: 'reading' });
workspaceStore.setTabMode(R.id, 'reading');
await sleep(400);
registry.runCommand('workspace:split-right');
await sleep(400);
const F = workspaceStore.openNote('Frames.md', { newTab: false, defaultMode: 'live' });
workspaceStore.setTabMode(F.id, 'live');
await sleep(4000);

const groupOf = (tabId) => workspaceStore.allGroups().find((g) => g.tabs.some((t) => t.id === tabId));
const paneEl = (tabId) => [...document.querySelectorAll('clew-tab-group')].find((el) => el.groupId === groupOf(tabId)?.id);
const lView = () => editorPool.get(L.id).view;
const topLine = (tabId) => {
	const v = editorPool.get(tabId)?.view;
	if (!v || !v.dom.isConnected) return null;
	return v.state.doc.lineAt(v.lineBlockAtHeight(v.scrollDOM.scrollTop + 2).from).number;
};
lView().dispatch({ selection: { anchor: lView().state.doc.line(121).from + 3 }, scrollIntoView: true });
await sleep(600);

let nextId = 0;
const loads = new Map();
const tagFrames = () => {
	for (const f of document.querySelectorAll('clew-workspace iframe')) {
		if (f.dataset.smokeId) continue;
		f.dataset.smokeId = String(++nextId);
		loads.set(f.dataset.smokeId, 0);
		f.addEventListener('load', () => loads.set(f.dataset.smokeId, loads.get(f.dataset.smokeId) + 1));
	}
};
const snapshot = (skipTabIds = []) => {
	tagFrames();
	const skip = skipTabIds.map(paneEl).filter(Boolean);
	const frames = [...document.querySelectorAll('clew-workspace iframe')].filter((f) => !skip.some((p) => p.contains(f)));
	const v = lView();
	return {
		frames: frames.map((f) => ({ f, id: f.dataset.smokeId, n: loads.get(f.dataset.smokeId) })),
		lTop: topLine(L.id),
		fTop: topLine(F.id),
		sel: `${v.state.selection.main.anchor}:${v.state.selection.main.head}`,
	};
};
const report = (op, before) => {
	const reloaded = before.frames.filter(({ id, n }) => loads.get(id) !== n);
	const detached = before.frames.filter(({ f }) => !f.isConnected);
	const v = lView();
	const tb = (tabId) => Boolean(paneEl(tabId)?.querySelector('.tab-body clew-editor-toolbar'));
	const d = (now, was) => (now === null || was === null ? '-' : now - was);
	console.log(`smoke-ss: ${op} reloads=${reloaded.length} detached=${detached.length} L-top=${d(topLine(L.id), before.lTop)} F-top=${d(topLine(F.id), before.fTop)}`
		+ ` L-sel=${`${v.state.selection.main.anchor}:${v.state.selection.main.head}` === before.sel ? 'kept' : 'lost'}`
		+ ` toolbars=${tb(L.id)}/${tb(F.id)} frames=${before.frames.length}`);
};
console.log(`smoke-ss: setup panes=${workspaceStore.allGroups().length} block-frames=${paneEl(F.id)?.querySelectorAll('.le-frames iframe').length} reading-frame=${Boolean(paneEl(R.id)?.querySelector('.preview-frame'))}`);

// mode: L live → source → live (L's own view stays; R's and F's frames counted)
let before = snapshot([L.id]);
workspaceStore.setTabMode(L.id, 'source'); await sleep(900);
workspaceStore.setTabMode(L.id, 'live'); await sleep(1500);
report('mode', before);

// tab: R switches to N01 and back
before = snapshot([R.id]);
workspaceStore.setActiveGroup(groupOf(R.id).id);
const n01 = workspaceStore.openNote('N01.md', { newTab: true, defaultMode: 'source' });
workspaceStore.activateTab(n01.id); await sleep(900);
workspaceStore.activateTab(R.id); await sleep(2000);
report('tab', before);

// split: L split right
before = snapshot();
workspaceStore.setActiveGroup(groupOf(L.id).id);
registry.runCommand('workspace:split-right'); await sleep(1500);
report('split', before);
const clone = workspaceStore.activeTab();

// close: that pane
before = snapshot();
const closed = workspaceStore.closeGroup(groupOf(clone.id).id, { force: true });
for (const id of closed ?? []) editorPool.close(id);
await sleep(1500);
report('close', before);

// reorder: a second tab of F's moved into a new pane right of L
workspaceStore.setActiveGroup(groupOf(F.id).id);
const n02 = workspaceStore.openNote('N02.md', { newTab: true, defaultMode: 'source' });
workspaceStore.activateTab(F.id); await sleep(1500);
before = snapshot();
workspaceStore.splitWithTab(groupOf(L.id).id, 'right', n02.id); await sleep(1500);
report('reorder', before);
console.log(`smoke-ss: order ${[...document.querySelectorAll('clew-tab-group')].map((g) => workspaceStore.allGroups().find((x) => x.id === g.groupId)?.tabs.find((t) => t.id === workspaceStore.allGroups().find((x) => x.id === g.groupId)?.activeTabId)?.path).join(' | ')}`);
