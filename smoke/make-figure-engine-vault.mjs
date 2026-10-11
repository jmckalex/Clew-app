#!/usr/bin/env node
// The fixture of smoke/figure-engine-compare.sh — what an owner's exports look
// like under each value of `exportFigureEngine` (external: the installed TeX
// tools; auto: mp-tikz-wasm, the tools for what it cannot draw):
//
//   node smoke/make-figure-engine-vault.mjs <dir>
//
//   <dir>/vault                       a copy of demo-vault/ without .clew/
//   <dir>/vault/Figures.md            make-figures-vault.mjs's note: every
//                                     syntax that reaches mp-tikz-wasm, the
//                                     engine's own forms among them
//   <dir>/vault/Books/Signals/Conventions.md
//                                     ends with a TikZ picture and a MetaPost
//                                     figure in the engine's forms (the book
//                                     has none as shipped), each with text, so
//                                     a book build draws figures too
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [dir] = process.argv.slice(2);
if (!dir) {
	console.error('usage: node smoke/make-figure-engine-vault.mjs <dir>');
	process.exit(2);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir);
const vault = path.join(root, 'vault');
fs.rmSync(root, { recursive: true, force: true });
fs.cpSync(path.join(here, '..', 'demo-vault'), vault, {
	recursive: true,
	filter: (src) => path.basename(src) !== '.clew',
});
const figures = path.join(root, 'figures');
execFileSync(process.execPath, [path.join(here, 'make-figures-vault.mjs'), figures], { stdio: 'ignore' });
fs.copyFileSync(path.join(figures, 'Figures.md'), path.join(vault, 'Figures.md'));
fs.appendFileSync(path.join(vault, 'Books', 'Signals', 'Conventions.md'), `

@begin(TiKZ)
\\draw[->] (0,0) -- (3,1) node[right] {a signal $s_1$};
\\draw (0,0) circle (0.5) node {S};
@end(TiKZ)

@begin(metapost)
beginfig(1);
draw fullcircle scaled 2cm;
label(btex $p(s_1)$ etex, origin);
endfig;
@end(metapost)
`);
console.log(`figure-engine vault: ${vault}`);
