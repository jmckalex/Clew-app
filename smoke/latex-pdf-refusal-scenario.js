// No PDF via LaTeX in a vault this device does not trust (the owner's
// decision 2026-10-15; main/latex-engine.js#latexPdfRefusal): it would run
// the TeX installed here over the vault's own TeX. Over `node
// smoke/make-book-vault.mjs <dir>` (CLEW_SMOKE_VAULT=<dir>/vault), each route:
//   note-pdf    a note's PDF via LaTeX (EXPORT_NOTE; the menu and `clew export
//               --pdf` both call it)
//   book-pdf    the book's PDF via LaTeX (EXPORT_BOOK 'pdf')
//   proof       a chapter proof (EXPORT_BOOK 'proof')
//   note-latex  the note's LaTeX export — never refused
//   menu        File → Export → As PDF (via LaTeX) on the open chapter: the
//               notice it shows
// each logged `smoke-lpr: <route> refused="…"` or `output=<path>`, then
// `files=[…]` — what the run left under lpr/ and the book's build/. A fresh
// CLEW_USER_DATA is RESTRICTED: the three PDFs refused, build/ never made,
// `files=["lpr/Conventions.tex"]`. With the vault under that profile's
// `recentVaults` (trusted) every route builds — a proof needs the full run
// first, which book-pdf is.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, workspaceStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-lpr: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
for (let i = 0; i < 100 && !vaultStore.index?.['Books/Signals/Signals.md']?.book; i++) await sleep(100);
const MASTER = 'Books/Signals/Signals.md';
const CHAPTER = 'Books/Signals/Conventions.md';
log(`trusted=${(await ipc.invoke('clew:vault-trust-get'))?.trusted === true}`);
const said = (r) => (r?.refused ? `refused="${r.refused}"` : `output=${r?.outputRel ?? r?.output ?? '-'}`);
const tryRoute = async (route, call) => {
	try {
		log(`${route} ${said(await call())}`);
	} catch (err) {
		log(`${route} error="${String(err?.message ?? err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}"`);
	}
};
await tryRoute('note-pdf', () => ipc.invoke('clew:export-note', { path: CHAPTER, format: 'pdf', outFile: 'lpr/Conventions.pdf' }));
await tryRoute('note-latex', () => ipc.invoke('clew:export-note', { path: CHAPTER, format: 'latex', outFile: 'lpr/Conventions.tex' }));
await tryRoute('book-pdf', () => ipc.invoke('clew:export-book', { master: MASTER, format: 'pdf' }));
await tryRoute('proof', () => ipc.invoke('clew:export-book', { master: MASTER, format: 'proof', chapter: CHAPTER }));

// The menu's route: the command on the open chapter, and what it says. (In a
// trusted vault it would ask where to save — so restricted only.)
if (!(await ipc.invoke('clew:vault-trust-get'))?.trusted) {
	workspaceStore.openNote(CHAPTER, { newTab: true, defaultMode: 'reading' });
	await sleep(1500);
	window.__clew.registry.runCommand('export:pdf');
	let text = '';
	for (let i = 0; i < 50 && !text; i++) {
		await sleep(100);
		text = [...document.querySelectorAll('.clew-notice')].map((n) => n.textContent).find((t) => /PDF via LaTeX/.test(t)) ?? '';
	}
	log(`menu notice="${text}"`);
}
await sleep(1500);
const files = (vaultStore.allPaths?.() ?? []).filter((p) => p.startsWith('lpr/') || p.startsWith('Books/Signals/build/')).sort();
log(`files=${JSON.stringify(files)}`);
