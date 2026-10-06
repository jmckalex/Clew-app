// Note exports with the engine's Obsidian links ON (export.js#runWorker →
// engine/export-worker.mjs; jmarkdown 3d9e65d): over a COPY of demo-vault
// (`rsync -a --exclude .clew demo-vault/ <dir>/vault/`), CLEW_SMOKE_VAULT=
// <dir>/vault. Exports, through the ordinary EXPORT_NOTE, into <dir>/vault/xn/:
// Citations and Footnotes as HTML and LaTeX (no [[…]] in either — byte-
// identical to a run with the links off), Math and Theorems as LaTeX and PDF
// (its ![[NASA - Earthrise.jpg|300]] an \includegraphics of the vault's file,
// one image in the PDF), Guide/Editing.md as HTML and PDF (its [[links]] as
// text; the PDF compiles in full — no minted `<MINTED>`, the [[ left only in
// inline code), Features/Diagrams.md as LaTeX and PDF (its @begin(mermaid)
// and @begin(metapost) — the engine's cached PDFs, included relative to the
// .tex since jmarkdown ff87858: no vault path in the .tex or the PDF). Logs
// `smoke-xn: <note> <format> warnings=<n>`; the checks are the shell's
// (smoke/README.md).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
await sleep(1500);
for (const [p, f, out] of [
	['Features/Citations.md', 'html', 'xn/citations.html'], ['Features/Citations.md', 'latex', 'xn/citations.tex'],
	['Features/Footnotes.md', 'html', 'xn/footnotes.html'], ['Features/Footnotes.md', 'latex', 'xn/footnotes.tex'],
	['Features/Math and Theorems.md', 'latex', 'xn/math.tex'], ['Features/Math and Theorems.md', 'pdf', 'xn/math-pdf/math.pdf'],
	['Guide/Editing.md', 'html', 'xn/editing.html'], ['Guide/Editing.md', 'pdf', 'xn/editing-pdf/editing.pdf'],
	['Features/Diagrams.md', 'latex', 'xn/diagrams.tex'], ['Features/Diagrams.md', 'pdf', 'xn/diagrams-pdf/diagrams.pdf'],
]) {
	const r = await ipc.invoke('clew:export-note', { path: p, format: f, outFile: out }).catch((e) => ({ error: e.message }));
	console.log(`smoke-xn: ${p} ${f} ${r.error ?? `warnings=${r.warnings?.length}`}`);
}
window.__clewSmokeInput = [{ wait: 300 }];
