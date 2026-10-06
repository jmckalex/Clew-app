// The `clew` command against a running Clew (src/cli/clew.mjs →
// main/deep-link-host.js). Driven from a SHELL while this keeps the window
// up: launch with CLEW_CLI_SOCKET=<short path> (a smoke profile's path is
// too long for a socket name) over `node smoke/make-deep-link-vault.mjs
// <dir>`, run the commands, and this reports what the window shows after
// 33 s, or the milliseconds a `cli-wait.txt` at the vault's root names (a
// PDF holding diagrams takes longer to build than that):
//   `cli: tabs=[…] cli-note=<bool> exported=<bool>`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-cli-page: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const asked = await ipc.invoke('clew:note-read', { path: 'cli-wait.txt' }).then((r) => Number(String(r?.content ?? r).trim())).catch(() => NaN);
const hold = Number.isFinite(asked) && asked > 0 ? asked : 33000;
window.__clewSmokeInput = [{ wait: hold + 2000 }];
(async () => {
	await sleep(hold);
	const tabs = workspaceStore.allGroups().flatMap((g) => g.tabs).map((t) => t.path);
	log(`tabs=${JSON.stringify(tabs)} cli-note=${vaultStore.pathExists('Ideas/From the shell.md')} exported=${vaultStore.pathExists('Plain.html')}`);
})();
