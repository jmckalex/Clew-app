// A vault for citations-scenario.js: `node smoke/make-citations-vault.mjs <dir>`.
// refs.bib holds three entries — one with a `file` field pointing at a PDF in
// the vault, one with a DOI, one plain — cited by three notes in different
// commands, one of them only in pandoc's form.
import { mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: make-citations-vault.mjs <dir>'); process.exit(1); }
rmSync(dir, { recursive: true, force: true });
mkdirSync(join(dir, 'Papers'), { recursive: true });
copyFileSync(new URL('../demo-vault/Attachments/sample.pdf', import.meta.url), join(dir, 'Papers', 'alexander.pdf'));
writeFileSync(join(dir, 'refs.bib'), `@book{alexander2023,
  author = {Alexander, J. McKenzie},
  title = {The Structural Evolution of Morality},
  year = {2023},
  file = {:Papers/alexander.pdf:PDF}
}

@book{knuth1984,
  author = {Knuth, Donald E.},
  title = {The TeXbook},
  year = {1984},
  doi = {10.5555/1102013}
}

@article{lamport1994,
  author = {Lamport, Leslie},
  title = {LaTeX: A Document Preparation System},
  year = {1994}
}
`);
writeFileSync(join(dir, 'A.md'), `# A

Morality evolves \\cite{alexander2023}, as \\citep{knuth1984} typesets.

Last line.
`);
writeFileSync(join(dir, 'B.md'), '# B\n\nAgain \\citet{alexander2023}.\n');
writeFileSync(join(dir, 'C.md'), '# C\n\nOnly pandoc knows [@lamport1994].\n');
