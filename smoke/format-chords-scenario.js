// The formatting chords (2026-09-27): each style's shortcut, pressed for real
// on a selected word in live edit, wraps it in the dialect's markers; and the
// sidebars moved off ⌘B / ⌘⇧B. Run with CLEW_SMOKE_MENU=1 for the Format
// menu's accelerators.
//
// Fixture (any disposable vault):
//   mkdir -p /tmp/fc-vault && printf '%s\n' '# Chords' '' 'word' '' 'Last.' \
//     > /tmp/fc-vault/Chords.md
//
// Expect one `chord … → …` line per style — `⌘B → *word*`, `⌘⇧B → **word**`,
// `⌘I → /word/`, `⌘U → __word__`, `⌘⇧H → ==word==`, `⌘⇧X → ~word~`,
// `⌘⇧C → `word``, `⌘⇧M → $word$`, `⌘⌥↓ → word_{…}`, `⌘⌥↑ → word^{…}` —
// then `sidebar ⌘⌥B left=false`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool } = window.__clew;
const log = (s) => console.log('smoke-fc: ' + s);
workspaceStore.setSidebar('left', { open: true });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Chords.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await sleep(1500);
const view = editorPool.get(tab.id).view;
const META = 4, ALT = 1, SHIFT = 8;
const CHORDS = [
	['⌘B', 'b', META], ['⌘⇧B', 'b', META | SHIFT], ['⌘I', 'i', META], ['⌘U', 'u', META],
	['⌘⇧H', 'h', META | SHIFT], ['⌘⇧X', 'x', META | SHIFT], ['⌘⇧C', 'c', META | SHIFT],
	['⌘⇧M', 'm', META | SHIFT], ['⌘⌥↓', 'ArrowDown', META | ALT], ['⌘⌥↑', 'ArrowUp', META | ALT],
];
const line3 = () => view.state.doc.line(3);
const selectWord = () => {
	view.dispatch({ changes: { from: line3().from, to: line3().to, insert: 'word' }, selection: { anchor: line3().from, head: line3().from + 4 } });
	view.focus();
};
const until = async (test, ms = 3000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(30)) if (test()) return true;
	return false;
};
// One chord every 900 ms; the chain reads each result and resets the word.
window.__clewSmokeInput = [
	...CHORDS.flatMap(([, key, modifiers]) => [{ wait: 450 }, { combo: { key, modifiers } }, { wait: 450 }]),
	{ wait: 400 }, { combo: { key: 'b', modifiers: META | ALT } }, { wait: 800 },
];
selectWord();
(async () => {
	for (const [name] of CHORDS) {
		await until(() => line3().text !== 'word');
		log(`chord ${name} → ${line3().text}`);
		selectWord();
	}
	await until(() => workspaceStore.state.sidebars.left.open === false);
	log(`sidebar ⌘⌥B left=${workspaceStore.state.sidebars.left.open}`);
})();
