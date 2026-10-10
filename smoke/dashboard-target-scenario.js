// The demo's dashboard chart follows its own `target` widget (Guide/
// Dashboards.md; the owner's report 2026-10-10: the doughnut plotted counts
// by status and never read `target`), over a COPY of demo-vault with its
// .clew/plugins and vault-settings.json (dataviewjs and Charts on), the vault
// listed under the profile's `recentVaults` (trusted). `dash-mode.txt` at the
// vault's root:
//
//   reading       the widget in the reading view (real input: frameClick,
//                 4, Enter) → CLEW_SMOKE_FRAME_MATCH=Dashboards.md
//   live-widget   live edit beside the reading view; the widget changed in the
//                 reading pane → FRAME_MATCH=__clew_block__ (the chart's
//                 block frame in live edit)
//   live-typed    live edit alone; `target: 2` edited to 4 in its front
//                 matter by typing → FRAME_MATCH=__clew_block__
//
// The scenario logs `smoke-dt: … changed-at=<ms>` when the file holds the new
// target; the frame `chart=[1,3] labels=["Active","Still to go"] title="Active
// projects: 1 of 4" line="1 active project of a target of 4: 3 still to go."
// loaded-at=<ms>` — loaded before the change: redrawn, never reloaded.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc, editorPool, actions } = window.__clew;
const NOTE = 'Guide/Dashboards.md';
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const mode = String(await ipc.invoke('clew:note-read', { path: 'dash-mode.txt' }).then((r) => r?.content ?? r).catch(() => 'reading')).trim() || 'reading';
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const target = async () => /^target:\s*(\S+)/m.exec(String(await ipc.invoke('clew:note-read', { path: NOTE })))?.[1];
console.log(`smoke-dt: mode=${mode} target=${await target()}`);

const ENTER = { combo: { key: 'Enter', text: '\r' } };
// The widget is below the fold: a reading view scrolled to the heading above it.
const toWidget = (tabId) => actions.jumpToHeading(workspaceStore.findTab(tabId).tab, NOTE, 'Writing: widgets and drags');
const widget = [
	{ frameClick: { match: 'Dashboards.md', selector: 'wa-number-input[data-edit-field="target"]' } }, { wait: 300 },
	{ combo: { key: 'End' } }, { combo: { key: 'Backspace' } }, { text: '4' }, ENTER, { wait: 6000 },
];
if (mode === 'reading') {
	const tab = workspaceStore.openNote(NOTE, { newTab: true, defaultMode: 'reading' });
	workspaceStore.setTabMode(tab.id, 'reading');
	await sleep(6000);   // the render, the chart, Web Awesome's lazy load
	toWidget(tab.id);
	await sleep(1500);
	window.__clewSmokeInput = widget;
} else {
	const tab = workspaceStore.openNote(NOTE, { newTab: true, defaultMode: 'live' });
	workspaceStore.setTabMode(tab.id, 'live');
	await sleep(3000);
	const view = editorPool.get(tab.id).view;
	// The chart's block in view, so its frame exists.
	view.scrollDOM.scrollTop = view.lineBlockAt(view.state.doc.toString().indexOf('```dataviewjs')).top - 80;
	if (mode === 'live-widget') {
		// The note again in a pane to the right (Split right), read there.
		const pane = workspaceStore.splitWithClone(workspaceStore.findTab(tab.id).group.id, 'right', tab.id);
		const reading = pane.tabs.find((t) => t.path === NOTE);
		workspaceStore.setTabMode(reading.id, 'reading');
		await sleep(7000);
		console.log(`smoke-dt: panes=${document.querySelectorAll('clew-tab-group').length} left=${workspaceStore.findTab(tab.id).tab.view.mode} right=${workspaceStore.findTab(reading.id).tab.view.mode}`);
		toWidget(reading.id);
		view.scrollDOM.scrollTop = view.lineBlockAt(view.state.doc.toString().indexOf('```dataviewjs')).top - 80;
		await sleep(2000);
		window.__clewSmokeInput = widget;
	} else {
		await sleep(5000);
		const at = view.state.doc.toString().indexOf('target: 2') + 'target: '.length;
		view.dispatch({ selection: { anchor: at, head: at + 1 } });
		view.focus();
		window.__clewSmokeInput = [{ wait: 300 }, { text: '4' }, { wait: 6000 }];
	}
}
(async () => {
	for (let t = 0; t < 15000 && (await target()) !== '4'; t += 100) await sleep(100);
	console.log(`smoke-dt: target=${await target()} changed-at=${Date.now()} frames=${document.querySelectorAll('iframe').length}`);
})();
