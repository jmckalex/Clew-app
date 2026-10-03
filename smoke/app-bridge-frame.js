// In each frame: the probe app's results (in the app frame), or — in the
// note's preview document — that a document on the PREVIEW origin saying
// hello as if it were an app gets no port.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (location.protocol === 'clew-frame:' && document.title === 'Watcher') {
	for (let i = 0; i < 40 && !window.__watch?.granted; i++) await sleep(250);
	console.log(`smoke-app-frame: watcher ${JSON.stringify(window.__watch ?? 'NO RESULTS')}`);
} else if (location.protocol === 'clew-frame:' && document.title === 'Writer') {
	for (let i = 0; i < 60 && !window.__writer; i++) await sleep(250);
	console.log(`smoke-app-frame: writer ${JSON.stringify(window.__writer ?? 'NO RESULTS')}`);
} else if (location.protocol === 'clew-frame:') {
	for (let i = 0; i < 60 && !window.__probe; i++) await sleep(250);
	console.log(`smoke-app-frame: ${JSON.stringify(window.__probe ?? 'NO RESULTS')}`);
	// Navigation is pinned to the app's own origin (R2): main refuses this
	// (`smoke-app-nav-refused:`), and the frame stays where it is.
	setTimeout(() => { location.href = 'https://clew-csp-probe.invalid/?pinned=1'; }, 0);
} else if (/Probe\.md/.test(location.pathname)) {
	let welcomed = false;
	window.addEventListener('message', (e) => { if (e.data?.type === 'welcome') welcomed = true; });
	window.top.postMessage({ source: 'clew-app', type: 'hello', v: [1] }, '*');
	await sleep(1500);
	console.log(`smoke-app-frame: preview-doc-hello welcomed=${welcomed}`);
}
