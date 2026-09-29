// Tabbing laid out in the preview (preview-client/tabbing.js over
// engine/tabbing.js). The frame script checks WHERE pieces land against
// LaTeX's rules, as relations between measured pieces (1 px tolerance), so
// it does not restate the implementation. Fixture:
//
//   node smoke/make-tabbing-vault.mjs <dir>
//
// Tabbing.md in reading mode and, beside it, in live edit (its blocks are
// engine-only frames). Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/tabbing-frame.js
// CLEW_SMOKE_FRAME_MATCH=vault/. Expect, from the reading view:
//   `ruler laid=true tue=true lab=true overrun=true` — rows under a \kill
//   ruler line up with its text, and a first cell too wide for its column
//   still puts the next piece at the stop (TeX overprints);
//   `margin plus=true minus=true` — \+ starts later rows at stop 1, \- back;
//   `label ends-before-column=true text-at-column=true` — \' ends sep (0.5em)
//   before the column;
//   `right flush=true` — \` meets the right edge;
//   `push swapped=true restored=true`;
//   `latex columns=true bold=true italic=true math=true`;
// and from each live block frame: `frame … laid=true`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, actions } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const reading = workspaceStore.openNote('Tabbing.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(reading.id, 'reading');
await sleep(1500);
actions.splitActive('right');
const live = workspaceStore.openNote('Tabbing.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(live.id, 'live');
await sleep(7000);   // MathJax in the last block, and the live frames
console.log('smoke-tb: opened');
