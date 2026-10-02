// "PDF via LaTeX" picks its engine (main/latex-engine.js): read off the
// generated .tex — fontspec and friends take LuaLaTeX, anything else pdfLaTeX
// — or forced by Settings → LaTeX engine. Vault: a copy of demo-vault holding
// a callout note (Callouts.md, from make-custom-callout-vault.sh) and the
// citation note Features/Citations.md (natbib + BibTeX). The settings to try
// come from the vault's `latex-engines.txt` (default: all four). Each export
// logs `smoke-lx: <setting> <note> engine=<…> reason=<…>` or `FAILED <message>`;
// PDFs land in `<vault>-pdf/`.
//
// With the owner's global ~/.jmarkdown (its preamble loads fontspec and sets
// Optima): auto → lualatex for both; pdflatex → FAILED naming pdfLaTeX, why it
// was chosen and the fontspec error; lualatex and xelatex succeed. With a
// plain config (HOME pointed at an empty dir): auto → pdflatex for both.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc, settingsStore } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const out = `${vaultStore.vault.path}-pdf`;
const listed = await ipc.invoke('clew:note-read', { path: 'latex-engines.txt' }).then((r) => String(r?.content ?? r ?? '')).catch(() => '');
const engines = listed.split(/\s+/).filter(Boolean);
for (const setting of engines.length ? engines : ['auto', 'pdflatex', 'lualatex', 'xelatex']) {
	settingsStore.set('latexEngine', setting);
	await sleep(300);
	for (const note of ['Callouts.md', 'Features/Citations.md']) {
		const base = `${setting}-${note.replace(/\.md$/, '').replace(/\//g, '-')}`;
		try {
			const r = await ipc.invoke('clew:export-note', { path: note, format: 'pdf', outFile: `${out}/${base}.pdf` });
			console.log(`smoke-lx: ${setting} ${note} engine=${r.engine} reason=${JSON.stringify(r.reason)}`);
		} catch (err) {
			console.log(`smoke-lx: ${setting} ${note} FAILED ${String(err.message).replace(/^Error invoking remote method '[^']*': (Error: )?/, '')}`);
		}
	}
}
