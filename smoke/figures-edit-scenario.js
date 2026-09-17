// The morph guard for figures, both directions (client.js → figures.js):
// editing PROSE must leave a rendered figure exactly as it stands, and
// editing the FIGURE must typeset the new one. Pair with figures-edit-frame.js.
//
// Fixture: smoke/make-figures-vault.mjs <dir> (uses Edit.md).
//
// Why both halves matter: auto.js typesets an element once and client.js
// keeps custom elements across a re-render, so the naive arrangement freezes
// an edited figure at its old picture — and the naive fix (re-render every
// figure on every morph) throws away a rendered SVG on every keystroke.
//
// Expect from the frame: `kept-mark=true` with an unchanged key after the
// prose edit, then a CHANGED key, `kept-mark=false` (a fresh element) and a
// different SVG size after the figure edit.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, ipc } = window.__clew;
workspaceStore.openNote('Edit.md', { defaultMode: 'reading' });
await sleep(20000);
console.log('smoke-figures-edit: frame=' + !!document.querySelector('clew-preview-view iframe'));

// Phase 2: prose only — same fence, one word different.
await ipc.invoke('clew:note-write', {
	path: 'Edit.md',
	content: '# Edit\n\nPROSE-TWO\n\n```tikz\n\\draw[thick] (0,0) rectangle (2,1);\n```\n',
});
console.log('smoke-figures-edit: prose-written');
await sleep(9000);

// Phase 3: the figure itself — a wider rectangle, so the SVG must change size.
await ipc.invoke('clew:note-write', {
	path: 'Edit.md',
	content: '# Edit\n\nPROSE-TWO\n\n```tikz\n\\draw[thick] (0,0) rectangle (6,1);\n```\n',
});
console.log('smoke-figures-edit: figure-written');
await sleep(15000);
