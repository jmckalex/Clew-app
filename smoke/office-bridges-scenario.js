// The office bridges (renderer/pdf-save.js, renderer/office-dock.js) from
// their legitimate senders, after they started refusing any sender not on
// the preview origin — and the office pages refusing a reply from any window
// but the one they asked (shared/message-guard.js, 2026-09-29). Needs the
// office engine (dev serves zeta-assets/); boots LibreOffice twice, so run it
// in the background (minutes). Fixture:
//
//   node smoke/make-office-bridges-vault.mjs <dir>
//
// Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/office-bridges-frame.js
// CLEW_SMOKE_FRAME_MATCH=Thumb.md. Expect:
//   `tab ready=true dirty=true saved=true` — an edit in the office TAB saved
//   through office-save (answered to the page, which then told the dock);
//   `embed ready=true dirty=true` — a LIVE embed, two frames deep, reported
//   its edit through the dock's embed branch; `embed saved=true
//   dirty-after=false` — and saved through the same bridge from there;
//   from the frame script: `smoke-office-frame thumb=<w>x<h>` — the
//   thumbnail bridge answered a preview document.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, officeDock, ipc } = window.__clew;
const log = (s) => console.log('smoke-office: ' + s);
const until = async (test, ms) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(250)) if (await test()) return true;
	return false;
};
await until(() => vaultStore.vault?.sessionId, 15000);
const engine = await ipc.invoke('clew:office-engine-status').catch(() => null);
log(`engine installed=${Boolean(engine?.installed)}`);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });

// Every office page announces itself to window.top with `zeta-ready`.
const readyFrom = new Set();
const savedFrom = new Map();
const modified = [];   // every zeta-modified: { win, state, origin }
window.addEventListener('message', (e) => {
	if (e.data?.cmd === 'zeta-ready') readyFrom.add(e.source);
	if (e.data?.cmd === 'zeta-vault-saved') savedFrom.set(e.source, e.data.ok === true);
	if (e.data?.cmd === 'zeta-modified') modified.push({ win: e.source, state: e.data.state, origin: e.origin });
});

// ---- the tab ----------------------------------------------------------------
const tab = workspaceStore.openFile('Report.docx', { newTab: true });
const dockWin = () => document.querySelector('.office-dock .office-frame')?.contentWindow;
const tabReady = await until(() => dockWin() && readyFrom.has(dockWin()), 300000);
dockWin()?.postMessage({ cmd: 'zeta-test-edit' }, '*');
const tabDirty = await until(() => officeDock.isDirty(tab.id), 30000);
const tabSaved = tabDirty ? await officeDock.save() : false;
log(`tab ready=${tabReady} dirty=${tabDirty} saved=${tabSaved}`);
workspaceStore.closeTab(tab.id, { force: true });
await sleep(2000);

// ---- a live embed, two frames deep ------------------------------------------
const live = workspaceStore.openNote('Live.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(live.id, 'reading');
let embedWin = null;
const embedReady = await until(() => {
	embedWin = [...readyFrom].find((w) => w && w !== dockWin()) ?? null;
	return Boolean(embedWin);
}, 300000);
embedWin?.postMessage({ cmd: 'zeta-test-edit' }, '*');
const embedDirty = await until(() => officeDock.isDirty(live.id), 30000);
const fromEmbed = modified.filter((m) => m.win === embedWin);
log(`embed ready=${embedReady} dirty=${embedDirty} modified-msgs=${fromEmbed.length}`
	+ ` states=${JSON.stringify(fromEmbed.map((m) => m.state))} origins=${JSON.stringify([...new Set(fromEmbed.map((m) => m.origin))])}`);
embedWin?.postMessage({ cmd: 'zeta-save' }, '*');
const embedSaved = await until(() => savedFrom.get(embedWin) === true, 60000);
const clean = await until(() => !officeDock.isDirty(live.id), 15000);
log(`embed saved=${embedSaved} dirty-after=${!clean}`);

// ---- a thumbnail (the frame script waits for it) ------------------------------
const thumb = workspaceStore.openNote('Thumb.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(thumb.id, 'reading');
await sleep(3000);
