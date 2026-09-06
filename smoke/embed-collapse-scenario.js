// Collapsible note embeds: `![[Note|collapsed]]` / `![[Note|open]]` render as
// a real <details>, and folding one in reading mode rewrites the note's own
// source line. Pair with embed-collapse-frame.js, which does the clicking.
//
// Fixture (disposable):
//   printf '# Parent\n\nPlain:\n\n![[Child]]\n\nClosed:\n\n![[Child|collapsed]]\n\nOpen:\n\n![[Child|Reading list|open]]\n' > V/Parent.md
//   printf '# Child\n\nchild body\n' > V/Child.md
//
// The assertion the harness cannot make is on disk: after the run, Parent.md
// line 9 must read `![[Child|open]]` — the frame script unfolds it.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
workspaceStore.openNote('Parent.md', { defaultMode: 'reading' });
await sleep(6000);
console.log('smoke-collapse: frame=' + !!document.querySelector('clew-preview-view iframe'));
