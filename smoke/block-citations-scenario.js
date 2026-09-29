// A live block frame renders under its note's citation keys (main/
// citation-header.js): a `\cite` in an embedded note resolves in live edit
// as it does in reading mode, with the bibliography named only in the
// note's header — and editing that header reaches the frame.
//
//   mkdir -p <dir> && cp demo-vault/Features/refs.bib <dir>/ &&
//   printf 'Child cites \\cite{lewis1969} and \\citep{skyrms1996}.\n' > <dir>/Child.md &&
//   printf -- '---\nBibliography: refs.bib\nResolve citations: true\nBibliography style: chicago\n---\n# Note\n\n![[Child]]\n\n@bibliography\n' > <dir>/Note.md
//   … CLEW_SMOKE_FRAME_SCRIPT=smoke/block-citations-frame.js CLEW_SMOKE_FRAME_MATCH=__clew_block__
//
// Expect `smoke-bc: first resolved=true` (was raw `\cite{…}` before
// 2026-09-29), then — the header's bibliography removed — `smoke-bc-frame:
// … resolved=false` (the frame re-rendered under the new keys).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-bc: ' + s);
const tab = workspaceStore.openNote('Note.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await sleep(8000);
// The frame is cross-origin to this page; ask its document through the
// harness at the END, and record now what the first render resolved to via
// the rendered HTML of the same snippet.
const hash = await (await fetch(document.querySelector('.le-frames iframe')?.src ?? 'about:blank').catch(() => null))?.text?.().catch(() => '') ?? '';
log(`first resolved=${/Lewis \(1969\)/.test(hash)}`);
await ipc.invoke('clew:note-write', { path: 'Note.md', content: '---\ntitle: Note\n---\n# Note\n\n![[Child]]\n\n@bibliography\n' });
await sleep(7000);
log('header-edited');
