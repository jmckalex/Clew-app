// Manual screenshot: a .docx open in an office tab (LibreOffice Writer in
// wasm) beside a note tab. Needs the office engine (dev: the repo's
// zeta-assets/). Boot takes a minute or two — run in the background.
// manual/images/office-tab.png — office-documents.html.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
workspaceStore.openNote('Welcome.md', { defaultMode: 'reading' });
await sleep(800);
workspaceStore.openFile('Attachments/Reading Group.docx', { newTab: true });
let frame = false;
for (let i = 0; i < 60 && !frame; i++) {
	await sleep(2000);
	frame = !!document.querySelector('.office-dock .office-frame');
}
console.log('smoke-manual: office-frame=' + frame);
await sleep(90000);
