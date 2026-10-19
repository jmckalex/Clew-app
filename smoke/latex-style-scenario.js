// Clew's LaTeX export style (src/engine/latex-style.js) through the app's own
// export: the open vault's `Styled.md` exported as LaTeX and as a PDF via
// LaTeX (EXPORT_NOTE), under whatever ~/.jmarkdown the machine has — the
// owner's sets Optima, which the style's EB Garamond must follow. The vault
// must be TRUSTED (a PDF via LaTeX is refused otherwise): list it under
// `recentVaults` in CLEW_USER_DATA's clew-settings.json. Copy any note to
// `Styled.md` first (the owner's comments note was the measure, 2026-10-19).
// Logs (smoke-latex-style:):
//   tex class=<\documentclass line> geometry=<true> garamond-after-user=<true|no user font>
//       smart-quotes=<no straight " left in the body> polyglossia=<variant>
//   pdf output=<vault path> | refused/error=<…>
// The PDF's fonts and paper are checked from outside (pdffonts, pdfinfo).
const { ipc, vaultStore } = window.__clew;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => console.log('smoke-latex-style: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);

const tex = await ipc.invoke('clew:export-note', { path: 'Styled.md', format: 'latex', outFile: 'out/Styled.tex' });
const read = await ipc.invoke('clew:note-read', { path: 'out/Styled.tex' });
const text = String(read?.content ?? read ?? '');
const preamble = text.slice(0, text.indexOf('\\begin{document}'));
const body = text.slice(text.indexOf('\\begin{document}'));
const user = preamble.search(/\\setmainfont\{(?!EBGaramond)/);
const garamond = preamble.indexOf('\\setmainfont{EBGaramond}');
log(`tex output=${tex?.outputRel ?? tex?.output ?? tex?.error} class=${JSON.stringify(preamble.split('\n')[0])}`
	+ ` geometry=${/\{geometry\}/.test(preamble)} garamond-after-user=${user < 0 ? 'no user font' : garamond > user}`
	+ ` smart-quotes=${!/(^|[\s(])"\w/m.test(body)} polyglossia=${/variant=(\w+)/.exec(preamble)?.[1] ?? 'none'}`);
const pdf = await ipc.invoke('clew:export-note', { path: 'Styled.md', format: 'pdf', outFile: 'out/Styled.pdf' });
log(`pdf output=${pdf?.outputRel ?? pdf?.output ?? ''} refused=${pdf?.refused ?? ''} error=${pdf?.error ?? ''}`);
log('done');
