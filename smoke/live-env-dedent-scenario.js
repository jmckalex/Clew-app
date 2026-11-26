// Live edit draws an environment's body without the indentation the engine
// strips (live/env-rules.js#bodyIndents; the owner's ask, 2026-11-26, after
// ⌥⌘E's indented body stood a step right of its head). Writes `Flush.md` — a
// body flush left, as most notes are, which must not move — and `Mixed.md` —
// a body indented two spaces with a line four in and a list, a nested pair
// each indented, a tab-indented body and one mixing a tab with spaces (which
// share nothing, so nothing is stripped) — opens each in live edit, the caret
// at the end, and measures where each body line's text starts.
//
// Run with CLEW_SMOKE_VAULT=<an empty folder>, CLEW_SMOKE_LOG=1 and a
// CLEW_USER_DATA of its own.
// Logs (smoke-live-env-dedent:):
//   flush [<line>:<x>, …]   mixed [<line>:<x>, …]
//          each body line's first character: px from the content's left
//          (a list item's, its bullet)
//   heads flush=[<x>, …] mixed=[<x>, …]
//          each environment head's text
//   caret line=<n> x=<px>
//          Mixed.md's "Two." with the caret on it: where it stands then
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-live-env-dedent: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(30)) if (test()) return true;
	return false;
};

await ipc.invoke('clew:note-write', { path: 'Flush.md', content: [
	'# Flush', '',
	'@begin(theorem)', 'A claim, flush left.', '', '- an item', '  its second line', '@end(theorem)', '',
	'@begin(clew-only)', 'Outer.', '@begin(lemma)', 'Inner.', '@end(lemma)', '@end(clew-only)', '',
	'After.',
].join('\n') });
await ipc.invoke('clew:note-write', { path: 'Mixed.md', content: [
	'# Mixed', '',
	'@begin(lemma)', '  Two.', '    Four.', '', '  - an item', '    its second line', '@end(lemma)', '',
	'@begin(clew-only)', '  Outer.', '  @begin(theorem)', '    Inner.', '  @end(theorem)', '@end(clew-only)', '',
	'@begin(proof)', '\tTabbed.', '@end(proof)', '',
	'@begin(remark)', '  Spaces.', '\tA tab.', '@end(remark)', '',
	'After.',
].join('\n') });

async function open(path) {
	const tab = workspaceStore.openNote(path, { newTab: true, defaultMode: 'live' });
	workspaceStore.setTabMode(tab.id, 'live');
	await until(() => editorPool.get(tab.id)?.view?.contentDOM.querySelector('.le-env-head'));
	const view = editorPool.get(tab.id).view;
	view.dispatch({ selection: { anchor: view.state.doc.length } });
	await sleep(400);
	return view;
}
const left = (view) => view.contentDOM.getBoundingClientRect().left;
/** Each body line (not the heading, an opener, a closer or a blank line):
 *  where its first character is drawn. */
function bodyX(view) {
	const out = [];
	for (let n = 2; n <= view.state.doc.lines; n += 1) {
		const line = view.state.doc.line(n);
		const text = line.text.trim();
		if (!text || /^@(begin|end)\(/.test(text) || text === 'After.') continue;
		const at = view.coordsAtPos(line.from + /^[ \t]*/.exec(line.text)[0].length);
		out.push(`${n}:${at ? Math.round(at.left - left(view)) : 'none'}`);
	}
	return out;
}
const heads = (view) => [...view.contentDOM.querySelectorAll('.le-env-head')]
	.map((h) => Math.round((h.firstElementChild ?? h).getBoundingClientRect().left - left(view)));

// Each note measured while its tab is the one showing.
const flush = await open('Flush.md');
const flushX = bodyX(flush);
const flushHeads = heads(flush);

const mixed = await open('Mixed.md');
log(`flush [${flushX.join(', ')}]`);
log(`mixed [${bodyX(mixed).join(', ')}]`);
log(`heads flush=${JSON.stringify(flushHeads)} mixed=${JSON.stringify(heads(mixed))}`);

// The caret on "Two.": its line must not move. Back to the end after, for
// the screenshot (Mixed.md, concealed).
const two = mixed.state.doc.toString().indexOf('Two.');
mixed.dispatch({ selection: { anchor: two + 2 } });
await sleep(300);
log(`caret line=${mixed.state.doc.lineAt(two).number} x=${Math.round(mixed.coordsAtPos(two).left - left(mixed))}`);
mixed.dispatch({ selection: { anchor: mixed.state.doc.length } });
await sleep(300);
