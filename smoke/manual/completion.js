// Manual screenshot: wikilink completion matching a FOLDER path — real
// keystrokes (the popup opens on typed input, not on dispatched changes).
// Vault: any with a `Draft.md` whose last line is SHORT prose ending in a
// space (the popup opens at the caret and must fit before the right
// sidebar), and a Guide/Links and Embeds.md to find. Auto-save writes the
// typed text into Draft.md — rewrite the note before every run.
// manual/images/wikilink-completion.png — editing.html.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool } = window.__clew;
const tab = workspaceStore.openNote('Draft.md', { defaultMode: 'source' });
await sleep(2500);
const { view } = editorPool.get(tab.id);
const end = view.state.doc.length;
view.dispatch({ selection: { anchor: end }, scrollIntoView: true });
view.focus();
await sleep(200);
const c = view.coordsAtPos(end);
console.log('smoke-manual: caret=' + JSON.stringify(c));
window.__clewSmokeInput = [
	{ click: { x: c.right + 1, y: (c.top + c.bottom) / 2 } },
	{ wait: 300 },
	{ text: '[[Guide/Link' },
	{ wait: 1200 },
];
