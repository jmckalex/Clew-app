// TikZ and MetaPost typeset in the preview by mp-tikz-wasm: the ```tikz and
// ```metapost fences, a TikZJax-dialect fence body, the :::TiKZ directive and
// the @begin(metapost) environment. Pair with figures-frame.js.
//
// Fixture (disposable) — one note holding all five forms:
//   smoke/make-figures-vault.mjs <dir>
//
// Expect, from the frame script: five figure elements, each with a
// .mpw-figure holding an <svg> and NO .mpw-error; `pending=0` before the
// screenshot; and the paths-not-text check (a TikZ label is glyph outlines,
// so the SVG carries <path> elements, not a font the page may not have).
//
// The first run is the slow one — the engines and ~90 TeX files load from
// __clew_assets__, and LuaTeX only if a figure asks for graph drawing. Every
// run after it answers from the preview's IndexedDB cache, so a rerun over
// the same CLEW_USER_DATA is the cache test, not the engine test.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
workspaceStore.openNote('Figures.md', { defaultMode: 'reading' });
await sleep(45000);
console.log('smoke-figures: frame=' + !!document.querySelector('clew-preview-view iframe'));
