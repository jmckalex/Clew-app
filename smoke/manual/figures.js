// Manual screenshot: the Diagrams feature note in reading mode. Pair with
// figures-show-frame.js (scrolls to "Showing the source instead" once every
// figure is typeset — the show=both block) or figures-latex-frame.js
// (scrolls to "LaTeX and plain TeX, too" — the ```latex and ```tex fences).
// manual/images/figures-show.png and figures-latex.png — diagrams.html.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
workspaceStore.openNote('Features/Diagrams.md', { defaultMode: 'reading' });
await sleep(8000);
