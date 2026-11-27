// Editing an environment's name in its `@begin(…)` or its `@end(…)` edits
// the other's too (editor/env-link.js; the owner's ask, 2026-11-27: "that
// would prevent it from ever generating a syntax error"), by REAL input in
// live edit: the caret at the end of the opener's name, Backspace through it
// and "lemma" typed; the caret in the closer's name and "s" typed; ⌘Z; then
// a nested pair's inner opener renamed. Each step waits for the page to have
// measured the last (an `until` on a marker), never a fixed wait.
//
// Run with CLEW_SMOKE_VAULT=<an empty folder>, CLEW_SMOKE_LOG=1 and a
// CLEW_USER_DATA of its own.
// Logs (smoke-env-link:):
//   emptied lines=[<the pair's lines>]
//          the opener's name backspaced away: the closer's with it
//   renamed lines=[…] heads=[<environment heads>]
//          "lemma" typed: both renamed; the caret moved off, live edit draws
//          a lemma
//   closer lines=[…]
//          "s" typed in the closer's name: the opener's too
//   undone lines=[…]
//          ⌘Z: the last edit undone in both, one step
//   nested lines=[<the nested block's lines>]
//          the inner opener renamed: its own closer only, the outer's untouched
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-env-link: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(30)) if (test()) return true;
	return false;
};
const step = (n) => {
	const mark = document.createElement('i');
	mark.hidden = true;
	mark.dataset.smokeLinkStep = String(n);
	document.body.append(mark);
};

await ipc.invoke('clew:note-write', { path: 'Link.md', content: [
	'# Link', '',
	'@begin(theorem)', 'A claim.', '@end(theorem)', '',
	'@begin(clew-only)', 'Outer.', '@begin(proof)', 'Inner.', '@end(proof)', '@end(clew-only)', '',
	'Last line.',
].join('\n') });
const tab = workspaceStore.openNote('Link.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-env-head'));
const view = editorPool.get(tab.id).view;
const doc = () => view.state.doc.toString();
view.focus();

const BS = { combo: { key: 'Backspace', code: 'Backspace' } };
const UNDO = { combo: { key: 'z', code: 'KeyZ', modifiers: 4 } };
const wait = (n) => ({ until: { selector: `[data-smoke-link-step="${n}"]`, ms: 12000 } });
window.__clewSmokeInput = [
	wait(1), BS, BS, BS, BS, BS, BS, BS, wait(2), { text: 'lemma' }, wait(3),
	{ text: 's' }, wait(4), UNDO, wait(5), { text: 'case' }, wait(6),
];

const lines = (from, n) => JSON.stringify(doc().split('\n').slice(from - 1, from - 1 + n));
const heads = () => JSON.stringify([...view.contentDOM.querySelectorAll('.le-env-head')].map((h) => h.textContent));
const caret = (pos) => view.dispatch({ selection: { anchor: pos } });

(async () => {
	caret(doc().indexOf('@begin(theorem)') + '@begin(theorem'.length);
	await sleep(200);
	step(1);
	await until(() => doc().includes('@begin()'), 6000);
	await sleep(150);
	log(`emptied lines=${lines(3, 3)}`);
	step(2);
	await until(() => doc().includes('@begin(lemma)'));
	// The caret off the pair, so live edit draws its head.
	caret(doc().length);
	await sleep(300);
	log(`renamed lines=${lines(3, 3)} heads=${heads()}`);
	caret(doc().indexOf('@end(') + '@end('.length + doc().slice(doc().indexOf('@end(') + 5).indexOf(')'));
	await sleep(200);
	step(3);
	await until(() => /@end\(\w+s\)/.test(doc()) || /@begin\(\w+s\)/.test(doc()));
	await sleep(150);
	log(`closer lines=${lines(3, 3)}`);
	step(4);
	await sleep(600);
	log(`undone lines=${lines(3, 3)}`);
	const inner = doc().indexOf('@begin(proof)');
	view.dispatch({ selection: { anchor: inner + '@begin('.length, head: inner + '@begin(proof'.length } });
	await sleep(200);
	step(5);
	await until(() => doc().includes('@begin(case)'));
	await sleep(250);
	log(`nested lines=${lines(7, 6)}`);
	caret(doc().length);
	await sleep(300);
	step(6);
})();
