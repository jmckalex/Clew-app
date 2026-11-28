// Where a link followed from a link preview opens (docs/dev/live-edit.md
// §5.11): its Open button, its "No note called …" card, and a link clicked
// INSIDE it. The owner, 2026-11-28: Open replaced the tab being read — Open
// and the card now open a tab of their own, ⌘-click this tab. Real pointer
// moves and clicks, each held 80 ms as a hand holds one (a click sent back to
// back finished before the focus change it set off, and hid the bug in step
// 7), over `Hover.md` in a scratch copy of the demo vault: `node
// smoke/make-hover-vault.mjs <dir>`. Each step starts from a known state —
// Hover.md the one tab, in live edit unless said — so its result never
// depends on the one before:
//   1. hover [[Welcome]], click Open    → `plain new-tab=true hover-kept=true active=Welcome.md tabs=2`
//   2. Welcome.md already in a tab of this pane, the same
//                                       → `reused active=Welcome.md tabs=2 its-tab=true`
//   3. ⌘-click Open                     → `meta in-place=true active=Welcome.md tabs=1`
//   4. reading mode, the long link, Open → `reading new-tab=true hover-kept=true active=Welcome.md tabs=2`
//   5. [[Gap one]]'s card               → `card new-tab=true hover-kept=true active=Gap one.md tabs=2`
//   6. [[Gap two]]'s card, ⌘            → `card-meta in-place=true active=Gap two.md tabs=1`
//   7. the guide section's first link, clicked in the popover
//                                       → `inner in-place=true active=Guide/Vaults and Files.md tabs=1`
//      (until 2026-11-28 the press moved focus into the popover's frame, the
//      window's blur hid it, and the click never arrived: `in-place=false
//      active=Hover.md`)
//   8. the same, ⌘                      → `inner-meta new-tab=true hover-kept=true active=Guide/Vaults and Files.md tabs=2`
//   9. a press on the section's heading in the popover, then Esc
//                                       → `escape pressed-shown=true hidden=true editor-focused=true`
// A step's log says what happened, so a run on code without the rule says
// `false` where it differs.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, settingsStore, vaultStore, linkPreview } = window.__clew;
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
const view = () => editorPool.get(tab.id).view;
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
	if (mode === 'live') view().focus();
	await sleep(800);
}
/** A marker the input queue waits for before it goes on. */
const mark = (id) => document.body.append(Object.assign(document.createElement('i'), { id: `smoke-lpo-${id}`, hidden: true }));
const state = () => {
	const active = workspaceStore.activeTab();
	return { active: active?.path, count: tabs().length, hover: hoverTab()?.path, isHover: active?.id === tab.id };
};
/** Wait for `path` to be shown, here or in a new tab; then the state. */
async function landed(path) {
	await until(() => workspaceStore.activeTab()?.path === path || hoverTab()?.path === path);
	await sleep(400);
	return state();
}
const newTab = (s) => `new-tab=${!s.isHover && s.count === 2} hover-kept=${s.hover === 'Hover.md'} active=${s.active} tabs=${s.count}`;
const inPlace = (s, path) => `in-place=${s.isHover && s.hover === path} active=${s.active} tabs=${s.count}`;

await reset('live');
// Where the reading view's link will be: the long aliased link's third line
// box, as link-preview-scenario.js finds it (the queue is read once).
const longRects = [...document.querySelector('.le-wikilink').getClientRects()];
const R = { x: Math.round(longRects[2].left + 60), y: Math.round((longRects[2].top + longRects[2].bottom) / 2) };
const edge = view().scrollDOM.getBoundingClientRect();
const E = { x: Math.round(edge.right - 30), y: Math.round(edge.top + 12) };
const GUIDE = vaultStore.resolveNoteName('Vaults and Files');

const META = 4;
const AWAY = [{ move: E }, { wait: 300 }];
const link = (target) => ({ move: { selector: `.cm-editor.cm-live .le-wikilink[data-le-target="${target}"]` } });
const SHOWN = { until: { selector: 'clew-link-preview:not([hidden]) .link-preview-open:not([hidden])' } };
const CARD_SHOWN = { until: { selector: 'clew-link-preview:not([hidden]) .link-preview-card:not([hidden])' } };
const HOLD = 80;
const OPEN = { click: { selector: 'clew-link-preview .link-preview-open' }, hold: HOLD };
const CARD = { click: { selector: 'clew-link-preview .link-preview-card' }, hold: HOLD };
const INNER = { frameClick: { match: '__clew_block__', selector: 'a.internal-link' }, hold: HOLD };
const HEADING = { frameClick: { match: '__clew_block__', selector: 'h2' }, hold: HOLD };
const go = (n, ms = 20000) => ({ until: { selector: `#smoke-lpo-${n}`, ms } });
/** Hover the long link (Welcome › The guide), wait for its document, click a link in it. */
const inner = (n, modifiers = 0) => [...AWAY, link('Welcome#The guide'), SHOWN, go(`${n}-ready`), { ...INNER, modifiers }];
window.__clewSmokeInput = [
	...AWAY, link('Welcome'), SHOWN, { wait: 300 }, OPEN,                                   // 1
	go(2), ...AWAY, link('Welcome'), SHOWN, { wait: 300 }, OPEN,                            // 2
	go(3), ...AWAY, link('Welcome'), SHOWN, { wait: 300 }, { ...OPEN, modifiers: META },    // 3
	go(4), ...AWAY, { move: R }, SHOWN, { wait: 300 }, OPEN,                                // 4
	go(5), ...AWAY, link('Gap one'), CARD_SHOWN, { wait: 300 }, CARD,                       // 5
	go(6), ...AWAY, link('Gap two'), CARD_SHOWN, { wait: 300 }, { ...CARD, modifiers: META }, // 6
	go(7), ...inner(7),                                                                     // 7
	go(8), ...inner(8, META),                                                               // 8
	go(9), ...AWAY, link('Welcome#The guide'), SHOWN, go('9-ready'), HEADING, { wait: 600 }, go('9-pressed'),
	{ combo: { key: 'Escape', modifiers: 0 } },                                             // 9
	{ wait: 4000 },
];

/** Mark step `n` ready once its popover's document has loaded. */
async function popoverReady(n) {
	await until(() => { const p = linkPreview().describe(); return p.visible && p.ready && p.label?.includes('The guide'); }, 15000);
	await sleep(500);
	mark(`${n}-ready`);
}

(async () => { try {
	let s = await landed('Welcome.md');
	log(`plain ${newTab(s)}`);

	await reset('live');
	const welcome = workspaceStore.openNote('Welcome.md', { newTab: true });
	workspaceStore.activateTab(tab.id);
	await drawn();
	await sleep(800);
	mark(2);
	await until(() => workspaceStore.activeTab()?.id !== tab.id || hoverTab()?.path !== 'Hover.md');
	await sleep(400);
	s = state();
	log(`reused active=${s.active} tabs=${s.count} its-tab=${workspaceStore.activeTab()?.id === welcome.id}`);

	await reset('live');
	mark(3);
	log(`meta ${inPlace(await landed('Welcome.md'), 'Welcome.md')}`);

	await reset('reading');
	await until(() => document.querySelector('clew-preview-view iframe'));
	await sleep(2500);
	mark(4);
	log(`reading ${newTab(await landed('Welcome.md'))}`);

	await reset('live');
	mark(5);
	log(`card ${newTab(await landed('Gap one.md'))}`);

	await reset('live');
	mark(6);
	log(`card-meta ${inPlace(await landed('Gap two.md'), 'Gap two.md')}`);

	await reset('live');
	mark(7);
	await popoverReady(7);
	log(`inner ${inPlace(await landed(GUIDE), GUIDE)}`);

	await reset('live');
	mark(8);
	await popoverReady(8);
	log(`inner-meta ${newTab(await landed(GUIDE))}`);

	await reset('live');
	mark(9);
	await popoverReady(9);
	await until(() => document.activeElement?.classList.contains('link-preview-frame'), 5000);
	const pressed = !linkPreview().describe().visible ? false : document.activeElement?.classList.contains('link-preview-frame');
	mark('9-pressed');
	await until(() => !linkPreview().describe().visible, 2000);
	await sleep(300);
	log(`escape pressed-shown=${pressed} hidden=${!linkPreview().describe().visible} editor-focused=${view().hasFocus}`);
} catch (err) { log('ERROR ' + err.stack); } })();
