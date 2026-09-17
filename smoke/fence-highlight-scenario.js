// Fence languages in the SOURCE pane: ```tikz / ```latex / ```tex bodies
// tokenized by the TeX stream mode, ```metapost by the MetaPost one
// (src/renderer/editor/langs/), and every other fence left plain.
//
// Fixture: smoke/make-figures-vault.mjs <dir> — Highlight.md fits one
// viewport, which matters because CodeMirror only renders visible lines.
// A NEW tab, because a restored tab from an earlier run over the same
// vault (figures-scenario leaves one in reading mode) would be navigated
// in place, mode and all.
//
// Expect: counts > 0 for jmd-keyword / jmd-function / jmd-constant /
// jmd-number / jmd-operator / jmd-paren / cmt-comment / jmd-string /
// jmd-type; the js fence's line reported with NO styled spans; the
// :::TiKZ body still jmd-embedded (the overlay's uniform face for
// directive bodies — unchanged by this feature); and the draw line's spans
// as listed. Screenshot: eyeball the colours.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
workspaceStore.openNote('Highlight.md', { newTab: true, defaultMode: 'source' });
await sleep(4000);
const content = document.querySelector('.cm-content');
const counts = {};
for (const cls of ['jmd-keyword', 'jmd-function', 'jmd-constant', 'jmd-number', 'jmd-operator', 'jmd-paren', 'cmt-comment', 'jmd-string', 'jmd-type', 'jmd-variable', 'jmd-embedded']) {
	counts[cls] = content?.querySelectorAll('.' + cls).length ?? -1;
}
console.log('smoke-fence-highlight: ' + JSON.stringify(counts));
const lines = [...(content?.querySelectorAll('.cm-line') ?? [])];
const spansOf = (prefix) => {
	const line = lines.find((l) => l.textContent.startsWith(prefix));
	return line ? [...line.querySelectorAll('span')].map((s) => s.className.replace(/\s+/g, '.') + ':' + s.textContent).join(' | ') : 'NOT FOUND';
};
console.log('smoke-fence-highlight: draw-line=' + spansOf('\\draw[->,thick]'));
console.log('smoke-fence-highlight: metapost-line=' + spansOf('pair a;'));
console.log('smoke-fence-highlight: label-line=' + spansOf('label.top(btex'));
console.log('smoke-fence-highlight: js-line=' + spansOf('const x = 1;'));
console.log('smoke-fence-highlight: directive-line=' + spansOf('\\draw (0,0) circle'));
