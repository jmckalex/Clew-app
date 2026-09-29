// The editor toolbar on two rows (owner's ask 2026-09-29): too narrow for one
// row it WRAPS, at group boundaries and in natural order, the mode switch
// ending row 1; only past two rows do groups go into `…`. The width is set by
// pinning the editor view (the bar is its full width). Fixture — a long note:
//
//   mkdir -p <dir> && node -e "require('fs').writeFileSync('<dir>/Long.md',
//     '# Long\n\n' + Array.from({length: 200}, (_, i) => 'Line ' + (i + 1) + ' of the note.').join('\n\n') + '\n')"
//   (optional) printf 330 > <dir>/end-width.txt  — the width to END at, for
//   the screenshot; default: two rows, nothing hidden
//
// Expect:
//   `wide rows=1 overflow=` then `threshold one-row>=N` (the narrowest
//   one-row width, found by stepping down 2 px at a time);
//   `just-under rows=2 overflow= hidden=0` — two rows before anything hides;
//   `very-narrow rows=2 overflow="…" mode-row=1 more=true`;
//   `jitter flips=0` — ±3 px around the threshold once on two rows stays on
//   two (8 px hysteresis); `back-to-one rows=1` at threshold + 10;
//   `text-shift=0` — a row appearing moves the scroll by its height, so the
//   text below the bar holds still (caret off screen: nothing jumps to it);
//   `caret-visible=true` — a caret the new row covers is brought back;
//   `arrows visual=true down-to-row2=true up-to-row1=true`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-tr: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};

workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Long.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
const host = () => [...document.querySelectorAll('clew-editor-view')].find((v) => v.tabId === tab.id);
const bar = () => host()?.querySelector('clew-editor-toolbar');
await until(() => bar()?.dataset.rows);
const view = editorPool.get(tab.id).view;
const setWidth = async (w) => {
	const h = host();
	h.style.flex = 'none';
	h.style.width = `${w}px`;
	await frames();
	await frames();
};
const rows = () => Number(bar().dataset.rows);
const overflow = () => bar().dataset.overflow ?? '';

// ---- where one row stops ------------------------------------------------------
await setWidth(1100);
log(`wide rows=${rows()} overflow=${overflow()}`);
let threshold = null;
for (let w = 1100; w > 300; w -= 2) {
	await setWidth(w);
	if (rows() > 1) { threshold = w + 2; break; }
}
log(`threshold one-row>=${threshold}`);

// ---- just under: two rows, nothing hidden ----------------------------------------
await setWidth(threshold - 20);
const hiddenGroups = [...bar().querySelectorAll(':scope > .toolbar-group')].filter((g) => g.hidden && g.dataset.group !== 'table-tools').length;
log(`just-under rows=${rows()} overflow=${overflow()} hidden=${hiddenGroups}`);

// ---- very narrow: two rows, then … --------------------------------------------------
await setWidth(330);
const modeEl = bar().querySelector('[data-group="mode"]');
const rowOf = (el) => (el.getBoundingClientRect().top - bar().getBoundingClientRect().top < bar().getBoundingClientRect().height / 2 ? 1 : 2);
log(`very-narrow rows=${rows()} overflow="${overflow()}" mode-row=${rowOf(modeEl)} more=${!bar().querySelector('.toolbar-more').hidden}`);

// ---- jitter at the threshold ------------------------------------------------------------
await setWidth(threshold - 3);
let flips = 0;
let last = rows();
for (let i = 0; i < 10; i++) {
	await setWidth(i % 2 ? threshold + 3 : threshold - 3);
	if (rows() !== last) { flips++; last = rows(); }
}
log(`jitter flips=${flips}`);
await setWidth(threshold + 10);
log(`back-to-one rows=${rows()}`);

// ---- the text holds still when a row appears -------------------------------------------
// (a) the caret far away (the top of the note, off screen): the scroll moves
// with the bar, and nothing jumps to the caret.
const scroller = () => view.scrollDOM.getBoundingClientRect();
const probe = () => [...view.contentDOM.querySelectorAll('.cm-line')]
	.find((l) => l.getBoundingClientRect().top > scroller().top + 120);
await setWidth(threshold + 10);
view.dispatch({ selection: { anchor: 0 } });
view.scrollDOM.scrollTop = 600;
await frames();
let line = probe();
let y0 = line.getBoundingClientRect().top;
await setWidth(threshold - 20);
await sleep(300);
log(`text-shift=${Math.round(line.getBoundingClientRect().top - y0)} rows=${rows()}`);
// (b) the caret on the top visible line — exactly where the new row lands:
// it is brought back into view.
await setWidth(threshold + 10);
view.scrollDOM.scrollTop = 600;
await frames();
const topLine = [...view.contentDOM.querySelectorAll('.cm-line')].find((l) => l.getBoundingClientRect().top >= scroller().top);
view.dispatch({ selection: { anchor: view.posAtDOM(topLine, 0) } });
await frames();
await setWidth(threshold - 20);
await sleep(300);
const caret = view.coordsAtPos(view.state.selection.main.head);
log(`caret-visible=${Boolean(caret && caret.top >= scroller().top - 1 && caret.bottom <= scroller().bottom + 1)} rows=${rows()}`);

// ---- keyboard across the rows --------------------------------------------------------------
bar().focusFirst();
const key = (k) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const seen = [];
for (let i = 0; i < 40; i++) {
	const el = document.activeElement;
	if (seen.includes(el)) break;
	seen.push(el);
	key('ArrowRight');
}
const rowSeq = seen.map(rowOf);
const visual = rowSeq.every((r, i) => i === 0 || r >= rowSeq[i - 1]) && rowSeq.includes(1) && rowSeq.includes(2);
bar().focusFirst();
key('ArrowDown');
const down = rowOf(document.activeElement);
key('ArrowUp');
const up = rowOf(document.activeElement);
log(`arrows visual=${visual} down-to-row2=${down === 2} up-to-row1=${up === 1} stops=${seen.length}`);
view.focus();

// ---- the width to end at, for the screenshot ------------------------------------------------
const endText = await ipc.invoke('clew:note-read', { path: 'end-width.txt' }).catch(() => null);
const end = Number(String(endText?.content ?? endText ?? '').trim());
await setWidth(end > 0 ? end : threshold - 20);
log(`end width=${Math.round(host().getBoundingClientRect().width)} rows=${rows()} overflow="${overflow()}"`);
