// Live edit pairs `@begin(name)` and `@end(name)` as the engine does — by
// NAME, nested like well-formed parentheses (the owner's ask, 2026-11-27):
// an opener's closer is the first `@end` of its own name, a same-name opener
// on the way needing its own, inside the environment around it; `@end(b)`
// never closes `@begin(a)`, and what pairs with nothing is drawn as written,
// as reading view prints it. Writes `Nesting.md` — crossed pairs, a stray
// closer, an opener whose closer an inner same-name opener takes, a
// same-name pair inside another name — opens it in live edit, the caret at
// the end, and measures.
//
// Run with CLEW_SMOKE_VAULT=<an empty folder>, CLEW_SMOKE_LOG=1 and a
// CLEW_USER_DATA of its own.
// Logs (smoke-live-env-nesting:):
//   heads [<each environment head's line>:<its text>]
//   lines [<line>:<text's x>/<rules>/<tops>/<feet>, …]
//          each non-blank line after the title: where its text starts (px
//          from the content's left), how many rules it draws, how many top
//          feet (┌, an opener) and feet (└, a closer) —
//          live-clew-only-scenario.js's measure
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-live-env-nesting: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(20)) if (test()) return true;
	return false;
};

// The engine prints this note (measured, 2026-11-27): aa(3–7) holding the
// text "@begin(bb)", then "@end(bb)" as text; "@begin(aa)" and "@end(bb)"
// as text (13–15); "@begin(aa)" as text, then aa(20–22); aa(25–35) holding
// bb(27–31), which holds "@begin(aa)" as text, and "@end(aa)" as text (33).
await ipc.invoke('clew:note-write', { path: 'Nesting.md', content: [
	'# Nesting', '',
	'@begin(aa)', 'one', '@begin(bb)', 'two', '@end(aa)', 'three', '@end(bb)', '',
	'four', '',
	'@begin(aa)', 'five', '@end(bb)', 'six', '',
	'@begin(aa)', 'seven', '@begin(aa)', 'eight', '@end(aa)', 'nine', '',
	'@begin(aa)', 'ten', '@begin(bb)', 'eleven', '@begin(aa)', 'twelve', '@end(bb)', 'thirteen', '@end(aa)', 'fourteen', '@end(aa)', '',
	'fifteen',
].join('\n') });
const tab = workspaceStore.openNote('Nesting.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .cm-line'));
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.length } });
await sleep(600);

const rect = (el) => el.getBoundingClientRect();
const lineEl = (n) => {
	const { node, offset } = view.domAtPos(view.state.doc.line(n).from);
	const at = node.nodeType === 1 ? (node.childNodes[offset] ?? node) : node.parentElement;
	return at?.closest?.('.cm-line');
};
const heads = [...view.contentDOM.querySelectorAll('.le-env-head')]
	.map((h) => `${view.state.doc.lineAt(view.posAtDOM(h)).number}:${h.textContent}`);
log(`heads ${JSON.stringify(heads)}`);
const measure = (el) => {
	const layers = el.style.backgroundSize.split(',').map((x) => x.trim()).filter(Boolean);
	const places = el.style.backgroundPosition.split(',').map((x) => x.trim());
	const feet = (bottom) => layers.filter((l, i) => l === '10px 2px' && places[i]?.endsWith('100%') === bottom).length;
	const cs = getComputedStyle(el);
	const x = Math.round(rect(el).left - rect(view.contentDOM).left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft));
	return `${x}/${layers.filter((l) => l === '2px 100%').length}/${feet(false)}/${feet(true)}`;
};
const out = [];
for (let n = 3; n <= view.state.doc.lines; n += 1) {
	if (!view.state.doc.line(n).text.trim()) continue;
	const el = lineEl(n);
	out.push(`${n}:${el ? measure(el) : 'none'}`);
}
log(`lines [${out.join(', ')}]`);
