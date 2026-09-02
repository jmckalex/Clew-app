// Diagnostic: does the vault watcher report Clew's own atomic writes?
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { ipc } = window.__clew;
const events = [];
ipc.on('clew:ev-file-changed', ({ path }) => events.push('change:' + path));
ipc.on('clew:ev-tree-changed', () => events.push('tree'));
await sleep(500);
await ipc.invoke('clew:note-write', { path: 'Projects/Note 0001.md',
	content: '---\nstatus: active\npriority: 1\n---\n# Diag\n\nWatcher diagnostic write.\n' });
console.log('smoke-diag: written');
await sleep(4000);
console.log('smoke-diag: events=' + JSON.stringify(events));
