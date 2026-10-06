// app-secrets-scenario.js's second half: the page the Forget reload brought.
// Forgetting the vault forgot what its apps kept secret here.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const keeper = (await ipc.invoke('clew:apps-list')).find((a) => a.id === 'keeper');
console.log(`smoke-secrets: after-forget keeper-secrets=${keeper ? keeper.secrets : 'unlisted'}`);
