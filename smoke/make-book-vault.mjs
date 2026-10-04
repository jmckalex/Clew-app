// Vaults for book-panel-scenario.js (book mode, docs/dev/book-mode.md):
//   node smoke/make-book-vault.mjs <dir>
// <dir>/vault — the demo vault's Books/ (Signals: a master and three
// chapters; its first link given an alias HERE, which a reorder must keep),
// plus Course.md, a second book that shares Conventions and names a chapter
// that does not exist, and Notes/Alone.md, in no book.
// <dir>/plain — a vault with no book (the control: no Book tab, no status
// item), though its Reading Note.md says `book: true` with no `chapters:`. <dir>/ud — a fresh userData.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [dir] = process.argv.slice(2);
if (!dir) throw new Error('usage: node smoke/make-book-vault.mjs <dir>');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.rmSync(dir, { recursive: true, force: true });
const vault = path.join(dir, 'vault');
fs.cpSync(path.join(repo, 'demo-vault', 'Books'), path.join(vault, 'Books'), { recursive: true });
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
fs.writeFileSync(path.join(vault, 'book-case.txt'), 'book\n');
const plain = path.join(dir, 'plain');
fs.mkdirSync(plain, { recursive: true });
fs.writeFileSync(path.join(plain, 'Note.md'), '# A note\n\nNo book here.\n');
// `book: true` with no `chapters:` key — a reading note about a book, not a master.
fs.writeFileSync(path.join(plain, 'Reading Note.md'), '---\nbook: true\nauthor: Jane Austen\n---\n# Emma\n\nNotes on the novel.\n');
fs.writeFileSync(path.join(plain, 'book-case.txt'), 'plain\n');
fs.mkdirSync(path.join(dir, 'ud'), { recursive: true });
console.log(`book fixture: ${vault} and ${plain}`);
