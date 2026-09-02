// Big-vault stress: time the index build, search, and a query-fence render
// over a 5000-note vault. Numbers land in the console (CLEW_SMOKE_LOG=1).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
const t0 = performance.now();
const stamp = (label) => console.log(`smoke-big: ${label}=${Math.round(performance.now() - t0)}ms`);

// 1. Index arrival (cold build on first run, cache load on second).
while (Object.keys(vaultStore.index).length < 5000) await sleep(50);
stamp('index-arrived');
console.log('smoke-big: notes=' + Object.keys(vaultStore.index).length);

// 2. Search latency across the whole corpus (three shapes).
for (const query of ['computation', 'philosophy identity', 'tag:#urgent']) {
	const s = performance.now();
	const results = await ipc.invoke('clew:search', { query });
	console.log(`smoke-big: search "${query}" ${Math.round(performance.now() - s)}ms ` +
		`${results?.length ?? results?.results?.length ?? '?'} hits`);
}

// 3. Query-fence dashboard render (vault scan in the worker).
const renderStart = performance.now();
let renderDone = false;
ipc.on('clew:ev-render-done', ({ path }) => {
	if (path === 'Dashboard.md' && !renderDone) {
		renderDone = true;
		console.log(`smoke-big: dashboard-render ${Math.round(performance.now() - renderStart)}ms`);
	}
});
workspaceStore.openNote('Dashboard.md', { defaultMode: 'reading' });
for (let i = 0; i < 240 && !renderDone; i++) await sleep(250);
if (!renderDone) console.log('smoke-big: dashboard-render TIMEOUT');

// 4. The save→requery loop: touch one note, watch the dashboard re-render
// (render-service re-renders hasQueries notes on ANY file change).
await sleep(1000);
let rerender = false;
const reStart = performance.now();
ipc.on('clew:ev-render-done', ({ path }) => {
	if (path === 'Dashboard.md' && renderDone && !rerender) {
		rerender = true;
		console.log(`smoke-big: dashboard-rerender ${Math.round(performance.now() - reStart)}ms`);
	}
});
const victim = Object.keys(vaultStore.index).find((p) => /Note \d+\.md$/.test(p));
console.log('smoke-big: touching=' + victim);
await ipc.invoke('clew:note-write', { path: victim,
	content: '---\nstatus: active\npriority: 1\n---\n# Touched\n\nEdited by the stress run.\n' });
for (let i = 0; i < 240 && !rerender; i++) await sleep(250);
if (!rerender) console.log('smoke-big: dashboard-rerender TIMEOUT');
await sleep(500);
