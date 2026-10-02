// Apps in notes, end to end (docs/dev/frame-bridge.md §7–§9, R1–R3) over
// `node smoke/make-app-vault.mjs <dir>`, with a fresh CLEW_USER_DATA — a
// vault this device never decided about, i.e. RESTRICTED (R1: its apps
// still run, each after its own prompt). `app-mode.txt` in the vault:
//
//   battery   (+ CLEW_SMOKE_FRAME_SCRIPT=smoke/app-bridge-frame.js
//             CLEW_SMOKE_FRAME_MATCH=Probe — the app frame and the note):
//             the prompt names the vault untrusted; Allow (real input); the
//             probe's results (`smoke-app-frame: {…}`); a preview document
//             saying hello gets no port; Dup.md's twin ids refused by name.
//   lifecycle the app's key survives a move of its folder (no new prompt),
//             and a revoke asks again.
//   writes    (+ CLEW_SMOKE_FRAME_SCRIPT=smoke/app-bridge-frame.js
//             CLEW_SMOKE_FRAME_MATCH=clew-frame) the write side (phase 4):
//             the app's edits land in the open EDITOR (dirty, saved), a real
//             ⌘Z takes one back, a note is created and not overwritten,
//             another note is denied, Find opens with the app's query, the
//             clipboard both ways, and history keeps the old text.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const sid = vaultStore.vault.sessionId;
const mode = await ipc.invoke('clew:note-read', { path: 'app-mode.txt' }).then((r) => String(r?.content ?? r ?? '').trim()).catch(() => 'battery');
const docUrl = (p) => `clew-preview://vault/${sid}/${p.split('/').map(encodeURIComponent).join('/')}.html`;
const sheet = () => document.querySelector('.clew-app-sheet');
const centre = (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
const until = async (test, ms = 15000) => { for (let t = 0; t < ms; t += 200) { if (await test()) return true; await sleep(200); } return false; };
const keyIn = (html) => /data-app-key="([0-9a-f]+)"/.exec(html)?.[1] ?? null;
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const open = (p) => { const t = workspaceStore.openNote(p, { newTab: true, defaultMode: 'reading' }); workspaceStore.setTabMode(t.id, 'reading'); };

const state = await ipc.invoke('clew:vault-trust-get');
if (mode === 'headless') {
	// The note open for READING only: no editor holds it, so an app's write
	// goes through a headless pool entry that saves at once (§10), and the
	// editor-only orders answer `unavailable`.
	const tab = workspaceStore.openNote('Writer.md', { newTab: true, defaultMode: 'reading' });
	workspaceStore.setTabMode(tab.id, 'reading');
	await until(() => !!sheet());
	window.__clewSmokeInput = [{ click: centre(sheet().querySelector('.clew-trust-button')) }, { wait: 7000 }];
	(async () => {
		const disk = async () => String(((r) => r?.content ?? r)(await ipc.invoke('clew:note-read', { path: 'Writer.md' })));
		await until(async () => (await disk()).includes('APPENDED-BY-APP'), 8000);
		const history = await ipc.invoke('clew:history-list', { path: 'Writer.md' }).catch(() => null);
		console.log(`smoke-app: headless saved=${(await disk()).includes('APPENDED-BY-APP')} history=${Array.isArray(history) ? history.length : '?'} pool-entries=${window.__clew.editorPool.tabsFor('Writer.md').length}`);
	})();
	return;
}
if (mode === 'writes') {
	// The write side (phase 4): Writer.md in an EDITOR on the left — where an
	// app's edit must land, as a transaction — and in reading mode on the
	// right, where the app runs.
	const left = workspaceStore.openNote('Writer.md', { newTab: true, defaultMode: 'source' });
	workspaceStore.setTabMode(left.id, 'source');
	await sleep(800);
	const right = workspaceStore.splitWithClone(workspaceStore.activeGroupId, 'right', left.id);
	await sleep(500);
	const clone = workspaceStore.activeTab();
	workspaceStore.setTabMode(clone.id, 'reading');
	await until(() => !!sheet());
	console.log(`smoke-app: writes prompt=${!!sheet()}`);
	const { editorPool } = window.__clew;
	const doc = () => editorPool.get(left.id)?.view?.state.doc.toString() ?? '';
	// The editor's first line, clicked for real before ⌘Z (focus must be the
	// editor's, not Find's field that the app opened) — by selector, resolved
	// when its turn comes: the Find panel pushes the lines down meanwhile.
	window.__clewSmokeInput = [
		{ click: centre(sheet().querySelector('.clew-trust-button')) },
		{ wait: 7000 },
		{ click: { selector: '.cm-content .cm-line' } },
		{ combo: { key: 'z', modifiers: 4 } },
		{ wait: 6000 },
	];
	(async () => {
		await until(() => doc().includes('APPENDED-BY-APP'), 12000);
		const after = doc();
		await until(() => doc().includes('INSERTED-BY-APP') && !!document.querySelector('.cm-search'), 6000);
		console.log(`smoke-app: editor appended=${doc().includes('APPENDED-BY-APP')} inserted=${doc().includes('INSERTED-BY-APP')} dirty=${editorPool.isDirty(left.id)} search-panel=${!!document.querySelector('.cm-search')}`);
		await sleep(2200);
		const disk = await ipc.invoke('clew:note-read', { path: 'Writer.md' });
		const created = await ipc.invoke('clew:note-read', { path: 'Created By App.md' }).catch(() => null);
		console.log(`smoke-app: saved=${String(disk?.content ?? disk).includes('APPENDED-BY-APP')} created=${JSON.stringify(created?.content ?? created)}`);
		await until(() => !doc().includes('INSERTED-BY-APP'), 9000);
		console.log(`smoke-app: undo focus=${document.activeElement?.className ?? document.activeElement?.tagName} in-editor=${!!editorPool.get(left.id)?.view?.hasFocus}`);
		// One ⌘Z takes back the app's LAST edit (the insert), as the user's own.
		console.log(`smoke-app: undo inserted=${doc().includes('INSERTED-BY-APP')} appended=${doc().includes('APPENDED-BY-APP')}`);
		const history = await ipc.invoke('clew:history-list', { path: 'Writer.md' }).catch((e) => `ERR ${e.message}`);
		console.log(`smoke-app: history=${Array.isArray(history) ? history.length : JSON.stringify(history)}`);
	})();
	return;
}
open('Probe.md');
await until(() => !!sheet());
console.log(`smoke-app: trusted=${state.trusted} prompt=${!!sheet()} text="${sheet()?.querySelector('p')?.textContent ?? ''}"`);
const key1 = keyIn(await (await fetch(docUrl('Probe.md'))).text());
if (mode === 'battery') {
	const dup = await (await fetch(docUrl('Dup.md'))).text();
	console.log(`smoke-app: dup-refused=${/Two apps in this vault say they are &quot;twin&quot;: Twin\/A, Twin\/B/.test(dup)}`);
	window.__clewSmokeInput = [{ click: centre(sheet().querySelector('.clew-trust-button')) }, { wait: 9000 }];
	(async () => {
		await until(() => !sheet());
		const status = await ipc.invoke('clew:app-status', { key: key1 });
		console.log(`smoke-app: allowed mayRun=${status?.mayRun} granted=${status?.granted.join(',')} ask=${status?.ask.length}`);
	})();
} else {
	window.__clewSmokeInput = [{ click: centre(sheet().querySelector('.clew-trust-button')) }, { wait: 16000 }];
	(async () => {
		await until(() => !sheet());
		await sleep(2500);
		// Move the app's folder and point the note at it: the same id is the
		// same app (R3) — same key, no new prompt.
		await ipc.invoke('clew:fs-rename', { path: 'Apps/Probe', newPath: 'Apps/Moved Probe' }).catch((e) => console.log(`smoke-app: rename failed ${e.message}`));
		const text = (await ipc.invoke('clew:note-read', { path: 'Probe.md' }));
		await ipc.invoke('clew:note-write', { path: 'Probe.md', content: String(text?.content ?? text).replace('Apps/Probe', 'Apps/Moved Probe') });
		await sleep(3000);
		const key2 = keyIn(await (await fetch(docUrl('Probe.md'))).text());
		console.log(`smoke-app: moved same-key=${key1 === key2 && !!key1} prompt-after-move=${!!sheet()}`);
		await ipc.invoke('clew:app-revoke', { id: 'probe' });
		const back = await until(() => !!sheet(), 8000);
		console.log(`smoke-app: revoked prompt-again=${back}`);
		console.log('smoke-app: done');
	})();
}
