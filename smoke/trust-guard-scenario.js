// Vault trust (frame-bridge.md §4; main/vault-trust.js, renderer/trust-banner.js)
// over the fixture from `node smoke/make-trust-vault.mjs <dir>`. With
// CLEW_SMOKE_FRAME_SCRIPT=smoke/trust-frame.js CLEW_SMOKE_FRAME_MATCH=Scripts.md
// the preview side is read too (its `smoke-trust-frame:` line).
//
// A vault this device never decided about (a fresh CLEW_USER_DATA): the
// PROMPT, its counts, the engine's refusals; then the prompt answered by real
// input — `trust-mode.txt` in the vault says how: `keep` (Keep restricted:
// no reload, the status-bar indicator) or `trust` (the window reloads; run
// with CLEW_SMOKE_SCRIPT_RELOADED=smoke/trust-guard-reloaded.js).
// A vault the device already trusts (listed under recentVaults in that
// userData's clew-settings.json — the first-launch migration): no prompt,
// every mark. One it decided to restrict (vault-trust.json saying so): no
// prompt, the indicator.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const sid = vaultStore.vault.sessionId;
const docUrl = (p) => `clew-preview://vault/${sid}/${p.split('/').map(encodeURIComponent).join('/')}.html`;
const fetchDoc = async (p) => (await fetch(docUrl(p))).text();
const refusedIn = (html) => [...new Set([...html.matchAll(/data-jmd-refused="([^"]*)"/g)].map((m) => m[1]))].sort();
const MARKS = ['SCRIPT-RAN', 'LOADJS-RAN', 'EXT-RAN', 'DIR-RAN', 'ENV-RAN', 'POSTPROCESS-RAN', 'FUNCBLOCK-RAN', 'class="shout"', 'mathematica txt'];
const marks = (html) => MARKS.filter((m) => html.includes(m));
const sheet = () => document.querySelector('.clew-trust-sheet');
const indicator = () => document.querySelector('.clew-trust-indicator');
const trustState = () => ipc.invoke('clew:vault-trust-get');
async function until(test, ms = 20000) {
	for (let t = 0; t < ms; t += 200) {
		if (await test()) return true;
		await sleep(200);
	}
	return false;
}
const centre = (el) => {
	const r = el.getBoundingClientRect();
	return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};

workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const mode = await ipc.invoke('clew:note-read', { path: 'trust-mode.txt' }).then((r) => String(r?.content ?? r ?? '').trim()).catch(() => '');
const state0 = await trustState();
const open = (p) => {
	const tab = workspaceStore.openNote(p, { newTab: true, defaultMode: 'reading' });
	workspaceStore.setTabMode(tab.id, 'reading');
};

if (state0.trusted) {
	open('Scripts.md');
	await sleep(4000);
	const html = await fetchDoc('Code/Trust.md');
	console.log(`smoke-trust: known trusted=true prompt=${!!sheet()} indicator=${!!indicator()} refused=${refusedIn(html).length} marks=${marks(html).length}/${MARKS.length} app-plugin=${window.__vplugApp ?? '-'}`);
	console.log('smoke-trust: done');
} else if (state0.decided) {
	open('Scripts.md');
	await until(() => !!indicator());
	await sleep(2000);
	const html = await fetchDoc('Code/Trust.md');
	console.log(`smoke-trust: decided-restricted prompt=${!!sheet()} indicator="${indicator()?.textContent ?? ''}" refused=${refusedIn(html).length} marks=${marks(html).length} app-plugin=${window.__vplugApp ?? '-'}`);
	console.log('smoke-trust: done');
} else {
	await until(() => !!sheet());
	const html1 = await fetchDoc('Code/Trust.md');
	const plain = await fetchDoc('Plain.md');
	console.log(`smoke-trust: first trusted=${state0.trusted} decided=${state0.decided} prompt=${!!sheet()} refused=${refusedIn(html1).join('|')} marks=${marks(html1).length} plain-refused=${refusedIn(plain).length}`);
	console.log(`smoke-trust: prompt lead="${sheet()?.querySelector('p')?.textContent}" details=${sheet()?.querySelectorAll('.clew-trust-details li').length} network-box=${!!sheet()?.querySelector('.clew-trust-network input')} buttons="${[...(sheet()?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim()).join('|')}" app-plugin=${window.__vplugApp ?? '-'}`);
	if (mode === 'trust') {
		// Real input, dispatched once this script returns; the click reloads
		// the window, and trust-guard-reloaded.js takes over.
		window.__clewSmokeInput = [{ click: centre(sheet().querySelector('.clew-trust-button')) }, { wait: 8000 }];
		console.log('smoke-trust: answering Trust');
	} else {
		window.__clewSmokeInput = [{ click: centre(sheet().querySelector('.clew-trust-keep')) }, { wait: 12000 }];
		(async () => {
			await until(() => !sheet());
			open('Scripts.md');
			await until(() => !!indicator());
			await sleep(4000);
			const state = await trustState();
			console.log(`smoke-trust: kept trusted=${state.trusted} decided=${state.decided} prompt=${!!sheet()} indicator="${indicator()?.textContent ?? ''}" title="${indicator()?.title ?? ''}"`);
			console.log('smoke-trust: done');
		})();
	}
}
