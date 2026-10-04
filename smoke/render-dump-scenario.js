// Every note in the vault rendered through the real preview, one line each:
// `smoke-rd: <path> <sha1>` of its HTML (session id and app frame keys
// masked — both differ from run to run). Run it before and
// after an ENGINE change and diff the lines — an additive extension must
// change no note it does not name (item 9, tabbing: "no existing note may
// change its output"). Over a scratch COPY of a vault (renders fill its
// .clew/cache):
//
//   rsync -a --exclude .clew demo-vault/ <dir>/
//
// A note that fails to render logs `smoke-rd: <path> ERROR <status>`.
// Each note whose build WARNED (the LaTeX-export lint, renderer/
// build-warnings.js — what the status bar's "⚠ N" counts) also logs
// `smoke-rdw: <path> <n> <codes>`: a demo note is clean, or warns on purpose.
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
		// The session id, and an app embed's frame key — a hash of the vault
		// copy's device identity (R3), so it differs in every dump's folder.
		const html = (await res.text()).split(sid).join('SID')
			.replace(/(data-app-key="|clew-frame:\/\/)[0-9a-f]+/g, '$1KEY');
		console.log(`smoke-rd: ${path} ${hex(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(html)))}`);
	} catch (err) {
		console.log(`smoke-rd: ${path} ERROR ${err.message}`);
	}
}
console.log(`smoke-rd: done ${paths.length}`);
await sleep(1000);   // the last renders' EV_RENDER_DONE
const warned = window.__clew.buildWarnings?.buildWarnings;
for (const path of paths) {
	const list = warned?.get(path) ?? [];
	if (!list.length) continue;
	const codes = [...new Set(list.map((w) => /\[([\w-]+)\]/.exec(w)?.[1] ?? 'other'))].sort();
	console.log(`smoke-rdw: ${path} ${list.length} ${codes.join(',')}`);
}

