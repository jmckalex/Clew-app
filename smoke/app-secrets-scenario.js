// An app's secrets on this device (main/app-secrets.js, app-calls.js
// secrets.*, frame-bridge.md §9c), over `node smoke/make-app-secrets-vault.mjs
// <dir>`: CLEW_SMOKE_VAULT=<the path it prints> CLEW_USER_DATA=<dir>/ud
// CLEW_SMOKE_LOG=1 CLEW_SMOKE_SCRIPT_RELOADED=smoke/app-secrets-reloaded.js.
// Under the harness the store is in memory (never written), so a run proves
// the rules, and tests/app-secrets.test.js the encryption on disk.
//
// Keeper.md's two apps are allowed by REAL clicks. Then:
//   set      its note says `phase: set` → Keeper keeps a secret
//            (`smoke-keeper: set=ok`, `phase=set got=present`); Settings'
//            list says `secrets=1`. Nosy, never granted app.secrets:
//            `smoke-nosy: get=denied set=denied`.
//   kept     `phase: get`, the tab closed and the note opened afresh — new
//            frames — `phase=get got=present`.
//   revoke   Revoke → `secrets=0`; asked again and allowed → `got=none`.
//   forget   set again (`secrets=1`), then Settings → Trusted vaults →
//            Forget: the window reloads, Keeper (now only looking) says
//            `phase=get got=none`, and the second half logs
//            `after-forget keeper-secrets=0`.
// The shell then searches the run log, the vault and the profile for the
// value (`S3CR3T-VALUE-7f3a`, which no file holds whole): none of them has it.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc, appHost } = window.__clew;
const log = (s) => console.log('smoke-secrets: ' + s);
const until = async (test, ms = 15000) => { for (let t = 0; t < ms; t += 200) { if (await test()) return true; await sleep(200); } return false; };
const sheet = () => document.querySelector('.clew-app-sheet');
const live = (name) => appHost.liveEmbeds().filter((e) => e.name === name).length;
const keeperSecrets = async () => (await ipc.invoke('clew:apps-list')).find((a) => a.id === 'keeper')?.secrets;
const read = async () => { const r = await ipc.invoke('clew:note-read', { path: 'Keeper.md' }); return String(r?.content ?? r ?? ''); };
const phase = async (p) => ipc.invoke('clew:note-write', { path: 'Keeper.md', content: (await read()).replace(/phase: \w+/, `phase: ${p}`) });
const openKeeper = () => {
	const tab = workspaceStore.openNote('Keeper.md', { newTab: true, defaultMode: 'reading' });
	workspaceStore.setTabMode(tab.id, 'reading');
	return tab;
};
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
let tab = openKeeper();
await until(() => !!sheet());
const allow = { click: { selector: '.clew-app-sheet .clew-trust-button' } };
// Keeper's prompt and Nosy's, then — after the revoke — Keeper's again.
window.__clewSmokeInput = [allow, { wait: 5000 }, allow, { wait: 30000 }, allow, { wait: 25000 }];

(async () => {
	await until(() => live('Keeper') && live('Nosy'), 20000);
	log(`live keeper=${live('Keeper')} nosy=${live('Nosy')}`);
	await sleep(1500);
	await phase('set');
	await until(async () => (await keeperSecrets()) === 1, 8000);
	log(`set secrets=${await keeperSecrets()}`);

	await phase('get');
	await sleep(800);
	workspaceStore.closeTab(tab.id, { force: true });
	await sleep(800);
	tab = openKeeper();
	await until(() => live('Keeper') > 0, 10000);
	await sleep(2500);
	log(`kept secrets=${await keeperSecrets()}`);

	await ipc.invoke('clew:app-revoke', { id: 'keeper' });
	log(`revoked secrets=${await keeperSecrets()}`);
	await until(() => !!sheet(), 10000);
	log(`revoke prompt=${!!sheet()}`);
	await until(() => !sheet() && live('Keeper') > 0, 30000);
	await sleep(2500);

	await phase('set');
	await until(async () => (await keeperSecrets()) === 1, 8000);
	log(`reset secrets=${await keeperSecrets()}`);
	// Only looking from now on: after the reload Keeper says what is left.
	await phase('get');
	await sleep(1500);
	const key = vaultStore.vault.path ?? vaultStore.vault.root;
	log('forgetting the vault');
	await ipc.invoke('clew:trusted-vaults-set', { key, action: 'forget' });
})();
