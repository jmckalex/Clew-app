// A file TeX could not find, said as a build warning of a PDF via LaTeX
// (shared/latex-engine.js#texMissingFiles; the owner's A1, 2026-10-22), over
// `node smoke/make-tex-missing-vault.mjs <dir>` with CLEW_USER_DATA=<dir>/ud
// (the vault trusted) and HOME=<dir>/home (no user config to choose the engine). Exports Missing.md, Cut.md, Clean.md and the book Book.md as
// PDF via LaTeX and logs each result's warnings:
//   `tm: note-pdf Missing.md made=true warnings=["PDF via LaTeX: TeX could not find the file \"/nonexistent/clew-smoke/picture.png\", …", …]`
//   `tm: note-pdf Cut.md made=true warnings=["… \"/Users/me/éééé…é.png\" …"]` (pdfLaTeX; the path whole)
//   `tm: note-pdf Clean.md made=true warnings=[]`
//   `tm: book-pdf made=true warnings=[… "/nonexistent/clew-smoke/chapter.png" …]`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
await sleep(1500);
const log = (what, r) => console.log(`smoke-tm: ${what} made=${Boolean(r?.output) && !r?.refused} warnings=${JSON.stringify(r?.warnings ?? null)}${r?.refused ? ` refused=${JSON.stringify(r.refused)}` : ''}`);
const run = (fn) => fn().catch((err) => ({ error: String(err?.message ?? err) }));
for (const note of ['Missing.md', 'Cut.md', 'Clean.md']) {
	const r = await run(() => ipc.invoke('clew:export-note', { path: note, format: 'pdf', outFile: `out/${note.replace(/\.md$/, '.pdf')}` }));
	log(`note-pdf ${note}`, r);
	if (r?.error) console.log(`smoke-tm: note-pdf ${note} error=${r.error.slice(0, 300)}`);
}
const book = await run(() => ipc.invoke('clew:export-book', { master: 'Book.md', format: 'pdf' }));
log('book-pdf', book);
if (book?.error) console.log(`smoke-tm: book-pdf error=${book.error.slice(0, 300)}`);
console.log('smoke-tm: done');
