// What a website export publishes (main/site-files.js; Clew-docs' finding
// 2026-10-03: the app fixture's site carried app data and clewdata.json).
// Fixture: `node smoke/make-site-privacy-vault.mjs <dir>`, opened restricted
// (a fresh CLEW_USER_DATA). The site is exported into the vault (`Site/`) so
// the scenario can read it back.
//
//   `site: pages=… clewdata=false app-data=false app-code=true
//    ordinary-data=true dotclew=false linked=false trust-files=false`
//   `markers: files-read=… leaked=[]` — no PRIVATE-… marker in any file
//   `app-page: static=true frame=false sentence=true`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-sp: ' + s);
for (let i = 0; i < 300 && !vaultStore.vault?.sessionId; i++) await sleep(100);
await sleep(1500);
const root = vaultStore.vault.path ?? vaultStore.vault.root;
const result = await ipc.invoke('clew:export-site', { outDir: `${root}/Site` }).catch((err) => ({ error: String(err.message ?? err) }));
log(`exported: notes=${result?.notes} files=${result?.files} failures=${result?.failures?.length ?? result?.error}`);
// The export refreshes the tree when it lands inside the vault.
const siteFiles = () => {
	const out = [];
	const walk = (entries) => {
		for (const e of entries ?? []) {
			if (e.type === 'folder') walk(e.children);
			else if (e.path.startsWith('Site/')) out.push(e.path);
		}
	};
	walk(vaultStore.tree);
	return out;
};
for (let i = 0; i < 100 && !siteFiles().length; i++) await sleep(100);
const files = siteFiles();
const has = (re) => files.some((f) => re.test(f));
log(`site: pages=${files.filter((f) => f.endsWith('.html')).length} clewdata=${has(/^Site\/clewdata\.json$/)} app-data=${has(/^Site\/Apps\/Probe\/data\//)} app-code=${has(/^Site\/Apps\/Probe\/app\.js$/)} ordinary-data=${has(/^Site\/Research\/data\/table\.csv$/)} dotclew=${has(/\/\.clew\//)} linked=${has(/^Site\/Linked\//)} trust-files=${has(/(app-grants|vault-trust)\.json$/)}`);
// Every text file of the site, searched for the fixture's private markers.
const leaked = [];
let read = 0;
for (const f of files.filter((p) => /\.(html|json|js|css|txt|csv|md)$/i.test(p) && !p.startsWith('Site/assets/'))) {
	const text = await ipc.invoke('clew:note-read', { path: f }).catch(() => '');
	read += 1;
	if (/PRIVATE-[A-Z-]+-MARKER/.test(text)) leaked.push(f);
}
log(`markers: files-read=${read} leaked=${JSON.stringify(leaked)}`);
const page = await ipc.invoke('clew:note-read', { path: 'Site/Probe.html' }).catch(() => '');
log(`app-page: static=${/<clew-app-embed[^>]*data-static="1"/.test(page)} frame=${/clew-frame:|<iframe[^>]*clew-app-frame/.test(page)} sentence=${/an app that runs inside Clew, not on a website/.test(page)}`);
