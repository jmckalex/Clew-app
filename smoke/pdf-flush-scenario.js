// A PDF annotation made just before a tab switch must reach the file (the
// HANDOVER §1 loss; the fix: pdf-core.js flushes a pending autosave when its
// document is hidden or unloads). Fixture: `node smoke/make-pdf-vault.mjs
// <dir>` (Paper.pdf, Embed.md embedding it, Other.md).
//
// Both surfaces that run the viewer, four trials each: make one highlight,
// switch to Other.md 0.3 s later — well inside the 2.5 s debounce; a tab
// switch rebuilds the tab body, which would REMOVE the viewer's frame — then,
// once all four are done, read the PDF back from disk and count.
//   the PDF tab (pdf-page.html)       → `tab made=4 kept=4/4`
//   a note's embed (pdf-embed.js)     → `embed made=4 kept=4/4`
// Before the fix: kept=0/4 on both (each highlight went with its frame).
// With it the outgoing view lingers, hidden, until its save lands
// (renderer/pdf-frames.js): each tab trial logs `switch shown-ms=` (the next
// view is in place when activateTab returns — it must stay ~0) and
// `lingered=1 gone-ms=` (how long the hidden view stayed).
// Then the other ways a frame goes, one highlight each:
//   closing the PDF tab                → `close kept=1/1` (the close guard)
//   the note re-rendered WITHOUT its embed (the document lives; the morph
//   holds the embed, hidden, until it is saved — pdf-embed.js#holdIfUnsaved;
//   a viewer disposed after removal never finishes a save)
//                                       → `rerender kept=1/1`
// Closing the window: pdf-flush-close-scenario.js.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, pdfAnnotations } = window.__clew;
const log = (s) => console.log('smoke-pf: ' + s);
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (test()) return true;
	return false;
};
const TRIALS = 4;
const create = (frame, specs) => new Promise((resolve) => {
	const on = (e) => {
		if (e.source !== frame.contentWindow || e.data?.type !== 'test-created') return;
		window.removeEventListener('message', on);
		resolve(e.data.made);
	};
	window.addEventListener('message', on);
	frame.contentWindow.postMessage({ source: 'clew-preview-host', type: 'test-create-annotations', specs }, '*');
	setTimeout(() => { window.removeEventListener('message', on); resolve(-1); }, 10000);
});
const highlights = async () => (await pdfAnnotations.listAnnotations('Paper.pdf')).filter((a) => a.kind === 'highlight').length;
const SPEC = [{ kind: 'highlight', page: 1, match: 'Morality evolves' }];

workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const other = workspaceStore.openNote('Other.md', { newTab: true });

// ---- the PDF tab ------------------------------------------------------------
const pdfFrame = () => [...document.querySelectorAll('clew-file-view')]
	.find((v) => v.path === 'Paper.pdf')?.querySelector('iframe.pdf-frame');
const pdfTab = workspaceStore.openFile('Paper.pdf', { newTab: true });
let made = 0;
for (let i = 0; i < TRIALS; i++) {
	workspaceStore.activateTab(pdfTab.id);
	await until(() => pdfFrame());
	await sleep(3000); // the viewer loads the PDF from disk
	made += Math.max(0, await create(pdfFrame(), SPEC));
	await sleep(300);
	const t0 = performance.now();
	workspaceStore.activateTab(other.id);
	const shown = [...document.querySelectorAll('.tab-body > :not([data-clew-retiring])')].some((v) => v.path === 'Other.md');
	log(`switch shown-ms=${Math.round(performance.now() - t0)} shown=${shown} lingered=${document.querySelectorAll('[data-clew-retiring]').length}`);
	await until(() => !document.querySelector('[data-clew-retiring]'), 12000);
	log(`switch gone-ms=${Math.round(performance.now() - t0)}`);
	await sleep(4000);
}
const afterTab = await highlights();
log(`tab made=${made} kept=${afterTab}/${TRIALS}`);

// ---- a note's embed -----------------------------------------------------------
const embedFrame = () => [...document.querySelectorAll('clew-preview-view')]
	.find((v) => v.path === 'Embed.md')?.querySelector('iframe.preview-frame');
const embedTab = workspaceStore.openNote('Embed.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(embedTab.id, 'reading');
made = 0;
for (let i = 0; i < TRIALS; i++) {
	workspaceStore.activateTab(embedTab.id);
	await until(() => embedFrame());
	await sleep(4500); // the note renders, then its viewer loads the PDF
	made += Math.max(0, await create(embedFrame(), SPEC));
	await sleep(300);
	workspaceStore.activateTab(other.id);
	await sleep(4000);
}
const afterEmbed = await highlights();
log(`embed made=${made} kept=${afterEmbed - afterTab}/${TRIALS}`);

// ---- closing the PDF tab with an edit pending -----------------------------
{
	const tab = workspaceStore.openFile('Paper.pdf', { newTab: true });
	await until(() => pdfFrame());
	await sleep(3000);
	await create(pdfFrame(), SPEC);
	await sleep(300);
	workspaceStore.closeTab(tab.id);
	await sleep(4000);
	log(`close kept=${(await highlights()) - afterEmbed}/1`);
}
const afterClose = await highlights();

// ---- the note re-rendered without its embed ----------------------------------
{
	workspaceStore.activateTab(embedTab.id);
	await until(() => embedFrame());
	await sleep(4500);
	await create(embedFrame(), SPEC);
	await sleep(300);
	await window.__clew.ipc.invoke('clew:note-write', { path: 'Embed.md', content: '# Embed\n\nNo paper here now.\n' });
	await sleep(5000);
	log(`rerender kept=${(await highlights()) - afterClose}/1`);
}
