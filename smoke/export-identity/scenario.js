// smoke/export-identity/run.sh's scenario: every note `export-identity.json`
// lists, exported as HTML and as LaTeX into the vault's out/ (a path's `/`
// written `--`), then the demo book Books/Signals both ways into its build/.
// One line each:
//   `ident: Features/Footnotes.md html: ok warnings=0` · `… error=<why>`
//   `ident: book latex: ok` · `ident: done`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-ident: ' + s);
for (let i = 0; i < 300 && !vaultStore.vault?.sessionId; i++) await sleep(100);
await sleep(1500);
const listed = await ipc.invoke('clew:note-read', { path: 'export-identity.json' }).then((r) => r?.content ?? r).catch(() => '[]');
const NOTES = JSON.parse(String(listed));
for (const n of NOTES) {
	for (const [format, ext] of [['html', 'html'], ['latex', 'tex']]) {
		const out = `out/${n.replace(/\.(md|jmd)$/, '').replaceAll('/', '--')}.${ext}`;
		const r = await ipc.invoke('clew:export-note', { path: n, format, outFile: out }).catch((e) => ({ error: String(e.message ?? e) }));
		log(`${n} ${format}: ${r?.error ? 'error=' + r.error.slice(0, 160) : 'ok'} warnings=${(r?.warnings ?? []).length}`);
	}
}
for (const format of ['latex', 'html']) {
	const r = await ipc.invoke('clew:export-book', { master: 'Books/Signals/Signals.md', format }).catch((e) => ({ error: String(e.message ?? e) }));
	log(`book ${format}: ${r?.error ? 'error=' + r.error.slice(0, 160) : 'ok'}`);
}
log('done');
