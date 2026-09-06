// An embed is a transclusion, so a changed note must restale everything that
// embeds it — including up a CHAIN (Grandparent embeds Parent embeds Child).
// Pair with embed-refresh-frame.js.
//
// Fixture (disposable):
//   mkdir -p V/Sub
//   printf '# Grandparent\n\n![[Parent]]\n' > V/Grandparent.md
//   printf '# Parent\n\n![[Child]]\n'       > V/Parent.md
//   printf '# Child\n\nORIGINAL child.\n'   > V/Sub/Child.md
//
// Expect has-ORIGINAL=false / has-UPDATED=true. Before the fix both were the
// other way round: the parent's cached HTML still held the old child prose.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, ipc } = window.__clew;
workspaceStore.openNote('Grandparent.md', { defaultMode: 'reading' });
await sleep(6000);
console.log('smoke-embed: frame=' + !!document.querySelector('clew-preview-view iframe'));
await ipc.invoke('clew:note-write', { path: 'Sub/Child.md', content: '# Child\n\nUPDATED child.\n' });
console.log('smoke-embed: child-written (two levels below the open note)');
await sleep(6000);
