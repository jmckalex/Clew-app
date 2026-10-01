// Live edit's formatting toolbar: how many rows, at which widths. Run on two
// builds to compare (the mode switch left the toolbar for the tab strip on
// 2026-10-01, which freed its width). Fixture: smoke/make-mode-vault.sh.
// For 1, 2 and 3 panes, sidebars closed and then both open, every pane's
// toolbar logs `smoke-tp: panes=<n> sidebars=<open|closed> pane=<i>
// width=<px> rows=<n> overflow=<groups in …>`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, settingsStore, registry } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
settingsStore.set('editorToolbar', 'live');
const measure = (panes, sidebars) => {
	const groups = [...document.querySelectorAll('clew-tab-group')].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
	groups.forEach((g, i) => {
		const bar = g.querySelector('.tab-body clew-editor-toolbar');
		if (!bar) { console.log(`smoke-tp: panes=${panes} sidebars=${sidebars} pane=${i + 1} NO-TOOLBAR`); return; }
		const tops = new Set([...bar.querySelectorAll(':scope > .toolbar-group:not([hidden])')].map((el) => Math.round(el.getBoundingClientRect().top)));
		console.log(`smoke-tp: panes=${panes} sidebars=${sidebars} pane=${i + 1} width=${Math.round(bar.getBoundingClientRect().width)} rows=${tops.size} overflow=${JSON.stringify(bar.dataset.overflow ?? '')}`);
	});
};
const first = workspaceStore.openNote('Other.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(first.id, 'live');
for (let panes = 1; panes <= 3; panes++) {
	if (panes > 1) {
		registry.runCommand('workspace:split-right');
		await sleep(400);
		const t = workspaceStore.openNote(`N0${panes}.md`, { newTab: false, defaultMode: 'live' });
		workspaceStore.setTabMode(t.id, 'live');
	}
	for (const open of [false, true]) {
		workspaceStore.setSidebar('left', { open });
		workspaceStore.setSidebar('right', { open });
		await sleep(1200);
		measure(panes, open ? 'open' : 'closed');
	}
}
