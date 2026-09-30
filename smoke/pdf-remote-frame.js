// Each viewer frame in Web.md (pdf-remote-scenario.js).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!location.search.includes('readonly=1')) {
	console.log(`smoke-rp-frame ${SMOKE_FRAME}: not a web PDF`);
} else if (window.__clewRemoteFailure) {
	console.log(`smoke-rp-frame: failure=${window.__clewRemoteFailure} save-offered=${!document.querySelector('[data-act="save"]').hidden}`);
} else {
	const h = window.__clewPdfHandle;
	const strip = document.body.classList.contains('is-remote');
	console.log(`smoke-rp-frame: readonly=${location.search.includes('readonly=1')} strip=${strip} loaded=${Boolean(h?.container)} autosave=${typeof h?.saveNow === 'function' ? 'installed' : 'none'} stale=${window.__clewRemoteStale}`);
	document.querySelector('button[data-act="save"]').click();
	for (let i = 0; i < 50 && !window.__clewRemoteSaved; i++) await sleep(100);
	console.log(`smoke-rp-frame: saved=${window.__clewRemoteSaved}`);
	document.querySelector('button[data-act="open"]').click();
	await sleep(800);
	console.log('smoke-rp-frame: opened=true');
}
