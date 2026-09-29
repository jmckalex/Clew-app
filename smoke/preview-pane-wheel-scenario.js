// A wheel over the live preview pane (owner's decision 2026-09-29): the pane
// scrolls its own overflow first, as the browser does, and hands the rest to
// the NOTE — before, a wheel over the pane reached nothing and the note stood
// still. Real wheel input. Fixture — a tall diagram, then enough text to scroll:
//
//   mkdir -p <dir> && node -e "const fs=require('fs');
//     const nodes=Array.from({length:14},(_,i)=>'  N'+i+' --> N'+(i+1)).join('\n');
//     fs.writeFileSync('<dir>/Tall.md', '# Tall\n\nAbove.\n\n\`\`\`mermaid\ngraph TD\n'+nodes+'\n\`\`\`\n\n'
//       + Array.from({length:150},(_,i)=>'Line '+(i+1)+'.').join('\n\n')+'\n')"
//
// With the cursor in the fence (source mode) the pane shows the diagram,
// taller than the pane, so its body scrolls. Three gestures over the pane:
//   A — three ticks: `own pane-scrolled=true note-still=true`
//   B — the same gesture on past the pane's bottom: `latched pane-at-end=true
//       note-still=true` (a gesture that began on the pane stays there)
//   C — a new gesture after a pause: `chained note-scrolled=true`
// Every tick is recorded as it lands, so the verdicts do not ride on a clock.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const { workspaceStore, editorPool } = window.__clew;
const log = (s) => console.log('smoke-ppw: ' + s);
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (test()) return true;
	return false;
};
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Tall.md', { newTab: true, defaultMode: 'source' });
workspaceStore.setTabMode(tab.id, 'source');
await until(() => editorPool.get(tab.id)?.view);
const view = editorPool.get(tab.id).view;
await frames();
const at = view.state.doc.toString().indexOf('N3 --> N4');
view.focus();
view.dispatch({ selection: { anchor: at + 2 } });
const pane = document.querySelector('clew-preview-pane');
const body = () => pane?.querySelector('.preview-pane-body');
const ready = await until(() => pane && !pane.hidden && body() && body().scrollHeight > body().clientHeight + 40, 20000);
log(`pane visible=${ready} kind=${pane?.dataset.kind} overflow=${ready ? body().scrollHeight - body().clientHeight : 0}`);
if (!ready) throw new Error('the pane never showed an overflowing diagram');
await sleep(300);
const noteTop0 = view.scrollDOM.scrollTop;
const r = body().getBoundingClientRect();
const point = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
const rec = [];
window.addEventListener('wheel', (e) => {
	requestAnimationFrame(() => rec.push({ dy: e.deltaY, pane: body().scrollTop, note: view.scrollDOM.scrollTop,
		atEnd: body().scrollTop + body().clientHeight >= body().scrollHeight - 1 }));
}, { capture: true, passive: true });
const tick = (dy) => ({ wheel: { ...point, deltaY: dy } });
window.__clewSmokeInput = [
	...Array.from({ length: 3 }, () => tick(100)),    // A
	...Array.from({ length: 12 }, () => tick(101)),   // B: same gesture, on past the end
	{ wait: 600 },                                     // the gesture ends
	...Array.from({ length: 3 }, () => tick(102)),    // C
	{ wait: 800 },
];
(async () => {
	await until(() => rec.filter((x) => x.dy === 102).length === 3, 20000);
	await frames();
	const last = (dy) => rec.filter((x) => x.dy === dy).at(-1);
	const a = last(100);
	const b = last(101);
	const c = last(102);
	log(`own pane-scrolled=${a.pane > 0} note-still=${a.note === noteTop0}`);
	log(`latched pane-at-end=${b.atEnd} note-still=${b.note === noteTop0}`);
	log(`chained note-scrolled=${c.note > noteTop0} pane-shown=${!pane.hidden}`);
})();
