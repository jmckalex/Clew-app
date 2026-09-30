// The interim vault-trust guard (main/vault-trust.js, renderer/trust-banner.js)
// over the fixture from `node smoke/make-trust-vault.mjs <dir>`.
//
// Run 1 — a vault this device has never seen (a fresh CLEW_USER_DATA):
//   `first trusted=false refused=<every construct, by name>` and the banner
//   up, the plain note refusing nothing, none of the constructs' marks in the
//   page; then the banner's own button clicked (real input) →
//   `after-trust trusted=true banner=false refused=0 marks=…` with every mark
//   present and Settings → This vault showing the box ticked; then a revoke →
//   `after-revoke … refused=<all again>`.
// Run 2 — the same vault KNOWN (CLEW_USER_DATA's clew-settings.json lists it
//   under recentVaults, and there is no vault-trust.json: the first-launch
//   migration) → `known trusted=true refused=0 banner=false` with every mark
//   present.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc, registry } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const sid = vaultStore.vault.sessionId;
const docUrl = (p) => `clew-preview://vault/${sid}/${p.split('/').map(encodeURIComponent).join('/')}.html`;
const fetchDoc = async (p) => (await fetch(docUrl(p))).text();
const refusedIn = (html) => [...new Set([...html.matchAll(/data-jmd-refused="([^"]*)"/g)].map((m) => m[1]))].sort();
const MARKS = ['SCRIPT-RAN', 'LOADJS-RAN', 'EXT-RAN', 'DIR-RAN', 'ENV-RAN', 'POSTPROCESS-RAN', 'FUNCBLOCK-RAN', 'class="shout"', 'mathematica txt'];
const marks = (html) => MARKS.filter((m) => html.includes(m));
const banner = () => document.querySelector('.clew-trust-banner');
const trustState = () => ipc.invoke('clew:vault-trust-get');
async function until(test, ms = 20000) {
	for (let t = 0; t < ms; t += 200) {
		if (await test()) return true;
		await sleep(200);
	}
	return false;
}

workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Code/Trust.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(tab.id, 'reading');

if ((await trustState()).trusted) {
	await sleep(4000);
	const html = await fetchDoc('Code/Trust.md');
	const state = await trustState();
	console.log(`smoke-trust: known trusted=${state.trusted} refused=${refusedIn(html).length} banner=${!!banner()} marks=${marks(html).length}/${MARKS.length}`);
} else {
	await until(() => !!banner());
	const html1 = await fetchDoc('Code/Trust.md');
	const plain = await fetchDoc('Plain.md');
	const state1 = await trustState();
	console.log(`smoke-trust: first trusted=${state1.trusted} refused=${refusedIn(html1).join('|')}`);
	console.log(`smoke-trust: first banner=${!!banner()} text="${banner()?.querySelector('.clew-trust-text')?.textContent}" marks=${marks(html1).length} plain-refused=${refusedIn(plain).length}`);

	// Trust, through the banner's own button — real input, which the harness
	// dispatches only once this script has returned: so the rest runs detached,
	// inside the wait queued after the click.
	const r = banner().querySelector('.clew-trust-button').getBoundingClientRect();
	window.__clewSmokeInput = [{ click: { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, { wait: 30000 }];
	(async () => {
		await until(async () => (await trustState()).trusted && !banner());
		await sleep(1500);
		const html2 = await fetchDoc('Code/Trust.md');
		const state2 = await trustState();
		console.log(`smoke-trust: after-trust trusted=${state2.trusted} banner=${!!banner()} refused=${refusedIn(html2).length} marks=${marks(html2).length}/${MARKS.length} missing=${MARKS.filter((m) => !html2.includes(m)).join('|')}`);

		// Settings → This vault says so.
		registry.runCommand('app:settings');
		await until(() => [...document.querySelectorAll('.settings-row')].some((row) => row.textContent.includes('Trusted on this device')));
		await sleep(500);
		const row = [...document.querySelectorAll('.settings-row')].find((el) => el.textContent.includes('Trusted on this device'));
		console.log(`smoke-trust: settings box=${row?.querySelector('input')?.checked}`);

		// Revoke: restricted again, the same constructs refused.
		await ipc.invoke('clew:vault-trust-set', { trusted: false });
		workspaceStore.openNote('Code/Trust.md', { newTab: true, defaultMode: 'reading' });
		await until(() => !!banner());
		const html3 = await fetchDoc('Code/Trust.md');
		const state3 = await trustState();
		console.log(`smoke-trust: after-revoke trusted=${state3.trusted} banner=${!!banner()} refused=${refusedIn(html3).join('|')} marks=${marks(html3).length}`);
		console.log('smoke-trust: done');
	})();
}
if (!window.__clewSmokeInput) console.log('smoke-trust: done');
