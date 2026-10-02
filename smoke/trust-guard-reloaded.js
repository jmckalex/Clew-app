// trust-guard-scenario.js's second half (CLEW_SMOKE_SCRIPT_RELOADED): the
// window the prompt's Trust reloaded. Every engine construct ran, nothing is
// refused, the prompt and the indicator are gone, Settings shows the box
// ticked, and the vault's own app-surface plugin loaded.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc, registry } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
await sleep(1500);
const sid = vaultStore.vault.sessionId;
const docUrl = (p) => `clew-preview://vault/${sid}/${p.split('/').map(encodeURIComponent).join('/')}.html`;
const html = await (await fetch(docUrl('Code/Trust.md'))).text();
const MARKS = ['SCRIPT-RAN', 'LOADJS-RAN', 'EXT-RAN', 'DIR-RAN', 'ENV-RAN', 'POSTPROCESS-RAN', 'FUNCBLOCK-RAN', 'class="shout"', 'mathematica txt'];
const refused = [...new Set([...html.matchAll(/data-jmd-refused="([^"]*)"/g)].map((m) => m[1]))];
const state = await ipc.invoke('clew:vault-trust-get');
const access = await ipc.invoke('clew:vault-access-get');
console.log(`smoke-trust: after-trust trusted=${state.trusted} decided=${state.decided} prompt=${!!document.querySelector('.clew-trust-sheet')} indicator=${!!document.querySelector('.clew-trust-indicator')} refused=${refused.length} marks=${MARKS.filter((m) => html.includes(m)).length}/${MARKS.length} app-plugin=${window.__vplugApp ?? '-'}`);
console.log(`smoke-trust: access scripts=${access.scripts} plugins=${access.plugins.join(',')} noteApi=${access.noteApi} dataviewJs=${access.dataviewJs} network=${access.network}`);
registry.runCommand('app:settings');
for (let i = 0; i < 50 && !document.querySelector('.settings-trust-switch:not(:disabled)'); i++) await sleep(200);
await sleep(500);
console.log(`smoke-trust: settings box=${document.querySelector('.settings-trust-switch')?.checked} trusted-vaults=${document.querySelectorAll('.settings-trusted-vaults .settings-row').length}`);
const tab = workspaceStore.openNote('Scripts.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(tab.id, 'reading');
await sleep(4000);
console.log('smoke-trust: done');
