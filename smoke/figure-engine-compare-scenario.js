// What an owner's exports look like under one value of `exportFigureEngine`
// (export-cache.js#figureEngineOptions), over `make-figure-engine-vault.mjs
// <dir>` opened TRUSTED (the vault under the profile's `recentVaults`). The
// value is `.figure-engine-compare.json`'s `setting` in the vault root (a
// dotfile: no walk sees it); smoke/figure-engine-compare.sh runs it once per
// value, each on a fresh copy and profile, and the check compares the two.
//
// Two rounds, `cold` (a fresh profile: an empty export cache) and `warm` (the
// same exports again: every figure from the cache), each exporting
// Features/Diagrams.md and Figures.md as HTML, LaTeX and PDF via LaTeX into
// `fe/<round>/`, then the Signals book (Books/Signals/build/) the same three
// ways. One line each:
//   smoke-fec: export <setting> <round> <what> <format> ms=… t0=… t1=… out=… warnings=[…]
// (t0/t1 are epoch milliseconds, for the process sampler's window; minted's
// lexer warnings left out) or `… error="…"`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, settingsStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-fec: ' + s);
try {
	for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
	const cfg = JSON.parse(await ipc.invoke('clew:note-read', { path: '.figure-engine-compare.json' }).then((r) => String(r?.content ?? r)).catch(() => '{}'));
	const setting = cfg.setting ?? 'external';
	const { trusted } = await ipc.invoke('clew:vault-trust-get');
	log(`start setting=${setting} default=${settingsStore.get('exportFigureEngine')} trusted=${trusted}`);
	settingsStore.set('exportFigureEngine', setting);
	await sleep(400);
	const EXT = { html: 'html', latex: 'tex', pdf: 'pdf' };
	const clean = (r) => (r?.warnings ?? []).map(String).filter((w) => !/minted has no Pygments lexer/.test(w)).map((w) => w.replace(/\s+/g, ' ').slice(0, 300));
	const run = async (round, what, format, call) => {
		const t0 = Date.now(), p0 = performance.now();
		const r = await call().catch((e) => ({ error: String(e.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') }));
		const ms = Math.round(performance.now() - p0), t1 = Date.now();
		log(`export ${setting} ${round} ${what} ${format} ms=${ms} t0=${t0} t1=${t1} ${r?.error
			? `error=${JSON.stringify(String(r.error).slice(0, 300))}`
			: `out=${r?.outputRel ?? r?.output ?? '-'} warnings=${JSON.stringify(clean(r))}`}`);
	};
	for (const round of ['cold', 'warm']) {
		for (const note of ['Features/Diagrams.md', 'Figures.md']) {
			const name = note.split('/').pop().replace(/\.md$/, '');
			for (const format of ['html', 'latex', 'pdf']) {
				await run(round, name, format, () => ipc.invoke('clew:export-note', { path: note, format, outFile: `fe/${round}/${name}.${EXT[format]}` }));
			}
		}
		for (const format of ['html', 'latex', 'pdf']) {
			await run(round, 'Signals', format, () => ipc.invoke('clew:export-book', { master: 'Books/Signals/Signals.md', format }));
		}
	}
} catch (err) { log(`error ${err?.stack ?? err}`); }
log('done');
window.__clewSmokeInput = [{ wait: 300 }];
