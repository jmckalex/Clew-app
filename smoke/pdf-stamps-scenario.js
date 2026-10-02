// The stamp tool's default stamps, local (pdf-core.js; frame-bridge.md
// §4.9a): a note embedding a PDF in a vault this device has NOT trusted (a
// fresh CLEW_USER_DATA — the preview CSP closes the network), and the same
// PDF in a tab. Over `node smoke/make-pdf-vault.mjs <dir>` plus Embed.md
// (`![[Paper.pdf]]`). Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/pdf-stamps-frame.js
// CLEW_SMOKE_FRAME_MATCH=:// (every frame; those without a viewer stay silent) and
// CLEW_SMOKE_NET_LOG=1: expect a `smoke-stamps-frame:` line with stamps for
// each, no `smoke-net:` line and no `clew-csp:` line.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const state = await ipc.invoke('clew:vault-trust-get');
console.log(`smoke-stamps: trusted=${state.trusted}`);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
// The PDF in a tab of its own pane, then the note in the first pane beside
// it, so both viewers live at once.
const first = workspaceStore.activeGroupId;
workspaceStore.openFile('Paper.pdf', { newTab: true });
await sleep(500);
workspaceStore.splitWithTab(first, 'right', workspaceStore.activeTab().id);
await sleep(500);
workspaceStore.setActiveGroup(first);
const note = workspaceStore.openNote('Embed.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(note.id, 'reading');
await sleep(9000);
console.log('smoke-stamps: opened');
