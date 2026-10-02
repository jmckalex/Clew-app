// trust-export-scenario.js's second half (CLEW_SMOKE_SCRIPT_RELOADED): the
// same export from the window that trusting reloaded.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const MARKS = ['SCRIPT-RAN', 'LOADJS-RAN', 'EXT-RAN', 'DIR-RAN', 'ENV-RAN', 'POSTPROCESS-RAN', 'FUNCBLOCK-RAN', 'class="shout"', 'mathematica txt'];
await ipc.invoke('clew:export-note', { path: 'Code/Trust.md', format: 'html', outFile: 'out-trusted.html' });
const html = await ipc.invoke('clew:note-read', { path: 'out-trusted.html' });
const text = typeof html === 'string' ? html : (html?.text ?? html?.content ?? '');
const refused = new Set([...text.matchAll(/data-jmd-refused="([^"]*)"/g)].map((m) => m[1])).size;
console.log(`smoke-trust-export: trusted refused=${refused} marks=${MARKS.filter((m) => text.includes(m)).length} vault-config=${text.includes('vault-config-read')}`);
