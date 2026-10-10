// An export's figures OUTSIDE the vault (main/export-cache.js, export.js#
// figureCache; jmarkdown d134995 cacheDir/copyFigures; the owner's "Outside",
// 2026-10-06), over a COPY of demo-vault (`rsync -a --exclude .clew
// demo-vault/ <dir>/vault/`), CLEW_SMOKE_VAULT=<dir>/vault CLEW_SMOKE_LOG=1.
// Trusted when the profile lists the vault under `recentVaults`, restricted
// with a fresh one. `ec-mode.txt` at the vault's root: `all` (the default) or
// `pdf` (the PDF export alone — "a restricted-vault PDF export leaves nothing
// anywhere but the PDF"). Logs `smoke-ec: …`; the file checks are
// `node smoke/export-cache-check.mjs <dir> before|after` (README).
//
//   all  Features/Diagrams.md (@begin(mermaid), @begin(TiKZ), @begin(metapost))
//        → xn/diagrams.tex, xn/diagrams.html, xn/pdf/diagrams.pdf;
//        xn/solo.tex twice (the second trashes the first's marked
//        solo-figures/: `smoke-trash: xn/solo-figures`), then xn/diagrams.tex
//        again (its .html is there: its folder is kept); xn/foreign.tex beside
//        a foreign-figures/ of the user's (untouched, a readable warning);
//        Books/Signals with a MetaPost figure in Conventions, as LaTeX and HTML
//   pdf  xn/pdf/diagrams.pdf only
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-ec: ' + s);
const read = async (p) => String(await ipc.invoke('clew:note-read', { path: p }).then((r) => r?.content ?? r).catch((e) => `ERR ${e.message}`));
const NOTE = 'Features/Diagrams.md';
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
await sleep(1500);
const sid = vaultStore.vault.sessionId;
const mode = (await read('ec-mode.txt')).trim().startsWith('pdf') ? 'pdf' : 'all';
const { trusted } = await ipc.invoke('clew:vault-trust-get');
log(`mode=${mode} trusted=${trusted}`);

const exported = async (path, format, outFile) => {
	const t0 = Date.now();
	const r = await ipc.invoke('clew:export-note', { path, format, outFile }).catch((e) => ({ error: e.message }));
	log(`export ${path} ${format} → ${outFile} ${r.error ? `ERROR ${r.error}` : `warnings=${r.warnings?.length ?? 0}`} ${Date.now() - t0}ms`);
	return r;
};
/** What a .tex or .html refers to for its figures. */
const refs = (text) => ({
	figures: [...new Set(text.match(/[\w.-]+-figures\/[\w-]+\/[\w.-]+/g) ?? [])].length,
	absolute: /\/Users\/|\/private\/|\/var\/folders\//.test(text),
	cache: /export-cache|clew-figures-/.test(text),
});
const status = async (url) => { try { return (await fetch(url)).status; } catch (e) { return `ERR ${e.message}`; } };

try {
	if (mode === 'pdf') {
		await exported(NOTE, 'pdf', 'xn/pdf/diagrams.pdf');
	} else {
		await exported(NOTE, 'latex', 'xn/diagrams.tex');
		log(`tex ${JSON.stringify(refs(await read('xn/diagrams.tex')))}`);

		await exported(NOTE, 'html', 'xn/diagrams.html');
		const html = await read('xn/diagrams.html');
		const srcs = [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('img')]
			.map((img) => img.getAttribute('src')).filter((src) => /-figures\//.test(src ?? ''));
		const base = `clew-preview://vault/${encodeURIComponent(sid)}/xn/`;
		const loaded = (await Promise.all(srcs.map((src) => status(new URL(src, base).href)))).filter((s) => s === 200).length;
		log(`html ${JSON.stringify(refs(html))} images=${loaded}/${srcs.length} srcs=${JSON.stringify(srcs.map((s) => s.replace(/[0-9a-f]{8,}/g, '…')))}`);

		await exported(NOTE, 'pdf', 'xn/pdf/diagrams.pdf');

		// A marked folder goes to the Trash before the next export of it…
		await exported(NOTE, 'latex', 'xn/solo.tex');
		await exported(NOTE, 'latex', 'xn/solo.tex');
		log(`solo ${JSON.stringify(refs(await read('xn/solo.tex')))}`);
		// …but not while another export it serves is there.
		await exported(NOTE, 'latex', 'xn/diagrams.tex');
		log(`kept html-images=${(await Promise.all(srcs.map((src) => status(new URL(src, base).href)))).filter((s) => s === 200).length}/${srcs.length}`);

		// A folder of that name the user made is never touched.
		await ipc.invoke('clew:note-write', { path: 'xn/foreign-figures/mine.md', content: 'The user\'s own.\n' });
		const foreign = await exported(NOTE, 'latex', 'xn/foreign.tex');
		const said = (foreign.warnings ?? []).map(String).filter((w) => /not one Clew or jmarkdown made/.test(w));
		log(`foreign kept=${(await read('xn/foreign-figures/mine.md')).startsWith('The user')} warning=${JSON.stringify(said[0] ?? null)} tex=${JSON.stringify(refs(await read('xn/foreign.tex')))}`);

		// A book whose chapter has a diagram: its .tex and its pages share build/Signals-figures/.
		const CH = 'Books/Signals/Conventions.md';
		const diagram = '\n\n@begin(metapost)\nbeginfig(1); draw fullcircle scaled 2cm; endfig;\n@end(metapost)\n';
		await ipc.invoke('clew:note-write', { path: CH, content: (await read(CH)) + diagram });
		await sleep(1500);
		for (const format of ['latex', 'html']) {
			const r = await ipc.invoke('clew:export-book', { master: 'Books/Signals/Signals.md', format }).catch((e) => ({ error: e.message }));
			log(`book ${format} ${r.error ? `ERROR ${r.error}` : `${r.outputRel} warnings=${r.warnings?.length ?? 0}`}`);
		}
		const tex = await read('Books/Signals/build/Signals.tex');
		const pages = await Promise.all(['index.html', 'Senders-and-Receivers.html', 'Conventions.html', 'Deception.html'].map((p) => read(`Books/Signals/build/Signals/${p}`)));
		const pageRefs = pages.flatMap((p) => p.match(/\.\.\/Signals-figures\/[\w-]+\/[\w.-]+/g) ?? []);
		const pageBase = `clew-preview://vault/${encodeURIComponent(sid)}/Books/Signals/build/Signals/`;
		const pageLoaded = (await Promise.all(pageRefs.map((src) => status(new URL(src, pageBase).href)))).filter((s) => s === 200).length;
		log(`book-refs tex=${JSON.stringify(refs(tex))} pages=${pageLoaded}/${pageRefs.length}`);
	}
} catch (err) { log(`error ${err?.message ?? err}`); }
log('done');
window.__clewSmokeInput = [{ wait: 300 }];
