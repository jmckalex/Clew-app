// Manual screenshot: a note embedding a .docx as a thumbnail (rendered by
// an offscreen LibreOffice, so the same minute-or-two boot). Pair with
// office-embed-frame.js, which waits for the thumbnail image. Vault: one
// with a `Projects/Reading Group.md` embedding `Reading Group.docx`.
// manual/images/office-embed.png — office-documents.html.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
workspaceStore.openNote('Projects/Reading Group.md', { defaultMode: 'reading' });
await sleep(6000);
