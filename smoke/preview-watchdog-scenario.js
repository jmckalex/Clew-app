// The stuck-preview watchdog (clew-preview-view.js#watchReady, item 12) and
// the client's 'ready' on pageshow. Chromium never loses the 'ready'
// message (WebKit does, for a custom-scheme frame moved in the DOM), so the
// loss is SIMULATED: a capturing listener swallows 'ready' before the view
// hears it. Fixture — three notes:
//
//   mkdir -p <dir> && for n in A B C; do printf "# $n\n\nNote $n.\n" > <dir>/$n.md; done
//
// Three panes, one note each. Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/
// preview-watchdog-frame.js CLEW_SMOKE_FRAME_MATCH=vault/. Expect:
//   `A rebuilt=0` — a frame whose 'ready' arrives is never rebuilt;
//   `B rebuilt=1` — lost once: rebuilt ONCE after load, and the rebuilt
//   frame's 'ready' opens the bridge (the frame script's `B: theme=dark`);
//   `C rebuilt=1 swallowed=2` — lost every time: rebuilt once, then left
//   alone (`C: theme=none` — the bridge stays shut, which is honest);
//   `pageshow A readies=2` — a later pageshow re-announces (the frame script
//   dispatches one in A).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, actions } = window.__clew;
const log = (s) => console.log('smoke-wd: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });

const noteOf = (win) => {
	const frame = [...document.querySelectorAll('clew-preview-view iframe')].find((f) => f.contentWindow === win);
	return frame ? decodeURIComponent(frame.src).match(/\/([ABC])\.md\.html/)?.[1] ?? null : null;
};
// A watchdog rebuild REPLACES a frame still in the view (one mutation record
// removing an iframe and adding one); render() — which every split and tab
// switch runs — empties the view first. Counted only once armed (below).
let armed = false;
const rebuilt = { A: 0, B: 0, C: 0 };
new MutationObserver((records) => {
	if (!armed) return;
	for (const r of records) {
		const added = [...r.addedNodes].find((n) => n.tagName === 'IFRAME' && n.classList.contains('preview-frame'));
		const removed = [...r.removedNodes].some((n) => n.tagName === 'IFRAME');
		const k = added && decodeURIComponent(added.src).match(/\/([ABC])\.md\.html/)?.[1];
		if (k && removed) rebuilt[k] += 1;
	}
}).observe(document.body, { childList: true, subtree: true });

const readies = { A: 0, B: 0, C: 0 };
const swallowed = { A: 0, B: 0, C: 0 };
window.addEventListener('message', (e) => {
	if (!armed || e.data?.source !== 'clew-preview' || e.data.type !== 'ready') return;
	const k = noteOf(e.source);
	if (!k) return;
	readies[k] += 1;
	if (k === 'A' && readies.A > 1) log(`pageshow A readies=${readies.A}`);
	// B loses its FIRST 'ready'; C loses every one.
	if ((k === 'B' && swallowed.B === 0) || k === 'C') {
		swallowed[k] += 1;
		e.stopImmediatePropagation();
	}
}, true);

const open = (path) => {
	const tab = workspaceStore.openNote(path, { newTab: true, defaultMode: 'reading' });
	workspaceStore.setTabMode(tab.id, 'reading');
};
open('A.md');
actions.splitActive('right');
open('B.md');
actions.splitActive('right');
open('C.md');
await sleep(4000);   // the layout settles: every view connected, every frame ready
// Armed: a fresh frame in each view, as a render would build one.
armed = true;
const views = [...document.querySelectorAll('clew-preview-view')];
for (const v of views) v.render();
await sleep(9000);   // load + 1.5 s, the rebuild, its load, and C's second 1.5 s
log(`A rebuilt=${rebuilt.A} readies=${readies.A}`);
log(`B rebuilt=${rebuilt.B} swallowed=${swallowed.B} readies=${readies.B}`);
log(`C rebuilt=${rebuilt.C} swallowed=${swallowed.C}`);
