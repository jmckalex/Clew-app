// Live edit's Tier C frames (plan §7): engine-rendered blocks in small
// clew-preview:// documents, hoisted into a layer over their placeholders.
// Pair with live-blocks-frame.js and CLEW_SMOKE_FRAME_MATCH=__clew_block__;
// add CLEW_SMOKE_METRICS=<file> for the memory numbers (smoke/README.md).
//
// Fixture: `node smoke/make-live-vault.mjs <dir>` (Frames.md: mermaid, a
// ```query, ![[Child]], a refused @reveal, a PDF, then 20 more mermaid
// blocks below the fold). The run rewrites Child.md — regenerate each time.
//
// Expect: `frame-scheme=true`; `first-frames` ≥5 with `heights-match=true` (every visible frame
// sits exactly on its placeholder, height from its own size report, ±1);
// `max-frames<=16` over the whole run (the cap); click the mermaid's edge
// strip → `revealed hidden-frame=true source-visible=true`; wheel over the
// query frame → `scroll-chained=true`; ~1.5 screens down and back →
// `pinned-survived=true` (the PDF frame is the same element — a pinned kind
// is kept within three screens; further away it is evictable, measured by
// CodeMirror's height map);
// `child-rewritten`. Then, from inside every block frame, the frame script
// reports each one — the @reveal frame `refused-by-name=true`, the Child
// embed `has-UPDATED=true` (restaled after Child.md changed), mermaid SVGs.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-lb: ' + s);
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (test()) return true;
	return false;
};
let maxFrames = 0;
setInterval(() => { maxFrames = Math.max(maxFrames, document.querySelectorAll('.le-frames iframe').length); }, 100);

const tab = workspaceStore.openNote('Frames.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-frame-slot'));
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.length } });
view.scrollDOM.scrollTop = 0;
await until(() => document.querySelectorAll('.le-frame-slot.is-measured').length >= 5, 20000);
await sleep(1500);

const frames = () => [...document.querySelectorAll('.le-frames iframe')].filter((f) => f.style.visibility === 'visible');
const slotOf = (f) => document.querySelector(`.le-frame-slot[data-frame-id="${CSS.escape(f.dataset.frameId)}"] .le-frame-body`);
const matches = frames().map((f) => {
	const a = f.getBoundingClientRect();
	const b = slotOf(f)?.getBoundingClientRect();
	return b && Math.abs(a.top - b.top) <= 1 && Math.abs(a.height - b.height) <= 1 && a.height > 8;
});
log(`first-frames=${frames().length} measured=${document.querySelectorAll('.le-frame-slot.is-measured').length} heights-match=${matches.length > 0 && matches.every(Boolean)}`);
// A mismatch paints an opaque slab behind every frame (Chromium's rule).
log(`frame-scheme=${frames().every((f) => getComputedStyle(f).colorScheme === (document.body.dataset.theme ?? 'dark'))}`);
log(`kinds=${[...document.querySelectorAll('.le-frame-slot')].map((s) => s.dataset.kind).slice(0, 6).join(',')}`);

await ipc.invoke('clew:note-write', { path: 'Child.md', content: '# Child\n\nUPDATED child text.\n' });
log('child-rewritten');

const mermaidSlot = document.querySelector('.le-frame-slot[data-kind="mermaid"]');
const edge = mermaidSlot.querySelector('.le-frame-edge').getBoundingClientRect();
const mermaidId = mermaidSlot.dataset.frameId;
const queryFrame = () => [...document.querySelectorAll('.le-frames iframe')]
	.find((f) => document.querySelector(`.le-frame-slot[data-frame-id="${CSS.escape(f.dataset.frameId)}"]`)?.dataset.kind === 'query');
const pdfFrame = [...document.querySelectorAll('.le-frames iframe')]
	.find((f) => document.querySelector(`.le-frame-slot[data-frame-id="${CSS.escape(f.dataset.frameId)}"]`)?.dataset.kind === 'pdf');
const qr = queryFrame().getBoundingClientRect();
window.__clewSmokeInput = [
	{ click: { x: Math.round(edge.left + 40), y: Math.round(edge.top + edge.height / 2) } },
	{ wait: 1200 },                                   // t≈1.2 revealed
	{ combo: { key: 'ArrowDown', modifiers: 0 } },    // leave nothing to chance: move off? stays inside
	{ wait: 300 },
	{ wheel: { x: Math.round(qr.left + qr.width / 2), y: Math.round(qr.top + 20), deltaY: 300 } },
	{ wait: 1000 },                                   // t≈2.5
	// ~1.5 screens down and back: inside the three screens a pinned frame
	// is kept for (further than that it is evictable, by design).
	...Array.from({ length: 3 }, () => ({ wheel: { x: Math.round(qr.left + qr.width / 2), y: 500, deltaY: 550 } })),
	{ wait: 2500 },
	...Array.from({ length: 3 }, () => ({ wheel: { x: Math.round(qr.left + qr.width / 2), y: 500, deltaY: -550 } })),
	{ wait: 3000 },
];
setTimeout(() => {
	const frame = [...document.querySelectorAll('.le-frames iframe')].find((f) => f.dataset.frameId === mermaidId);
	const sourceVisible = view.contentDOM.textContent.includes('A[Start] --> B[End]');
	log(`revealed hidden-frame=${!frame || frame.style.visibility === 'hidden'} source-visible=${sourceVisible}`);
	window.__lbTop = view.scrollDOM.scrollTop;
}, 1000);
setTimeout(() => log(`scroll-chained=${view.scrollDOM.scrollTop > (window.__lbTop ?? 0)}`), 2300);
setTimeout(() => {
	log(`pinned-survived=${Boolean(pdfFrame && document.contains(pdfFrame))} max-frames=${maxFrames}`);
	// Back at the top after the round trip: every drawn frame must sit on
	// its placeholder at its content's height again.
	const again = frames().map((f) => {
		const a = f.getBoundingClientRect();
		const b = slotOf(f)?.getBoundingClientRect();
		return b && Math.abs(a.top - b.top) <= 1 && Math.abs(a.height - b.height) <= 1;
	});
	log(`after-roundtrip frames=${again.length} heights-match=${again.length > 0 && again.every(Boolean)}`);
}, 8500);
