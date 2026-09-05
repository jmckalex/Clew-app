// Reading mode → source mode carries the READING position (the fix for
// "⌘E from reading mode jumps back to the top of the note").
//
// Phase 1: scroll the preview like a reader would — posting `scroll-to-line`
// straight into the iframe, which is what a wheel gesture amounts to as far
// as the client is concerned, and which (unlike a host-driven scroll) leaves
// the view's suppressor idle. Then flip to source and read where the editor
// landed. Expect the reading line, NOT line 1.
//
// Phase 2: the round trip that must change nothing — cursor parked mid-line,
// out to reading mode and straight back with no scrolling. Expect the same
// line AND the same column.
//
// Vault: any containing a `Long.md` far taller than the window (the session
// that wrote this generated 365 lines / 60 `## Section N` headings).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, actions } = window.__clew;

/** The editor's own idea of its topmost visible line (clew-editor-view's). */
const topVisibleLine = (view) => {
	const rect = view.scrollDOM.getBoundingClientRect();
	const pos = view.posAtCoords({ x: rect.left + 8, y: rect.top + 4 }, false);
	return view.state.doc.lineAt(pos).number;
};
const cursorAt = (view) => {
	const head = view.state.selection.main.head;
	const line = view.state.doc.lineAt(head);
	return { line: line.number, col: head - line.from };
};

const tab = workspaceStore.openNote('Long.md');
await sleep(1500);
actions.jumpToLine(tab.id, 12);
await sleep(1200); // outlast the 1s view-state debounce
console.log('smoke-rs: start=' + JSON.stringify(cursorAt(editorPool.get(tab.id).view)));

// --- phase 1: the reader scrolls, then flips back -------------------------
actions.toggleReadingMode();
await sleep(6000); // engine render + preview boot
const iframe = document.querySelector('clew-preview-view iframe');
console.log('smoke-rs: preview-frame=' + !!iframe);
iframe.contentWindow.postMessage(
	{ source: 'clew-preview-host', type: 'scroll-to-line', line: 239, behavior: 'auto' }, '*');
await sleep(800);
console.log('smoke-rs: readingLine=' + workspaceStore.findTab(tab.id)?.tab.view.readingLine);

actions.toggleReadingMode();
await sleep(1500);
const view = editorPool.get(tab.id).view;
console.log('smoke-rs: landed=' + JSON.stringify(cursorAt(view))
	+ ' top=' + topVisibleLine(view)
	+ ' of ' + view.state.doc.lines + ' lines');

// --- phase 2: a round trip with no reader scroll must not move the cursor --
// Park mid-line, then fire the pointerup a click would have: the editor's
// view-state save hangs off keyup/pointerup/scroll, so a bare dispatch()
// records nothing and the phase would test a stale cursor instead.
const parkLine = view.state.doc.line(241);
view.dispatch({ selection: { anchor: parkLine.from + 7 }, scrollIntoView: true });
document.querySelector('clew-editor-view')
	.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
await sleep(1500); // let the 1s view-state debounce record it
console.log('smoke-rs: parked=' + JSON.stringify(cursorAt(view)));
actions.toggleReadingMode();
await sleep(6000);
actions.toggleReadingMode();
await sleep(1500);
const view2 = editorPool.get(tab.id).view;
console.log('smoke-rs: roundtrip=' + JSON.stringify(cursorAt(view2))
	+ ' top=' + topVisibleLine(view2));
