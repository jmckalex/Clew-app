// Manual screenshot: the demo vault's Welcome note in reading mode
// (manual/images/welcome.jpg — getting-started.html, introduction.html).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
workspaceStore.openNote('Welcome.md', { defaultMode: 'reading' });
await sleep(7000);
