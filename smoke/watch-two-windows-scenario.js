// The watcher budget across TWO windows, in the real app (vault.js; the
// plain-node twin is smoke/watch-repro.mjs). Window 1 is CLEW_SMOKE_VAULT;
// this opens SMOKE_SECOND (passed in as the vault path written below) as a
// second window. Both are `make-watch-vault.mjs` fixtures (ph341's shape).
// The runner writes a file into each vault's ROOT from outside Clew at 25 s:
//
//   node smoke/make-watch-vault.mjs <a> && node smoke/make-watch-vault.mjs <b>
//   sed "s#__SECOND__#<b>/vault#" smoke/watch-two-windows-scenario.js > s.js
//   (sleep 25; echo x > <a>/vault/External-1.md; echo x > <b>/vault/External-2.md) &
//   CLEW_SMOKE_SCRIPT=s.js CLEW_SMOKE_VAULT=<a>/vault … electron .
//
// Expect main's log to show two cap lines — window 1 `capped at 6000`,
// window 2 `capped at 1000` (before 2026-09-30: 8000, and 0 for the second)
// — and `window-1 external visible=true`, the watcher's doing alone (Clew
// writes nothing here). Window 2's explorer, in the second screenshot, lists
// External-2.md.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
await sleep(3000);
await ipc.invoke('clew:vault-open-path', { path: '__SECOND__' });
console.log('smoke-w2: second window opened');
window.__clewSmokeInput = [{ wait: 36000 }];
(async () => {
	for (let t = 0; t < 34000 && !vaultStore.pathExists('External-1.md'); t += 200) await sleep(200);
	console.log(`smoke-w2: window-1 external visible=${vaultStore.pathExists('External-1.md')} at ${Math.round(performance.now() / 1000)} s`);
})();
