// The `clew` command against a running Clew (src/cli/clew.mjs →
// main/deep-link-host.js). Driven from a SHELL while this keeps the window
// up: launch with CLEW_CLI_SOCKET=<short path> (a smoke profile's path is
// too long for a socket name) over `node smoke/make-deep-link-vault.mjs
// <dir>`, run the commands, and this reports what the window shows after
// `CLEW_SMOKE_CLI_WAIT` ms (default 30000):
//   `cli: tabs=[…] cli-note=<bool> exported=<bool>`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore } = window.__clew;
const log = (s) => console.log('smoke-cli-page: ' + s);
window.__clewSmokeInput = [{ wait: 35000 }];
(async () => {
	await sleep(33000);
	const tabs = workspaceStore.allGroups().flatMap((g) => g.tabs).map((t) => t.path);
	log(`tabs=${JSON.stringify(tabs)} cli-note=${vaultStore.pathExists('Ideas/From the shell.md')} exported=${vaultStore.pathExists('Plain.html')}`);
})();
