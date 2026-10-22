// A vault for tex-missing-scenario.js: `node smoke/make-tex-missing-vault.mjs <dir>`.
// <dir>/vault — Missing.md names an image by a full path that is not there and
// embeds one the vault does not hold; Cut.md (pdfLaTeX) a path of accented
// letters that pdfTeX's log breaks inside; Clean.md names none; Book.md is a book
// whose one chapter, Chapter.md, names a missing image too. <dir>/ud lists the
// vault as known (trusted: a restricted vault makes no PDF via LaTeX); run with
// HOME=<dir>/home, empty.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node smoke/make-tex-missing-vault.mjs <dir>');
fs.rmSync(dir, { recursive: true, force: true });
const vault = path.join(dir, 'vault');
const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(vault, rel)), { recursive: true }); fs.writeFileSync(path.join(vault, rel), text); };
put('Missing.md', '# Missing\n\nBefore.\n\n![A picture](/nonexistent/clew-smoke/picture.png)\n\n![[gone-from-the-vault.png]]\n\nAfter.\n');
put('Clean.md', '# Clean\n\nNothing to find.\n');
// pdfLaTeX (forced by the header), whose log breaks inside a letter of this
// path on both lines that name it: read only if compilePdf reads the log as bytes.
put('Cut.md', `---\nLaTeX engine: pdflatex\n---\n# Cut\n\n![Cut](/Users/me/${'é'.repeat(120)}.png)\n`);
put('Book.md', '---\nbook: true\ntitle: Book\nchapters:\n  - "[[Chapter]]"\n---\n');
put('Chapter.md', '# Chapter\n\n![In a chapter](/nonexistent/clew-smoke/chapter.png)\n\nText.\n');
// An empty HOME for the run: the user's own ~/.jmarkdown would otherwise decide
// the engine (a global fontspec preamble takes LuaLaTeX, which never cuts a letter).
fs.mkdirSync(path.join(dir, 'home'), { recursive: true });
fs.mkdirSync(path.join(dir, 'ud'), { recursive: true });
fs.writeFileSync(path.join(dir, 'ud', 'clew-settings.json'), JSON.stringify({ recentVaults: [vault] }) + '\n');
