// What the index cache's save costs main's thread (main/indexer.js#persist):
// 2s after the last changed file the whole index goes to .clew/cache.json.
// Until 2026-10-15 that was one synchronous JSON.stringify and a
// synchronous write and fsync — on 5,000 notes a stall of main, and on the
// iPad (Clew-iOS runs the same file in its page) a 150–175ms frame. Now the
// JSON is built in slices and written on libuv's threads.
//
// Fixture: `node smoke/gen-big-vault.mjs <dir>` (5,000 notes). The run lets the
// open's own save pass, then writes ONE note and asks main something trivial
// (SETTINGS_GET) every few milliseconds for 5s, timing each answer — main
// can answer nothing while its thread is held. Logs, per window after the
// write: `write` (0–1.5s: the change itself) and `save` (1.5–5s: the cache
// save, 2s after it): answers, median, p99 and max round trip, how many over
// 16.7 and 50ms. Three rounds. With CLEW_SMOKE_INDEX_SAVE=1 main logs
// `smoke-index-save:` with the save's own timings (its own variable: the
// sweeps count every smoke- line).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-is: ' + s);
for (let i = 0; i < 1200 && Object.keys(vaultStore.index ?? {}).length < 5000; i++) await sleep(100);
log(`notes=${Object.keys(vaultStore.index).length}`);
await sleep(4000);   // the open's own save, out of the way

const note = Object.keys(vaultStore.index).filter((p) => p.endsWith('.md')).sort()[17];
const original = String(((r) => r?.content ?? r)(await ipc.invoke('clew:note-read', { path: note })));
const stats = (xs) => {
	const s = [...xs].sort((a, b) => a - b);
	const at = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
	return `answers=${s.length} median=${at(0.5).toFixed(1)} p99=${at(0.99).toFixed(1)} max=${(s[s.length - 1] ?? 0).toFixed(1)}`
		+ ` over16=${s.filter((x) => x > 16.7).length} over50=${s.filter((x) => x > 50).length}`;
};
for (let round = 1; round <= 3; round++) {
	await ipc.invoke('clew:note-write', { path: note, content: `${original}\nround ${round}\n` });
	const t0 = performance.now();
	const write = [];
	const save = [];
	while (performance.now() - t0 < 5000) {
		const s = performance.now();
		await ipc.invoke('clew:settings-get');
		const e = performance.now();
		(s - t0 < 1500 ? write : save).push(e - s);
		await sleep(3);
	}
	log(`round ${round} write ${stats(write)}`);
	log(`round ${round} save ${stats(save)}`);
}
await ipc.invoke('clew:note-write', { path: note, content: original });
log('done');
