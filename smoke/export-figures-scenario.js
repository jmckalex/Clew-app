// What draws an export's TikZ and MetaPost (jmarkdown 21dee42;
// export-cache.js#figureEngineOptions, export.js#figureEngine) over
// `node smoke/make-export-figures-vault.mjs <dir>` (CLEW_SMOKE_VAULT=<dir>/vault
// CLEW_USER_DATA=<dir>/ud CLEW_SMOKE_LOG=1; trusted when the profile lists the
// vault under `recentVaults`, restricted otherwise; CLEW_SMOKE_NO_TEX=1 for a
// machine with no TeX; CLEW_MPTIKZ_DIR=<dir>/nodist for a library that will
// not load). The files are smoke/export-figures-check.mjs's to read afterwards.
//
// Under each value of the `exportFigureEngine` setting in turn — external,
// then auto — every fixture note is exported into `ef/<setting>/`:
//   start    `default=external trusted=…` — the setting's value before any change
//   export   `<setting> <note>.<ext> ok=… warnings=[…]` (minted's lexer
//            warnings left out) or `error="…"`
// A restricted vault's exports come out the same under both values: the
// setting governs trusted vaults only.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, settingsStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-ef: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const { trusted } = await ipc.invoke('clew:vault-trust-get');
log(`start default=${settingsStore.get('exportFigureEngine')} trusted=${trusted}`);
const EXPORTS = [
	['Figures/Engine.md', ['html', 'latex']],
	['Figures/Probe.md', ['html', 'pdf']],
	['Figures/Times.md', ['html']],
	['Pkg/Package.md', ['html']],
];
const EXT = { html: 'html', latex: 'tex', pdf: 'pdf' };
for (const setting of ['external', 'auto']) {
	settingsStore.set('exportFigureEngine', setting);
	await sleep(400);
	for (const [note, formats] of EXPORTS) {
		const name = note.split('/').pop().replace(/\.md$/, '');
		for (const format of formats) {
			const outFile = `ef/${setting}/${name}.${EXT[format]}`;
			const r = await ipc.invoke('clew:export-note', { path: note, format, outFile })
				.catch((e) => ({ error: String(e.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') }));
			const warnings = (r?.warnings ?? []).map(String).filter((w) => !/minted has no Pygments lexer/.test(w)).map((w) => w.slice(0, 160));
			log(`export ${setting} ${name}.${EXT[format]} ${r?.error ? `error=${JSON.stringify(String(r.error).slice(0, 200))}` : `ok=true warnings=${JSON.stringify(warnings)}`}`);
		}
	}
}
settingsStore.set('exportFigureEngine', 'external');
await sleep(400);
log('done');
window.__clewSmokeInput = [{ wait: 300 }];
