#!/usr/bin/env node
// The fixture of smoke/export-figures-scenario.js — what draws an export's TikZ
// and MetaPost (jmarkdown 21dee42; export-cache.js#figureEngineOptions):
//
//   node smoke/make-export-figures-vault.mjs <dir>
//
//   <dir>/vault/Figures/Engine.md   a TikZ picture and a MetaPost figure, the
//                                   engine's own forms (@begin(TiKZ), @begin(metapost))
//   <dir>/vault/Figures/Probe.md    a TikZ node that \input's <dir>/outside.txt —
//                                   a file OUTSIDE the vault: the installed
//                                   lualatex draws its word, the library's TeX
//                                   cannot see it
//   <dir>/vault/Figures/Times.md    Times New Roman, bold — a family whose faces
//                                   are separate files, which the engine's
//                                   file-name lookup finds only the regular of
//   <dir>/vault/Pkg/Package.md      \SI{3}{\metre}, siunitx loaded by the folder's
//                                   own .jmarkdown/config.json (read only by a
//                                   TRUSTED vault's export, whose cwd is the
//                                   note's folder) — a package the library lacks
//   <dir>/outside.txt               PROBEWORD
//   <dir>/nodist/                   an empty folder: CLEW_MPTIKZ_DIR=<dir>/nodist
//                                   is a library that will not load
import fs from 'node:fs';
import path from 'node:path';

const [dir] = process.argv.slice(2);
if (!dir) {
	console.error('usage: node smoke/make-export-figures-vault.mjs <dir>');
	process.exit(2);
}
const root = path.resolve(dir);
fs.rmSync(root, { recursive: true, force: true });
const vault = path.join(root, 'vault');
const write = (rel, text) => {
	const file = path.join(vault, rel);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, text);
};
fs.mkdirSync(path.join(root, 'nodist'), { recursive: true });
fs.writeFileSync(path.join(root, 'outside.txt'), 'PROBEWORD\n');

write('Figures/Engine.md', `# Engine

@begin(TiKZ)
\\draw[->] (0,0) -- (2,1) node[right] {A label};
\\draw (0,0) circle (0.6);
@end(TiKZ)

@begin(metapost)
beginfig(1);
draw fullcircle scaled 2cm;
label(btex $y_1$ etex, origin);
endfig;
@end(metapost)
`);
write('Figures/Probe.md', `# Probe

@begin(TiKZ)
\\node[draw] at (0,0) {\\input{${path.join(root, 'outside.txt')}}};
@end(TiKZ)
`);
write('Figures/Times.md', `# Times

@begin(TiKZ)
\\node[draw] at (0,0) {\\fontspec{Times New Roman}Regular \\textbf{Bold}};
@end(TiKZ)
`);
write('Pkg/.jmarkdown/config.json', `${JSON.stringify({ 'LaTeX preamble': ['\\usepackage{siunitx}'] }, null, '\t')}\n`);
write('Pkg/Package.md', `# Package

@begin(TiKZ)
\\node[draw] at (0,0) {\\SI{3}{\\metre}};
@end(TiKZ)
`);
console.log(`export-figures vault: ${vault}`);
