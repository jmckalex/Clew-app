// Every note in the vault rendered through the real preview, one line each:
// `smoke-rd: <path> <sha1>` of its HTML (session id masked). Run it before and
// after an ENGINE change and diff the lines — an additive extension must
// change no note it does not name (item 9, tabbing: "no existing note may
// change its output"). Over a scratch COPY of a vault (renders fill its
// .clew/cache):
//
//   rsync -a --exclude .clew demo-vault/ <dir>/
//
// A note that fails to render logs `smoke-rd: <path> ERROR <status>`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore } = window.__clew;
for (let i = 0; i < 300 && !vaultStore.vault?.sessionId; i++) await sleep(100);
await sleep(2000);   // the index
const sid = vaultStore.vault.sessionId;
const paths = [...vaultStore.notePaths()].sort();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
for (const path of paths) {
	const url = `clew-preview://vault/${sid}/${path.split('/').map(encodeURIComponent).join('/')}.html`;
	try {
		const res = await fetch(url);
		if (!res.ok) { console.log(`smoke-rd: ${path} ERROR ${res.status}`); continue; }
		const html = (await res.text()).split(sid).join('SID');
		console.log(`smoke-rd: ${path} ${hex(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(html)))}`);
	} catch (err) {
		console.log(`smoke-rd: ${path} ERROR ${err.message}`);
	}
}
console.log(`smoke-rd: done ${paths.length}`);
