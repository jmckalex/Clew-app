// The two editor chords that have no on-screen affordance of their own:
// ⌥Q (fill/reflow the paragraph, Emacs' M-q) and ⌥D (delete the word
// forward, the twin of mac's own ⌥⌫). Both are registry commands, so the
// window dispatcher claims the chord BEFORE CodeMirror — which on mac also
// stops Option typing its character (`œ`, `∂`) into the note.
//
// Pair with CLEW_SMOKE_MENU=1: `smoke-menu: Edit > Fill Paragraph (Reflow)
// [Alt+Q]` is the Edit-menu half of the owner's 2026-09-18 ask (a native
// menu is invisible to capturePage; that dump is the only assertion it can
// carry).
//
// Fixture (any disposable vault):
//
//   mkdir -p /tmp/keys-vault && printf '%s\n' \
//     '# Keys' '' \
//     'delete these words one by one and leave the rest alone' '' \
//     'A paragraph whose words run well past the fill column because it was written as one very long line that wants reflowing.' \
//     > /tmp/keys-vault/Keys.md
//
// The run EDITS the fixture and auto-saves — regenerate it before every
// run, or the second one finds the words already gone.
//
// Expect: `alt-q`/`alt-d` name the two command ids (the keymap is the
// renderer's own, user rebindings included); `after delete-line` is
// `" words one by one and leave the rest alone"` — two words gone, the
// space before the third kept, which is mac's own ⌥⌫ mirrored;
// `reflow-lines=2 widths=[68,51]` against the default fill column of 72;
// and `option-chars=[]`, the assertion that the dispatcher claimed both
// chords before CodeMirror could type `œ` or `∂`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, registry } = window.__clew;
workspaceStore.openNote('Keys.md', { newTab: true, defaultMode: 'source' });
await sleep(2500);

const keymap = registry.effectiveKeymap();
console.log('smoke-keys: alt-q=' + (keymap.get('Alt-q') ?? 'UNBOUND')
	+ ' alt-d=' + (keymap.get('Alt-d') ?? 'UNBOUND'));

const lineFor = (prefix) => [...document.querySelectorAll('.cm-line')]
	.find((l) => l.textContent.startsWith(prefix));
const deleteLine = lineFor('delete these words');
const longLine = lineFor('A paragraph whose words');
const at = (line, fromLeft) => {
	const r = line.getBoundingClientRect();
	return { x: Math.round(r.left + fromLeft), y: Math.round(r.top + r.height / 2) };
};
console.log('smoke-keys: before delete-line=' + JSON.stringify(deleteLine.textContent));
console.log('smoke-keys: before reflow-text=' + JSON.stringify(longLine.textContent.slice(0, 40)));

// Alt is CDP modifier bit 1. Two ⌥D at the line's head, then one ⌥Q with
// the cursor inside the long paragraph.
window.__clewSmokeInput = [
	{ click: at(deleteLine, 2) },
	{ wait: 400 },
	{ combo: { key: 'd', modifiers: 1 } },
	{ combo: { key: 'd', modifiers: 1 } },
	{ wait: 400 },
	{ click: at(longLine, 40) },
	{ wait: 300 },
	{ combo: { key: 'q', modifiers: 1 } },
	// Long enough that the report below lands before the harness exits.
	{ wait: 2000 },
];
setTimeout(() => {
	const text = [...document.querySelectorAll('.cm-line')].map((l) => l.textContent);
	const after = text.find((t) => t.includes('one by one')) ?? 'NOT FOUND';
	console.log('smoke-keys: after delete-line=' + JSON.stringify(after));
	// The reflowed paragraph is every line from its first to the end.
	const head = text.findIndex((t) => t.startsWith('A paragraph'));
	const reflowed = text.slice(head).filter((t) => t.trim());
	console.log('smoke-keys: reflow-lines=' + reflowed.length
		+ ' widths=' + JSON.stringify(reflowed.map((t) => t.length)));
	console.log('smoke-keys: option-chars=' + JSON.stringify(
		text.join('\n').match(/[œ∂]/g) ?? []));
}, 3500);
