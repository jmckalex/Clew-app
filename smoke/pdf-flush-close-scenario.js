// Closing the WINDOW with a PDF annotation pending (pdf-frames.js via the
// window's close handshake in office-dock.js). Two runs over ONE fixture from
// `node smoke/make-pdf-vault.mjs <dir>`:
//   1. with CLEW_SMOKE_CLOSE_WINDOW=1: finds no highlight, makes one and
//      returns — the harness closes the window at once, well inside the
//      2.5 s debounce → `made=1`, then the harness's `smoke-windows: 0`
//   2. without it: finds what reached the file → `after-close kept=1/1`
// Before the fix: kept=0/1.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, pdfAnnotations } = window.__clew;
const log = (s) => console.log('smoke-pfc: ' + s);
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (test()) return true;
	return false;
};
const frame = () => [...document.querySelectorAll('clew-file-view:not([data-clew-retiring])')]
	.find((v) => v.path === 'Paper.pdf')?.querySelector('iframe.pdf-frame');
const existing = (await pdfAnnotations.listAnnotations('Paper.pdf')).filter((a) => a.kind === 'highlight').length;
if (existing > 0) {
	log(`after-close kept=${existing}/1`);
} else {
	await until(() => frame());
	await sleep(1000);
	const made = await new Promise((resolve) => {
		const on = (e) => { if (e.data?.type === 'test-created') { window.removeEventListener('message', on); resolve(e.data.made); } };
		window.addEventListener('message', on);
		frame().contentWindow.postMessage({ source: 'clew-preview-host', type: 'test-create-annotations',
			specs: [{ kind: 'highlight', page: 1, match: 'Morality evolves' }] }, '*');
		setTimeout(() => resolve(-1), 10000);
	});
	log(`made=${made}`);
}
