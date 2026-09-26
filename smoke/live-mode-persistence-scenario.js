// Live edit's MODE, across a restart (docs/dev/live-edit-plan.md §3.3). Two
// runs over one fixture — the scenario tells them apart by what the
// workspace restored.
//
// Fixture (regenerate before run 1; run 2 reuses it):
//
//   mkdir -p /tmp/lm-vault && node -e "let s='# Persist\n\n';
//     for (let i = 1; i <= 40; i++) s += 'Paragraph ' + i + ' with *strong* words.\n\n';
//     require('fs').writeFileSync('/tmp/lm-vault/Persist.md', s)"
//
// Run 1 opens Persist.md in SOURCE, then by real input: ⌘⇧E → live
// (`run1 live: mode=live cm-live=true same-host=true` — the flip must not
// remount the editor), ⌘E → reading (`run1 reading: mode=reading
// editMode=live`). The workspace is left saved in reading.
//
// Run 2 (same vault): `run2 restored: mode=reading editMode=live`; ⌘E →
// `run2 back: mode=live cm-live=true` (back to LIVE, not source — the point
// of editMode); ⌘E again to reading, then ⌘-click a paragraph in the
// preview (inverse search) → `run2 inverse: mode=live line=<n> text=Paragraph …`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, vaultStore } = window.__clew;
const log = (s) => console.log('smoke-lm: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
await until(() => vaultStore.vault);
await sleep(800); // the workspace restores after vault-opened
const META = 4;
const SHIFT = 8;
const tabOf = () => workspaceStore.allGroups().flatMap((g) => g.tabs).find((t) => t.path === 'Persist.md');
const hostOf = (id) => document.querySelector('clew-editor-view')?.tabId === id ? document.querySelector('clew-editor-view') : null;
const cmLive = () => Boolean(document.querySelector('.cm-editor.cm-live'));
const restored = tabOf();

if (!restored) {
	// ---- run 1 ----
	const tab = workspaceStore.openNote('Persist.md', { newTab: true, defaultMode: 'source' });
	await until(() => document.querySelector('.cm-content')?.textContent.includes('Paragraph 3'));
	const host = hostOf(tab.id);
	const line = [...document.querySelectorAll('.cm-line')].find((l) => l.textContent.startsWith('Paragraph 2'));
	const r = line.getBoundingClientRect();
	window.__clewSmokeInput = [
		{ click: { x: Math.round(r.left + 30), y: Math.round(r.top + r.height / 2) } },
		{ wait: 300 },
		{ combo: { key: 'e', modifiers: META | SHIFT } },
		{ wait: 800 },
		{ combo: { key: 'e', modifiers: META } },
		{ wait: 2500 },
	];
	setTimeout(() => {
		const t = tabOf();
		log(`run1 live: mode=${t.view.mode} cm-live=${cmLive()} same-host=${hostOf(t.id) === host && host.isConnected}`);
	}, 1000);
	setTimeout(() => {
		const t = tabOf();
		log(`run1 reading: mode=${t.view.mode} editMode=${t.view.editMode}`);
	}, 2800);
} else {
	// ---- run 2 ----
	log(`run2 restored: mode=${restored.view.mode} editMode=${restored.view.editMode}`);
	workspaceStore.activateTab?.(restored.id);
	await sleep(1500);
	const frame = document.querySelector('clew-preview-view iframe');
	const fr = frame?.getBoundingClientRect();
	window.__clewSmokeInput = [
		{ click: { x: Math.round(fr.left + fr.width / 2), y: Math.round(fr.top + 20) } }, // focus the pane
		{ wait: 400 },
		{ combo: { key: 'e', modifiers: META } },
		{ wait: 1200 },
		{ combo: { key: 'e', modifiers: META } },
		{ wait: 2500 },
		// ⌘-click well down the preview: a paragraph, whichever it is.
		{ click: { x: Math.round(fr.left + fr.width / 2 - 100), y: Math.round(fr.top + fr.height * 0.45) }, modifiers: META },
		{ wait: 2500 },
	];
	setTimeout(() => {
		const t = tabOf();
		log(`run2 back: mode=${t.view.mode} cm-live=${cmLive()}`);
	}, 1700);
	setTimeout(() => {
		const t = tabOf();
		const view = editorPool.get(t.id)?.view;
		const head = view?.state.selection.main.head ?? 0;
		const line = view?.state.doc.lineAt(head);
		log(`run2 inverse: mode=${t.view.mode} line=${line?.number} text=${line?.text.slice(0, 14)}`);
	}, 7500);
}
