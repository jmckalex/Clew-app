// Vault already opts in (vault-settings.json) — the state after a restart.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { ipc, workspaceStore, registry } = window.__clew;
const listed = await ipc.invoke('clew:plugins-list');
console.log('smoke-gp: discovered=' + JSON.stringify(listed.plugins.map((p) => `${p.id}:${p.scope}`)));
console.log('smoke-gp: enabled=' + JSON.stringify(listed.enabled));
workspaceStore.openNote('Note.md', { defaultMode: 'reading' });
await sleep(5000);
console.log('smoke-gp: app-command=' + registry.allCommands().some((c) => c.id.includes('hello-global')));
