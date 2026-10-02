// Custom callout types in every output (fixture: make-custom-callout-vault.sh
// <dir>; the out dir is `<vault>-out`, written next to it). Writes the site
// export, the HTML and LaTeX note exports and the reading-view PDF of
// Callouts.md (plus any note `export-notes.txt` lists, HTML and LaTeX), and
// logs each result; the files are then read from the shell (smoke/README.md
// has the checks, including compiling the .tex).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const out = `${vaultStore.vault.path}-out`;
const run = async (what, fn) => {
	try { console.log(`smoke-cx: ${what} ${JSON.stringify(await fn())}`); } catch (err) { console.log(`smoke-cx: ${what} FAILED ${err.message}`); }
};
// `export-notes.txt` in the vault lists other notes to export too (HTML and
// LaTeX), one per line — a citation note, a note with a lone .svg.
const extra = await ipc.invoke('clew:note-read', { path: 'export-notes.txt' }).then((r) => String(r?.content ?? r ?? '')).catch(() => '');
const notes = ['Callouts.md', ...extra.split('\n').map((l) => l.trim()).filter(Boolean)];
await run('site', () => ipc.invoke('clew:export-site', { outDir: `${out}/site` }));
for (const note of notes) {
	const base = note.replace(/\.md$/, '').replace(/\//g, '-');
	await run(`html ${note}`, () => ipc.invoke('clew:export-note', { path: note, format: 'html', outFile: `${out}/${base}.html` }));
	await run(`latex ${note}`, () => ipc.invoke('clew:export-note', { path: note, format: 'latex', outFile: `${out}/${base}.tex` }));
}
await run('print-pdf', () => ipc.invoke('clew:export-note', { path: 'Callouts.md', format: 'print-pdf', outFile: `${out}/Callouts.pdf` }));
