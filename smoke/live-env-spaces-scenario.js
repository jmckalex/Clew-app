// Live edit reads an environment's name as the engine does — spaces and tabs
// around it inside the parentheses ignored (`@begin( theorem )` is
// `@begin(theorem)`; begin-end-core.js trims them, the owner's ask
// 2026-11-27). Writes `Spaced.md` — an unspaced theorem to compare, one
// spaced in its opener and closer, one spaced in the opener only, a spaced
// element name, a spaced clew-only block holding a proof spaced with tabs,
// and parentheses holding only spaces (no name: no environment) — opens it
// in live edit, the caret at the end, and measures.
//
// Run with CLEW_SMOKE_VAULT=<an empty folder>, CLEW_SMOKE_LOG=1 and a
// CLEW_USER_DATA of its own.
// Logs (smoke-live-env-spaces:):
//   heads [<each environment head's text>]
//   lines [<line>:<text's x>/<rules>/<tops>/<feet>, …]
//          each non-blank line from the first opener to the last closer:
//          where its text starts (px from the content's left), how many
//          rules it draws, how many top feet (┌, an opener) and feet (└, a
//          closer) — live-clew-only-scenario.js's measure
//   revealed text=<the line's text> rules=<n>
//          the caret on `@begin( theorem )`: its line as written
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-live-env-spaces: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(20)) if (test()) return true;
	return false;
};

await ipc.invoke('clew:note-write', { path: 'Spaced.md', content: [
	'# Spaced', '',
	'@begin(theorem)', 'Unspaced.', '@end(theorem)', '',
	'@begin( theorem )', 'Spaces inside both.', '@end( theorem )', '',
	'@begin(  lemma)', 'A spaced opener.', '@end(lemma)', '',
	'@begin( <aside> )', 'An element, spaced.', '@end( aside )', '',
	'@begin( clew-only )', 'Outer.', '@begin(\tproof\t)', 'Inner.', '@end(proof)', 'Outer again.', '@end( clew-only )', '',
	'@begin( )', 'No name, no environment.', '@end( )', '',
	'After.',
].join('\n') });
const tab = workspaceStore.openNote('Spaced.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-env-head'));
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.length } });
await sleep(500);

const rect = (el) => el.getBoundingClientRect();
const heads = [...view.contentDOM.querySelectorAll('.le-env-head')].map((h) => h.textContent);
log(`heads ${JSON.stringify(heads)}`);

const lineEl = (n) => {
	const { node, offset } = view.domAtPos(view.state.doc.line(n).from);
	const at = node.nodeType === 1 ? (node.childNodes[offset] ?? node) : node.parentElement;
	return at?.closest?.('.cm-line');
};
const measure = (el) => {
	const layers = el.style.backgroundSize.split(',').map((x) => x.trim()).filter(Boolean);
	const places = el.style.backgroundPosition.split(',').map((x) => x.trim());
	const feet = (bottom) => layers.filter((l, i) => l === '10px 2px' && places[i]?.endsWith('100%') === bottom).length;
	const cs = getComputedStyle(el);
	const x = Math.round(rect(el).left - rect(view.contentDOM).left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft));
	return `${x}/${layers.filter((l) => l === '2px 100%').length}/${feet(false)}/${feet(true)}`;
};
const text = view.state.doc.toString();
const first = view.state.doc.lineAt(text.indexOf('@begin(')).number;
const last = view.state.doc.lineAt(text.lastIndexOf('@end(')).number;
const out = [];
for (let n = first; n <= last; n += 1) {
	if (!view.state.doc.line(n).text.trim()) continue;
	const el = lineEl(n);
	out.push(`${n}:${el ? measure(el) : 'none'}`);
}
log(`lines [${out.join(', ')}]`);

const spaced = text.indexOf('@begin( theorem )');
view.dispatch({ selection: { anchor: spaced + 3 } });
await sleep(300);
const shown = lineEl(view.state.doc.lineAt(spaced).number);
log(`revealed text=${JSON.stringify(shown?.textContent ?? null)} rules=${shown ? measure(shown).split('/')[1] : null}`);
view.dispatch({ selection: { anchor: view.state.doc.length } });
await sleep(300);
