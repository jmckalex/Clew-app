// A directive the engine takes LITERALLY keeps its source raw in live edit
// (jmarkdown-scan.js LITERAL_DIRECTIVES; the owner's report 2026-10-01:
// `@reveal[http://…/prez/teaching/…/]` showed `http:/localhost:8888prez…`
// in italics, its slashes concealed, while the cursor was on it). Fixture:
//
//   mkdir -p <dir> && printf '%s\n' '# Literal' '' "@reveal[http://localhost:8888/prez/teaching/ph341/econ-and-id/]{height='450px'}" '' 'plain /italic/ word' '' '@note[some /italic/ text]' > <dir>/Literal.md
//
// Expect `cursor-on raw=true italics=0` (the line reads exactly as the
// source), `cursor-away frame=true` (the deck's slot drawn), and the prose
// and the @note's /italic/ still italic: `prose-italic=1 note-italic=1`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, editorPool } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Literal.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
for (let i = 0; i < 100 && !editorPool.get(tab.id)?.view; i++) await sleep(20);
const view = editorPool.get(tab.id).view;
const src = view.state.doc.toString();
const line = (needle) => [...document.querySelectorAll('.cm-editor .cm-line')].find((l) => l.textContent.includes(needle));
const revealSrc = src.split('\n').find((l) => l.startsWith('@reveal'));
view.dispatch({ selection: { anchor: src.indexOf('@reveal') + 12 } });
await sleep(800);
const on = line('@reveal');
console.log(`smoke-ld: cursor-on raw=${on?.textContent === revealSrc} italics=${on?.querySelectorAll('.le-italic').length} text=${JSON.stringify(on?.textContent)}`);
view.dispatch({ selection: { anchor: src.indexOf('plain') } });
await sleep(1500);
console.log(`smoke-ld: cursor-away frame=${Boolean(document.querySelector('.cm-editor .le-frame-slot'))}`);
console.log(`smoke-ld: prose-italic=${line('plain')?.querySelectorAll('.le-italic').length} note-italic=${document.querySelectorAll('.cm-editor .le-italic').length - (line('plain')?.querySelectorAll('.le-italic').length ?? 0)}`);
