// Image embeds within a line, in reading view and a site export
// (engine/wikilinks.js: wikiembedImage, and wikiembed's start() only where a
// line begins). Until 2026-10-15 `![[a.png]] ![[b.png]]` showed "!" and a
// link, then a block image; "Alone: ![[a.png]]" lost its image to a block
// after the text — while an export drew both in place.
//
// Any vault (`node smoke/make-live-vault.mjs <dir>`: its Attachments/pic.png);
// the run writes Inline.md and exports the site to <vault>-site. Run with
// CLEW_SMOKE_FRAME_SCRIPT=smoke/inline-embeds-frame.js
// CLEW_SMOKE_FRAME_MATCH=Inline.md. Expect from the frame, per line:
// `two imgs=2 bang=false`, `alone imgs=1 text="Alone:"`, `own-line block=true`,
// `sized imgs=1 width=200`, `pdf imgs=0 link=true` (a PDF within a line stays
// a link); `site written=<path>`, whose Inline.html the runner checks:
//   grep -c '<p[^>]*><img class="internal-media" src="./Attachments/pic.png"[^>]*> <img' → 1
// (both in one paragraph, the URL relative to the page).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-ie: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);

await ipc.invoke('clew:note-write', {
	path: 'Inline.md',
	content: '# Inline\n\n![[pic.png]] ![[pic.png]]\n\nAlone: ![[pic.png]]\n\n![[pic.png]]\n\nSized ![[pic.png|200]] here\n\nA PDF ![[sample.pdf]] here\n',
});
await sleep(800);
const tab = workspaceStore.openNote('Inline.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(tab.id, 'reading');
await sleep(3500);

// The site export: the same lines, relative URLs (export-site.js#finishPage).
const root = vaultStore.vault.path;
const site = await ipc.invoke('clew:export-site', { outDir: `${root}-site` }).catch((err) => ({ error: String(err.message ?? err) }));
log(site?.error ? `site error=${JSON.stringify(site.error)}` : `site written=${root}-site/Inline.html`);
