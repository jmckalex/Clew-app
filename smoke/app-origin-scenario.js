// The app page on its own origin (docs/dev/frame-bridge.md §2, phase 2):
// the assertions §2.13 asks for, from the page itself.
//   smoke-app: origin=clew-app://app secure=true clipboard=ok
//   smoke-app: render-post=200 block-get=200 preview-get=200 acao=clew-app://app
//   smoke-app: page=200 page-csp-frame-ancestors=true outside=404 vault-path=404
//   smoke-app-frame-refused: clew-app://app/index.html (a note's iframe)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
await sleep(1000);
let clip;
try { await navigator.clipboard.writeText('clew-app clipboard probe'); clip = 'ok'; } catch (err) { clip = `error ${err.name}`; }
console.log(`smoke-app: origin=${location.origin} secure=${window.isSecureContext} clipboard=${clip}`);
// The app page's own CORS-mode reads of the preview origin, as its code makes them.
const sid = vaultStore.vault.sessionId;
const token = (await ipc.invoke('clew:vault-current'))?.callerToken;
const post = await fetch(`clew-preview://vault/${sid}/__clew_block__`, { method: 'POST', body: JSON.stringify({ token, text: '# Probe\n\n$x^2$', sourcePath: null }) });
const { hash } = post.ok ? await post.json() : {};
const block = hash ? await fetch(`clew-preview://vault/${sid}/__clew_block__/${hash}`) : null;
const notes = vaultStore.notePaths();
const preview = notes.length ? await fetch(`clew-preview://vault/${sid}/${notes[0].split('/').map(encodeURIComponent).join('/')}.html`) : null;
console.log(`smoke-app: render-post=${post.status} block-get=${block?.status} preview-get=${preview?.status} acao-readable=${!!(await preview?.text())}`);
const page = await fetch('clew-app://app/index.html');
const outside = await fetch('clew-app://app/..%2F..%2Fmain%2Fmain.js');
const vaultPath = await fetch(`clew-app://app/${encodeURIComponent(notes[0] ?? 'x.md')}`);
console.log(`smoke-app: page=${page.status} page-csp-frame-ancestors=${/frame-ancestors 'none'/.test(page.headers.get('content-security-policy') ?? '')} outside=${outside.status} vault-path=${vaultPath.status}`);
// No frame may load the app page (§2.7): a note's own iframe pointed at it
// (Framer.md, written here) is refused by main — `smoke-app-frame-refused:`
// — before `frame-ancestors 'none'` would be consulted.
await ipc.invoke('clew:note-write', { path: 'Framer.md', content: '# Framer\n\n<iframe src="clew-app://app/index.html" width="200" height="100"></iframe>\n' });
await sleep(800);
const tab = window.__clew.workspaceStore.openNote('Framer.md', { newTab: true, defaultMode: 'reading' });
window.__clew.workspaceStore.setTabMode(tab.id, 'reading');
await sleep(4000);
console.log('smoke-app: framer opened');
