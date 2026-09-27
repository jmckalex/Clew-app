// The editor toolbar (docs/dev/live-edit.md §6) with real input. Run
// with CLEW_SMOKE_MENU=1 for the menu half.
//
// Fixture (regenerate before every run — it is edited):
//
//   mkdir -p /tmp/tb-vault && printf '%s\n' '# Toolbar' '' 'alpha beta gamma' '' \
//     'delta epsilon zeta' '' 'Last line.' > /tmp/tb-vault/Toolbar.md
//
// Expect: `smoke-menu: View > Live Edit [CmdOrCtrl+Shift+E]`, the `View >
// Mode` radios and `View > Editor Toolbar`; `toolbar=true groups=6 overflow=`
// (nothing overflows with the sidebars closed); then —
//   `strong-click line="*alpha* beta gamma"` (a real click on the button,
//     the selection kept: the bar never steals focus);
//   `pressed=strong` with the cursor inside the word, and a second click
//     `unwrapped line="alpha beta gamma"` (the toolbar's unwrap-from-inside);
//   `table rows=3 cols=2` from the table popover's 3 × 2 cell;
//   `bubble=visible` after a real triple-click, `bubble-after-escape=hidden`;
//   `focus-in-toolbar=true` after ⌥⇧T and `focused-after-arrows=<label>`;
//   `after-toggle mode=source toolbar=false` (⌘⇧E; shown in live only by
//     default), `after-toggle mode=live toolbar=true`;
//   `narrow overflow="…" mode-visible=true` in a pane split three ways.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, actions } = window.__clew;
const log = (s) => console.log('smoke-tb: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
// Full width: the smoke window is 1280px, and with both sidebars open the
// pane is ~730px — where Lists and Insert rightly overflow.
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Toolbar.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('clew-editor-view clew-editor-toolbar'));
await sleep(600);
const view = editorPool.get(tab.id).view;
const bar = () => document.querySelector('clew-editor-view clew-editor-toolbar');
const doc = () => view.state.doc.toString();
const lineWith = (s) => doc().split('\n').find((l) => l.includes(s));
const groupsShown = () => [...bar().querySelectorAll(':scope > .toolbar-group')].filter((g) => !g.hidden).length;
log(`toolbar=${Boolean(bar())} groups=${groupsShown()} overflow=${bar().dataset.overflow ?? ''}`);

const center = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
const button = (cmd) => bar().querySelector(`[data-command="${cmd}"]`);
const alpha = doc().indexOf('alpha');
view.focus();
view.dispatch({ selection: { anchor: alpha, head: alpha + 5 } });
const strongPoint = center(button('edit:format-strong'));
const tablePoint = center(bar().querySelector('[data-popover="table"]'));
const deltaLine = [...document.querySelectorAll('.cm-line')].find((l) => l.textContent.startsWith('delta'));
const deltaPoint = { x: Math.round(deltaLine.getBoundingClientRect().left + 30), y: Math.round(deltaLine.getBoundingClientRect().top + deltaLine.getBoundingClientRect().height / 2) };
const META = 4;
const SHIFT = 8;
const ALT = 1;

window.__clewSmokeInput = [
	{ click: strongPoint },                                  // t≈0
	{ wait: 900 },
	{ click: strongPoint },                                  // t≈0.9 (cursor placed inside by a timer)
	{ wait: 900 },
	{ click: tablePoint },                                   // t≈1.8
	{ wait: 1200 },
	{ tripleClick: deltaPoint },                             // t≈3.0
	{ wait: 1000 },
	{ combo: { key: 'Escape', modifiers: 0 } },              // t≈4.0
	{ wait: 600 },
	{ combo: { key: 't', modifiers: ALT | SHIFT } },         // t≈4.6
	{ wait: 400 },
	{ combo: { key: 'ArrowRight', modifiers: 0 } },
	{ combo: { key: 'ArrowRight', modifiers: 0 } },
	{ combo: { key: 'ArrowRight', modifiers: 0 } },
	{ wait: 600 },                                           // t≈5.8
	{ combo: { key: 'Escape', modifiers: 0 } },
	{ wait: 400 },
	{ combo: { key: 'e', modifiers: META | SHIFT } },        // t≈6.3
	{ wait: 800 },
	{ combo: { key: 'e', modifiers: META | SHIFT } },        // t≈7.1
	{ wait: 3500 },
];
setTimeout(() => {
	log(`strong-click line="${lineWith('beta')}"`);
	// Cursor INSIDE the word, then the bar must show strong pressed.
	view.dispatch({ selection: { anchor: doc().indexOf('alpha') + 2 } });
	setTimeout(() => log(`pressed=${button('edit:format-strong').getAttribute('aria-pressed') === 'true' ? 'strong' : 'none'}`), 150);
}, 600);
setTimeout(() => log(`unwrapped line="${lineWith('beta')}"`), 1500);
setTimeout(() => {
	const cell = document.querySelector('.clew-popover .popover-grid-cell[data-size="3x2"]');
	cell?.click();
	setTimeout(() => {
		const lines = doc().split('\n');
		const rows = lines.filter((l) => /^\|/.test(l.trim()));
		const body = rows.length - 2;
		log(`table rows=${body} cols=${(rows[0]?.match(/\|/g)?.length ?? 1) - 1}`);
	}, 300);
}, 2600);
setTimeout(() => log(`bubble=${document.querySelector('clew-selection-bubble').hidden ? 'hidden' : 'visible'}`), 3800);
setTimeout(() => log(`bubble-after-escape=${document.querySelector('clew-selection-bubble').hidden ? 'hidden' : 'visible'}`), 4400);
setTimeout(() => log(`focus-in-toolbar=${Boolean(bar()?.contains(document.activeElement))}`), 4900);
setTimeout(() => log(`focused-after-arrows=${document.activeElement?.getAttribute('aria-label')}`), 5700);
setTimeout(() => log(`after-toggle mode=${workspaceStore.findTab(tab.id).tab.view.mode} toolbar=${Boolean(bar())}`), 6900);
setTimeout(() => {
	log(`after-toggle mode=${workspaceStore.findTab(tab.id).tab.view.mode} toolbar=${Boolean(bar())}`);
	actions.splitActive('right');
	actions.splitActive('right');
	setTimeout(() => {
		const bars = [...document.querySelectorAll('clew-editor-view clew-editor-toolbar')];
		const narrow = bars.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0];
		const mode = narrow?.querySelector('[data-group="mode"]');
		log(`narrow width=${Math.round(narrow?.getBoundingClientRect().width)} overflow="${narrow?.dataset.overflow}" mode-visible=${Boolean(mode && !mode.hidden)} more=${!narrow?.querySelector('.toolbar-more').hidden}`);
	}, 1500);
}, 8000);
