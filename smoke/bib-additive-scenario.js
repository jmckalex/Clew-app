// The engine's additive Bibliography, as Clew renders, re-renders and
// exports it (jmarkdown 909af7a/e7cf638; main/citation-header.js). Run it
// through `smoke/bib-additive.sh <out-dir>`, which makes the fixture
// (make-bib-vault.mjs), trusts it, points HOME at an empty folder (the
// owner's global ~/.jmarkdown loads fontspec, which no pdfLaTeX run
// survives) and reads the PDFs this exports from outside.
//
//   paper:   vault=true note=true shared="Note Title"  (the note's entry wins)
//   replace: vault=false note=true                      (Bibliography mode: replace)
//   list:    note=true far=true                         (a YAML list over two lines)
//   split:   near=true far=true
//   cites:   vault=true                                 (no header: the vault's alone)
//   export-html plain: reading="(Vault, 2001)" export="(Vault, 2001)"
//            — an HTML export cites as reading view does: the vault's file
//            resolving and its style (apa) over the user's config
//            (export-worker.mjs, shared/citation-files.js#vaultBiblify). Until
//            2026-10-20 export="\citep{vaultonly:2001}", unresolved
//   restale: paper-updated=true                         (a vault.bib edit re-renders a
//            note naming its OWN Bibliography — it draws on the vault's too now)
//   export <engine> <note>: ok=true engine=<engine> pdf=out/<note>-<engine>.pdf
//     — what the app knows of a PDF via LaTeX. What the PDF holds (each
//     citation defined, the references a key in two files resolves to) is
//     the runner's `pdf <engine> <note>:` lines, by pdftotext: the build is
//     made in a temporary folder and only the PDF lands, so the .tex, .log
//     and .blg this used to read beside it are gone (since 2026-10-10; it
//     then logged `bibliography=none undefined=0` for every note).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc, settingsStore } = window.__clew;
const log = (s) => console.log('smoke-bib: ' + s);
for (let i = 0; i < 300 && !vaultStore.vault?.sessionId; i++) await sleep(100);
await sleep(1500);
const html = (path) => ipc.invoke('clew:render-html', { path }).catch((err) => `ERROR ${err.message}`);
// A citation the engine resolved carries data-bibtex; its text is the label.
const resolved = (doc, key) => new RegExp(`data-bibtex="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>[^<]*[A-Z][a-z]+`).test(doc);
const listHas = (doc, title) => doc.includes(title);

let doc = await html('Notes/Paper.md');
log(`paper: vault=${resolved(doc, 'vaultonly:2001')} note=${resolved(doc, 'localonly:2002')} shared=${JSON.stringify(listHas(doc, 'Note Title') ? 'Note Title' : listHas(doc, 'Vault Title') ? 'Vault Title' : 'none')}`);
doc = await html('Notes/Replace.md');
log(`replace: vault=${resolved(doc, 'vaultonly:2001')} note=${resolved(doc, 'localonly:2002')}`);
doc = await html('Notes/List.md');
log(`list: note=${resolved(doc, 'localonly:2002')} far=${resolved(doc, 'far:2003')}`);
doc = await html('Notes/Split.md');
log(`split: near=${resolved(doc, 'near:2004')} far=${resolved(doc, 'far:2003')}`);
doc = await html('Notes/Cites.md');
log(`cites: vault=${resolved(doc, 'vaultonly:2001')}`);
const seeText = (d) => /<p[^>]*>See ([\s\S]*?)\.<\/p>/.exec(String(d))?.[1].replace(/<[^>]*>/g, '') ?? null;
doc = await html('Notes/Plain.md');
await ipc.invoke('clew:export-note', { path: 'Notes/Plain.md', format: 'html', outFile: 'out/Plain.html' });
const exported = await ipc.invoke('clew:note-read', { path: 'out/Plain.html' }).then((r) => r?.content ?? r).catch(() => '');
log(`export-html plain: reading=${JSON.stringify(seeText(doc))} export=${JSON.stringify(seeText(exported))}`);

// A vault.bib edit: does a note naming its own Bibliography re-render?
const bib = await ipc.invoke('clew:note-read', { path: 'Library/vault.bib' });
await ipc.invoke('clew:note-write', { path: 'Library/vault.bib', content: bib.replace('Only In The Vault', 'Edited In The Vault') });
await sleep(4000);
doc = await html('Notes/Paper.md');
log(`restale: paper-updated=${doc.includes('Edited In The Vault')}`);

// PDF via LaTeX under each engine (`bib-engines.txt` in the vault, default both).
const engines = String(await ipc.invoke('clew:note-read', { path: 'bib-engines.txt' }).catch(() => '') || 'pdflatex,lualatex').trim().split(/\s*,\s*/);
for (const engine of engines) {
	settingsStore.set('latexEngine', engine);
	await sleep(300);
	for (const note of ['Paper', 'Replace', 'Cites', 'Split', 'Merge']) {
		const out = `out/${note}-${engine}.pdf`;
		const result = await ipc.invoke('clew:export-note', { path: `Notes/${note}.md`, format: 'pdf', outFile: out }).catch((err) => ({ error: String(err.message ?? err) }));
		log(`export ${engine} ${note}: ok=${!result?.error} engine=${result?.engine ?? '-'} pdf=${out}${result?.error ? ` error=${JSON.stringify(String(result.error).slice(0, 160))}` : ''}`);
	}
}
settingsStore.set('latexEngine', 'auto');
