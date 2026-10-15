// One construct must never cost a note its whole live edit. The same note
// twice — bold, an image, a callout — once WITH a table and once without,
// each in live edit; what the editor draws is counted. From 8619a67
// (2026-10-09) to 2026-10-15 a table's widget threw inside the block field's
// create, and a note holding a table showed raw `**bold**`, the image as
// text and the callout as source, with no le-* class at all, the tab still
// saying live (the iPad first, then here: `with-table mode=live cm-live=false
// le=0 … raw-stars=true`).
//
// Fixture: `node smoke/make-live-vault.mjs <dir>` (its Attachments/pic.png);
// the run writes With.md and Without.md. Expect both lines alike:
// `without-table mode=live cm-live=true le=10 intense=1 image=1 callout=2
// table=0 raw-stars=false`, the same with `le=12 … table=1` for `with-table`,
// and no `smoke-wn: warn` line (a live-edit warning: a construct's drawing
// failed).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-wn: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });

const warn = console.warn;
console.warn = (...args) => {
	if (/live edit/i.test(String(args[0]))) log(`warn ${args.map(String).join(' ').slice(0, 160)}`);
	warn(...args);
};

const body = '# Whole\n\nSome **bold** text.\n\n![[Attachments/pic.png]]\n\n> [!note] A callout\n> Its body.\n';
const table = '\n| a | b |\n| --- | --- |\n| 1 | 2 |\n';
await ipc.invoke('clew:note-write', { path: 'Without.md', content: body });
await ipc.invoke('clew:note-write', { path: 'With.md', content: body + table });
await sleep(800);

for (const [label, path] of [['without-table', 'Without.md'], ['with-table', 'With.md']]) {
	const tab = workspaceStore.openNote(path, { newTab: true, defaultMode: 'live' });
	workspaceStore.setTabMode(tab.id, 'live');
	await sleep(2500);
	// The editor showing the note, live or not: the tab says live either way.
	const editor = [...document.querySelectorAll('.cm-editor')].find((e) => e.getBoundingClientRect().width > 0);
	const count = (sel) => editor ? editor.querySelectorAll(sel).length : -1;
	log(`${label} mode=${workspaceStore.activeTab()?.view?.mode} cm-live=${editor?.classList.contains('cm-live')}`
		+ ` le=${count('[class*="le-"]')} intense=${count('.le-intense')}`
		+ ` image=${count('.le-image')} callout=${count('.cm-line.le-callout')} table=${count('.le-table')}`
		+ ` raw-stars=${editor?.querySelector('.cm-content')?.textContent.includes('**bold**')}`);
}
