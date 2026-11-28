// The link preview's Open button (docs/dev/live-edit.md §5.11; the owner's
// report 2026-11-28: Open REPLACED the tab being read — now a tab of its own,
// ⌘-click this tab). Real pointer moves and clicks over `Hover.md` in a
// scratch copy of the demo vault: `node smoke/make-hover-vault.mjs <dir>`.
// Each step starts from a known state — Hover.md the one tab, in live edit
// unless said — so a step's result never depends on the one before:
//   1. hover [[Welcome]], click Open    → `plain new-tab=true hover-kept=true active=Welcome.md tabs=2`
//   2. Welcome.md already in a tab of this pane, the same
//                                       → `reused active=Welcome.md tabs=2` (its tab, never a second)
//   3. ⌘-click Open                     → `meta in-place=true active=Welcome.md tabs=1`
//   4. reading mode, the long link, Open → `reading new-tab=true hover-kept=true active=Welcome.md tabs=2`
// A step's log names what happened, so the run before the fix says
// `new-tab=false` (and `tabs=1`) where Open replaced the tab.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, settingsStore } = window.__clew;
const log = (s) => console.log('smoke-lpo: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
settingsStore.set('linkPreview', 'hover');
const tab = workspaceStore.openNote('Hover.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');

const tabs = () => workspaceStore.allGroups().flatMap((g) => g.tabs);
const hoverTab = () => workspaceStore.findTab(tab.id)?.tab;
const drawn = () => until(() => document.querySelector('.cm-editor.cm-live .le-wikilink[data-le-target="Welcome"]'));
/** Hover.md the only tab, active, in `mode`. */
async function reset(mode) {
	for (const t of tabs()) {
		if (t.id === tab.id) continue;
		workspaceStore.closeTab(t.id, { force: true });
		editorPool.close(t.id);
	}
	workspaceStore.activateTab(tab.id);
	if (hoverTab().path !== 'Hover.md') workspaceStore.navigate(tab.id, 'Hover.md');
	workspaceStore.setTabMode(tab.id, mode);
	if (mode === 'live') await drawn();
	await sleep(800);
}
/** The step's marker, which the input queue waits for before it goes on. */
const ready = (n) => document.body.append(Object.assign(document.createElement('i'), { id: `smoke-lpo-${n}`, hidden: true }));
const state = () => {
	const active = workspaceStore.activeTab();
	return { active: active?.path, count: tabs().length, hover: hoverTab()?.path, isHover: active?.id === tab.id };
};

await reset('live');
const view = editorPool.get(tab.id).view;
// Where the reading view's link will be: the long aliased link's third line
// box, as link-preview-scenario.js finds it (the queue is read once).
const longRects = [...document.querySelector('.le-wikilink').getClientRects()];
const R = { x: Math.round(longRects[2].left + 60), y: Math.round((longRects[2].top + longRects[2].bottom) / 2) };
const edge = view.scrollDOM.getBoundingClientRect();
const E = { x: Math.round(edge.right - 30), y: Math.round(edge.top + 12) };

const META = 4;
const WELCOME = { move: { selector: '.cm-editor.cm-live .le-wikilink[data-le-target="Welcome"]' } };
const SHOWN = { until: { selector: 'clew-link-preview:not([hidden]) .link-preview-open:not([hidden])' } };
const OPEN = { click: { selector: 'clew-link-preview .link-preview-open' } };
window.__clewSmokeInput = [
	{ move: E }, { wait: 300 }, WELCOME, SHOWN, { wait: 300 }, OPEN,                       // 1
	{ until: { selector: '#smoke-lpo-2' } }, { move: E }, { wait: 300 }, WELCOME, SHOWN, { wait: 300 }, OPEN, // 2
	{ until: { selector: '#smoke-lpo-3' } }, { move: E }, { wait: 300 }, WELCOME, SHOWN, { wait: 300 }, { ...OPEN, modifiers: META }, // 3
	{ until: { selector: '#smoke-lpo-4', ms: 20000 } }, { move: E }, { wait: 300 }, { move: R }, SHOWN, { wait: 300 }, OPEN, // 4
	{ wait: 2500 },
];

(async () => { try {
	const opened = () => until(() => workspaceStore.activeTab()?.path === 'Welcome.md' || hoverTab()?.path === 'Welcome.md');

	await opened();
	await sleep(400);
	let s = state();
	log(`plain new-tab=${!s.isHover && s.count === 2} hover-kept=${s.hover === 'Hover.md'} active=${s.active} tabs=${s.count}`);

	await reset('live');
	const welcome = workspaceStore.openNote('Welcome.md', { newTab: true });
	workspaceStore.activateTab(tab.id);
	await drawn();
	await sleep(800);
	ready(2);
	await until(() => workspaceStore.activeTab()?.id !== tab.id || hoverTab()?.path !== 'Hover.md');
	await sleep(400);
	s = state();
	log(`reused active=${s.active} tabs=${s.count} its-tab=${workspaceStore.activeTab()?.id === welcome.id}`);

	await reset('live');
	ready(3);
	await opened();
	await sleep(400);
	s = state();
	log(`meta in-place=${s.isHover && s.hover === 'Welcome.md'} active=${s.active} tabs=${s.count}`);

	await reset('reading');
	await until(() => document.querySelector('clew-preview-view iframe'));
	await sleep(2500);
	ready(4);
	await opened();
	await sleep(400);
	s = state();
	log(`reading new-tab=${!s.isHover && s.count === 2} hover-kept=${s.hover === 'Hover.md'} active=${s.active} tabs=${s.count}`);
} catch (err) { log('ERROR ' + err.stack); } })();
