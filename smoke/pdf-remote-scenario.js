// Web PDFs a note embeds (docs/dev/pdf-unification.md §4, main/remote-pdfs.js,
// pdf-page.js read-only). Fixture: `node smoke/make-remote-pdf-vault.mjs
// <vault> <userData>`, then CLEW_USER_DATA=<userData> CLEW_SMOKE_VAULT=<vault>
// CLEW_SMOKE_FRAME_SCRIPT=smoke/pdf-remote-frame.js CLEW_SMOKE_FRAME_MATCH=pdf-page.
// No network: one PDF comes from the pre-seeded device cache, the other is
// refused by the address guard before any connection.
//
// From the note: `frames remote=2 raw-web=0` — both frames went to the
// viewer and neither was left pointing at the web. From each viewer frame
// (pdf-remote-frame.js): the cached one `readonly=true strip=true
// autosave=none` then `saved=Attachments/paper.pdf` and `opened=true`; the
// refused one `failure=refused-address save-offered=false` (nothing to save). And main logs
// `smoke-open-external: https://papers.example.org/paper.pdf` in place of
// launching a browser.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Web.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(tab.id, 'reading');
await sleep(8000);   // the note, then both viewers boot
const html = await (await fetch(`clew-preview://vault/${vaultStore.vault.sessionId}/Web.md.html`)).text();
const remote = (html.match(/data-clew-remote-pdf=/g) ?? []).length;
const rawWeb = (html.match(/<iframe[^>]*src="https?:/g) ?? []).length;
console.log(`smoke-rp: frames remote=${remote} raw-web=${rawWeb}`);
window.__clewSmokeInput = [{ wait: 500 }];
