// The map's distance tool (preview-client/leaflet-maps.js#wireDistanceTool):
// shift-click two points to measure; a new shift-click starts over, taking
// the old line and readout away; Esc clears it (and claims the key). Fixture:
//
//   mkdir -p <dir> && printf '# Map\n\n```leaflet\nlat: 51.5074\nlong: -0.1278\nzoom: 13\nheight: 380\n```\n' > <dir>/Map.md
//
// Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/map-measure-frame.js
// CLEW_SMOKE_FRAME_MATCH=Map.md. Expect: `real lines=1 readouts=1` (two
// real shift-clicks measured); `measured lines=1 readouts=1`
// (two clicks show one line and its distance); `third lines=1 readouts=0`
// (a third click starts over: the old line and readout go, the new first
// point shows); `fourth lines=1 readouts=1`; `esc lines=0 readouts=0
// claimed=true`; `esc-idle claimed=false` (a second Esc is the note's).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const t = workspaceStore.openNote('Map.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(t.id, 'reading');
await sleep(5000);
// Two REAL shift-clicks first (CDP input; Leaflet's shift also arms its box
// zoom, which only real input exercises): the frame script reports what they
// left (`real …`) before its own steps. The map sits under the heading, in
// the text column; these points are inside it.
const frame = [...document.querySelectorAll('clew-preview-view')].find((v) => v.tabId === t.id)?.querySelector('iframe');
const fr = frame.getBoundingClientRect();
const at = (fx, dy) => ({ click: { x: Math.round(fr.left + fr.width * fx), y: Math.round(fr.top + dy) }, modifiers: 8 });
window.__clewSmokeInput = [at(0.42, 220), { wait: 300 }, at(0.58, 330), { wait: 600 }];
console.log('smoke-mm: opened');
