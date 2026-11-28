// A vault for spellcheck-scenario.js: `node smoke/make-spell-vault.mjs <dir>`.
// Spell.md holds one misspelt word in prose and misspelt words in what is
// not prose — a code span, maths, a wikilink's target, a citation key — each
// on a line of its own, so a right-click lands on one thing; and a table, for
// the live-edit cell editor. Generic words only.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: make-spell-vault.mjs <dir>'); process.exit(1); }
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'Spell.md'), `# Spell

A misspelt wrod in prose.

Some \`inlnecode\` here.

Maths $\\betta$ here.

A link [[Notte tagret]] here.

A cite \\cite{Smithh} here.

| Name | Note |
| ---- | ---- |
| one  | celll text |

Last.
`);
