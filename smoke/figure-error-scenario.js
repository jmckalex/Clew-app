// A figure with a typo can always be fixed (the owner's report, 2026-10-03:
// moving the caret into a broken ```tikz fence opened the live preview pane
// OVER the fence, the whole TeX log in it, covering the lines to edit).
// Over `node smoke/make-figure-error-vault.mjs <dir> <source|live> <kind>
// <arrows|click>`, the figure scrolled to the lower part of the window, REAL
// input:
//   arrows — ArrowDown from the line before the figure into the typo's line;
//   click  — the caret already in the figure, a click on the typo, then
//            Shift+→ over it and the fix typed, then Esc.
// Polled throughout: how many px of the figure's own lines the pane covered
// (`covered-max`), whether the pane takes pointer events, and the error the
// pane reports with the line it maps to (`error-line`: the 1-based line in
// the note, where the typo is: `typo-line`). Logs:
//   `fe: <mode>/<kind>/<input> covered-max=<px> pane-pointer=<v> pane=<shown|hidden> side=<s>`
//   `fe: error message=<first line> error-line=<n> typo-line=<n> marked=<bool>`
//   (click) `fe: click caret-at-typo=<bool>` then `fe: fixed doc=<bool> error-after=<…> rerendered=<bool> mark-after=<bool>`
//   (arrows) `fe: show-log opened=true lines=<n> pane=shown caret-kept=true editor-focus=true`
//   `fe: escape pane=<hidden|shown>`
//   (arrows) `fe: left caret-line=<n> mark=false` (the caret out of the figure)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, settingsStore, ipc, previewPane } = window.__clew;
const log = (s) => console.log('smoke-fe: ' + s);
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};
const kase = JSON.parse(await ipc.invoke('clew:note-read', { path: 'case.json' }));
settingsStore.set('theme', 'dark');
const tab = workspaceStore.openNote('Note.md', { defaultMode: kase.mode });
workspaceStore.setTabMode(tab.id, kase.mode);
await until(() => editorPool.get(tab.id)?.view);
await sleep(kase.mode === 'live' ? 4000 : 1200);
const view = () => editorPool.get(tab.id).view;
const text = () => view().state.doc.toString();
const fenceFrom = () => text().indexOf('```' + kase.kind);
const fenceTo = () => text().indexOf('```', fenceFrom() + 3) + 3;
const typoAt = () => text().indexOf(kase.typo, fenceFrom());
const typoLine = () => view().state.doc.lineAt(Math.max(0, typoAt())).number;
const pane = () => document.querySelector('clew-preview-pane');
const before = text().indexOf('The line before the figure.');
// The figure in the lower part of the window, as the owner had it.
view().focus();
view().dispatch({ selection: { anchor: before + 'The line before the figure.'.length } });
await sleep(300);
{
	const top = view().lineBlockAt(before).top;
	const sd = view().scrollDOM;
	sd.scrollTop = Math.max(0, view().documentTop - sd.getBoundingClientRect().top + sd.scrollTop + top - sd.clientHeight * (kase.at ?? 0.62));
}
await sleep(800);
const fenceBox = () => {
	const a = view().coordsAtPos(fenceFrom(), 1);
	const b = view().coordsAtPos(Math.min(fenceTo(), view().state.doc.length), -1);
	const c = view().contentDOM.getBoundingClientRect();
	return a && b ? { top: a.top, bottom: b.bottom, left: c.left, right: c.right } : null;
};
const covered = () => {
	const p = pane();
	if (!p || p.hidden || getComputedStyle(p).visibility === 'hidden') return 0;
	const r = p.getBoundingClientRect();
	const f = fenceBox();
	if (!f || r.right <= f.left || r.left >= f.right) return 0;
	return Math.max(0, Math.min(r.bottom, f.bottom) - Math.max(r.top, f.top));
};
let coveredMax = 0;
let pointer = null;
const poll = setInterval(() => {
	coveredMax = Math.max(coveredMax, covered());
	const p = pane();
	if (p && !p.hidden) pointer = getComputedStyle(p).pointerEvents;
}, 50);
const describe = () => previewPane?.().describe?.() ?? pane()?.describe?.() ?? {};
const errorReport = () => {
	const d = describe();
	const mark = view().dom.querySelector('.cm-figure-error');
	const markLine = mark ? view().state.doc.lineAt(view().posAtDOM(mark)).number : null;
	log(`error message=${JSON.stringify(d.figureError?.message ?? null)} error-line=${d.figureError?.noteLine ?? null} typo-line=${typoLine()} marked=${markLine === typoLine()}${mark ? '' : ' (no mark)'}`);
};
const summary = () => {
	const d = describe();
	log(`${kase.mode}/${kase.kind}/${kase.input} covered-max=${Math.round(coveredMax)} pane-pointer=${pointer} pane=${pane()?.hidden === false ? 'shown' : 'hidden'} side=${d.side}`);
};

if (kase.input === 'arrows') {
	// Exactly as many presses as there are lines to the typo's.
	const presses = typoLine() - view().state.doc.lineAt(view().state.selection.main.head).number;
	const steps = [];
	for (let i = 0; i < presses; i++) steps.push({ combo: { key: 'ArrowDown' } }, { wait: 350 });
	// `esc: false` (make-figure-error-vault's `noesc`) leaves the pane up
	// for the screenshot.
	// Then a REAL click on the pane's own "Show log" (the frame's could not
	// be clicked: the owner's report), Escape, and the caret out of the
	// figure — whose line mark must go with it (it stayed: the owner's
	// report).
	const leave = [];
	for (let i = 0; i < 4; i++) leave.push({ combo: { key: 'ArrowDown' } }, { wait: 150 });
	window.__clewSmokeInput = [...steps, { wait: 9000 },
		{ click: { selector: 'clew-preview-pane .preview-pane-log-toggle' } }, { wait: 1500 },
		...(kase.esc === false ? [] : [{ combo: { key: 'Escape' } }, { wait: 800 }, ...leave, { wait: 1200 }])];
	(async () => {
		await until(() => view().state.doc.lineAt(view().state.selection.main.head).number >= typoLine(), 5000);
		await until(() => describe().figureError || describe().renders > 0, 9000);
		await sleep(1200);
		log(`arrows caret-line=${view().state.doc.lineAt(view().state.selection.main.head).number} typo-line=${typoLine()}`);
		summary();
		errorReport();
		const headBefore = view().state.selection.main.head;
		await until(() => pane()?.logText && !pane().logText.hidden, 9000);
		await sleep(300);
		log(`show-log opened=${pane()?.logText?.hidden === false} lines=${(pane()?.logText?.textContent ?? '').split('\n').length} pane=${pane()?.hidden === false ? 'shown' : 'hidden'} caret-kept=${view().state.selection.main.head === headBefore} editor-focus=${view().hasFocus}`);
		if (kase.esc === false) { clearInterval(poll); return; }
		await until(() => pane()?.hidden !== false, 15000);
		log(`escape pane=${pane()?.hidden === false ? 'shown' : 'hidden'}`);
		await until(() => view().state.doc.lineAt(view().state.selection.main.head).number > typoLine() + 2, 6000);
		await sleep(600);
		log(`left caret-line=${view().state.doc.lineAt(view().state.selection.main.head).number} mark=${Boolean(view().dom.querySelector('.cm-figure-error'))}`);
		clearInterval(poll);
	})();
} else {
	// The caret into the figure first (the pane up, as after arrows), then a
	// REAL click on the typo, the typo selected by Shift+→, the fix typed.
	view().dispatch({ selection: { anchor: fenceFrom() + 3 } });
	await until(() => describe().figureError || describe().renders > 0, 12000);
	await sleep(1500);
	const at = view().coordsAtPos(typoAt(), 1);
	const select = Array.from({ length: kase.typo.length }, () => ({ combo: { key: 'ArrowRight', modifiers: 8 } }));
	window.__clewSmokeInput = [
		{ click: { x: Math.round(at.left + 1), y: Math.round((at.top + at.bottom) / 2) } }, { wait: 600 },
		...select, { wait: 200 }, { text: kase.fix }, { wait: 9000 },
		{ combo: { key: 'Escape' } }, { wait: 800 },
	];
	(async () => {
		const rendersBefore = describe().renders ?? 0;
		errorReport();
		await sleep(500);
		const head = view().state.selection.main.head;
		log(`click caret-at-typo=${Math.abs(head - typoAt()) <= 1} head=${head} typo=${typoAt()}`);
		await until(() => text().includes(kase.fix) && !text().includes(kase.typo), 4000);
		await until(() => (describe().renders ?? 0) > rendersBefore && !describe().figureError, 9000);
		await sleep(500);
		// The line mark goes with the error (the owner's report: it stayed).
		await sleep(1500);
		log(`fixed doc=${!text().includes(kase.typo)} error-after=${JSON.stringify(describe().figureError?.message ?? null)} rerendered=${(describe().renders ?? 0) > rendersBefore} mark-after=${Boolean(view().dom.querySelector('.cm-figure-error'))}`);
		summary();
		await until(() => pane()?.hidden !== false, 15000);
		log(`escape pane=${pane()?.hidden === false ? 'shown' : 'hidden'}`);
		clearInterval(poll);
	})();
}
