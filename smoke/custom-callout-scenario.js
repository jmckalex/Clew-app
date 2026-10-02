// Custom callout types, reading view vs live edit (Settings → Callouts;
// the engine's callout-definitions.js and callout-table.js#applyCustomCallouts).
// Fixture: smoke/make-custom-callout-vault.sh <dir> [dark|light] — run once
// per theme with CLEW_USER_DATA=<dir>-ud. Each callout head logs, in LIVE
// edit, `smoke-cc-live: <n> title=… border=… bg=… accent=… icon=… folded=…`;
// custom-callout-frame.js logs the same from READING view as `smoke-cc-read:`.
// Sorted, the two lists must be IDENTICAL — 14 heads since the engine's
// callouts (jmarkdown a7de8c6): the folded `-` one measured folded in both;
// `suggestion`; the untitled alias `[!CAUTION]` headed "Caution" in
// warning's colours; and the unknown types — `zzz-unknown`, `fresh` and the
// two whose definitions Settings refuses — drawn as notes (note's colour,
// the pencil) headed by their names. And `style-urls=0` (no colour
// smuggled CSS onto the page).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, editorPool } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Callouts.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
for (let i = 0; i < 100 && !editorPool.get(tab.id)?.view; i++) await sleep(20);
const view = editorPool.get(tab.id).view;
const src = view.state.doc.toString();
view.dispatch({ selection: { anchor: src.indexOf('The end.') } });
await sleep(1500);
console.log(`smoke-cc: theme=${document.body.dataset.theme}`);

const iconOf = (svg) => (svg ? `${svg.getAttribute('viewBox')}|${svg.querySelector('path')?.getAttribute('d').slice(0, 24)}` : 'none');
// Every head in the note, each scrolled into view first (CodeMirror draws
// only what is near the screen).
const doc = view.state.doc;
const starts = [];
for (let i = 1; i <= doc.lines; i++) if (/^> \[!/.test(doc.line(i).text)) starts.push(doc.line(i).from);
const heads = [];
for (const pos of starts) {
	view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(pos).top - 100);
	await sleep(150);
	heads.push([...view.dom.querySelectorAll('.cm-line.le-callout-head')].find((l) => { try { return view.posAtDOM(l) === pos; } catch { return false; } }));
}
heads.forEach((line, n) => {
	if (!line) { console.log(`smoke-cc-live: ${n} MISSING`); return; }
	const cs = getComputedStyle(line);
	const marker = line.querySelector('.le-callout-marker');
	const title = line.querySelector('.le-callout-title, .le-callout-label');
	console.log(`smoke-cc-live: ${n} title=${JSON.stringify(title?.textContent.trim())} border=${cs.borderLeftColor} bg=${cs.backgroundColor}`
		+ ` accent=${marker ? getComputedStyle(marker).color : 'none'} title-color=${title ? getComputedStyle(title).color : 'none'}`
		+ ` icon=${iconOf(marker?.querySelector('svg'))} folded=${line.classList.contains('le-callout-folded')}`);
});

workspaceStore.setTabMode(tab.id, 'reading');
await sleep(4000);
