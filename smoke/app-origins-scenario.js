// A `network` grant is bound to its ORIGINS (main/app-grants.js, 2026-10-04).
// Over `node smoke/make-app-origins-vault.mjs <dir> <portA> <portB>` with
// smoke/probe-stub.mjs on both ports, CLEW_SMOKE_VAULT=<dir>/vault,
// CLEW_USER_DATA=<dir>/ud-trusted (or ud-restricted),
// CLEW_SMOKE_FRAME_SCRIPT=smoke/app-origins-frame.js
// CLEW_SMOKE_FRAME_MATCH=clew-frame. The Probe app (granted host A) tries A
// and B on every load. This scenario, by real clicks and by editing the
// manifest ON DISK as a person would:
//   1 Allow → load: A reached, B blocked (not named)
//   2 manifest names A and B → the frame reloads at once and a prompt asks
//     for B ALONE; while it waits, the load: B still blocked — no request
//     reached host B (its stub's log)
//   3 Allow → load: A and B reached
//   4 manifest names B alone → reload at once: A blocked, B reached
// Logs each prompt's text (`ao: prompt …`); the frame logs the history.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-ao: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const tab = workspaceStore.openNote('Probe.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(tab.id, 'reading');
const manifestPath = 'Apps/Probe/clew-app.json';
const manifest = JSON.parse(String(await ipc.invoke('clew:note-read', { path: manifestPath }).then((r) => r?.content ?? r)));
const [A] = manifest.network;
const B = A.replace(/:\d+$/, (p) => `:${Number(p.slice(1)) + 1}`);
const writeNetwork = (network) => ipc.invoke('clew:note-write', { path: manifestPath, content: JSON.stringify({ ...manifest, network }, null, '\t') });
const texts = new Set();
setInterval(() => {
	const sheet = document.querySelector('.clew-app-sheet p');
	if (sheet && !texts.has(sheet.textContent)) { texts.add(sheet.textContent); log(`prompt ${sheet.textContent}`); }
}, 100);
const click = { click: { selector: '.clew-app-sheet .clew-trust-button' } };
// 1 Allow at ~2 s (a spare try at ~4 s finds nothing); 2 the edit at 8 s,
// its prompt left unanswered until 3, the Allow at ~14 s; 4 the edit at 22 s.
window.__clewSmokeInput = [{ wait: 2000 }, click, { wait: 2000 }, click, { wait: 10000 }, click, { wait: 16000 }];
(async () => {
	await sleep(8000);
	await writeNetwork([A, B]);
	log('step 2: manifest names A and B');
	await sleep(14000);
	await writeNetwork([B]);
	log('step 4: manifest names B alone');
})();
