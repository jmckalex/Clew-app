// The Window menu lists every open vault (menu.js#windowItems, the owner's
// ask 2026-10-01). Fixture — three vaults, two of them with ONE folder name:
//
//   mkdir -p <dir>/Alpha <dir>/Teaching/Notes <dir>/Research/Notes
//   printf '# First\n' > <dir>/Alpha/First.md
//   printf '# Week 1\n' > <dir>/Teaching/Notes/Week\ 1.md
//   printf '# Draft\n' > <dir>/Research/Notes/Draft.md
//
// Run with CLEW_SMOKE_VAULT=<dir>/Alpha CLEW_SMOKE_MENU=1
// CLEW_SMOKE_MENU_CLICK='Window > Alpha'. This opens First.md in window 1,
// then the two Notes vaults as windows 2 and 3 (their workspaces start
// empty, so their rows carry no note). Expect the Window menu to end:
//
//   smoke-menu: Window > Alpha — First
//   smoke-menu: Window > Notes (Teaching)
//   smoke-menu: Window > Notes (Research) ✓      (nothing focused in a hidden
//                                                 run: the newest window)
//
// then `smoke-menu-click: Window > Alpha → Alpha — First`, main's
// `smoke-window-focus: Alpha`, and the same three rows as
// `smoke-menu-after:` with the ✓ on `Alpha — First`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.openNote('First.md', { newTab: true, defaultMode: 'reading' });
const root = vaultStore.vault.path;
const parent = root.replace(/\/[^/]+$/, '');
for (const other of ['Teaching/Notes', 'Research/Notes']) {
	await ipc.invoke('clew:vault-open-path', { path: `${parent}/${other}` });
	await sleep(1500);
}
await sleep(2500);
console.log(`smoke-wm: root=${root.split('/').pop()} opened=2`);
