// Vaults for book-panel-scenario.js (book mode, docs/dev/book-mode.md):
//   node smoke/make-book-vault.mjs <dir> [export|trust]
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
const plain = path.join(dir, 'plain');
fs.mkdirSync(plain, { recursive: true });
fs.writeFileSync(path.join(plain, 'Note.md'), '# A note\n\nNo book here.\n');
// `book: true` with no `chapters:` key — a reading note about a book, not a master.
fs.writeFileSync(path.join(plain, 'Reading Note.md'), '---\nbook: true\nauthor: Jane Austen\n---\n# Emma\n\nNotes on the novel.\n');
fs.writeFileSync(path.join(plain, 'book-case.txt'), 'plain\n');
fs.mkdirSync(path.join(dir, 'ud'), { recursive: true });
console.log(`book fixture: ${vault} and ${plain}`);
