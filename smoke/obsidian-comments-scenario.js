// Obsidian's `%%` comments hidden (src/engine/obsidian-comments.js; the
// owner's C1, 2026-10-22), over `node smoke/make-comments-vault.mjs <dir>`.
// Opens the note `comments-note.txt` names (default Comments.md) in the mode
// `comments-mode.txt` names:
//   reading (default) — obsidian-comments-frame.js logs, per frame
//     (FRAME_MATCH the note's name), which markers show:
//       `oc-frame: Comments.md shown=["CODE-KEPT",…]` — never a *-SECRET
//     and the site export, the HTML and LaTeX exports and the reading-view
//     PDF are written into `<vault>-out` (`oc: <what> …`), read from the shell
//     (smoke/README.md has the checks);
//   live — live edit is source, so it shows them all:
//       `oc: live secret-shown=true kept-shown=true`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, editorPool, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const read = (p, fallback) => ipc.invoke('clew:note-read', { path: p }).then((r) => String(r?.content ?? r ?? '').trim() || fallback).catch(() => fallback);
const note = await read('comments-note.txt', 'Comments.md');
const mode = await read('comments-mode.txt', 'reading');
const tab = workspaceStore.openNote(note, { newTab: true, defaultMode: mode });
workspaceStore.setTabMode(tab.id, mode);
await sleep(5000);
if (mode === 'live') {
	const shown = editorPool.get(tab.id)?.view?.dom.textContent ?? '';
	console.log(`smoke-oc: live secret-shown=${shown.includes('MULTI-LINE-SECRET') && shown.includes('INLINE-SECRET')} kept-shown=${shown.includes('CODE-KEPT')}`);
} else {
	const out = `${vaultStore.vault.path}-out`;
	const run = async (what, fn) => {
		try { console.log(`smoke-oc: ${what} ${JSON.stringify(await fn())}`); } catch (err) { console.log(`smoke-oc: ${what} FAILED ${err.message}`); }
	};
	await run('site', () => ipc.invoke('clew:export-site', { outDir: `${out}/site` }));
	for (const n of ['Comments.md', 'Headed.md', 'Board.md']) {
		const base = n.replace(/\.md$/, '');
		await run(`html ${n}`, () => ipc.invoke('clew:export-note', { path: n, format: 'html', outFile: `${out}/${base}.html` }));
		await run(`latex ${n}`, () => ipc.invoke('clew:export-note', { path: n, format: 'latex', outFile: `${out}/${base}.tex` }));
	}
	await run('print-pdf', () => ipc.invoke('clew:export-note', { path: 'Comments.md', format: 'print-pdf', outFile: `${out}/Comments.pdf` }));
}
console.log('smoke-oc: done');
