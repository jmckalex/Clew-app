// Typing beside 300 citations (Many.md, `smoke/make-cite-vault.sh <dir>`):
// what a keystroke costs once the pills read the engine's texts
// (editor/live/cite-text.js), source vs live, the live-perf method — the
// synchronous time of a one-character insert, 40 of them, same spot. And
// how many block renders the typing asks for: none, because prose typed
// between citations does not change the note's list of them (`block-requests
// during typing=0`; the batch is asked for when the list changes, debounced).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, vaultStore } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const log = (s) => console.log('smoke-cperf: ' + s);
let blockRequests = 0;
const realFetch = window.fetch;
window.fetch = (url, ...rest) => {
	if (String(url).includes('__clew_block__')) blockRequests++;
	return realFetch(url, ...rest);
};

async function measure(mode) {
	const tab = workspaceStore.openNote('Many.md', { newTab: true, defaultMode: mode });
	workspaceStore.setTabMode(tab.id, mode);
	await sleep(4000);   // the pills' engine texts in (live), or nothing to wait for
	const view = editorPool.get(tab.id).view;
	const at = view.state.doc.line(40).to;
	view.dispatch({ selection: { anchor: at }, scrollIntoView: true });
	await sleep(1500);
	const pills = [...document.querySelectorAll('.cm-editor .le-cite')].map((p) => p.textContent);
	const before = blockRequests;
	const times = [];
	for (let i = 0; i < 40; i += 1) {
		const pos = view.state.selection.main.head;
		const t0 = performance.now();
		view.dispatch({ changes: { from: pos, insert: 'x' }, selection: { anchor: pos + 1 }, userEvent: 'input.type' });
		times.push(performance.now() - t0);
		await sleep(20);
	}
	await sleep(600);   // past the batch's debounce
	const asked = blockRequests - before;
	const start = view.state.selection.main.head - 40;
	view.dispatch({ changes: { from: start, to: start + 40 } });
	times.sort((a, b) => a - b);
	log(`Many.md ${mode} chars=${view.state.doc.length} median=${times[20].toFixed(2)} p95=${times[37].toFixed(2)} block-requests during typing=${asked}`
		+ (mode === 'live' ? ` pills=${pills.length} sample=${JSON.stringify(pills.slice(0, 5))}` : ''));
	workspaceStore.closeTab?.(tab.id);
	await sleep(300);
}

await measure('source');
await measure('live');
