// The app page's postMessage bridges (renderer/pdf-save.js) from their
// legitimate senders, after they started refusing any sender not on the
// preview origin (shared/message-guard.js, 2026-09-29). Fixture:
//
//   node smoke/make-bridges-vault.mjs <dir>
//
// Run TWICE over the same vault with CLEW_SMOKE_FRAME_SCRIPT=smoke/
// bridges-frame.js CLEW_SMOKE_FRAME_MATCH=clewex (every Excalidraw page).
// Run 1 — the drawing in a tab: `smoke-bridges-frame tab: ready=true
// library=0 injected=1` (library-load and resolve-files answered), then
// `saved status=saved on-disk=true` (excalidraw-save written and answered)
// and `library-set items=1`. Run 2 (the scenario sees a stored library): the
// tab's `library=1` — the library the first run saved came back — and the
// drawing embedded in a note, two frames deep: `smoke-bridges-frame embed:
// ready=true injected=1` (resolve-files from a NESTED sender). A refused
// bridge shows as `ready=false` (the page waits 30 s on an unanswered ask)
// or `injected=0`. (The embed is left out of run 1: the tab's save
// re-renders the note embedding the drawing, which replaces that frame.)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, actions, ipc } = window.__clew;
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};
await until(() => vaultStore.vault?.sessionId);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const stored = await ipc.invoke('clew:excalidraw-lib-get').catch(() => []);
const second = Array.isArray(stored) && stored.length > 0;
workspaceStore.openFile('Draw.excalidraw.md', { newTab: true });
await sleep(1500);
if (second) {
	actions.splitActive('right');
	const embeds = workspaceStore.openNote('Embeds.md', { newTab: true, defaultMode: 'reading' });
	workspaceStore.setTabMode(embeds.id, 'reading');
}
await sleep(6000);
console.log(`smoke-bridges: run=${second ? 2 : 1} stored-library=${stored?.length ?? 0}`);
