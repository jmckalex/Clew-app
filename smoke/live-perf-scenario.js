// What live edit costs per keystroke (plan §9): the synchronous time of a
// one-character insert transaction — state fields, both decoration
// layers, CodeMirror's DOM update — in SOURCE and in LIVE, on the demo
// vault's largest note and on a ~200 KB note. Baseline first: the same
// inserts in source mode, same note, same spot.
//
// Fixture: a scratch copy of the demo vault plus a big note —
//   rsync -a --exclude .clew demo-vault/ /tmp/perf-vault/ &&
//   node -e "const f=require('fs');const s=f.readFileSync('/tmp/perf-vault/Features/Diagrams.md','utf8');f.writeFileSync('/tmp/perf-vault/Big.md', s.repeat(17))"
//
// Reports `perf <note> <mode> median=<ms> p95=<ms>` per note and mode. The
// run types into its fixture (and undoes it); regenerate between runs.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool } = window.__clew;
const log = (s) => console.log('smoke-perf: ' + s);

async function measure(path, mode) {
	const tab = workspaceStore.openNote(path, { newTab: true, defaultMode: mode });
	workspaceStore.setTabMode(tab.id, mode);
	await sleep(2500);
	const view = editorPool.get(tab.id).view;
	const at = view.state.doc.line(Math.min(40, view.state.doc.lines)).to;
	view.dispatch({ selection: { anchor: at }, scrollIntoView: true });
	await sleep(1500);
	const times = [];
	for (let i = 0; i < 40; i += 1) {
		const pos = view.state.selection.main.head;
		const t0 = performance.now();
		view.dispatch({ changes: { from: pos, insert: 'x' }, selection: { anchor: pos + 1 }, userEvent: 'input.type' });
		times.push(performance.now() - t0);
		await sleep(20);
	}
	const start = view.state.selection.main.head - 40;
	view.dispatch({ changes: { from: start, to: start + 40 } });
	times.sort((a, b) => a - b);
	log(`${path} ${mode} chars=${view.state.doc.length} median=${times[20].toFixed(2)} p95=${times[37].toFixed(2)}`);
	workspaceStore.closeTab?.(tab.id);
	await sleep(300);
}

for (const path of ['Features/Diagrams.md', 'Big.md']) {
	await measure(path, 'source');
	await measure(path, 'live');
}
