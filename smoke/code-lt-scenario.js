// Markup inside code is text everywhere Clew shows it (Clew-boss, 2026-10-04:
// "the swallowed `</>`"). Over `node smoke/make-code-lt-vault.mjs <dir>`,
// opens Code.md in the mode `code-lt-mode.txt` names (reading | live) and
// logs, from live edit's own DOM, the table widget's code cells:
//   `cl: mode=live cells=["</>","<b>x</b>"]`
// code-lt-frame.js logs every `code`/`pre` text in each preview frame
// (FRAME_MATCH `Code.md` for reading, `__clew_block__` for live edit's block
// frames, `Snippet` for the embed) and whether a script ran:
//   `cl-frame: <frame> codes=[…] title=<document.title> after=<bool>`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, editorPool, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const mode = String(await ipc.invoke('clew:note-read', { path: 'code-lt-mode.txt' }).then((r) => r?.content ?? r).catch(() => 'reading')).trim() || 'reading';
const tab = workspaceStore.openNote('Code.md', { newTab: true, defaultMode: mode });
workspaceStore.setTabMode(tab.id, mode);
await sleep(5000);
if (mode === 'live') {
	const view = editorPool.get(tab.id)?.view;
	// Away from the table, so it is drawn as a widget, not revealed.
	view?.dispatch({ selection: { anchor: view.state.doc.length } });
	await sleep(1500);
	const cells = [...(view?.dom.querySelectorAll('table code') ?? [])].map((c) => c.textContent);
	console.log(`smoke-cl: mode=live cells=${JSON.stringify(cells)}`);
} else console.log(`smoke-cl: mode=${mode}`);
