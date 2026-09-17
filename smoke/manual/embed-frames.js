// Manual screenshot: the Links and Embeds guide in reading mode, scrolled
// (by embed-frames-frame.js) to "How much frame an embed draws" — the
// |quiet, |bare and |collapsed embeds on one screen
// (manual/images/embed-frames.png — links-and-embeds.html).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
workspaceStore.openNote('Guide/Links and Embeds.md', { defaultMode: 'reading' });
await sleep(7000);
