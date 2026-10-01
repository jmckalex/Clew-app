// Opening, moving and re-pointing tabs in ONE tick leaves every note drawn
// in its mode (editor/pool.js#open waits for an open under way; setMode
// checks the state's own compartment; a host re-applies its mode when the
// pool puts in a new state). Clew-docs' repro, 2026-10-02: openNote(note,
// live) then, in the same tick, openFile('Paper.pdf', {newTab}) and
// splitWithTab — live edit left undrawn (raw `#` and `>`) under a pressed
// live button, and "RangeError: Field is not present in this state" from
// Sidenotes.read inside EditorView.measure. Fixture: make-mode-vault.sh.
//
// For each mode (live, reading, source) and variant —
//   a  note + PDF opened, the PDF split off to the right
//   b  note + PDF opened, the NOTE split off to the right
//   c  one tab re-pointed three times in a tick (Other → Long → Live)
//   d  Clew-docs' shape: an already-live tab re-pointed to Live.md, a PDF
//      opened and split off, all in one tick
// — logs `smoke-or: <mode> <variant> shown=<editor|reading|none> drawn=<…>
// errors=<n>`: `drawn=live` (the heading drawn, `cm-live` on the editor),
// `source` (raw, no live classes) or `reading` (the preview frame); want it
// equal to the mode, and errors=0. Before the fix: live a/b `shown=none`
// (the pane empty — the host gave up on an entry with no view yet).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, editorPool, settingsStore } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
settingsStore.set('sidenotes', 'on');
const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map((x) => String(x?.stack ?? x)).join(' ')); origError(...a); };
window.addEventListener('error', (e) => errors.push(String(e.message)));

const reset = async () => {
	for (const g of workspaceStore.allGroups().slice(1)) workspaceStore.closeGroup(g.id, { force: true });
	for (const t of [...(workspaceStore.allGroups()[0]?.tabs ?? [])]) { editorPool.close(t.id); workspaceStore.closeTab(t.id, { force: true }); }
	await sleep(800);
	errors.length = 0;
};
const state = (tabId) => {
	const tab = workspaceStore.findTab(tabId)?.tab;
	const host = [...document.querySelectorAll('clew-editor-view, clew-preview-view')].find((h) => h.tabId === tabId && h.isConnected && !h.hasAttribute('data-clew-retiring'));
	const view = editorPool.get(tabId)?.view;
	let shown = 'none';
	let drawn = '-';
	if (host?.localName === 'clew-preview-view' && host.querySelector('.preview-frame')) { shown = 'reading'; drawn = 'reading'; }
	if (host?.localName === 'clew-editor-view' && view && host.contains(view.dom)) {
		shown = 'editor';
		const live = view.dom.classList.contains('cm-live') && Boolean(view.dom.querySelector('.le-h1'));
		const raw = !view.dom.querySelector('[class*="le-"]');
		drawn = live ? 'live' : raw ? 'source' : 'mixed';
	}
	return { mode: tab?.view.mode, shown, drawn };
};
for (const mode of ['live', 'reading', 'source']) {
	for (const variant of ['a', 'b', 'c', 'd']) {
		await reset();
		let note;
		if (variant === 'a' || variant === 'b') {
			note = workspaceStore.openNote('Live.md', { newTab: true, defaultMode: mode });
			const pdf = workspaceStore.openFile('Paper.pdf', { newTab: true });
			workspaceStore.splitWithTab(workspaceStore.activeGroupId, 'right', variant === 'a' ? pdf.id : note.id);
		} else if (variant === 'c') {
			note = workspaceStore.openNote('Other.md', { newTab: true, defaultMode: mode });
			workspaceStore.openNote('Long.md', { newTab: false });
			workspaceStore.openNote('Live.md', { newTab: false });
		} else {
			note = workspaceStore.openNote('Other.md', { newTab: true, defaultMode: mode });
			await sleep(1500); // fully drawn in its mode first
			errors.length = 0;
			workspaceStore.openNote('Live.md', { newTab: false });
			const pdf = workspaceStore.openFile('Paper.pdf', { newTab: true });
			workspaceStore.splitWithTab(workspaceStore.activeGroupId, 'right', pdf.id);
		}
		workspaceStore.setTabMode(note.id, mode);
		await sleep(3000);
		const s = state(note.id);
		const field = errors.filter((e) => /Field is not present/.test(e));
		console.log(`smoke-or: ${mode} ${variant} tab-mode=${s.mode} shown=${s.shown} drawn=${s.drawn} errors=${field.length}${field.length ? ` first=${JSON.stringify(field[0].slice(0, 160))}` : ''}`);
	}
}
