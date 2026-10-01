// The three mode buttons are in every view of a note, whatever
// `editorToolbar` says (the owner, 2026-10-01: source view had no bar). The
// setting governs the FORMATTING toolbar; without it, source and live show
// reading mode's slim bar. Fixture: one long note —
//
//   mkdir -p <dir> && node -e "require('fs').writeFileSync('<dir>/Long.md', '# Long\n\n' + Array.from({length: 120}, (_, i) => 'Line ' + i + ' of the note, long enough to read.').join('\n\n'))"
//
// Phase A, programmatic, per setting × mode: `bar=true buttons=3 pressed=<mode>`,
// `slim=` as the setting implies, and `at=x,y` the SAME for every mode (the
// buttons do not move). Phase B, REAL clicks under 'live', every ordered pair
// of modes: `click → <mode> pressed=<mode>`, and for a source↔live switch
// `text-moved=0` (a line mid-note keeps its screen position: the bar swap
// is compensated).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, editorPool, settingsStore } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Long.md', { newTab: true, defaultMode: 'source' });
const bar = () => document.querySelector('.tab-body clew-editor-toolbar');
const mode = () => workspaceStore.findTab(tab.id)?.tab.view.mode;
const report = (tag) => {
	const b = bar();
	const btns = b ? [...b.querySelectorAll('[data-command^="workspace:mode-"]')] : [];
	const pressed = btns.find((x) => x.getAttribute('aria-pressed') === 'true')?.dataset.command?.replace('workspace:mode-', '') ?? 'none';
	const r = btns[0]?.getBoundingClientRect();
	return `${tag} bar=${Boolean(b)} slim=${b?.slim ?? '-'} buttons=${btns.length} pressed=${pressed} at=${r ? `${Math.round(r.left)},${Math.round(r.top)}` : '-'}`;
};
for (const setting of ['live', 'always', 'never']) {
	settingsStore.set('editorToolbar', setting);
	for (const m of ['source', 'live', 'reading']) {
		workspaceStore.setTabMode(tab.id, m);
		await sleep(m === 'reading' ? 2500 : 900);
		console.log(`smoke-mb: ${report(`${setting} ${m}`)}`);
	}
}
// Phase B: 'live', starting in source, scrolled to mid-note.
settingsStore.set('editorToolbar', 'live');
workspaceStore.setTabMode(tab.id, 'source');
await sleep(1000);
const view = editorPool.get(tab.id).view;
const mid = view.state.doc.line(120).from;
view.dispatch({ selection: { anchor: mid }, scrollIntoView: true });
await sleep(600);
const yOf = () => { const v = editorPool.get(tab.id)?.view; const c = v && document.contains(v.dom) ? v.coordsAtPos(mid) : null; return c ? Math.round(c.top) : null; };
const CLICK = (m) => ({ click: { selector: `.tab-body clew-editor-toolbar [data-command="workspace:mode-${m}"]` } });
const route = ['live', 'reading', 'source', 'reading', 'live', 'source'];
window.__clewSmokeInput = route.flatMap((m) => [CLICK(m), { wait: m === 'reading' ? 2600 : 1400 }]);
(async () => {
	let prev = mode();
	let y = yOf();
	for (const want of route) {
		for (let i = 0; i < 80 && mode() !== want; i++) await sleep(50);
		await sleep(want === 'reading' ? 2000 : 800);
		const nowY = yOf();
		const textMoved = (prev !== 'reading' && want !== 'reading' && y !== null && nowY !== null) ? ` text-moved=${nowY - y}` : '';
		console.log(`smoke-mb: click ${prev} → ${mode()} ${report('').trim()}${textMoved}`);
		prev = mode();
		if (want !== 'reading') y = yOf();
	}
})();
