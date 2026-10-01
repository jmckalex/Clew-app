// Custom callout types in every output (fixture: make-custom-callout-vault.sh
// <dir>; the out dir is `<vault>-out`, written next to it). Writes the site
// export, the HTML and LaTeX note exports and the reading-view PDF of
// Callouts.md, and logs each result; the files are then read from the shell
// (smoke/README.md has the checks).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const out = `${vaultStore.vault.path}-out`;
const run = async (what, fn) => {
	try { console.log(`smoke-cx: ${what} ${JSON.stringify(await fn())}`); } catch (err) { console.log(`smoke-cx: ${what} FAILED ${err.message}`); }
};
await run('site', () => ipc.invoke('clew:export-site', { outDir: `${out}/site` }));
await run('html', () => ipc.invoke('clew:export-note', { path: 'Callouts.md', format: 'html', outFile: `${out}/Callouts.html` }));
await run('latex', () => ipc.invoke('clew:export-note', { path: 'Callouts.md', format: 'latex', outFile: `${out}/Callouts.tex` }));
await run('print-pdf', () => ipc.invoke('clew:export-note', { path: 'Callouts.md', format: 'print-pdf', outFile: `${out}/Callouts.pdf` }));
