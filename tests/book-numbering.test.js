// A book's numbers while writing (src/renderer/editor/live/book-numbering.js,
// docs/dev/book-mode.md §3): the engine's one-document numbering, mirrored
// piece by piece. Parity with the built book is the scenario's to assert
// (smoke/book-parity-scenario.js); these hold the rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numberBook } from '../src/renderer/editor/live/book-numbering.js';
import { numberDocument } from '../src/renderer/editor/live/numbering.js';

const master = (header = '') => ({ path: 'Book.md', text: `---\nbook: true\n${header}chapters:\n  - "[[One]]"\n  - "[[Two]]"\n---\n\nA book.\n` });
const one = { path: 'One.md', text: '---\nstatus: draft\n---\n# One\n\n@begin(figure)[A]{#fig-a}\nx\n@end(figure)\n\n@begin(theorem){#thm-a}\nT\n@end(theorem)\n\n@begin(equation){#eq-a}\na=b\n@end(equation)\n' };
const two = { path: 'Two.md', text: '# Two\n\n@begin(figure)[B]{#fig-b}\ny\n@end(figure)\n\n@begin(lemma){#lem-b}\nL\n@end(lemma)\n' };
const num = (book, key) => book.labels.get(key)?.number;

test('per chapter (the default): every counter restarts at each chapter, as "chapter.n"', () => {
	const book = numberBook({ master: master(), chapters: [one, two] });
	assert.equal(book.perChapter, true);
	assert.deepEqual([num(book, 'fig-a'), num(book, 'thm-a'), num(book, 'eq-a'), num(book, 'fig-b'), num(book, 'lem-b')], ['1.1', '1.1', '1.1', '2.1', '2.1']);
	assert.equal(book.labels.get('fig-b').path, 'Two.md');
	// The line is the CHAPTER file's (its front matter counted).
	assert.equal(book.labels.get('fig-a').line, 6);
	assert.equal(book.pieces.get('One.md').lines.get(6).number, '1.1');
});

test('continuous numbering runs on across the chapters', () => {
	const book = numberBook({ master: master(), chapters: [one, two], numbering: 'continuous' });
	assert.deepEqual([num(book, 'fig-a'), num(book, 'fig-b'), num(book, 'thm-a'), num(book, 'lem-b')], ['1', '2', '1', '2']);
});

test('a chapter with no # heading gets the engine\'s inserted title: it is still a chapter', () => {
	const bare = { path: 'Bare.md', text: '@begin(figure){#fig-bare}\nz\n@end(figure)\n' };
	const book = numberBook({ master: master(), chapters: [one, bare] });
	assert.equal(num(book, 'fig-bare'), '2.1');
});

test('text before a chapter\'s first # heading belongs to the chapter before; {-} starts none', () => {
	const early = { path: 'Early.md', text: '@begin(figure){#fig-early}\nz\n@end(figure)\n\n# Late\n\n@begin(figure){#fig-late}\nw\n@end(figure)\n' };
	const star = { path: 'Star.md', text: '# Prelude {-}\n\n@begin(figure){#fig-star}\nq\n@end(figure)\n' };
	const book = numberBook({ master: master(), chapters: [one, early, star] });
	assert.deepEqual([num(book, 'fig-early'), num(book, 'fig-late'), num(book, 'fig-star')], ['1.2', '2.1', '2.2']);
});

test('the master\'s own # heading comes before chapter 1, and counts', () => {
	const titled = { path: 'Book.md', text: '---\nbook: true\nchapters:\n  - "[[One]]"\n---\n# Preface\n\n@begin(figure){#fig-pre}\np\n@end(figure)\n' };
	const book = numberBook({ master: titled, chapters: [one] });
	assert.deepEqual([num(book, 'fig-pre'), num(book, 'fig-a')], ['1.1', '2.1']);
});

test('numeric headings run across the book, from the MASTER\'s header; a book is class book', () => {
	const ch = { path: 'C.md', text: '---\nHeadings: none\n---\n# Three\n\n## Part @label[sec-p]\n' };
	const book = numberBook({ master: master('Headings: numeric\n'), chapters: [one, two, ch] });
	assert.equal(book.pieces.get('C.md').lines.get(4).number, '3');
	assert.equal(num(book, 'sec-p'), '3.1');
	assert.equal(book.labels.get('sec-p').type, 'section', 'class book: # is a chapter, ## a section');
	assert.equal(book.pieces.get('One.md').lines.get(4).type, 'chapter');
});

test('a label defined in two chapters: the last wins, counted twice', () => {
	const again = { path: 'Again.md', text: '# Again\n\n@begin(figure){#fig-a}\nr\n@end(figure)\n' };
	const book = numberBook({ master: master(), chapters: [one, again] });
	assert.deepEqual([book.labels.get('fig-a').path, num(book, 'fig-a'), book.labels.get('fig-a').count], ['Again.md', '2.1', 2]);
});

test('incremental: an unchanged piece is reused; one edit recounts that chapter and what it hands on', () => {
	const cache = new Map();
	const first = numberBook({ master: master(), chapters: [one, two] }, cache);
	const same = numberBook({ master: master(), chapters: [one, two] }, cache);
	assert.equal(same.pieces.get('One.md'), first.pieces.get('One.md'));
	assert.equal(same.pieces.get('Two.md'), first.pieces.get('Two.md'));
	const edited = { ...one, text: one.text + '\nmore prose\n' };
	const after = numberBook({ master: master(), chapters: [edited, two] }, cache);
	assert.notEqual(after.pieces.get('One.md'), first.pieces.get('One.md'));
	assert.equal(after.pieces.get('Two.md'), first.pieces.get('Two.md'), 'nothing handed on changed');
});

test('a note in no book is numbered exactly as before', () => {
	const alone = numberDocument(one.text);
	assert.equal(alone.labels.get('fig-a').number, '1');
	assert.equal(alone.end, undefined);
});
