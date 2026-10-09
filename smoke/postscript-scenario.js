// PostScript in figures (mp-tikz-wasm 0.4.0's Ghostscript, an opt-in bundle
// and a module of its own; preview-client/figures.js asks for `+ghostscript`
// whenever the staged build carries both). Pair with postscript-frame.js:
//   node smoke/make-figures-vault.mjs <dir>
//   CLEW_SMOKE_VAULT=<dir> CLEW_USER_DATA=<fresh> CLEW_SMOKE_LOG=1
//   CLEW_SMOKE_FRAME_SCRIPT=smoke/postscript-frame.js
//   CLEW_SMOKE_FRAME_MATCH=<the note's name, e.g. PostScript.md>
// The note is PostScript.md unless `figure-note.txt` in the vault names
// another (Families.md: a supplied face by family name). A FRESH profile, or
// the result cache answers for the engine.
//
// Expect, for PostScript.md on a build with Ghostscript: every figure
// `state=mpw-ok`; PSTricks `colours` with red and blue, the EPS box its
// green, the turned text `rotated=true`; the TikZ control as before; and
// `smoke-asset: mptikz/ghostscript/gs.wasm` in the run's log — while a run of
// figures-scenario.js (no PostScript anywhere) logs no ghostscript/ asset.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const named = await ipc.invoke('clew:note-read', { path: 'figure-note.txt' }).then((r) => String(r?.content ?? r ?? '').trim()).catch(() => '');
const note = named || 'PostScript.md';
workspaceStore.openNote(note, { defaultMode: 'reading' });
console.log(`smoke-ps: note=${note}`);
window.__clewSmokeInput = [{ wait: 45000 }];
