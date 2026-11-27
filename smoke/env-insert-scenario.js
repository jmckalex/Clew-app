// ⌥⌘E — an environment whose name is typed once (editor/env-insert.js; the
// owner's ask, 2026-11-26), by REAL input: the chord as a Mac sends it (key
// "´" on code "KeyE", ⌥ a dead key), the name typed, Enter and Tab. Writes
// its own `Env.md` and `Src.md`; in live edit an insert after a paragraph and
// then a wrap of two selected lines, in source mode an insert at the end.
// Each step waits for the page to have measured the one before (an `until`
// on a marker the scenario adds), never a fixed wait.
//
// Run with CLEW_SMOKE_VAULT=<an empty folder>, CLEW_SMOKE_LOG=1 and a
// CLEW_USER_DATA of its own.
// Logs (smoke-env-insert:):
//   field lines=<the block's lines> hints=<n> marks=<names> drawn=[<opener line's text>, <closer line's text>] chips=<n>
//          after ⌥⌘E: the empty field, a "name" hint in the opener and closer,
//          both lines drawn as source — `@begin(name)`, no directive chip
//   typed lines=<…> marks=<the highlighted names> closer=<the @end line's text> concealed=<bool>
//          after typing "lemma": copied into the closer, which live edit shows
//   entered line=<the cursor's line> col=<n> marks=<n> concealed=<bool>
//          after Enter: on the indented body line, the field gone, the closer
//          concealed again (its └ foot)
//   wrap selected=<the field's selected text> marks=<names>
//          ⌥⌘E over two selected lines: the last name, selected
//   wrapped lines=<…> line=<the cursor's line> col=<n>
//          after typing "clew-only" and Enter
//   heads [<each environment head's text>]
//          live edit's reading of what was written
//   source lines=<…> line=<…> col=<n> marks-while-typing=<n>
//          in source mode, "proof" and Tab
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-env-insert: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(30)) if (test()) return true;
	return false;
};
const step = (n) => {
	const mark = document.createElement('i');
	mark.hidden = true;
	mark.dataset.smokeEnvStep = String(n);
	document.body.append(mark);
};

await ipc.invoke('clew:note-write', { path: 'Env.md', content: [
	'# Env', '', 'First paragraph.', '', 'Wrap me, line one.', 'Wrap me, line two.', '', 'Last line.',
].join('\n') });
await ipc.invoke('clew:note-write', { path: 'Src.md', content: '# Source\n\nA paragraph.' });

const tab = workspaceStore.openNote('Env.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .cm-line'));
const view = editorPool.get(tab.id).view;
const doc = () => view.state.doc.toString();
view.focus();
view.dispatch({ selection: { anchor: doc().indexOf('First paragraph.') + 'First paragraph.'.length } });

const E = { combo: { key: '´', code: 'KeyE', modifiers: 5 } };
const ENTER = { combo: { key: 'Enter', code: 'Enter', text: '\r' } };
const TAB = { combo: { key: 'Tab', code: 'Tab' } };
const wait = (n) => ({ until: { selector: `[data-smoke-env-step="${n}"]`, ms: 12000 } });
window.__clewSmokeInput = [
	E, wait(1), { text: 'lemma' }, wait(2), ENTER, wait(3), { text: 'Body.' }, wait(4),
	E, wait(5), { text: 'clew-only' }, wait(6), ENTER, wait(7),
	E, wait(8), { text: 'proof' }, wait(9), TAB, wait(10),
];

const blockLines = (v, from = 0) => {
	const text = v.state.doc.toString();
	const at = text.indexOf('@begin(', from);
	if (at < 0) return '[]';
	const end = text.indexOf('\n', text.indexOf('@end(', at));
	return JSON.stringify(text.slice(at, end < 0 ? text.length : end).split('\n'));
};
const marks = (v) => JSON.stringify([...v.contentDOM.querySelectorAll('.cm-env-name')].map((m) => m.textContent));
const cursor = (v) => {
	const head = v.state.selection.main.head;
	const line = v.state.doc.lineAt(head);
	return `line=${JSON.stringify(line.text)} col=${head - line.from}`;
};
const lineDom = (pos) => {
	let n = view.domAtPos(pos).node;
	while (n && !n.classList?.contains('cm-line')) n = n.parentNode;
	return n;
};
const closerLine = (name) => [...view.contentDOM.querySelectorAll('.cm-line')]
	.find((l) => l.textContent.includes(`@end(${name})`) || (l.classList.contains('le-env-close') && l.classList.contains(`le-env-${name}`)));

(async () => {
	await until(() => doc().includes('@begin('));
	await sleep(100);
	const drawn = ['@begin(', '@end('].map((w) => lineDom(doc().indexOf(w))?.textContent ?? null);
	log(`field lines=${blockLines(view)} hints=${view.contentDOM.querySelectorAll('.cm-env-name-hint').length} marks=${marks(view)}`
		+ ` drawn=${JSON.stringify(drawn)} chips=${view.contentDOM.querySelectorAll('.le-directive-chip').length}`);
	step(1);

	await until(() => doc().includes('@end(lemma)'));
	await sleep(150);
	const closer = closerLine('lemma');
	log(`typed lines=${blockLines(view)} marks=${marks(view)} closer=${JSON.stringify(closer?.textContent ?? null)}`
		+ ` concealed=${Boolean(closer?.classList.contains('le-env-foot-line'))}`);
	step(2);

	await until(() => !view.contentDOM.querySelector('.cm-env-name'));
	await sleep(150);
	log(`entered ${cursor(view)} marks=${view.contentDOM.querySelectorAll('.cm-env-name').length}`
		+ ` concealed=${Boolean(closerLine('lemma')?.classList.contains('le-env-foot-line'))}`);
	step(3);

	await until(() => doc().includes('Body.'));
	const one = doc().indexOf('Wrap me, line one.');
	view.dispatch({ selection: { anchor: one, head: doc().indexOf('line two.') + 'line two.'.length } });
	await sleep(100);
	step(4);

	await until(() => view.contentDOM.querySelectorAll('.cm-env-name').length === 2);
	await sleep(100);
	const sel = view.state.selection.main;
	log(`wrap selected=${JSON.stringify(view.state.sliceDoc(sel.from, sel.to))} marks=${marks(view)}`);
	step(5);

	await until(() => doc().includes('@end(clew-only)'));
	await sleep(100);
	step(6);

	await until(() => !view.contentDOM.querySelector('.cm-env-name'));
	await sleep(300);
	log(`wrapped lines=${blockLines(view, doc().indexOf('@begin(clew-only'))} ${cursor(view)}`);
	view.dispatch({ selection: { anchor: doc().length } });
	await sleep(300);
	log(`heads ${JSON.stringify([...view.contentDOM.querySelectorAll('.le-env-head')].map((h) => h.textContent))}`);

	// Source mode, another note: at its end.
	const src = workspaceStore.openNote('Src.md', { newTab: true, defaultMode: 'source' });
	workspaceStore.setTabMode(src.id, 'source');
	await until(() => editorPool.get(src.id)?.view?.contentDOM.isConnected);
	const sview = editorPool.get(src.id).view;
	sview.focus();
	sview.dispatch({ selection: { anchor: sview.state.doc.length } });
	await sleep(200);
	step(7);

	await until(() => sview.state.doc.toString().includes('@begin('));
	step(8);
	await until(() => sview.state.doc.toString().includes('@end(proof)'));
	await sleep(100);
	const typing = sview.contentDOM.querySelectorAll('.cm-env-name').length;
	step(9);
	await until(() => !sview.contentDOM.querySelector('.cm-env-name'));
	await sleep(100);
	log(`source lines=${blockLines(sview)} ${cursor(sview)} marks-while-typing=${typing}`);

	// The screenshot: the live-edit note, from its top.
	workspaceStore.activateTab(tab.id);
	await sleep(200);
	view.dispatch({ selection: { anchor: 0 }, scrollIntoView: true });
	step(10);
})();
