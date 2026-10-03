// Admonition fences (```ad-*, engine/admonitions.js) resolve with the
// ENGINE's callout table — the instance CLEW_CALLOUTS customised — so a
// custom type's alias works in a fence as it does in `> [!rem]`.
// Fixture: smoke/make-custom-callout-vault.sh <dir> with CLEW_USER_DATA=
// <dir>-ud; FRAME_MATCH `Admonitions.md`, frame admonition-alias-frame.js,
// which logs `smoke-adm: <n> type=… title=… custom=… color=…`. Expected:
// `ad-rem` and `ad-remark` both type=remark (the alias resolved), custom=
// true, color #2e8b57, headed "Rem" (untitled: the type AS WRITTEN, as
// `> [!rem]` is) and "Titled"; `ad-hint` type=tip headed "Hint".
// A table that is NOT the engine's would know no `remark`: ad-rem would
// come out a note titled "Rem".
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const tab = workspaceStore.openNote('Admonitions.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(tab.id, 'reading');
await sleep(4000);
console.log('smoke-adm: opened');
