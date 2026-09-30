// A note's OWN PDF frames go to Clew's viewer (main/pdf-frames-rewrite.js,
// docs/dev/pdf-unification.md §3). Fixture:
//
//   node smoke/make-pdf-vault.mjs <dir> && mkdir -p "<dir>/Notes/Week 1"
//   && cp <dir>/Paper.pdf "<dir>/Notes/Week 1/local.pdf" && printf 'plain\n' > "<dir>/Notes/Week 1/notes.txt"
//   && cp smoke/pdf-rewrite-note.md "<dir>/Notes/Week 1/Reading.md"
//
// Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/pdf-rewrite-frame.js
// CLEW_SMOKE_FRAME_MATCH=vault/. From the note: `viewers=4 raw-pdf=0
// sizes=true text-frame-untouched=true fallback-gone=true own-embed=true`;
// from the viewer opened at #page=3: `viewer … page=3`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const t = workspaceStore.openNote('Notes/Week 1/Reading.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(t.id, 'reading');
await sleep(9000);   // five viewers boot
console.log('smoke-pr: opened');
