// Manual screenshot: study-vault's Pipeline board in reading mode, sidebars
// closed (manual/images/kanban-board.png — tasks-and-kanban.html). Run over a
// scratch copy of study-vault with its .clew/workspace.json deleted. Since
// a65395c the board widens to the pane, so all four columns are in the shot.
// (Written by the Clew-docs session for the retaken image; kept here so the
// shot can be reproduced.)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
workspaceStore.openNote('Papers/Pipeline.md', { defaultMode: 'reading' });
await sleep(7000);
