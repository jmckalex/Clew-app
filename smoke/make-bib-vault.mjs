// A vault for bib-additive-scenario.js: `node smoke/make-bib-vault.mjs <dir>`.
// The engine's additive Bibliography (jmarkdown 909af7a/e7cf638): a note's
// `Bibliography:` ADDS to the configured one (here the vault's,
// Library/vault.bib), the note's entry winning a key both hold, unless
// `Bibliography mode: replace`.
//
//   Library/vault.bib   vaultonly:2001, shared:1999 ("Vault Title")
//   Notes/local.bib     localonly:2002, shared:1999 ("Note Title")
//   Notes/Paper.md      Bibliography: local.bib — cites all three
//   Notes/Replace.md    the same, `Bibliography mode: replace`
//   Notes/List.md       Bibliography as a YAML list over two lines
//   Notes/Split.md      Bibliography: local2.bib, ../Library/vault2.bib —
//                       DISJOINT keys in two folders, so LaTeX names both
//                       by basename and bibtex must find Library/ (BIBINPUTS)
//   Notes/Merge.md      Bibliography: local.bib, ../Library/vault.bib — a key
//                       in BOTH, so a LaTeX export names one merged file
//   Notes/Cites.md      no header: the vault's bibliography alone
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node smoke/make-bib-vault.mjs <dir>');
fs.rmSync(dir, { recursive: true, force: true });
const put = (rel, text) => {
	fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
	fs.writeFileSync(path.join(dir, rel), text);
};
const entry = (key, author, title, year) => `@book{${key},\n  author = {${author}},\n  title = {${title}},\n  year = {${year}},\n  publisher = {Press}\n}\n`;

put('Library/vault.bib', entry('vaultonly:2001', 'Vault, Ada', 'Only In The Vault', '2001') + '\n' + entry('shared:1999', 'Shared, Sam', 'Vault Title', '1999'));
put('Notes/local.bib', entry('localonly:2002', 'Local, Lee', 'Only In The Note', '2002') + '\n' + entry('shared:1999', 'Shared, Sam', 'Note Title', '1999'));
put('Library/vault2.bib', entry('far:2003', 'Far, Fay', 'In Another Folder', '2003'));
put('Notes/local2.bib', entry('near:2004', 'Near, Ned', 'Beside The Note', '2004'));

const body = 'Vault \\cite{vaultonly:2001}, note \\cite{localonly:2002}, both \\cite{shared:1999}.\n\n@bibliography\n';
put('Notes/Paper.md', `---\nBibliography: local.bib\nResolve citations: true\n---\n# Paper\n\n${body}`);
put('Notes/Replace.md', `---\nBibliography: local.bib\nBibliography mode: replace\nResolve citations: true\n---\n# Replace\n\n${body}`);
put('Notes/List.md', `---\nBibliography:\n  - local.bib\n  - ../Library/vault2.bib\nResolve citations: true\n---\n# List\n\nNote \\cite{localonly:2002}, far \\cite{far:2003}.\n\n@bibliography\n`);
put('Notes/Split.md', `---\nBibliography: local2.bib, ../Library/vault2.bib\nResolve citations: true\n---\n# Split\n\nNear \\cite{near:2004}, far \\cite{far:2003}.\n\n@bibliography\n`);
put('Notes/Merge.md', `---\nBibliography: local.bib, ../Library/vault.bib\nResolve citations: true\n---\n# Merge\n\nShared \\cite{shared:1999}, vault \\cite{vaultonly:2001}, note \\cite{localonly:2002}.\n\n@bibliography\n`);
put('Notes/Cites.md', `---\nResolve citations: true\n---\n# Cites\n\nThe vault's alone: \\cite{vaultonly:2001}.\n\n@bibliography\n`);
put('Welcome.md', '# Welcome\n');
fs.mkdirSync(path.join(dir, '.clew'), { recursive: true });
fs.writeFileSync(path.join(dir, '.clew', 'vault-settings.json'), JSON.stringify({ bibliography: 'Library/vault.bib' }, null, '\t'));
