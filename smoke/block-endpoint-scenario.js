// Live edit's block endpoints (protocol.js `__clew_block__`, render-service
// renderBlock) exercised from the APP page — the origin the frame layer will
// call from — plus one block document framed in the app, the way phase 5
// will frame them. Pair with block-endpoint-frame.js and
// CLEW_SMOKE_FRAME_MATCH=__clew_block__ (the harness then runs the frame
// script inside every block frame).
//
// Fixture (any disposable vault):
//
//   mkdir -p /tmp/block-vault && printf '%s\n' '# Child' '' 'ORIGINAL text.' \
//     > /tmp/block-vault/Child.md && printf '# Host\n' > /tmp/block-vault/Host.md
//
// Expect: `block-endpoint=200 json-hash=true`; `document=200 marked=true
// client=true token-in-html=false`; `missing=404`; `bad-json=400`;
// `escape=403` (a sourcePath outside the vault is refused); the caller token
// (docs/dev/frame-bridge.md §1): `no-token=403 wrong-token=403
// fragment-no-token=403 fragment-raw-text=400 fragment-token=200`; `dependent-rekeyed=true` — after Child.md
// is rewritten, POSTing the same `![[Child]]` text yields a NEW hash whose
// document says UPDATED (`fresh-has-UPDATED=true`), where a cache keyed on
// the text alone would serve ORIGINAL; `plain-stable=true` for text that
// reads no other file; `size=<px> (>0)` from the framed block's own report.
// The frame script (block-endpoint-frame.js) then reports from INSIDE the
// block: `overflow=hidden`, `body-margin=0px`, the mermaid SVG drawn, and
// `content=` EQUAL to the `size=` above — the block reports what it holds,
// not the height of the frame it was given (240px at first).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};
await until(() => vaultStore.vault?.sessionId);
const sid = vaultStore.vault.sessionId;
const base = `clew-preview://vault/${sid}/__clew_block__`;
// The token this window was handed (VAULT_CURRENT is its own-window path);
// the vault store itself never holds it.
const token = (await ipc.invoke('clew:vault-current'))?.callerToken;
const post = (body) => fetch(base, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify({ token, ...body }) });
const log = (s) => console.log('smoke-block: ' + s);
log(`token-handed=${typeof token === 'string' && token.length === 64} store-clean=${!('callerToken' in vaultStore.vault)}`);

const mermaid = '```mermaid\ngraph LR\n  A --> B\n```\n';
let res = await post({ text: mermaid, sourcePath: 'Host.md' });
const { hash } = await res.clone().json().catch(() => ({}));
log(`block-endpoint=${res.status} json-hash=${typeof hash === 'string' && hash.length > 0}`);

res = await fetch(`${base}/${hash}`);
const doc = await res.text();
log(`document=${res.status} marked=${/<html[^>]*data-clew-block="1"/.test(doc)} client=${doc.includes('/__clew_preview__/client.js')} token-in-html=${doc.includes(token)}`);
log(`missing=${(await fetch(`${base}/0000000000deadbeef00`)).status}`);
log(`bad-json=${(await post('not json')).status}`);
log(`escape=${(await post({ text: 'x', sourcePath: '../../etc/passwd' })).status}`);
// The caller token: nothing renders without it, on either endpoint.
const raw = (url, body) => fetch(url, { method: 'POST', body });
const frag = `clew-preview://vault/${sid}/__clew_fragment__`;
log(`no-token=${(await raw(base, JSON.stringify({ text: 'x', sourcePath: 'Host.md' }))).status}`
	+ ` wrong-token=${(await raw(base, JSON.stringify({ token: '0'.repeat(64), text: 'x' }))).status}`
	+ ` fragment-no-token=${(await raw(frag, JSON.stringify({ text: '# Card' }))).status}`
	+ ` fragment-raw-text=${(await raw(frag, '# Card')).status}`
	+ ` fragment-token=${(await raw(frag, JSON.stringify({ token, text: '# Card' }))).status}`);

// Dependent text: the key must move when the file it embeds does.
const embed = '![[Child]]\n';
const h1 = (await (await post({ text: embed, sourcePath: 'Host.md' })).json()).hash;
await ipc.invoke('clew:note-write', { path: 'Child.md', content: '# Child\n\nUPDATED text.\n' });
await sleep(1200); // the watcher's event reaches renderService.onFileChanged
const h2 = (await (await post({ text: embed, sourcePath: 'Host.md' })).json()).hash;
const fresh = await (await fetch(`${base}/${h2}`)).text();
log(`dependent-rekeyed=${h1 !== h2} fresh-has-UPDATED=${fresh.includes('UPDATED')}`);
const p1 = (await (await post({ text: 'Plain *text*.\n', sourcePath: 'Host.md' })).json()).hash;
const p2 = (await (await post({ text: 'Plain *text*.\n', sourcePath: 'Host.md' })).json()).hash;
log(`plain-stable=${p1 === p2}`);

// Frame the mermaid block in the app, as the frame layer will, and wait for
// its own size report.
let size = 0;
window.addEventListener('message', (e) => {
	if (e.data?.source !== 'clew-preview') return;
	if (e.data.type === 'size') size = e.data.height;
	// What every host does on `ready` (clew-preview-view.js): the theme is
	// also what starts mermaid in the frame.
	if (e.data.type === 'ready') e.source.postMessage({ source: 'clew-preview-host', type: 'theme', theme: 'dark' }, '*');
});
const frame = document.createElement('iframe');
frame.style.cssText = 'position:fixed;left:40px;bottom:40px;width:480px;height:240px;border:2px solid orange;z-index:9999;background:#222';
document.body.append(frame);
frame.src = `${base}/${hash}`;
await until(() => size > 0);
await sleep(1500); // mermaid draws after load; let the final size land
log(`size=${size}`);
frame.style.height = `${size}px`;
