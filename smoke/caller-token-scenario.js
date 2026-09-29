// The caller token end to end (docs/dev/frame-bridge.md §1): every way a
// canvas card reaches the fragment endpoint still renders through the ENGINE
// — the card is a callout, which the instant card renderer cannot draw, so a
// card that fell back shows `[!note]` as text. Fixture:
//
//   node smoke/make-token-vault.mjs <dir>
//
// Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/caller-token-frame.js
// CLEW_SMOKE_FRAME_MATCH=vault/ (every preview frame). Expect:
//   `smoke-token: handed=true store-clean=true` — the window holds its token,
//   the vault store does not;
//   `canvas-tab engine-cards=1` and `portal engine-cards=1` — the app
//   page's own POSTs (canvas/node-content.js, canvas/portal.js);
//   `pdf=written` — the reading-view PDF export of Host.md, a TOP-level
//   document handed the token by main (check its text afterwards:
//   `pdftotext <dir>/host.pdf - | grep -c '\[!note\]'` is 0 and
//   `Engine card` is there);
//   from the frame script, for the reading view (`Host.md.html`) and the live
//   block frame (`__clew_block__/…`): `engine-cards=1 fallback-cards=0`; the
//   nested note card (`Inner.md.html?cdepth=1`) `scene=false` (no canvas at
//   depth 1, so nothing there asks).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc, actions } = window.__clew;
const log = (s) => console.log('smoke-token: ' + s);
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};
await until(() => vaultStore.vault?.sessionId);
const own = await ipc.invoke('clew:vault-current');
log(`handed=${typeof own?.callerToken === 'string' && own.callerToken.length === 64} store-clean=${!('callerToken' in vaultStore.vault)}`);

workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const reading = workspaceStore.openNote('Host.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(reading.id, 'reading');
await sleep(1500);
actions.splitActive('right');
const live = workspaceStore.openNote('Live.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(live.id, 'live');
await until(() => document.querySelector('.le-frames iframe'), 15000);

// The app page's own POSTs: a canvas in a tab, and the same canvas as a
// portal in another one. (Checked before the PDF export, whose hidden
// window would otherwise share the wait.)
const engineCards = (scope) => [...document.querySelectorAll(`${scope} .is-engine`)]
	.filter((el) => el.querySelector('.callout-title')).length;
workspaceStore.openCanvas('Board.canvas', { newTab: true });
await until(() => engineCards('clew-canvas-view') > 0, 15000);
log(`canvas-tab engine-cards=${engineCards('clew-canvas-view')}`);
workspaceStore.openCanvas('Wall.canvas', { newTab: true });
await until(() => engineCards('.canvas-portal') > 0, 15000);
log(`portal engine-cards=${engineCards('.canvas-portal')}`);
// Back to the live note in this pane (the reading view kept the other), so
// both are on screen for the frame script.
const again = workspaceStore.openNote('Live.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(again.id, 'live');
await until(() => document.querySelector('.le-frames iframe'), 15000);

const pdf = await ipc.invoke('clew:export-note', { path: 'Host.md', format: 'print-pdf', outFile: 'host.pdf' })
	.catch((err) => ({ error: err.message }));
log(`pdf=${pdf?.output ? 'written' : `failed ${pdf?.error ?? JSON.stringify(pdf)}`}`);
await sleep(4000);
