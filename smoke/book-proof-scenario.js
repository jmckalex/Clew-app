// "Proof this chapter" (book phase 3; main/book-proof.js, export-book.js's
// 'proof'; jmarkdown cf5ed60's include layout + \includeonly) over a COPY of
// demo-vault (`rsync -a --exclude .clew demo-vault/ <dir>/vault/`;
// CLEW_SMOKE_VAULT=<dir>/vault CLEW_USER_DATA=<dir>/ud CLEW_SMOKE_LOG=1), or,
// when the vault holds Books/Big/Big.md (the 40-chapter timing book), the
// timings alone.
//
//   before   a proof with no full run yet → refused, saying so:
//            `before error="No full PDF of Signals: A Short Book yet. …"`
//   full     the book as PDF (the full run, include layout) → `full ms=…`
//   panel    Conventions active, the Book panel's Proof row → its button
//            `Conventions (ch. 2)`, a REAL click → the panel's last-build line
//            names `Signals (proof, Conventions).pdf`
//   proof    the same by IPC → `proof ms=… chapter=2 fullRunAt=…`
//   changed  the master's chapters reordered on disk → refused:
//            `changed error="The chapters of … have changed since its last full PDF …"`
//   big      Big.md: `full ms=…`, then `proof ms=…` of chapter 20
// The PDFs' text is the shell's (README): the proof holds chapter 2 alone,
// numbered 2, its references to chapters 1 and 3 resolved (no ??).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-proof: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};
const read = async (p) => String(await ipc.invoke('clew:note-read', { path: p }).then((r) => r?.content ?? r).catch((e) => `ERR ${e.message}`));
const book = async (master, format, chapter = null) => {
	const t0 = Date.now();
	const r = await ipc.invoke('clew:export-book', { master, format, ...(chapter ? { chapter } : {}) }).catch((e) => ({ error: e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') }));
	return { ...r, ms: Date.now() - t0 };
};
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const BIG = 'Books/Big/Big.md';
const big = await until(() => vaultStore.index[BIG]?.book, 3000);

if (big) {
	const full = await book(BIG, 'pdf');
	log(`big full ms=${full.ms} ${full.error ? `error=${JSON.stringify(full.error)}` : full.outputRel}`);
	const proof = await book(BIG, 'proof', 'Books/Big/Ch20.md');
	log(`big proof ms=${proof.ms} ${proof.error ? `error=${JSON.stringify(proof.error)}` : `${proof.outputRel} chapter=${proof.chapter}`}`);
	const again = await book(BIG, 'proof', 'Books/Big/Ch20.md');
	log(`big proof-again ms=${again.ms}`);
	window.__clewSmokeInput = [{ wait: 200 }];
} else {
	const MASTER = 'Books/Signals/Signals.md';
	const CH2 = 'Books/Signals/Conventions.md';
	await until(() => vaultStore.index[MASTER]?.book);
	await sleep(800);
	const before = await book(MASTER, 'proof', CH2);
	log(`before error=${JSON.stringify(before.error ?? null)}`);
	const full = await book(MASTER, 'pdf');
	log(`full ms=${full.ms} ${full.error ? `error=${JSON.stringify(full.error)}` : full.outputRel}`);

	// The panel, with a chapter of this book the active note.
	const tab = workspaceStore.openNote(CH2, { newTab: true });
	workspaceStore.setTabMode(tab.id, 'source');
	workspaceStore.setSidebar('right', { open: true, activeTool: 'book' });
	await until(() => document.querySelector('.book-build-button[data-format="proof"]'));
	log(`panel button=${JSON.stringify(document.querySelector('.book-build-button[data-format="proof"]')?.textContent ?? null)}`);
	window.__clewSmokeInput = [{ click: { selector: '.book-build-button[data-format="proof"]' } }, { wait: 45000 }];
	(async () => {
		await until(() => /proof, Conventions/.test(document.querySelector('.book-build-last')?.textContent ?? ''), 40000);
		log(`panel last=${JSON.stringify(document.querySelector('.book-build-last')?.textContent ?? '')}`);
		const proof = await book(MASTER, 'proof', CH2);
		log(`proof ms=${proof.ms} ${proof.error ? `error=${JSON.stringify(proof.error)}` : `${proof.outputRel} chapter=${proof.chapter} fullRunAt=${proof.fullRunAt}`}`);
		const notChapter = await book(MASTER, 'proof', 'Welcome.md');
		log(`not-a-chapter error=${JSON.stringify(notChapter.error ?? null)}`);
		// The chapters reordered since the full run: its numbers no longer fit.
		const text = await read(MASTER);
		const swapped = text.replace('  - "[[Senders and Receivers]]"\n  - "[[Conventions]]"', '  - "[[Conventions]]"\n  - "[[Senders and Receivers]]"');
		await ipc.invoke('clew:note-write', { path: MASTER, content: swapped });
		await until(() => vaultStore.index[MASTER]?.book?.chapters?.[0]?.resolved === CH2, 8000);
		const changed = await book(MASTER, 'proof', CH2);
		log(`changed swapped=${swapped !== text} error=${JSON.stringify(changed.error ?? null)}`);
		await ipc.invoke('clew:note-write', { path: MASTER, content: text });
		log('done');
	})();
}
