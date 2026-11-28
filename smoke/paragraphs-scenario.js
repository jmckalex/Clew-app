// How paragraphs are set apart in reading view (Settings → Appearance →
// Paragraphs, renderer/lib/preview-look.js, preview.css; the owner's choice
// 2026-11-28), over Paras.md (`node smoke/make-paragraphs-vault.mjs <dir>`).
// Run with `CLEW_SMOKE_FRAME_SCRIPT=smoke/paragraphs-frame.js
// CLEW_SMOKE_FRAME_MATCH=Paras.md`. The note opens in the style the profile
// holds (a fresh one: spaced), and the setting is switched to the OTHER style
// while the note is open — so the frame script, run last, reads a live switch.
// Put `"readingParagraphs": "indented"` in the run's clew-settings.json to go
// the other way. Live edit is measured too: the note is cloned into a split
// on the right and put in live edit — so the reading view on the left stays
// open through the switch — and its indented lines read before and after.
// A `print.flag` file in the vault also prints the note (the reading-view
// PDF, `clew:export-notes-print`) after the switch, into CLEW_SMOKE_EXPORT_DIR,
// for pdftotext to read.
//   `smoke-paragraphs: live style=spaced indented=[]`, `from=spaced
//   to=indented`, `live style=indented indented=[first words of each
//   indented line] indent=24px`, then the frame's `smoke-paragraphs-frame:
//   style=indented [...]` — each paragraph's first words, its first-line
//   indent (px) and the gap above it (px).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, settingsStore, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-paragraphs: ' + s);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const from = settingsStore.get('readingParagraphs') === 'indented' ? 'indented' : 'spaced';
const to = from === 'indented' ? 'spaced' : 'indented';
const tab = workspaceStore.openNote('Paras.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(tab.id, 'reading');
await sleep(3000);
const right = workspaceStore.splitWithClone(workspaceStore.activeGroup().id, 'right', tab.id);
const liveTab = right?.tabs?.[0];
if (liveTab) workspaceStore.setTabMode(liveTab.id, 'live');
await sleep(2500);
/** Live edit's indented lines: their first two words, and the first one's indent. */
const liveLines = (style) => {
	const lines = [...document.querySelectorAll('.cm-editor.cm-live .cm-line.le-para-indent')];
	const words = lines.map((l) => l.textContent.trim().split(/\s+/).slice(0, 2).join(' '));
	return `live style=${style} indented=${JSON.stringify(words)}${lines[0] ? ` indent=${getComputedStyle(lines[0]).textIndent}` : ''}`;
};
log(liveLines(from));
log(`from=${from} to=${to}`);
settingsStore.set('readingParagraphs', to);
await sleep(1500);
log(liveLines(to));
if (vaultStore.pathExists?.('print.flag')) {
	const result = await ipc.invoke('clew:export-notes-print', { paths: ['Paras.md'] }).catch((err) => ({ error: String(err) }));
	log(`printed ${JSON.stringify(result?.written ?? result)}`);
}
