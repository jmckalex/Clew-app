// A vault PDF a frame NAVIGATES to goes to EmbedPDF's viewer page, not
// Chromium's (protocol.js, docs/dev/pdf-unification.md §6 "As built"). A
// deliberate leak: a note whose own script adds an <iframe> (at #page=3), an
// <embed> and an <object> pointing at Paper.pdf AFTER render, so no
// serve-time rewrite can see them (data-clew-keep, or the next morph
// discards them before their navigations get anywhere). Fixture:
//
//   node smoke/make-pdf-vault.mjs <dir> && cp smoke/pdf-leak-note.md <dir>/Leak.md
//
// Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/pdf-leak-frame.js
// CLEW_SMOKE_FRAME_MATCH=clewpdf/pdf-page. Main logs one `smoke-pdf-leak:
// clew-preview://vault/<sid>/Paper.pdf` per element that navigated; each
// viewer frame logs `smoke-leak-frame: loaded=true page=N` (3 for the
// iframe). Every OTHER scenario must log no `smoke-pdf-leak` at all
// (smoke/pdf-baseline.sh prints any it finds).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Leak.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(tab.id, 'reading');
await sleep(9000);
console.log('smoke-leak: opened');
