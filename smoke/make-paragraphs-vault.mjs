// A vault for paragraphs-scenario.js: `node smoke/make-paragraphs-vault.mjs <dir>`.
// Paras.md has a paragraph after a heading, one after another, a quote set
// apart by blank lines, a paragraph after it, a list, a paragraph after that,
// and a displayed equation inside a sentence. Generic words only.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: make-paragraphs-vault.mjs <dir>'); process.exit(1); }
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'Paras.md'), `# Paragraphs

First after the heading. It runs on for a while so that it wraps onto a second line in reading view, which is where an indent would show.

Second paragraph, after the first. In the book style it is indented and has no space above it.

> A quoted sentence, set apart by blank lines.

After the quote, a blank line between them.

- a list item
- another list item

After the list.

Before a displayed equation:
$$
x^2 + 1
$$
and the sentence goes on after it.

Last paragraph, after the one with the equation.
`);
