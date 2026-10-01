// Custom callout types, reading view vs live edit (Settings → Callouts;
// shared/custom-callouts.js, engine/callouts.js#applyCustomCallouts).
// Fixture: smoke/make-custom-callout-vault.sh <dir> [dark|light] — run once
// per theme with CLEW_USER_DATA=<dir>-ud. Each callout head logs, in LIVE
// edit, `smoke-cc-live: <n> title=… border=… bg=… accent=… icon=… folded=…`;
// custom-callout-frame.js logs the same from READING view as `smoke-cc-read:`.
// Sorted, the two lists must be IDENTICAL (8 heads: the folded `-` one is
// measured folded in both). Also `refused-as-quotes=2` in both (the two
// definitions Settings refuses leave their notes plain quotes) and
// `style-urls=0` (no colour smuggled CSS onto the page).
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
const heads = [...document.querySelectorAll('.cm-editor .cm-line.le-callout-head')];
heads.forEach((line, n) => {
	const cs = getComputedStyle(line);
	const marker = line.querySelector('.le-callout-marker');
	const title = line.querySelector('.le-callout-title, .le-callout-label');
	console.log(`smoke-cc-live: ${n} title=${JSON.stringify(title?.textContent.trim())} border=${cs.borderLeftColor} bg=${cs.backgroundColor}`
		+ ` accent=${marker ? getComputedStyle(marker).color : 'none'} title-color=${title ? getComputedStyle(title).color : 'none'}`
		+ ` icon=${iconOf(marker?.querySelector('svg'))} folded=${line.classList.contains('le-callout-folded')}`);
});
const quotes = [...document.querySelectorAll('.cm-editor .cm-line')].filter((l) => l.textContent.includes('Refused'));
console.log(`smoke-cc-live: refused-as-quotes=${quotes.filter((l) => l.classList.contains('le-quote') && !l.classList.contains('le-callout')).length}`);

workspaceStore.setTabMode(tab.id, 'reading');
await sleep(4000);
