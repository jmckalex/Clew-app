// `font=note`: figures typeset in the note's own face (Avenir Next on a Mac)
// by mp-tikz-wasm's LuaTeX with fontspec, the faces handed over as bytes
// (main/note-fonts.js → preview-client/figures.js#ensureLoader) and the
// SVG carrying real <text> in an embedded woff2 subset. Pair with
// fonts-frame.js.
//
// Fixture: smoke/make-figures-vault.mjs <dir> — Fonts.md. Fresh
// CLEW_USER_DATA: the result cache would otherwise answer for the engine.
// Needs a staged build carrying the `opentype` bundle — the pinned 0.3.0
// does (0.2.1 did not); on a build without it every marked figure must show
// the by-name refusal instead, and the control must still render.
//
// Expect, from the frame script: `loader bundles="+opentype"`, four
// `[data-opentype]` figures each `text>0` with an `@font-face` in its SVG,
// the control `text=0 paths>0` with no @font-face, and pending=0.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
workspaceStore.openNote('Fonts.md', { defaultMode: 'reading' });
// Short: the frame script does the waiting, and times it from the preview's load.
await sleep(3000);
console.log('smoke-fonts: frame=' + !!document.querySelector('clew-preview-view iframe'));
