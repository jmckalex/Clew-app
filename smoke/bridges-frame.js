// Runs INSIDE every Excalidraw page (CLEW_SMOKE_FRAME_MATCH=clewex); see
// bridges-scenario.js. The page's own smoke hooks say what its bridges
// answered; the tab also makes a real edit and a library change.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (test, ms) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (test()) return true;
	return false;
};
const params = new URLSearchParams(location.search);
const view = params.get('view') === '1';
const tag = view ? 'embed' : 'tab';
const ready = await until(() => window.__clewExcalidrawReady === true, 12000);
console.log(`smoke-bridges-frame ${tag}: ready=${ready}`
	+ (view ? '' : ` library=${window.__clewExcalidrawLibraryCount}`)
	+ ` injected=${window.__clewExcalidrawInjected}`);
if (!view && ready && window.__clewExcalidrawLibraryCount === 0) {
	const api = window.__clewExcalidrawAPI;
	const status = document.getElementById('status');
	const mark = `bridge-${Date.now()}`;
	// A real edit: the page saves only after user input (a keydown counts).
	window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
	const elements = api.getSceneElements();
	api.updateScene({ elements: [...elements, { ...elements[0], id: mark, x: 0, y: 140, seed: 7, versionNonce: 7 }] });
	let seen = '';
	await until(() => {
		if (status.textContent) seen = status.textContent;
		return seen === 'saved' || seen === 'save failed';
	}, 8000);
	const src = params.get('src');
	const disk = await (await fetch(src, { cache: 'no-store' })).text();
	console.log(`smoke-bridges-frame saved status=${seen || 'none'} on-disk=${disk.includes(mark)}`);
	// The library: one item, saved through the bridge (the next run loads it).
	const items = await api.updateLibrary({
		libraryItems: [{ id: 'lib1', status: 'unpublished', elements: [api.getSceneElements()[0]], created: Date.now() }],
		merge: true,
	});
	await sleep(1500);
	console.log(`smoke-bridges-frame library-set items=${items?.length}`);
}
