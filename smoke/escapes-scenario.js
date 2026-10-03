// Escaped characters print as themselves, in live edit as in reading view
// (jmarkdown e02cd51: an escaped `$` is wrapped in span.escaped, which
// MathJax reads no delimiter across). Fixture, one note:
//
//   mkdir -p <dir> && printf '# Escapes\n\nCosts \\$5 and \\$10, a\\_b, 50\\%%, \\{x\\}, and $x^2$ maths.\n' > <dir>/Escapes.md
//
// Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/escapes-frame.js
// CLEW_SMOKE_FRAME_MATCH=Escapes.md. Expect:
//   live: drawn="Costs $5 and $10, a_b, 50%, {x}, and …maths." math-widgets=1
//   source: math-spans=1 (only $x^2$; smoke/math-highlight-scenario's rule)
//   (frame) reading: text="Costs $5 and $10, a_b, 50%, {x}, and … maths." mathjax=1
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool } = window.__clew;
const log = (s) => console.log('smoke-esc: ' + s);
const tab = workspaceStore.openNote('Escapes.md', { defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
for (let i = 0; i < 100 && !editorPool.get(tab.id)?.view; i++) await sleep(100);
await sleep(1500);
const view = editorPool.get(tab.id).view;
// The cursor on the heading, so the prose line is concealed.
view.dispatch({ selection: { anchor: 2 } });
await sleep(600);
const line = [...view.contentDOM.querySelectorAll('.cm-line')].find((l) => l.textContent.includes('Costs'));
log(`live: drawn=${JSON.stringify(line?.textContent ?? '')} math-widgets=${[...(line?.querySelectorAll('svg') ?? [])].filter((svg) => !svg.parentElement.closest('svg')).length}`);
workspaceStore.setTabMode(tab.id, 'source');
await sleep(800);
const src = [...view.contentDOM.querySelectorAll('.cm-line')].find((l) => l.textContent.includes('Costs'));
log(`source: math-spans=${src?.querySelectorAll('.jmd-math').length ?? 0} text=${JSON.stringify(src?.textContent ?? '')}`);
workspaceStore.setTabMode(tab.id, 'reading');
await sleep(5000);
