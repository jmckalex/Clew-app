// Vaults for book-panel-scenario.js (book mode, docs/dev/book-mode.md):
//   node smoke/make-book-vault.mjs <dir> [export|trust|numbers|parity|cites]
// <dir>/vault — the demo vault's Books/ and the Features/refs.bib its
// Conventions cites (Signals: a master and three
// chapters; its first link given an alias HERE, which a reorder must keep),
// plus Course.md, a second book that shares Conventions and names a chapter
// that does not exist, and Notes/Alone.md, in no book.
// <dir>/plain — a vault with no book (the control: no Book tab, no status
// item), though its Reading Note.md says `book: true` with no `chapters:`.
// `export` (book-export-scenario.js): Deception.md gains a second # heading
// — the engine warns at that chapter's line — Senders and Receivers opens
// with a blank line (a chapter AFTER such a one was placed a line too high
// until jmarkdown 53e0ade), and book-case.txt says export; Conventions moves
// to Essays/More/ (a chapter in another folder, at the same depth, so its
// `../../Features/refs.bib` still resolves) and it and Deception embed
// Attachments/NASA - Earthrise.jpg — a book's embeds are chapter-relative
// (jmarkdown 283cd30), and no build file names the vault's absolute path.
// `trust` (book-trust-scenario.js): a fourth chapter, Code.md, holds code the
// ENGINE runs (a jmarkdown script block, Math.max/calc/math.sqrt in prose)
// and an inline <script> it passes through; <dir>/ud-trusted lists the vault
// as known (trusted), <dir>/ud a fresh userData (restricted). <dir>/ud — a fresh userData.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [dir, mode = 'book'] = process.argv.slice(2);
if (!dir) throw new Error('usage: node smoke/make-book-vault.mjs <dir>');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.rmSync(dir, { recursive: true, force: true });
const vault = path.join(dir, 'vault');
fs.cpSync(path.join(repo, 'demo-vault', 'Books'), path.join(vault, 'Books'), { recursive: true });
// Conventions cites from the demo vault's Features/refs.bib, as shipped.
fs.mkdirSync(path.join(vault, 'Features'), { recursive: true });
fs.copyFileSync(path.join(repo, 'demo-vault', 'Features', 'refs.bib'), path.join(vault, 'Features', 'refs.bib'));
const master = path.join(vault, 'Books', 'Signals', 'Signals.md');
const text = fs.readFileSync(master, 'utf8');
const aliased = text.replace('  - "[[Senders and Receivers]]"', '  - "[[Senders and Receivers|Ch. 1]]"');
if (aliased === text) throw new Error('Signals.md no longer lists [[Senders and Receivers]] as expected');
fs.writeFileSync(master, aliased);
fs.writeFileSync(path.join(vault, 'Course.md'), `---
book: true
title: Course
chapters:
  - "[[Conventions]]"
  - "[[Missing Chapter]]"
---

A second book, sharing a chapter with Signals.
`);
fs.mkdirSync(path.join(vault, 'Notes'), { recursive: true });
fs.writeFileSync(path.join(vault, 'Notes', 'Alone.md'), '# Alone\n\nA note in no book, until it is added to one.\n');
fs.writeFileSync(path.join(vault, 'book-case.txt'), `${mode}\n`);
if (mode === 'trust') {
	const master = path.join(vault, 'Books', 'Signals', 'Signals.md');
	fs.writeFileSync(master, fs.readFileSync(master, 'utf8').replace('  - "[[Deception]]"\n', '  - "[[Deception]]"\n  - "[[Code]]"\n'));
	fs.writeFileSync(path.join(vault, 'Books', 'Signals', 'Code.md'), `# Code

<script data-type="jmarkdown">
global.output = 'SCRIPT-RAN';
</script>

Prose with Math.max(1, 41) inline and a calc("40+2") call, and a mathjs math.sqrt(16) call.

<script>document.documentElement.dataset.inline = 'INLINE-RAN';</script>
`);
	fs.mkdirSync(path.join(dir, 'ud-trusted'), { recursive: true });
	fs.writeFileSync(path.join(dir, 'ud-trusted', 'clew-settings.json'), JSON.stringify({ recentVaults: [vault] }) + '\n');
}
if (mode === 'export') {
	const first = path.join(vault, 'Books', 'Signals', 'Senders and Receivers.md');
	fs.writeFileSync(first, fs.readFileSync(first, 'utf8').replace(/^(---\n[\s\S]*?\n---\n)/, '$1\n'));
	fs.appendFileSync(path.join(vault, 'Books', 'Signals', 'Deception.md'), '\n# A Second Heading\n\nIn a book this starts a chapter of its own.\n\n![[NASA - Earthrise.jpg|300]]\n');
	fs.mkdirSync(path.join(vault, 'Attachments'), { recursive: true });
	fs.copyFileSync(path.join(repo, 'demo-vault', 'Attachments', 'NASA - Earthrise.jpg'), path.join(vault, 'Attachments', 'NASA - Earthrise.jpg'));
	const essays = path.join(vault, 'Essays', 'More');
	fs.mkdirSync(essays, { recursive: true });
	fs.renameSync(path.join(vault, 'Books', 'Signals', 'Conventions.md'), path.join(essays, 'Conventions.md'));
	fs.appendFileSync(path.join(essays, 'Conventions.md'), '\n![[NASA - Earthrise.jpg]]\n');
}
if (mode === 'numbers') {
	// book-numbers-scenario.js: Conventions (chapter 2) refers to chapter 1's
	// proposition and equation; Notes/Alone.md, in no book, numbers its own.
	fs.appendFileSync(path.join(vault, 'Books', 'Signals', 'Conventions.md'), '\nAs @cref[prop-perfect] showed, and by @ref[eq-chance], a convention can settle.\n');
	fs.writeFileSync(path.join(vault, 'Notes', 'Alone.md'), '# Alone\n\n@begin(figure)[Lone]{#fig-lone}\nx\n@end(figure)\n\nSee @ref[fig-lone].\n');
}
if (mode === 'cites') {
	// book-cites-scenario.js: Signals in a NUMERIC style (vancouver numbers by
	// first citation — in a book, the book's first), chapter 1 citing
	// skyrms1996 and maynardsmith1973 before Conventions cites lewis1969 and
	// skyrms1996; Deception names a bibliography of its own, whose key
	// Conventions cites too (one book, one list — it resolves, with the
	// engine's warning). Alone, Conventions would read [1] [2] and an
	// unknown key.
	const signals = path.join(vault, 'Books', 'Signals');
	const masterPath = path.join(signals, 'Signals.md');
	const master = fs.readFileSync(masterPath, 'utf8');
	if (!master.includes('Bibliography style: chicago')) throw new Error('Signals.md no longer says Bibliography style: chicago');
	fs.writeFileSync(masterPath, master.replace('Bibliography style: chicago', 'Bibliography style: vancouver'));
	fs.appendFileSync(path.join(signals, 'Senders and Receivers.md'), '\nThe dynamics are surveyed by \\cite{skyrms1996}, the evolutionary view by \\cite{maynardsmith1973}.\n');
	fs.appendFileSync(path.join(signals, 'Conventions.md'), '\nCostly signals keep them honest \\cite{zahavi1975}.\n');
	const deception = path.join(signals, 'Deception.md');
	const text = fs.readFileSync(deception, 'utf8');
	fs.writeFileSync(deception, text.startsWith('---\n') ? text.replace('---\n', '---\nBibliography: deception.bib\n') : `---\nBibliography: deception.bib\n---\n${text}`);
	fs.writeFileSync(path.join(signals, 'deception.bib'), `@article{zahavi1975,
  author = {Zahavi, Amotz},
  title = {Mate Selection — A Selection for a Handicap},
  journal = {Journal of Theoretical Biology},
  year = {1975},
  volume = {53},
  pages = {205--214}
}
`);
}
if (mode === 'parity') {
	// book-parity-scenario.js: Books/Parity, whose every label the master
	// refers to (`R <key>: @ref[key] ; @cref[key]`), so the built book prints
	// each number — per chapter, then continuous. Each chapter holds a case
	// the numbering could get wrong: a figure in the master (chapter 0), a
	// chapter with no # heading (the engine inserts one), text before a
	// chapter's first # (the chapter before's), a `{-}` heading (no chapter),
	// a second # in one file (a chapter of its own), subfigures, the shared
	// theorem counter, a label inside a theorem, footnote labels of both
	// kinds, numeric headings, a chapter's own header (ignored).
	const book = path.join(vault, 'Books', 'Parity');
	fs.mkdirSync(book, { recursive: true });
	const chapters = {
		Alpha: `---
status: draft
---
# Alpha @label[ch-alpha]

## Setting @label[sec-setting]

@begin(figure)[A figure]{#fig-a1}
a
@end(figure)

@begin(figure)[With parts]{#fig-a2}
@begin(subfigure)[Left]{#sub-a2l}
l
@end(subfigure)
@begin(subfigure)[Right]{#sub-a2r}
r
@end(subfigure)
@end(figure)

@begin(table)[A table]{#tab-a1}
| x | y |
|---|---|
| 1 | 2 |
@end(table)

@begin(theorem)[Main]{#thm-a1}
T, with a label inside @label[in-thm].
@end(theorem)

@begin(lemma){#lem-a1}
L
@end(lemma)

@begin(equation){#eq-a1}
a = b
@end(equation)

A note[fn: An inline note @label[fn-a].] in prose.

### Deeper @label[sub-deeper]

More prose.
`,
		Beta: `---
title: Beta Title
---
Opening prose, under the title the engine inserts.

@begin(proposition){#prop-b1}
P
@end(proposition)

## A section @label[sec-beta]

@begin(figure){#fig-b1}
b
@end(figure)

@begin(listing)[Code]{#lst-b1}
\`\`\`js
const x = 1;
\`\`\`
@end(listing)
`,
		Gamma: `@begin(figure){#fig-g0}
before the title: still the chapter before
@end(figure)

# Gamma

@begin(figure){#fig-g1}
g
@end(figure)

# Interlude {-}

@begin(figure){#fig-g2}
after an unnumbered heading
@end(figure)

@begin(corollary){#cor-g1}
C
@end(corollary)

# Gamma Two @label[ch-gamma-two]

@begin(equation){#eq-g1}
x
@end(equation)

@begin(table){#tab-g1}
| a |
|---|
| b |
@end(table)
`,
		Delta: `---
Headings: none
---
# Delta

A classic note[^d] here.

[^d]: A classic note @label[fn-d].

@begin(definition){#def-d1}
D
@end(definition)

@begin(example)
unlabelled, still counted
@end(example)

@begin(remark){#rem-d1}
R
@end(remark)

:::figure[In colons]{#fig-d1}
d
:::

@begin(equation){#eq-d1}
y
@end(equation)

$$
z
$$

## Last @label[sec-last]
`,
	};
	for (const [name, text] of Object.entries(chapters)) fs.writeFileSync(path.join(book, `${name}.md`), text);
	const keys = ['fig-master', ...Object.values(chapters).flatMap((t) => [...t.matchAll(/\{#([\w-]+)\}|@label\[([\w-]+)\]/g)].map((m) => m[1] ?? m[2]))];
	fs.writeFileSync(path.join(book, 'Parity.md'), `---
book: true
title: Parity
numbering: per chapter
Headings: numeric
chapters:
${Object.keys(chapters).map((n) => `  - "[[${n}]]"`).join('\n')}
---

A book whose master refers to every label it holds.

@begin(figure)[Before any chapter]{#fig-master}
m
@end(figure)

${keys.map((k) => `- R ${k}: @ref[${k}] ; @cref[${k}]`).join('\n')}
`);
}
const plain = path.join(dir, 'plain');
fs.mkdirSync(plain, { recursive: true });
fs.writeFileSync(path.join(plain, 'Note.md'), '# A note\n\nNo book here.\n');
// `book: true` with no `chapters:` key — a reading note about a book, not a master.
fs.writeFileSync(path.join(plain, 'Reading Note.md'), '---\nbook: true\nauthor: Jane Austen\n---\n# Emma\n\nNotes on the novel.\n');
fs.writeFileSync(path.join(plain, 'book-case.txt'), 'plain\n');
fs.mkdirSync(path.join(dir, 'ud'), { recursive: true });
console.log(`book fixture: ${vault} and ${plain}`);
