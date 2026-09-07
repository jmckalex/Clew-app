// How much frame an embed draws: `![[Note]]` / `|quiet` / `|bare`.
// Pair with embed-chrome-frame.js.
//
// Fixture (disposable) — the control section matters as much as the embeds,
// because "bare" claims to be INDISTINGUISHABLE from writing the content out:
//   printf '# Host note\n\n## Control — written inline\n\n### Embedded heading\n\nThe embedded body text.\n\nProse immediately after, which should read as one flow.\n\n## Bare — transcluded\n\n![[Child|bare]]\n\nProse immediately after, which should read as one flow.\n\n## Quiet\n\n![[Child|quiet]]\n\n## Default\n\n![[Child]]\n' > V/Host.md
//   printf '### Embedded heading\n\nThe embedded body text.\n' > V/Child.md
//
// Expect: default 3px stripe + 1px box + 6px radius + title; quiet 3px stripe,
// no box, no radius, title kept; bare nothing and no title — and its gaps
// EQUAL to the inline control's, above and below.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
workspaceStore.openNote('Host.md', { defaultMode: 'reading' });
await sleep(7000);
console.log('smoke-chrome: frame=' + !!document.querySelector('clew-preview-view iframe'));
