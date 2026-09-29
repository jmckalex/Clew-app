// The pen convention (preview-client/pdf-pen.js, items 10+11): once a pen has
// been seen in a document, a FINGER pans a PDF viewer whose drawing tool is
// armed, and only the pen draws; a mouse is never affected. Checked in both
// kinds of viewer document — a PDF tab (pdf-page.html) and a note's embed —
// with synthetic pointer events of each pointerType (the module reads
// pointerType; real pen/touch hardware is not in the harness). Fixture:
//
//   node smoke/make-pdf-vault.mjs <dir> && printf '# Embed\n\n![[Paper.pdf]]\n' > <dir>/Embed.md
//
// Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/pdf-pen-frame.js
// CLEW_SMOKE_FRAME_MATCH=vault/. Expect, from each viewer document
// (`tab` and `embed`): `handles=1 armed=false`; `touch-before-pen
// intercepted=false`; `pen armed=true`; `touch-drawing intercepted=true
// panned=true`; `mouse-drawing intercepted=false`; `touch-no-tool
// intercepted=false`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, actions } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
workspaceStore.openFile('Paper.pdf', { newTab: true });
await sleep(1500);
actions.splitActive('right');
const t = workspaceStore.openNote('Embed.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(t.id, 'reading');
await sleep(8000);
console.log('smoke-pen: opened');
