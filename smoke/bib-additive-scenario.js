// The engine's additive Bibliography, as Clew renders, re-renders and
// exports it (jmarkdown 909af7a/e7cf638; main/citation-header.js). Fixture:
// `node smoke/make-bib-vault.mjs <dir>`. For the PDF exports under BOTH
// engines run with HOME pointed at an empty folder: the owner's global
// ~/.jmarkdown loads fontspec, which no pdfLaTeX run survives.
//
//   paper:   vault=true note=true shared="Note Title"  (the note's entry wins)
//   replace: vault=false note=true                      (Bibliography mode: replace)
//   list:    note=true far=true                         (a YAML list over two lines)
//   split:   near=true far=true
//   cites:   vault=true                                 (no header: the vault's alone)
//   restale: paper-updated=true                         (a vault.bib edit re-renders a
//            note naming its OWN Bibliography — it draws on the vault's too now)
//   export <engine> <note>: ok=… bibliography={…} undefined=N engine=…
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
	for (const note of ['Paper', 'Split', 'Merge']) {
		const out = `out/${note}-${engine}.pdf`;
		const result = await ipc.invoke('clew:export-note', { path: `Notes/${note}.md`, format: 'pdf', outFile: out }).catch((err) => ({ error: String(err.message ?? err) }));
		const tex = await ipc.invoke('clew:note-read', { path: out.replace(/\.pdf$/, '.tex') }).catch(() => '');
		const texLog = await ipc.invoke('clew:note-read', { path: out.replace(/\.pdf$/, '.log') }).catch(() => '');
		const blg = await ipc.invoke('clew:note-read', { path: out.replace(/\.pdf$/, '.blg') }).catch(() => '');
		const merged = await ipc.invoke('clew:note-read', { path: out.replace(/\.pdf$/, '-bibliography.bib') }).then((t) => (t ? (t.match(/^@/gm) ?? []).length : 0)).catch(() => 0);
		const undefinedCites = (texLog.match(/Citation [`'][^']*' on page \d+ undefined/g) ?? []).length;
		log(`export ${engine} ${note}: ok=${!result?.error} bibliography=${(/\\bibliography\{([^}]*)\}/.exec(tex) ?? [])[1] ?? 'none'} undefined=${undefinedCites} cant-open=${/couldn't open database/.test(blg)} merged-entries=${merged} engine=${result?.engine ?? '-'}${result?.error ? ` error=${JSON.stringify(String(result.error).slice(0, 160))}` : ''}`);
	}
}
settingsStore.set('latexEngine', 'auto');
