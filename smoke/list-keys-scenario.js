// Enter and ⌘Enter in a list item, by REAL keys in live edit (the owner's
// choice, 2026-10-19; editor/list-keys.js): Enter stays in the item, so an
// item takes several paragraphs; ⌘Enter starts the next item; the task box
// moved to ⌘L. Writes its own ListKeys.md into any vault (CLEW_SMOKE_VAULT=
// <an empty folder>, CLEW_SMOKE_LOG=1). Logs (smoke-list-keys:):
//   paragraph lines=["  them ending here?","","  Second paragraph."] drawn=item
//              Enter, Enter, typing at the end of a hard-wrapped item: a
//              second paragraph in it, drawn as the item's text (le-li-cont)
//   next-item lines=["  Second paragraph.","* Next item"] drawn=item
//   task toggled="- [x] a task" next="- [ ] another task"
//              ⌘L ticks it, ⌘Enter gives an empty box
//   numbered lines=["1. first","2. inserted","3. second"]
//   prose lines=["Prose line.","Below."]   ⌘Enter outside a list: the blank
//              line below it always gave
//   cmd-l line="- [ ] Below."   ⌘L on a plain line makes it a task
//              (Obsidian's Toggle checkbox status, the owner's yes 2026-10-20)
//   first-line bullet=["* First item.","  B2"] numbered=["3. second","   N2"]
//              task=["- [ ] another task","  TC"]
//              Enter at the end of an item's FIRST line stays in the item too.
//              Until the fix after a7baa98 it started a new item (`* B2`,
//              `4. N2`, `- [ ] TC`): lang-markdown's keymap, at Prec.high, ran
//              before listEnter (Clew-docs measured it; note-keys.js)
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
	'* A second item whose text is wrapped',
	'  by hand over three lines, the last of',
	'  them ending here?',
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
endOf('them ending here?');

const enter = { combo: { key: 'Enter', modifiers: 0, text: '\r' } };
const cmdEnter = { combo: { key: 'Enter', modifiers: 4 } };
window.__clewSmokeInput = [
	enter, enter, { text: 'Second paragraph.' }, { wait: 300 },
	cmdEnter, { text: 'Next item' }, { wait: 1500 },  // → the task line
	{ combo: { key: 'l', code: 'KeyL', modifiers: 4 } }, { wait: 300 },
	cmdEnter, { text: 'another task' }, { wait: 1500 }, // → "1. first"
	cmdEnter, { text: 'inserted' }, { wait: 1500 },     // → "Prose line."
	cmdEnter, { text: 'Below.' }, { wait: 1500 },       // → "* First item."
	enter, { text: 'B2' }, { wait: 1500 },              // → "3. second"
	enter, { text: 'N2' }, { wait: 1500 },              // → "- [ ] another task"
	enter, { text: 'TC' }, { wait: 1500 },              // → "Below."
	{ combo: { key: 'l', code: 'KeyL', modifiers: 4 } }, { wait: 800 },
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
	// Enter at the end of an item's FIRST line, three kinds of item.
	const first = {};
	for (const [name, at, typed] of [['bullet', '* First item.', 'B2'], ['numbered', '3. second', 'N2'], ['task', '- [ ] another task', 'TC']]) {
		endOf(at);
		await until(() => text().includes(typed));
		await sleep(200);
		first[name] = around(typed, 1, 0);
	}
	log(`first-line bullet=${first.bullet} numbered=${first.numbered} task=${first.task}`);
	endOf('Below.');
	await until(() => lines().some((l) => l.startsWith('- [ ] Below')));
	log(`cmd-l line=${JSON.stringify(lines().find((l) => l.includes('Below.')))}`);
	log('done');
}, 0);
