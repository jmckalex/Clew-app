// The demo vault brought up to date in an existing copy (main/demo-sync.js;
// the owner's dev.6 had no App Gallery because its copy dated from 1
// October, then kept the old ticker). Over `node smoke/make-demo-sync-target.mjs
// <dir>` (a copy as dev.6 made it: no record, the old ticker, Welcome.md
// edited): CLEW_SMOKE_VAULT=<dir>/vault CLEW_SMOKE_DEMO_TARGET=<dir>/copy —
// the dev build takes the packaged path to that copy. This opens the demo
// vault as Help does (VAULT_OPEN_DEMO); MAIN logs `smoke-demo-sync:
// fresh=false added=N updated=N […]` and, to the demo's window,
// `smoke-demo-sync: notice "…"`. Run twice over one copy: the second does
// nothing. From the shell after: the ticker is the new one (finnhub.io in
// its manifest, live.js there), Welcome.md keeps "MY OWN EDIT.", and .clew
// holds demo-files.json but no plugins.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const info = await ipc.invoke('clew:vault-open-demo').catch((e) => ({ error: String(e) }));
console.log(`smoke-demo-sync-page: opened=${info?.name ?? info?.error ?? null}`);
window.__clewSmokeInput = [{ wait: 6000 }];
