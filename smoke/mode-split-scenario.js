// The tab strip's mode switch, per PANE and per WINDOW (clew-tab-bar.js).
// Fixture: smoke/make-mode-vault.sh <dir>; run with CLEW_SMOKE_VAULT=<dir>.
// Three panes (Long | Other | N01, the last two splits making each about a
// third of the window): every pane's switch is inside its own strip
// (`pane <i> width=… pinned=true pressed=source`). Then REAL clicks, each on
// one pane's switch: `click <pane> <mode> → left=… middle=… right=…` — only
// the clicked pane changes, and `+toolbar` marks the panes in live edit (the
// formatting toolbar under the default `editorToolbar: 'live'`). Last, the second vault opens in a second window
// (<dir>-2, its Welcome.md opening by itself): `second-window opened`; the
// screenshot of that window shows its own switch (the harness captures
// every window).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, settingsStore, ipc, registry } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
settingsStore.set('editorToolbar', 'live');
const notes = ['Long.md', 'Other.md', 'N01.md'];
workspaceStore.openNote(notes[0], { newTab: true, defaultMode: 'source' });
for (const path of notes.slice(1)) {
	registry.runCommand('workspace:split-right');
	await sleep(400);
	workspaceStore.openNote(path, { newTab: false, defaultMode: 'source' });
}
await sleep(1500);
const groups = () => [...document.querySelectorAll('clew-tab-group')].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
const NAMES = ['left', 'middle', 'right'];
groups().forEach((g, i) => { g.dataset.smoke = NAMES[i]; });
const modeOf = (g) => {
	const id = workspaceStore.allGroups().find((x) => x.id === g.groupId)?.activeTabId;
	return workspaceStore.findTab(id)?.tab.view.mode;
};
const pressedOf = (g) => g.querySelector('.tab-modes [aria-pressed="true"]')?.dataset.value;
groups().forEach((g, i) => {
	const bar = g.querySelector('clew-tab-bar').getBoundingClientRect();
	const m = g.querySelector('.tab-modes').getBoundingClientRect();
	const add = g.querySelector('.tab-add').getBoundingClientRect();
	console.log(`smoke-ms: pane ${NAMES[i]} width=${Math.round(bar.width)} pinned=${m.left >= bar.left && m.right <= add.left + 0.5 && add.right <= bar.right + 0.5} pressed=${pressedOf(g)}`);
});
const CLICK = (pane, m) => ({ click: { selector: `clew-tab-group[data-smoke="${pane}"] .tab-modes [data-value="${m}"]` } });
const route = [['left', 'reading'], ['right', 'live'], ['middle', 'reading'], ['left', 'live'], ['right', 'source'], ['middle', 'live']];
window.__clewSmokeInput = route.flatMap(([pane, m]) => [CLICK(pane, m), { wait: 2200 }]);
(async () => {
	for (const [pane, m] of route) {
		const g = () => document.querySelector(`clew-tab-group[data-smoke="${pane}"]`);
		for (let i = 0; i < 80 && modeOf(g()) !== m; i++) await sleep(50);
		await sleep(1200);
		const all = NAMES.map((n) => {
			const x = document.querySelector(`clew-tab-group[data-smoke="${n}"]`);
			const bar = x.querySelectorAll('.tab-body clew-editor-toolbar').length;
			return `${n}=${modeOf(x)}/${pressedOf(x)}${bar ? `+toolbar${bar > 1 ? bar : ''}` : ''}`;
		});
		console.log(`smoke-ms: click ${pane} ${m} → ${all.join(' ')}`);
	}
	await ipc.invoke('clew:vault-open-path', { path: `${vaultStore.vault.path}-2` });
	await sleep(3000);
	console.log('smoke-ms: second-window opened');
})();
