// Enter and ⌘Enter in a list item, by REAL keys in live edit (the owner's
// choice, 2026-10-19; editor/list-keys.js): Enter stays in the item, so an
// item takes several paragraphs; ⌘Enter starts the next item; the task box
// moved to ⌘L. Writes its own ListKeys.md into any vault (CLEW_SMOKE_VAULT=
// <an empty folder>, CLEW_SMOKE_LOG=1). Logs (smoke-list-keys:):
//   paragraph lines=["  something so strong?","","  Second paragraph."] drawn=item
//              Enter, Enter, typing at the end of a hard-wrapped item: a
//              second paragraph in it, drawn as the item's text (le-li-cont)
//   next-item lines=["  Second paragraph.","* Next item"] drawn=item
//   task toggled="- [x] a task" next="- [ ] another task"
//              ⌘L ticks it, ⌘Enter gives an empty box
//   numbered lines=["1. first","2. inserted","3. second"]
//   prose lines=["Prose line.","Below."]   ⌘Enter outside a list: the blank
//              line below it always gave
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-list-keys: ' + s);
const until = async (test, ms = 20000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(20)) if (test()) return true;
	return false;
};

await ipc.invoke('clew:note-write', { path: 'ListKeys.md', content: [
	'# Lists',
	'',
	'* First item.',
	'* I wonder if the claim is stronger',
	'  than it needs to be. Do you really need',
	'  something so strong?',
	'',
	'- [ ] a task',
	'',
	'1. first',
	'2. second',
	'',
	'Prose line.',
	'',
].join('\n') });
const tab = workspaceStore.openNote('ListKeys.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-bullet'));
const view = editorPool.get(tab.id).view;
const text = () => view.state.doc.toString();
const lines = () => text().split('\n');
const around = (s, before, after) => {
	const i = lines().findIndex((l) => l.includes(s));
	return JSON.stringify(lines().slice(i - before, i + after + 1));
};
const drawn = (s) => {
	const line = [...view.contentDOM.querySelectorAll('.cm-line')].find((l) => l.textContent.includes(s));
	return line?.classList.contains('le-li-cont') || line?.classList.contains('le-li') ? 'item' : line ? `other(${line.className})` : 'none';
};
const endOf = (s) => {
	const line = view.state.doc.line(lines().findIndex((l) => l.includes(s)) + 1);
	view.dispatch({ selection: { anchor: line.to } });
	view.focus();
};
endOf('something so strong?');

const enter = { combo: { key: 'Enter', modifiers: 0, text: '\r' } };
const cmdEnter = { combo: { key: 'Enter', modifiers: 4 } };
window.__clewSmokeInput = [
	enter, enter, { text: 'Second paragraph.' }, { wait: 300 },
	cmdEnter, { text: 'Next item' }, { wait: 1500 },  // → the task line
	{ combo: { key: 'l', code: 'KeyL', modifiers: 4 } }, { wait: 300 },
	cmdEnter, { text: 'another task' }, { wait: 1500 }, // → "1. first"
	cmdEnter, { text: 'inserted' }, { wait: 1500 },     // → "Prose line."
	cmdEnter, { text: 'Below.' }, { wait: 1500 },
];
// Each step's checks once its text is in, then the cursor to the next place.
setTimeout(async () => {
	await until(() => text().includes('Next item'));
	await sleep(200);
	log(`paragraph lines=${around('Second paragraph.', 2, 0)} drawn=${drawn('Second paragraph.')}`);
	log(`next-item lines=${around('Next item', 1, 0)} drawn=${drawn('Next item')}`);
	endOf('a task');
	await until(() => text().includes('another task'));
	await sleep(200);
	log(`task toggled=${JSON.stringify(lines().find((l) => l.includes('a task')))} next=${JSON.stringify(lines().find((l) => l.includes('another task')))}`);
	endOf('1. first');
	await until(() => text().includes('inserted'));
	await sleep(200);
	log(`numbered lines=${around('inserted', 1, 1)}`);
	endOf('Prose line.');
	await until(() => text().includes('Below.'));
	await sleep(200);
	log(`prose lines=${around('Below.', 1, 0)}`);
	log('done');
}, 0);
