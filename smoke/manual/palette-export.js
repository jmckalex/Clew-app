// Manual screenshot: the command palette filtered to the export commands,
// over the Export guide in reading mode. manual/images/palette-export.png
// — export.html.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, registry } = window.__clew;
workspaceStore.openNote('Guide/Export.md', { defaultMode: 'reading' });
await sleep(6000);
registry.runCommand('app:command-palette');
await sleep(400);
const input = document.querySelector('.modal-input');
input.value = 'export';
input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(500);
console.log('smoke-manual: results=' + document.querySelectorAll('.modal-result').length);
