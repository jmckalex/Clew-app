// A book's numbers while writing (docs/dev/book-mode.md §3, phase 2:
// renderer/book-map.js over editor/live/book-numbering.js), by REAL input,
// over `node smoke/make-book-vault.mjs <dir> numbers`
// (CLEW_SMOKE_VAULT=<dir>/vault CLEW_USER_DATA=<dir>/ud CLEW_SMOKE_LOG=1).
// Conventions — chapter 2 of Signals — refers to chapter 1's proposition and
// equation; Notes/Alone.md is in no book.
//
//   chapter  live edit on Conventions: its own equation `(2.1)` and theorem
//            `Theorem 2.1`; the chips to chapter 1 `proposition 1.1`, `1.1`
//   hover    a real move onto the @cref[prop-perfect] chip → the preview's
//            label "Proposition 1.1 — Perfect communication" (chapter 1's text)
//   complete ` @ref[prop` typed → the list offers prop-perfect, its detail
//            naming the chapter it is in
//   jump     a real click on the chip → Senders and Receivers opens, at the
//            proposition's line
//   continuous  the master says `numbering: continuous` → Conventions'
//            equation `(2)`, theorem `Theorem 2`, the chips `proposition 1`
//   alone    Notes/Alone.md: its own numbers, `Figure 1` and `1`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-bn: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (await test()) return true;
	return false;
};
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
for (let i = 0; i < 50 && !vaultStore.index['Books/Signals/Signals.md']?.book; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });

const CONV = 'Books/Signals/Conventions.md';
const shown = () => ({
	tags: [...document.querySelectorAll('.cm-editor.cm-live .le-math-block[data-le-tag]')].map((e) => e.dataset.leTag),
	heads: [...document.querySelectorAll('.cm-editor.cm-live .le-env-numbered')].map((e) => e.textContent),
	chips: [...document.querySelectorAll('.cm-editor.cm-live .le-ref')].map((e) => e.textContent),
});
const openLive = async (path) => {
	const tab = workspaceStore.openNote(path, { newTab: true, defaultMode: 'live' });
	workspaceStore.setTabMode(tab.id, 'live');
	await until(() => editorPool.get(tab.id)?.view);
	return tab;
};

const tab = await openLive(CONV);
const view = editorPool.get(tab.id).view;
// The chapter shows its own numbers until the book's texts are in, then the
// book's: wait for the switch.
await until(() => shown().tags.some((t) => t.includes('2.')), 10000);
await sleep(500);
log(`chapter ${JSON.stringify(shown())}`);

// Positions for the real input, measured before the queue runs.
view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true });
await sleep(500);
const chip = () => document.querySelector('.cm-editor.cm-live .le-ref[data-le-ref="prop-perfect"]');
const center = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
const C = center(chip());
const P = () => window.__clew.linkPreview().describe();
window.__clewSmokeInput = [
	{ move: C }, { wait: 1800 },                                   // hover
	{ move: { x: 5, y: 300 } }, { wait: 1200 },
	{ wait: 600 },                                                 // the scenario: caret at the end
	{ text: ' @ref[prop' }, { wait: 1500 },                        // complete
	{ combo: { key: 'Escape' } }, { wait: 600 },
	{ click: C }, { wait: 2500 },                                  // jump
	{ wait: 30000 },                                               // continuous, alone
];

(async () => { try {
	await until(() => P().visible && P().ready, 6000);
	await sleep(300);
	log(`hover preview=${P().visible ? 'visible' : 'none'} label=${JSON.stringify(P().label)}`);
	await until(() => !P().visible, 4000);
	view.dispatch({ selection: { anchor: view.state.doc.length } });
	view.focus();
	await until(() => document.querySelector('.cm-tooltip-autocomplete'), 6000);
	await sleep(300);
	const offered = [...document.querySelectorAll('.cm-tooltip-autocomplete li')].map((li) => `${li.querySelector('.cm-completionLabel')?.textContent}|${li.querySelector('.cm-completionDetail')?.textContent}`);
	log(`complete offered=${JSON.stringify(offered)}`);
	// The typed text out again, so the chip sits where it was measured.
	await until(() => !document.querySelector('.cm-tooltip-autocomplete'), 3000);
	const typed = view.state.doc.toString().lastIndexOf(' @ref[prop');
	if (typed >= 0) view.dispatch({ changes: { from: typed, to: view.state.doc.length } });
	await until(() => workspaceStore.activeTab()?.path !== CONV, 6000);
	await sleep(800);
	const active = workspaceStore.activeTab();
	const target = active?.path ? editorPool.get(active.id)?.view : null;
	const line = target ? target.state.doc.lineAt(target.state.selection.main.head) : null;
	log(`jump active=${active?.path} line=${line?.number ?? '-'} text=${JSON.stringify(line?.text ?? null)}`);

	// Continuous numbering, from the master's own header.
	const master = 'Books/Signals/Signals.md';
	const text = String(await ipc.invoke('clew:note-read', { path: master }));
	await ipc.invoke('clew:note-write', { path: master, content: text.replace('numbering: per chapter', 'numbering: continuous') });
	workspaceStore.setActiveTab?.(tab.id);
	await openLive(CONV);
	await until(() => shown().tags.includes('(2)'), 8000);
	await sleep(400);
	log(`continuous ${JSON.stringify(shown())}`);

	await openLive('Notes/Alone.md');
	await until(() => shown().chips.length > 0, 6000);
	await sleep(400);
	log(`alone ${JSON.stringify(shown())}`);
} catch (err) { log(`error ${err?.message ?? err}`); } })();
