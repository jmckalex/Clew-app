// `@begin(clew-only)` in live edit (the owner's report, 2026-11-26, on
// dev.22: the box did not display well), and environments NESTED (the
// owner's question the same day: with `@end` concealed, where does each end?
// — one rule per level, each ending in a foot, live/env-rules.js). Writes its
// own `Marked.md` — a marking block like an essay's (fields, a line, a link),
// a rule and a heading after it, a theorem to compare, then a theorem inside
// a clew-only block with a list and a display equation in it and text after
// it — opens it in live edit with the caret at the end, and measures. The
// screenshot (the run's PNG) shows the nested block.
//
// Run with CLEW_SMOKE_VAULT=<any folder>, CLEW_SMOKE_LOG=1 and a
// CLEW_USER_DATA of its own.
// Logs (smoke-live-clew-only:):
//   head clew-only=<the head's text>   theorem=<the theorem's>
//          rule=<the first block's rule: dashed | solid>
//   box lines=<n> top=<px> bottom=<px> last-text-bottom=<px> foot=<px>
//          foot: the concealed `@end` line's height
//   revealed foot=<px> text=<the @end line's text>
//          the caret on the `@end` line
//   nested [<line>:<text's x>/<rules>/<feet>, …]
//          each line of the nested block: where its text starts (px from the
//          content's left), how many rules it draws, how many feet; a block
//          (the display equation) `block <x>/<rules>/0`, its content's x
//   frame boxed=<bool> rules=<n> iframe-left=<px> body-left=<px> same=<bool> right-of-rule=<bool>
//          a mermaid diagram inside a clew-only block (Figure.md): its iframe
//          laid over its boxed placeholder, right of the rule
//   table framed=<bool> rules=<n>
//   typed line=<the table's row> same-node=<bool> framed=<bool>
//          a table inside a theorem, edited by REAL input (Table.md)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-live-clew-only: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(20)) if (test()) return true;
	return false;
};

await ipc.invoke('clew:note-write', { path: 'Marked.md', content: [
	'# Essay A',
	'',
	'**Question.** What is it to act under a description?',
	'',
	'@begin(clew-only)',
	'Marked: INPUT[toggle:marked] · Grade: INPUT[number:grade]',
	'',
	'Handed in on Monday, about 1,000 words.',
	'',
	'[[Essay A.pdf|Open the essay (PDF)|external]]',
	'@end(clew-only)',
	'',
	'---',
	'',
	'## Feedback',
	'',
	'A first paragraph of feedback.',
	'',
	'@begin(theorem)',
	'A theorem, for comparison.',
	'@end(theorem)',
	'',
	'The end.',
	'',
	'## Nested',
	'',
	'@begin(clew-only)',
	'Outer text.',
	'@begin(theorem)',
	'Inner text.',
	'- an item',
	'$$ a = b $$',
	'@end(theorem)',
	'Outer again.',
	'@end(clew-only)',
	'',
	'After both.',
].join('\n') });
const tab = workspaceStore.openNote('Marked.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-env-head'));
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.length } });
await sleep(500);

const lines = () => [...view.contentDOM.querySelectorAll('.cm-line')];
const envLines = (name) => lines().filter((l) => l.classList.contains(`le-env-${name}`));
const heads = [...view.contentDOM.querySelectorAll('.le-env-head')].map((h) => [...h.children]
	.map((part) => getComputedStyle(part).textTransform === 'capitalize' ? part.textContent.replace(/\b\w/g, (c) => c.toUpperCase()) : part.textContent).join(' · '));
log(`head clew-only=${JSON.stringify(heads[0] ?? null)} theorem=${JSON.stringify(heads[1] ?? null)}`
	+ ` rule=${/repeating/.test(envLines('clew-only')[0].style.backgroundImage) ? 'dashed' : 'solid'}`);

// The first block's lines: from its head to its first closer.
const firstClew = envLines('clew-only');
const box = firstClew.slice(0, firstClew.findIndex((l) => l.classList.contains('le-env-close')) + 1);
const rect = (el) => el.getBoundingClientRect();
const foot = box.find((l) => l.classList.contains('le-env-close'));
const textLines = box.filter((l) => !l.classList.contains('le-env-close') && l.textContent.trim());
const top = rect(box[0]).top;
log(`box lines=${box.length} top=0 bottom=${Math.round(rect(box.at(-1)).bottom - top)}`
	+ ` last-text-bottom=${Math.round(rect(textLines.at(-1)).bottom - top)} foot=${Math.round(rect(foot).height)}`);

const close = view.state.doc.toString().indexOf('@end(clew-only)');
view.dispatch({ selection: { anchor: close } });
await sleep(300);
const revealed = envLines('clew-only').find((l) => l.classList.contains('le-env-close'));
log(`revealed foot=${Math.round(rect(revealed).height)} text=${JSON.stringify(revealed.textContent)}`);
view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true });
await sleep(500);

// The nested block: each line's text start (its padding: where the text
// stands), its rules and feet (env-rules.js's layers), from `Outer text.` on.
const left = rect(view.contentDOM).left;
const from = view.state.doc.toString().indexOf('Outer text.');
const nested = [];
for (let n = view.state.doc.lineAt(from).number - 1; n <= view.state.doc.lines; n += 1) {
	const pos = view.state.doc.line(n).from;
	const { node, offset } = view.domAtPos(pos);
	const at = node.nodeType === 1 ? (node.childNodes[offset] ?? node) : node.parentElement;
	const el = at?.closest?.('.cm-line, .le-env-block');
	if (!el) { nested.push(`${n}:block-unframed`); continue; }
	const layers = el.style.backgroundSize.split(',').map((x) => x.trim()).filter(Boolean);
	// A line's text starts at its padding; a block's content inside its box.
	const inner = el.classList.contains('le-env-block') ? el.firstElementChild : el;
	const cs = getComputedStyle(inner);
	const x = Math.round(rect(inner).left - left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft));
	nested.push(`${n}:${el.classList.contains('le-env-block') ? 'block ' : ''}${x}/${layers.filter((l) => l === '2px 100%').length}/${layers.filter((l) => l === '10px 2px').length}`);
}
log(`nested [${nested.join(', ')}]`);

const rulesOf = (el) => el ? el.style.backgroundSize.split(',').filter((l) => l.trim() === '2px 100%').length : 0;

// A diagram's frame inside an environment: its placeholder is boxed with the
// rules, and the frame layer lays the iframe over the placeholder's own body
// (frame-layer.js#read), so the iframe stands inside the frame too.
//   frame boxed=true rules=1 iframe-left=<px> body-left=<px> same=true right-of-rule=true
await ipc.invoke('clew:note-write', { path: 'Figure.md', content: [
	'# Figure', '', '@begin(clew-only)', 'A diagram:', '', '```mermaid', 'graph LR', '  A --> B', '```', '', '@end(clew-only)', '', 'Done.', '',
].join('\n') });
const figTab = workspaceStore.openNote('Figure.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(figTab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-frame-slot.is-measured'), 20000);
await until(() => [...document.querySelectorAll('.le-frames iframe')].some((f) => f.style.visibility === 'visible'), 10000);
await sleep(300);
{
	const slot = document.querySelector('.cm-editor.cm-live .le-frame-slot');
	const box = slot?.closest('.le-env-block');
	const body = slot?.querySelector('.le-frame-body');
	const frame = [...document.querySelectorAll('.le-frames iframe')].find((f) => f.dataset.frameId === slot?.dataset.frameId);
	const content = rect(document.querySelector('.cm-editor.cm-live .cm-content')).left;
	const fx = frame ? Math.round(rect(frame).left - content) : null;
	const bx = body ? Math.round(rect(body).left - content) : null;
	log(`frame boxed=${Boolean(box)} rules=${rulesOf(box)} iframe-left=${fx} body-left=${bx} same=${fx !== null && Math.abs(fx - bx) <= 1} right-of-rule=${fx !== null && fx > 26}`);
}

// A table inside an environment is boxed with its rules (widgets/
// framed-block.js) and still edited IN PLACE: REAL input clicks a cell and
// types, and the cell editor must be the same node after the keystrokes
// (the wrapper hands each update to the table's own updateDOM).
//   table framed=true rules=1 → typed line="| a1 | b1xyz |" same-node=true framed=true
await ipc.invoke('clew:note-write', { path: 'Table.md', content: [
	'# Table', '', '@begin(theorem)', 'Cells:', '', '| A | B |', '| --- | --- |', '| a1 | b1 |', '', '@end(theorem)', '', 'Done.', '',
].join('\n') });
const tableTab = workspaceStore.openNote('Table.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tableTab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-table'));
const tableView = editorPool.get(tableTab.id).view;
tableView.dispatch({ selection: { anchor: tableView.state.doc.length } });
await sleep(500);
const boxOf = () => document.querySelector('.le-table')?.closest('.le-env-block');
log(`table framed=${Boolean(boxOf())} rules=${rulesOf(boxOf())}`);
const b1 = [...document.querySelectorAll('.le-table td')].find((t) => t.textContent === 'b1');
const r = b1.getBoundingClientRect();
let editor0 = null;
window.__clewSmokeInput = [
	{ click: { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } },
	{ wait: 800 },
	{ text: 'xyz' },
	{ wait: 800 },
];
setTimeout(() => { editor0 = document.querySelector('.le-cell-editor'); }, 600);
setTimeout(() => {
	const line = tableView.state.doc.toString().split('\n').find((l) => l.includes('a1'));
	log(`typed line=${JSON.stringify(line)} same-node=${Boolean(editor0) && document.querySelector('.le-cell-editor') === editor0} framed=${Boolean(boxOf())}`);
	// The screenshot: the nested block.
	workspaceStore.activateTab(tab.id);
	setTimeout(() => view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true }), 150);
}, 1900);
