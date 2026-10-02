// Links out of a vault (engine/vault-bounds.js): over
// `node smoke/make-symlink-vault.mjs <dir>`, opened RESTRICTED (a fresh
// CLEW_USER_DATA) — nothing outside is listed, served, searched, indexed or
// embedded, and the note says so in place — and TRUSTED (the vault under
// recentVaults) — everything followed, as the owner's vaults need.
//   smoke-symlink: trusted=<bool> tree-out=<bool> tree-leak=<bool>
//     get-file=<status> get-folder=<status> get-image=<status>
//     search=<hits> index-out=<bool> embed-secret=<bool> embed-refused=<n>
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
await sleep(1500);
const sid = vaultStore.vault.sessionId;
const state = await ipc.invoke('clew:vault-trust-get');
const names = JSON.stringify(vaultStore.tree ?? []);
const status = async (p) => { try { return (await fetch(`clew-preview://vault/${sid}/${p}`)).status; } catch (e) { return `ERR ${e.message}`; } };
const note = await (await fetch(`clew-preview://vault/${sid}/Note.md.html`)).text();
const hits = await ipc.invoke('clew:search', { query: 'OUTSIDE-SECRET' }).catch(() => []);
console.log(`smoke-symlink: trusted=${state.trusted} tree-out=${names.includes('"Out"')} tree-leak=${names.includes('leak.md')} get-file=${await status('leak.md')} get-folder=${await status('Out/secret.md')} get-image=${await status('Out/pic.png')} search=${hits.length} index-out=${vaultStore.notePaths().some((p) => p.startsWith('Out/') || p === 'leak.md')} embed-secret=${note.includes('OUTSIDE-SECRET')} embed-refused=${(note.match(/leaves the vault/g) ?? []).length}`);
