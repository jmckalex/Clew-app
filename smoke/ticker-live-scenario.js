// The Stock Ticker's Live stocks (Finnhub) and ECB modes, by REAL input,
// over `node smoke/make-ticker-live-vault.mjs <dir> <stub|real> [port]`,
// CLEW_SMOKE_VAULT=<dir>/vault CLEW_USER_DATA=<dir>/ud,
// CLEW_SMOKE_FRAME_SCRIPT=smoke/ticker-live-frame.js
// CLEW_SMOKE_FRAME_MATCH=clew-frame.
//   stub  (smoke/finnhub-stub.mjs running on the port): Live stocks with no
//         key opens the key panel and asks nothing; a key typed and saved
//         starts the requests — the stub's log: three quick ones, the 4th a
//         429, a wait, then stale quotes; the band's states
//         `sim,none,open,closed`; Forget key empties the app's storage.
//   real  (+ CLEW_SMOKE_NET_LOG=1): nothing leaves until Live; a made-up
//         key → one request to finnhub.io, refused (401), said; ECB rates →
//         api.frankfurter.dev; no other host ever. The frame tries Finnhub's
//         X-Finnhub-Token header itself: blocked by Finnhub's CORS.
// Both: the key is in no file of the vault (`tl: vault-has-key=false`).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-tl: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const kind = String(await ipc.invoke('clew:note-read', { path: 'ticker-mode.txt' }).then((r) => r?.content ?? r)).trim();
const tab = workspaceStore.openNote('Ticker.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(tab.id, 'reading');
const KEY = kind === 'stub' ? 'test-key-123' : 'clew-test-invalid-key';
const allowOnce = [{ wait: 2500 }, { click: { selector: '.clew-app-sheet .clew-trust-button' } }];
const app = (selector) => ({ frameClick: { match: 'clew-frame', selector } });
const typeKey = [app('#keyInput'), { text: KEY }, app('#keySave')];
window.__clewSmokeInput = kind === 'stub'
	? [...allowOnce, ...allowOnce, { wait: 4000 }, app('#modeStocks'), { wait: 1500 }, ...typeKey, { wait: 50000 },
		app('#keyBtn'), { wait: 800 }, app('#keyForget'), { wait: 2000 }]
	: [...allowOnce, ...allowOnce, { wait: 6000 }, app('#modeStocks'), { wait: 2000 }, ...typeKey, { wait: 6000 },
		app('#keyClose'), app('#modeEcb'), { wait: 6000 }, app('#keyBtn'), { wait: 800 }, app('#keyForget'), { wait: 2000 }];
log(`kind=${kind} phase=start (no Live yet: nothing may be requested)`);
(async () => {
	await sleep(kind === 'stub' ? 12000 : 15000);
	log('phase=clicking-live-stocks');
	await sleep(kind === 'stub' ? 44000 : 10000);
	const clewdata = String(await ipc.invoke('clew:note-read', { path: 'clewdata.json' }).then((r) => r?.content ?? r).catch(() => ''));
	// Kept as the app's SECRET on this device (app.secrets), not for the
	// session only: Clew's own count, before Forget key empties it.
	const kept = (await ipc.invoke('clew:apps-list')).find((a) => a.id === 'stock-ticker')?.secrets;
	log(`vault-has-key=${clewdata.includes(KEY)} kept-as-secret=${kept} clewdata=${JSON.stringify(clewdata.slice(0, 160))}`);
})();
