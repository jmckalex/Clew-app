// The view-mode switch in the TAB STRIP (clew-tab-bar.js; the owner's
// choice 2026-10-01 — the slim bar is gone). Fixture: smoke/make-mode-vault.sh.
//
// Phase A, programmatic, setting × mode: `strip=true buttons=3 pressed=<mode>
// at=x,y` — the same place in all nine — `toolbar=` exactly where
// `editorToolbar` shows the FORMATTING toolbar (live: live only; always:
// source and live; never: none), `other-bars=0` (no slim bar anywhere), and
// `note-top=` the gap between the strip and the note: 0 with no toolbar.
// Phase N: tabs with no modes — `canvas|bib|settings available=false
// hidden=true` — and `plus-moved=0` (the switch keeps its place, hidden).
// Phase P, a crowded strip (28 tabs): `pinned=true` (the switch and "+"
// inside the bar, the tabs scrolling under them: `tabs-scroll=true`).
// Phase B, REAL clicks under 'live', every ordered pair of modes:
// `click <from> → <to> pressed=<to>`; a source↔live switch also logs
// `text-moved=` for a line mid-note (0: the toolbar's arrival or departure
// is compensated). Phase K, the keyboard: `key alt-shift-t focus=switch:source`
// (no toolbar in source under 'live', so ⌥⇧T lands on the strip's switch),
// `key arrow-left focus=switch:reading`, `key escape focus=editor`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, editorPool, settingsStore, actions } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Long.md', { newTab: true, defaultMode: 'source' });
const strip = () => document.querySelector('clew-tab-bar');
const modes = () => strip()?.querySelector('.tab-modes');
const mode = () => workspaceStore.findTab(tab.id)?.tab.view.mode;
const report = (tag) => {
	const m = modes();
	const btns = m ? [...m.querySelectorAll('.tab-mode')] : [];
	const pressed = btns.find((x) => x.getAttribute('aria-pressed') === 'true')?.dataset.value ?? 'none';
	const r = btns[0]?.getBoundingClientRect();
	const toolbars = [...document.querySelectorAll('.tab-body clew-editor-toolbar')];
	const barBottom = strip().getBoundingClientRect().bottom;
	const content = document.querySelector('.tab-body .cm-scroller, .tab-body .preview-frame');
	const top = content ? Math.round(content.getBoundingClientRect().top - barBottom) : '-';
	return `${tag} strip=${Boolean(m)} buttons=${btns.length} pressed=${pressed} at=${r ? `${Math.round(r.left)},${Math.round(r.top)}` : '-'}`
		+ ` toolbar=${toolbars.length === 1} other-bars=${Math.max(0, toolbars.length - 1)} note-top=${top}`;
};
for (const setting of ['live', 'always', 'never']) {
	settingsStore.set('editorToolbar', setting);
	for (const m of ['source', 'live', 'reading']) {
		workspaceStore.setTabMode(tab.id, m);
		await sleep(m === 'reading' ? 2500 : 900);
		console.log(`smoke-mb: ${report(`${setting} ${m}`)}`);
	}
}

// Phase N: tabs with no modes.
settingsStore.set('editorToolbar', 'live');
const plusAt = () => Math.round(strip().querySelector('.tab-add').getBoundingClientRect().left);
const before = plusAt();
for (const [name, open] of [['canvas', () => workspaceStore.openCanvas('Board.canvas', { newTab: true })],
	['bib', () => workspaceStore.openFile('refs.bib', { newTab: true })], ['settings', () => actions.openSettings()]]) {
	open();
	await sleep(900);
	const m = modes();
	console.log(`smoke-mb: ${name} available=${!m.classList.contains('is-unavailable')} hidden=${getComputedStyle(m).visibility === 'hidden'}`
		+ ` disabled=${[...m.querySelectorAll('.tab-mode')].every((b) => b.disabled)} plus-moved=${plusAt() - before}`);
}
workspaceStore.activateTab(tab.id);
await sleep(600);
console.log(`smoke-mb: ${report('back-to-note')}`);

// Phase P: a crowded strip.
for (let i = 1; i <= 24; i++) workspaceStore.openNote(`N${String(i).padStart(2, '0')}.md`, { newTab: true, defaultMode: 'source' });
await sleep(1200);
{
	const bar = strip().getBoundingClientRect();
	const m = modes().getBoundingClientRect();
	const add = strip().querySelector('.tab-add').getBoundingClientRect();
	const s = strip().querySelector('.tab-strip');
	console.log(`smoke-mb: crowded tabs=${strip().querySelectorAll('.tab').length} pinned=${m.left >= bar.left && m.right <= add.left + 0.5 && add.right <= bar.right + 0.5 && m.width > 60}`
		+ ` tabs-scroll=${s.scrollWidth > s.clientWidth} modes=${Math.round(m.left)}..${Math.round(m.right)} plus=${Math.round(add.left)}..${Math.round(add.right)} bar-right=${Math.round(bar.right)}`);
}
for (const t of [...workspaceStore.allGroups()[0].tabs]) if (t.id !== tab.id) { editorPool.close(t.id); workspaceStore.closeTab(t.id, { force: true }); }
workspaceStore.activateTab(tab.id);

// Phase B: real clicks, 'live', starting in source, a line mid-note.
workspaceStore.setTabMode(tab.id, 'source');
await sleep(1000);
const view = editorPool.get(tab.id).view;
const mid = view.state.doc.line(120).from;
view.dispatch({ selection: { anchor: mid }, scrollIntoView: true });
await sleep(600);
const yOf = () => { const v = editorPool.get(tab.id)?.view; const c = v && document.contains(v.dom) ? v.coordsAtPos(mid) : null; return c ? Math.round(c.top) : null; };
const CLICK = (m) => ({ click: { selector: `clew-tab-bar .tab-modes [data-value="${m}"]` } });
const route = ['live', 'reading', 'source', 'reading', 'live', 'source'];
window.__clewSmokeInput = [
	...route.flatMap((m) => [CLICK(m), { wait: m === 'reading' ? 2600 : 1400 }]),
	// Phase K: the keyboard. Source under 'live' shows no toolbar, so ⌥⇧T
	// lands on the strip's switch; ← moves; Escape goes back to the note.
	{ wait: 600 },
	{ combo: { key: 't', modifiers: 1 | 8 } },
	{ wait: 700 },
	{ combo: { key: 'ArrowLeft', modifiers: 0 } },
	{ wait: 700 },
	{ combo: { key: 'Escape', modifiers: 0 } },
	{ wait: 700 },
];
(async () => {
	let prev = mode();
	let y = yOf();
	for (const want of route) {
		for (let i = 0; i < 80 && mode() !== want; i++) await sleep(50);
		await sleep(want === 'reading' ? 2000 : 800);
		const nowY = yOf();
		const textMoved = (prev !== 'reading' && want !== 'reading' && y !== null && nowY !== null) ? ` text-moved=${nowY - y}` : '';
		const pressed = modes().querySelector('[aria-pressed="true"]')?.dataset.value;
		console.log(`smoke-mb: click ${prev} → ${mode()} pressed=${pressed} toolbar=${Boolean(document.querySelector('.tab-body clew-editor-toolbar'))}${textMoved}`);
		prev = mode();
		if (want !== 'reading') y = yOf();
	}
	const focused = () => {
		const a = document.activeElement;
		if (a?.classList.contains('tab-mode')) return `switch:${a.dataset.value}`;
		return a?.closest('.cm-editor') ? 'editor' : a?.tagName.toLowerCase();
	};
	for (const step of ['alt-shift-t', 'arrow-left', 'escape']) {
		const was = focused();
		for (let i = 0; i < 40 && focused() === was; i++) await sleep(50);
		console.log(`smoke-mb: key ${step} focus=${focused()}`);
	}
})();
