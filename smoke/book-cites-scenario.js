// Citation pills in BOOK order (docs/dev/book-mode.md §4, phase 2; cite-text.js
// with book-map.js#citeContext, main's citation-header.js#bookCitationHeader),
// over `node smoke/make-book-vault.mjs <dir> cites` (CLEW_SMOKE_VAULT=<dir>/vault
// CLEW_USER_DATA=<dir>/ud CLEW_SMOKE_LOG=1): Signals in vancouver, a numeric
// style; chapter 1 cites skyrms1996 and maynardsmith1973 first; Conventions
// (chapter 2, its own header saying chicago — not the book's) cites
// lewis1969, skyrms1996 and zahavi1975, which only Deception's own
// bibliography holds.
//
//   pills   Conventions in live edit → its pills, once settled: the BOOK's
//           numbers (`[3]`, `[1]`, `[4]`), not its own ([1], [2], unknown)
//   engine  the book built as HTML, Conventions' page: its citations in order
//           → `equal=true` against the pills
//   renumber chapter 1's second citation removed on disk → Conventions' pills
//           follow without a keystroke (`[2]`, `[1]`, `[3]`)
//   master-disk  the master's `Bibliography style` → chicago on disk (no
//           editor on it) → the pills follow, author-date, equal to a rebuild
//   master-editor  back to vancouver in the master's OWN editor, a pane beside
//           the chapter → the pills follow again, equal to a rebuild
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc, editorPool } = window.__clew;
const log = (s) => console.log('smoke-bc: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (await test()) return true;
	return false;
};
const flat = (s) => String(s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const read = async (p) => String(await ipc.invoke('clew:note-read', { path: p }).then((r) => r?.content ?? r).catch(() => ''));
const MASTER = 'Books/Signals/Signals.md';
const CONV = 'Books/Signals/Conventions.md';
const FIRST = 'Books/Signals/Senders and Receivers.md';
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
for (let i = 0; i < 50 && !vaultStore.index[MASTER]?.book; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });

const pills = () => [...document.querySelectorAll('.cm-editor.cm-live .le-cite')].map((p) => flat(p.textContent));
/** The pills once they have held still for 2 s (and `test` holds). */
async function settled(test = () => true, ms = 20000) {
	let last = '';
	let since = Date.now();
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) {
		const now = JSON.stringify(pills());
		if (now !== last) { last = now; since = Date.now(); }
		else if (Date.now() - since > 2000 && test(pills())) break;
	}
	return pills();
}

const tab = workspaceStore.openNote(CONV, { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
const shown = await settled((p) => p.length === 3 && p.every((t) => /\[\d+\]/.test(t)));
log(`pills ${JSON.stringify(shown)}`);

/** The book built as HTML: Conventions' citations as its page prints them. */
async function engineCites() {
	const result = await ipc.invoke('clew:export-book', { master: MASTER, format: 'html' });
	const folder = result.outputRel.replace(/index\.html$/, '');
	const pages = ['index.html', 'Senders-and-Receivers.html', 'Conventions.html', 'Deception.html'].map((p) => folder + p);
	let cites = null;
	for (const page of pages) {
		const doc = new DOMParser().parseFromString(await read(page), 'text/html');
		if (![...doc.querySelectorAll('h1')].some((h) => /Conventions/.test(h.textContent))) continue;
		cites = [...doc.querySelectorAll('[data-bibtex]')].map((e) => flat(e.textContent));
	}
	return { cites, warnings: (result.warnings ?? []).map((w) => w.text).filter((t) => /cite|bibliograph/i.test(t)) };
}

try {
	const engine = await engineCites();
	log(`engine ${JSON.stringify(engine.cites)} equal=${JSON.stringify(engine.cites) === JSON.stringify(shown)} warnings=${JSON.stringify(engine.warnings)}`);

	const text = await read(FIRST);
	const edited = text.replace(', the evolutionary view by \\cite{maynardsmith1973}', '');
	if (edited === text) log('error chapter 1 is not as expected');
	await ipc.invoke('clew:note-write', { path: FIRST, content: edited });
	const after = await settled((p) => JSON.stringify(p) !== JSON.stringify(shown), 20000);
	const again = await engineCites();
	log(`renumber ${JSON.stringify(after)} engine=${JSON.stringify(again.cites)} equal=${JSON.stringify(again.cites) === JSON.stringify(after)}`);

	// The MASTER's citation settings changed, on disk, with no editor on it:
	// the open chapter's pills follow (Clew-iOS's question, 2026-10-09).
	const t0 = Date.now();
	const masterText = await read(MASTER);
	await ipc.invoke('clew:note-write', { path: MASTER, content: masterText.replace('Bibliography style: vancouver', 'Bibliography style: chicago') });
	const styled = await settled((p) => JSON.stringify(p) !== JSON.stringify(after), 20000);
	const chicago = await engineCites();
	log(`master-disk ${JSON.stringify(styled)} after=${Date.now() - t0}ms engine=${JSON.stringify(chicago.cites)} equal=${JSON.stringify(chicago.cites) === JSON.stringify(styled)}`);

	// …and edited back in the master's OWN editor, a pane beside the chapter.
	const masterTab = workspaceStore.openNote(MASTER, { newTab: true, defaultMode: 'source' });
	workspaceStore.setTabMode(masterTab.id, 'source');
	workspaceStore.splitWithTab(workspaceStore.findTab(tab.id).group.id, 'right', masterTab.id);
	await until(() => editorPool.get(masterTab.id)?.view, 6000);
	await sleep(800);
	const mview = editorPool.get(masterTab.id).view;
	const at = mview.state.doc.toString().indexOf('Bibliography style: chicago');
	const t1 = Date.now();
	mview.dispatch({ changes: { from: at, to: at + 'Bibliography style: chicago'.length, insert: 'Bibliography style: vancouver' } });
	const back = await settled((p) => JSON.stringify(p) !== JSON.stringify(styled), 20000);
	const vancouver = await engineCites();
	log(`master-editor ${JSON.stringify(back)} after=${Date.now() - t1}ms panes=${document.querySelectorAll('clew-tab-group').length} engine=${JSON.stringify(vancouver.cites)} equal=${JSON.stringify(vancouver.cites) === JSON.stringify(back)}`);
} catch (err) { log(`error ${err?.message ?? err}`); }
log('done');
