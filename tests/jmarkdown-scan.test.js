// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * @file Tests for the JMarkdown dialect scanner — the port of the
 * JMarkdown.sublime-syntax state machine.
 *
 * Ported from the jmacs project (`packages/renderer/test/
 * jmarkdown-scan.test.js`, GPL-3.0-or-later, same author), with the
 * `[[file]]` inclusion-line test replaced by wikilink behaviour and a
 * new section for Clew's Obsidian passes (wikilinks, tags) and the
 * `jmd-math` face.
 */

import { test } from 'node:test';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

import { scanJmarkdown } from '../src/renderer/editor/jmd/jmarkdown-scan.js';

/** The innermost face painted at `pos`, or null. */
function faceAt(captures, pos) {
	let best = null;
	for (const c of captures) {
		if (c.start <= pos && pos < c.end) {
			if (!best || c.end - c.start < best.end - best.start) best = c;
		}
	}
	return best ? best.face : null;
}

/** The innermost face at the first occurrence of `frag`. */
function faceOf(scan, text, frag, skip = 0) {
	let at = -1;
	for (let n = 0; n <= skip; n += 1) at = text.indexOf(frag, at + 1);
	assert.notEqual(at, -1, `fragment ${JSON.stringify(frag)} not found`);
	return faceAt(scan.captures, at);
}

/** True when some owned region covers `pos`. */
function owned(scan, text, frag) {
	const at = text.indexOf(frag);
	assert.notEqual(at, -1);
	return scan.regions.some((r) => r.start <= at && at < r.end);
}

test('empty input scans to nothing', () => {
	const scan = scanJmarkdown('');
	assert.deepEqual(scan, { captures: [], regions: [], folds: [], injections: [], constructs: [] });
});

/* ── metadata header ─────────────────────────────────────────────────── */

test('fenced metadata header: bold keys, owned lines, fences', () => {
	const text = '---\nTitle: My Book\nBibliography style: harvard1\n---\n\n# Heading\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, '---'), 'jmd-meta-fence');
	assert.equal(faceOf(scan, text, 'Title'), 'jmd-meta-key');
	assert.equal(faceOf(scan, text, 'Bibliography style'), 'jmd-meta-key');
	// The value is not captured, but the line is owned (no grammar bleed).
	assert.equal(faceOf(scan, text, 'My Book'), null);
	assert.ok(owned(scan, text, 'My Book'));
	// The body is not owned.
	assert.ok(!owned(scan, text, '# Heading'));
});

test('legacy header (no opening fence) is detected from the first line', () => {
	const text = 'Title: Notes\nDate: today\n---\nProse.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'Title'), 'jmd-meta-key');
	assert.equal(faceOf(scan, text, 'Date'), 'jmd-meta-key');
	assert.ok(!owned(scan, text, 'Prose.'));
});

test('a document with no header starts scanning at line one', () => {
	const text = '# Just markdown\n\nWith /italics/ here.\n';
	const scan = scanJmarkdown(text);
	assert.ok(!owned(scan, text, '# Just markdown'));
	assert.equal(faceOf(scan, text, 'italics'), 'jmd-italic');
});

test('Extension key: regex spec values get their faces', () => {
	const text = 'Extension smiley: /:-\\)/ /:-\\)/ true 0\n---\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'Extension smiley'), 'jmd-meta-key');
	assert.equal(faceOf(scan, text, '/:-\\)/'), 'jmd-meta-regex');
	assert.equal(faceOf(scan, text, 'true'), 'jmd-meta-bool');
	assert.equal(faceAt(scan.captures, text.indexOf(' 0') + 1), 'jmd-meta-number');
});

test('Extension key: delimiter spec and indented HTML body injection', () => {
	const text =
		'Extension box: <<< >>> [true, false] 2\n' +
		'    <div class="box">\n' +
		'    </div>\n' +
		'---\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, '<<<'), 'jmd-meta-delim');
	assert.equal(faceOf(scan, text, '[true, false]'), 'jmd-meta-bool');
	const html = scan.injections.find((i) => i.language === 'html');
	assert.ok(html, 'an html injection for the indented body');
	assert.ok(text.slice(html.start, html.end).includes('<div class="box">'));
	// The body is not owned (the injection must show through).
	assert.ok(!owned(scan, text, '<div'));
});

test('Custom element key: the element name face', () => {
	const text = 'Custom element: my-element\n---\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'Custom element'), 'jmd-meta-key');
	assert.equal(faceOf(scan, text, 'my-element'), 'jmd-meta-element');
});

/* ── block directives ────────────────────────────────────────────────── */

test('block directive: punctuation, name, attributes, fold, owned lines', () => {
	const text = 'Intro.\n\n:::note[A title]{.fancy #n1 author="me"}\nBody text.\n:::\n\nAfter.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, ':::'), 'jmd-directive-punct');
	assert.equal(faceOf(scan, text, 'note'), 'jmd-directive-name');
	assert.equal(faceOf(scan, text, 'A title'), 'jmd-directive-bracket');
	assert.equal(faceOf(scan, text, 'fancy'), 'jmd-attr-class');
	assert.equal(faceOf(scan, text, 'n1'), 'jmd-attr-id');
	assert.equal(faceOf(scan, text, 'author'), 'jmd-attr-name');
	assert.equal(faceOf(scan, text, '"me"'), 'jmd-string');
	// Opener and closer lines are owned; the body is not.
	assert.ok(owned(scan, text, ':::note'));
	assert.ok(!owned(scan, text, 'Body text.'));
	// One fold spanning opener to closer.
	assert.equal(scan.folds.length, 1);
	assert.equal(scan.folds[0].start, text.indexOf(':::note'));
});

test('nested directives fold by colon count', () => {
	const text = '::::aside\nOuter.\n:::note\nInner.\n:::\n::::\n';
	const scan = scanJmarkdown(text);
	assert.equal(scan.folds.length, 2);
	const sorted = scan.folds.slice().sort((a, b) => a.start - b.start);
	assert.equal(sorted[0].start, text.indexOf('::::aside'));
	assert.equal(sorted[1].start, text.indexOf(':::note'));
	assert.ok(sorted[0].end > sorted[1].end);
});

test(':::TiKZ bodies inject latex; :::mermaid bodies get mermaid captures', () => {
	const text =
		':::TiKZ\n\\draw (0,0) -- (1,1);\n:::\n\n' +
		':::mermaid\ngraph LR\nA --> B\n:::\n';
	const scan = scanJmarkdown(text);
	const latex = scan.injections.find((i) => i.language === 'latex');
	assert.ok(latex);
	assert.ok(text.slice(latex.start, latex.end).includes('\\draw'));
	assert.equal(faceOf(scan, text, 'graph'), 'keyword');
	assert.equal(faceOf(scan, text, '-->'), 'operator');
	assert.ok(owned(scan, text, 'graph LR'), 'mermaid body is owned');
	assert.equal(scan.folds.length, 2);
});

test('an unclosed :::TiKZ body runs to end of file, like the Sublime context', () => {
	const text = ':::TiKZ\n\\draw (0,0);\nstill latex\n';
	const scan = scanJmarkdown(text);
	const latex = scan.injections.find((i) => i.language === 'latex');
	assert.ok(latex);
	assert.equal(latex.end, text.length);
	assert.equal(scan.folds.length, 0);
});

/* ── @begin/@end environments ────────────────────────────────────────── */

test('@begin/@end: keyword, parens, name zones and a fold', () => {
	const text = '@begin(theorem)[Euclid]{.numbered}\nThere are infinitely many primes.\n@end(theorem)\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, '@begin'), 'jmd-env-keyword');
	assert.equal(faceOf(scan, text, 'theorem'), 'jmd-env-name');
	assert.equal(faceOf(scan, text, 'Euclid'), 'jmd-directive-bracket');
	assert.equal(faceOf(scan, text, 'numbered'), 'jmd-attr-class');
	assert.equal(faceOf(scan, text, '@end'), 'jmd-env-keyword');
	assert.equal(faceOf(scan, text, 'theorem', 1), 'jmd-env-name');
	// Markdown body is neither owned nor blanked.
	assert.ok(!owned(scan, text, 'infinitely'));
	assert.equal(scan.folds.length, 1);
	// A block fold: collapsing keeps both @begin and @end lines (a vertical
	// ellipsis between them), rather than swallowing the closing line.
	assert.equal(scan.folds[0].block, true);
});

test('@begin(equation*) bodies inject latex', () => {
	const text = '@begin(equation*)\nE = mc^2\n@end(equation*)\n';
	const scan = scanJmarkdown(text);
	const latex = scan.injections.find((i) => i.language === 'latex');
	assert.ok(latex);
	assert.ok(text.slice(latex.start, latex.end).includes('E = mc^2'));
	assert.equal(scan.folds.length, 1);
});

test('@begin(mermaid) bodies get mermaid captures', () => {
	const text = '@begin(mermaid)\nsequenceDiagram\n@end(mermaid)\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'sequenceDiagram'), 'keyword');
});

test('name sigils .name and <name> stay generic environments', () => {
	const text = '@begin(.TeX)\nThis is a CLASS, not LaTeX.\n@end(TeX)\n';
	const scan = scanJmarkdown(text);
	assert.equal(scan.injections.filter((i) => i.language === 'latex').length, 0);
	assert.equal(faceOf(scan, text, 'TeX'), 'jmd-env-name');
});

test('@begin/@end environments nest on a stack', () => {
	const text = '@begin(a)\n@begin(b)\nx\n@end(b)\n@end(a)\n';
	const scan = scanJmarkdown(text);
	assert.equal(scan.folds.length, 2);
	const sorted = scan.folds.slice().sort((a, b) => a.start - b.start);
	assert.ok(sorted[0].end > sorted[1].end, 'outer fold wraps inner');
});

/* ── inline constructs ───────────────────────────────────────────────── */

test('mustache variables', () => {
	const text = 'Hello {{name}}, welcome.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'name'), 'jmd-mustache');
	assert.equal(faceOf(scan, text, '{{'), 'jmd-punct');
});

test('inline directives with content and attributes', () => {
	const text = 'See :ref[sec-intro] and :TeX[\\noindent]{.x} here.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'ref'), 'jmd-directive-name');
	assert.equal(faceOf(scan, text, 'sec-intro'), 'jmd-directive-bracket');
	assert.equal(faceOf(scan, text, 'TeX'), 'jmd-directive-name');
	assert.ok(owned(scan, text, 'sec-intro'), 'bracket content owned (no link mis-parse)');
});

test('prose colons, times, ratios, and URLs never match as directives', () => {
	const text = 'At 3:30 the ratio a:b appeared: see http://example.com now.\n';
	const scan = scanJmarkdown(text);
	assert.equal(scan.captures.filter((c) => c.face === 'jmd-directive-punct').length, 0);
});

test('==highlight== spans are owned and faced', () => {
	const text = 'This is ==really important== text.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'really important'), 'jmd-highlight');
	assert.ok(owned(scan, text, 'really important'));
});

test('an unclosed ==highlight ends at the blank line', () => {
	const text = 'Some ==half typed\nspan here\n\nNext paragraph.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'half typed'), 'jmd-highlight');
	assert.equal(faceOf(scan, text, 'span here'), 'jmd-highlight');
	assert.equal(faceOf(scan, text, 'Next paragraph.'), null);
});

test('/italic/ spans: two on a line', () => {
	const text = 'Some /italic words/, then /more/.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'italic words'), 'jmd-italic');
	assert.equal(faceOf(scan, text, 'more'), 'jmd-italic');
});

// Italics follow the ENGINE (owner's rule, 2026-09-27): its tokenizer is a
// bare regex tried at every slash the lexer reaches, so a slash inside a word
// italicises too, and `\/` is the author's way out. These expectations are
// the engine's own output (syntax-modifications.js, via marked); the parity
// test below re-derives them where the engine master is installed.
const ENGINE_ITALICS = [
	['Look in /usr/bin and /etc/hosts for it.', ['usr', 'etc']],
	['Either and/or/not will do.', ['or']],
	['Buy 1/2 or 3/4 of it.', ['2 or 3']],
	['Escaped \\/usr\\/bin is a path.', []],
	// The body stops at the next slash, escaped or not.
	['An /italic with \\/escaped\\/ slashes/ here.', ['italic with \\']],
	['In strong */both/* and (/aside/) and "/quoted/" and _/under/_.', ['both', 'aside', 'quoted', 'under']],
	['A link [text](http://a.com/b/c) and /this/.', ['this']],
	['A URL https://a.com/b/c here and /that/.', ['b', 'that']],
	['Tag <b>x</b> and <http://a/b/c> ok.', []],
	['/Hello, world./ and /e.g. this/ and /why?/ yes.', ['Hello, world.', ' and ']],
	['Across\nlines /a\nb/ ok.', ['a\nb']],
	['Para /a\n\nb/ no.', []],
	['Double // slash.', []],
	['Text [a/b/c](dest) here.', ['b']],
];
const italicBodies = (text) => scanJmarkdown(text).constructs
	.filter((c) => c.kind === 'italic').map((c) => text.slice(c.body.start, c.body.end));

test('italics: the engine\'s rule, case by case', () => {
	for (const [text, want] of ENGINE_ITALICS) assert.deepEqual(italicBodies(text), want, text);
});

const MARKED = path.join(process.env.JMARKDOWN_SRC
	?? path.join(os.homedir(), 'Sites', 'jmckalex', 'software', 'jmarkdown'),
'node_modules', 'marked', 'lib', 'marked.esm.js');

test('italics: parity with the engine\'s own tokenizer', { skip: !existsSync(MARKED) && 'the engine master (and its marked) is not on this machine' }, async () => {
	const { Marked } = await import(pathToFileURL(MARKED).href);
	const { italics, strong } = await import('../vendor/jmarkdown/src/syntax-modifications.js');
	globalThis.global ??= globalThis;
	const marked = new Marked();
	marked.use({ extensions: [italics, strong] });
	for (const [text] of ENGINE_ITALICS) {
		const engine = [];
		marked.walkTokens(marked.lexer(text), (t) => { if (t.type === 'italics') engine.push(t.text); });
		assert.deepEqual(italicBodies(text), engine, text);
	}
});

test('citations: command, pre/post notes, keys', () => {
	const text = 'As shown \\citep[see][p. 7]{smith2020} and \\cite{a, b}.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, '\\citep'), 'jmd-cite');
	assert.equal(faceOf(scan, text, 'see'), 'jmd-string');
	assert.equal(faceOf(scan, text, 'smith2020'), 'jmd-cite-key');
	assert.equal(faceOf(scan, text, 'a, b'), 'jmd-cite-key');
});

test('inline footnotes: labelled and anonymous, opener, body and closer', () => {
	const text = 'A claim.[^note1: The evidence.] And more.[fn: Anonymous.]\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, '[^note1:'), 'jmd-footnote');
	assert.equal(faceOf(scan, text, '[fn:'), 'jmd-footnote');
	assert.equal(faceOf(scan, text, 'The evidence.'), 'jmd-footnote-body');
	assert.equal(faceOf(scan, text, 'Anonymous.'), 'jmd-footnote-body');
	assert.equal(faceOf(scan, text, ']'), 'jmd-footnote');
});

test('inline footnotes: an endnote group is part of the opener', () => {
	const text = 'A claim.[^n(asides): Aside.] And[fn(asides): another.]\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, '[^n(asides):'), 'jmd-footnote');
	assert.equal(faceOf(scan, text, '[fn(asides):'), 'jmd-footnote');
	assert.equal(faceOf(scan, text, 'Aside.'), 'jmd-footnote-body');
	assert.equal(faceOf(scan, text, 'another.'), 'jmd-footnote-body');
});

test('a footnote body carries its face across a paragraph break', () => {
	// The engine lifts a body holding blank lines out and renders it as
	// its own block (preprocessFootnotes), so the note does not end at
	// the break — and neither does the face. This is what stock markdown
	// gets wrong: it reads the brackets as a link, which cannot leave its
	// paragraph (see jmd/footnote-parser.js).
	const text = 'Text[^n: First paragraph.\n\n\tSecond paragraph.] after.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'First paragraph.'), 'jmd-footnote-body');
	assert.equal(faceOf(scan, text, 'Second paragraph.'), 'jmd-footnote-body');
	assert.equal(faceOf(scan, text, ' after.'), null);
});

test('a footnote body leaves its constructs to the other passes', () => {
	const text = 'Text[^n: with /italic/, [[Target]] and $x^2$.] after.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'italic'), 'jmd-italic');
	assert.equal(faceOf(scan, text, 'Target'), 'jmd-wikilink-target');
	assert.equal(faceOf(scan, text, '$x^2$'), 'jmd-math');
	assert.equal(faceOf(scan, text, 'with '), 'jmd-footnote-body');
});

test('a footnote body ends at its own bracket, nesting counted', () => {
	const text = 'Text[^n: a [bracket] inside.] after.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'inside.'), 'jmd-footnote-body');
	assert.equal(faceOf(scan, text, ' after.'), null);
});

test('an unclosed footnote paints its opener alone', () => {
	// What the user sees mid-keystroke; the body would otherwise run to
	// the end of the document.
	const text = 'Text[^n: still typing\n\nA later paragraph.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, '[^n:'), 'jmd-footnote');
	assert.equal(faceOf(scan, text, 'still typing'), null);
	assert.equal(faceOf(scan, text, 'A later paragraph.'), null);
});

test('a whole-line [[file]] is a wikilink in Clew (no inclusion face)', () => {
	// jmacs faced these lines jmd-include; Clew's engine treats every
	// [[…]] as a wikilink, and so does the scanner.
	const text = 'Before.\n\n[[chapter-2.jmd]]\n\nAfter.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'chapter-2.jmd'), 'jmd-wikilink-target');
	assert.equal(faceOf(scan, text, '[['), 'jmd-wikilink-bracket');
	assert.ok(owned(scan, text, '[[chapter-2.jmd]]'));
});

/* ── @name directives (inline / block) ───────────────────────────────── */

/** The html injection whose interior is wrapped as a synthetic tag. */
function attrInjection(scan) {
	return scan.injections.find(
		(i) => i.language === 'html' && i.wrapPrefix === '<x '
	);
}

test('@name directive: sigils/brackets faced, text ambient, attrs injected', () => {
	const text = 'Here @note[hello]{.fancy #n1 data-x="7"} there.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, '@note'), 'jmd-directive-punct'); // the @
	assert.equal(faceOf(scan, text, 'note'), 'jmd-directive-name');
	assert.equal(faceAt(scan.captures, text.indexOf('[')), 'jmd-punct');
	assert.equal(faceAt(scan.captures, text.indexOf(']')), 'jmd-punct');
	assert.equal(faceAt(scan.captures, text.indexOf('{')), 'jmd-punct');
	assert.equal(faceAt(scan.captures, text.indexOf('}')), 'jmd-punct');
	// The text group is injected into jmarkdown_inline: not owned, no
	// scanner face of its own, but an injection carries its interior.
	assert.ok(!owned(scan, text, 'hello'), 'text group not owned');
	assert.equal(faceOf(scan, text, 'hello'), null);
	const inline = scan.injections.find((i) => i.language === 'jmarkdown_inline');
	assert.ok(inline, 'text group injected into jmarkdown_inline');
	assert.equal(text.slice(inline.start, inline.end), 'hello');
	// The attribute list is injected into html, wrapped, and NOT owned
	// (so the injection shows through the capture-provider clip).
	const html = attrInjection(scan);
	assert.ok(html, 'an html injection for the attribute list');
	assert.equal(text.slice(html.start, html.end), '.fancy #n1 data-x="7"');
	assert.equal(html.wrapSuffix, ' />');
	assert.ok(!owned(scan, text, '.fancy'), 'attribute interior not owned');
});

test('@name+ block directive: the + is faced as directive punctuation', () => {
	const text = '@note+[hi]{.x}\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'note'), 'jmd-directive-name');
	assert.equal(faceAt(scan.captures, text.indexOf('+')), 'jmd-directive-punct');
	assert.ok(attrInjection(scan), 'attrs still injected on a block directive');
});

test('@<name> angle form: the < and > are faced; + sits outside', () => {
	const text = 'A @<fig>[cap]{.big} and @<tbl>+[x]{.y} end.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceAt(scan.captures, text.indexOf('<')), 'jmd-directive-punct');
	assert.equal(faceAt(scan.captures, text.indexOf('>')), 'jmd-directive-punct');
	assert.equal(faceOf(scan, text, 'fig'), 'jmd-directive-name');
	assert.equal(faceOf(scan, text, 'tbl'), 'jmd-directive-name');
	// '+' after the closing '>' of the second directive.
	assert.equal(faceAt(scan.captures, text.indexOf('+')), 'jmd-directive-punct');
});

test('an unpaired angle bracket is not a directive', () => {
	const text = 'nope @<name[x]{.y} nope\n';
	const scan = scanJmarkdown(text);
	assert.equal(scan.captures.filter((c) => c.face === 'jmd-directive-name').length, 0);
	assert.equal(scan.captures.filter((c) => c.face === 'jmd-directive-punct').length, 0);
	assert.equal(attrInjection(scan), undefined, 'no attribute injection either');
});

test('both groups are optional: @name, @name[text], @name{attrs}', () => {
	const bare = scanJmarkdown('Say @hello now.\n');
	assert.equal(faceOf(bare, 'Say @hello now.\n', 'hello'), 'jmd-directive-name');
	assert.equal(attrInjection(bare), undefined);

	const textOnly = scanJmarkdown('@ref[sec-1] here\n');
	assert.equal(faceAt(textOnly.captures, '@ref[sec-1] here\n'.indexOf('[')), 'jmd-punct');
	assert.equal(attrInjection(textOnly), undefined, 'no attrs -> no injection');

	const attrsOnly = scanJmarkdown('@x{.a}\n');
	const html = attrInjection(attrsOnly);
	assert.ok(html);
	assert.equal('@x{.a}\n'.slice(html.start, html.end), '.a');
});

test('the text group may span lines (but not a blank line)', () => {
	const text = '@note[line one\nline two]{.x}\nAfter.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceAt(scan.captures, text.indexOf(']')), 'jmd-punct');
	const html = attrInjection(scan);
	assert.ok(html);
	assert.equal(text.slice(html.start, html.end), '.x');
});

test('a blank line inside a group aborts it (the bracket is left plain)', () => {
	const text = '@note[line one\n\nline two]\n';
	const scan = scanJmarkdown(text);
	// The opening name is still faced, but the '[' never resolves to a group.
	assert.equal(faceOf(scan, text, 'note'), 'jmd-directive-name');
	assert.equal(faceAt(scan.captures, text.indexOf('[')), null);
});

test('attribute injection is quote-aware: a } inside a value does not close', () => {
	const text = `@x{style='a}b' data-y="z"}\n`;
	const scan = scanJmarkdown(text);
	const html = attrInjection(scan);
	assert.ok(html);
	assert.equal(text.slice(html.start, html.end), `style='a}b' data-y="z"`);
});

test('the text group is a bracket-free jmarkdown_inline injection', () => {
	// Injecting the bare interior (not the wrapping [ … ]) is what avoids
	// the shortcut-link mis-parse; the span excludes the brackets.
	const text = 'Here @note[hello *world*]{.x} there.\n';
	const scan = scanJmarkdown(text);
	const inline = scan.injections.find((i) => i.language === 'jmarkdown_inline');
	assert.ok(inline);
	assert.equal(text.slice(inline.start, inline.end), 'hello *world*');
	assert.equal(text[inline.start - 1], '[', 'injection starts after the [');
	assert.equal(text[inline.end], ']', 'injection ends before the ]');
});

test('the text interior stays unclaimed: scanner extras still paint there', () => {
	// ==highlight==, {{mustache}} and a footnote opener inside the text
	// group are painted by the scanner passes (the interior is unclaimed).
	const text = '@note[see ==this==, {{v}} and more[^n: x]] ok\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'this'), 'jmd-highlight');
	assert.equal(faceOf(scan, text, 'v'), 'jmd-mustache');
	assert.equal(faceOf(scan, text, '[^n:'), 'jmd-footnote');
});

test('a style="…" value in the attribute list is injected into css', () => {
	const text = `@x{.a style='color: crimson; font-weight: bold'}\n`;
	const scan = scanJmarkdown(text);
	const css = scan.injections.find((i) => i.language === 'css');
	assert.ok(css, 'a css injection for the style value');
	assert.equal(text.slice(css.start, css.end), 'color: crimson; font-weight: bold');
	assert.equal(css.wrapPrefix, '*{');
	assert.equal(css.wrapSuffix, '}');
	// The whole attribute list is still injected into html as well.
	assert.ok(attrInjection(scan), 'html injection for the list is still present');
});

test('style-value css injection handles double quotes and coexists with html', () => {
	const text = `@x{style="margin: 0 auto" data-y="7"}\n`;
	const scan = scanJmarkdown(text);
	const css = scan.injections.find((i) => i.language === 'css');
	assert.ok(css);
	assert.equal(text.slice(css.start, css.end), 'margin: 0 auto');
	// data-y is a plain attribute, not css — only the style value is injected.
	assert.equal(scan.injections.filter((i) => i.language === 'css').length, 1);
});

test('an email address is never a directive (@ must follow start or space)', () => {
	const text = 'Write to me@example.com today.\n';
	const scan = scanJmarkdown(text);
	assert.equal(scan.captures.filter((c) => c.face === 'jmd-directive-name').length, 0);
});

test('@begin/@end environments are untouched by the @name pass', () => {
	const text = '@begin(theorem)\nx\n@end(theorem)\n';
	const scan = scanJmarkdown(text);
	// Still the environment keyword face, not a directive name.
	assert.equal(faceOf(scan, text, '@begin'), 'jmd-env-keyword');
	assert.equal(faceOf(scan, text, 'theorem'), 'jmd-env-name');
});

/* ── embedded JavaScript chains ──────────────────────────────────────── */

test('a call chain becomes a javascript injection', () => {
	const text = 'The total is compute(3, 4).label here.\n';
	const scan = scanJmarkdown(text);
	const js = scan.injections.find((i) => i.language === 'javascript');
	assert.ok(js);
	assert.equal(text.slice(js.start, js.end), 'compute(3, 4).label');
});

test('e.g. and i.e. never start a chain; nor do sentence-final dots', () => {
	const text = 'This works, e.g. when used, i.e. carefully. The effect. ends here.\n';
	const scan = scanJmarkdown(text);
	assert.equal(scan.injections.filter((i) => i.language === 'javascript').length, 0);
});

test('chain arguments may contain strings with brackets', () => {
	const text = 'Run fmt("a ) tricky", [1, 2]).out now.\n';
	const scan = scanJmarkdown(text);
	const js = scan.injections.find((i) => i.language === 'javascript');
	assert.ok(js);
	assert.equal(text.slice(js.start, js.end), 'fmt("a ) tricky", [1, 2]).out');
});

/* ── masking ─────────────────────────────────────────────────────────── */

test('nothing matches inside fenced code, inline code, or math', () => {
	const text =
		'```\n/not italic/ ==nope== {{no}}\n```\n' +
		'Inline `/code/` and math $a/b/c$ stay plain.\n';
	const scan = scanJmarkdown(text);
	assert.equal(scan.captures.filter((c) => c.face === 'jmd-italic').length, 0);
	assert.equal(scan.captures.filter((c) => c.face === 'jmd-highlight').length, 0);
	assert.equal(scan.captures.filter((c) => c.face === 'jmd-mustache').length, 0);
});

test('<script> blocks inject html', () => {
	const text = 'Before.\n<script data-type="jmarkdown">\nlet x = 1;\n</script>\nAfter.\n';
	const scan = scanJmarkdown(text);
	const html = scan.injections.find((i) => i.language === 'html');
	assert.ok(html);
	assert.ok(text.slice(html.start, html.end).includes('let x = 1;'));
	assert.ok(text.slice(html.start, html.end).includes('</script>'));
});

test('a colon in an ordinary first line does not open a header', () => {
	// Sublime's lookahead would treat this whole document as metadata;
	// the scanner requires a terminating --- before the first blank line.
	const text = 'See here: the first line has a colon.\n\nMore prose.\n';
	const scan = scanJmarkdown(text);
	assert.equal(scan.captures.filter((c) => c.face === 'jmd-meta-key').length, 0);
	assert.ok(!owned(scan, text, 'See here'));
});

// --- block HTML → html injections (inline-html-highlighting) -----------

test('<style> blocks inject html and silence the inline pass', () => {
	const text = '<style>\n  div.center {\n    text-align: center;\n  }\n</style>\nafter\n';
	const scan = scanJmarkdown(text);
	const html = scan.injections.find((i) => i.language === 'html');
	assert.ok(html, 'a html injection covers the style block');
	assert.equal(text.slice(html.start, html.end).startsWith('<style>'), true);
	assert.equal(text.slice(html.start, html.end).endsWith('</style>'), true);
	// The blanked body must produce NO javascript chain injection for
	// `div.center` (the misfire this feature fixes).
	assert.equal(scan.injections.filter((i) => i.language === 'javascript').length, 0);
});

test('an indented <style> block (up to three spaces) is still consumed', () => {
	const text = '  <style>\n    h2 { color: red; }\n  </style>\n';
	const scan = scanJmarkdown(text);
	const html = scan.injections.find((i) => i.language === 'html');
	assert.ok(html);
	assert.ok(text.slice(html.start, html.end).includes('</style>'));
});

test('a block-level tag runs to the first blank line', () => {
	const text = '<div class="x">\ncontent line\n</div>\n\nprose after\n';
	const scan = scanJmarkdown(text);
	const html = scan.injections.find((i) => i.language === 'html');
	assert.ok(html);
	assert.equal(text.slice(html.start, html.end), '<div class="x">\ncontent line\n</div>');
});

test('a dashed custom element counts as a block tag', () => {
	const text = '<dissertation-feedback data-candidate="70118">\nbody\n</dissertation-feedback>\n';
	const scan = scanJmarkdown(text);
	const html = scan.injections.find((i) => i.language === 'html');
	assert.ok(html);
	assert.ok(text.slice(html.start, html.end).startsWith('<dissertation-feedback'));
});

test('inline HTML in prose is NOT consumed as a block', () => {
	// A span is not a block-level tag: the paragraph must survive for the
	// inline grammar (which injects each html_tag itself).
	const text = 'prose with <span class="foo">a span</span> inside\n';
	const scan = scanJmarkdown(text);
	assert.equal(scan.injections.filter((i) => i.language === 'html').length, 0);
});

test('autolinks and << lines do not trigger the block-HTML rule', () => {
	const text = '<https://example.com>\n\n>> centred <<\n';
	const scan = scanJmarkdown(text);
	assert.equal(scan.injections.filter((i) => i.language === 'html').length, 0);
});

/* ── wikilinks (Clew's Obsidian pass) ────────────────────────────────── */

/** All captures with a face in the wikilink family. */
function wikiCaptures(scan) {
	return scan.captures.filter((c) => c.face.startsWith('jmd-wikilink'));
}

test('a bare wikilink: brackets and target faced, span owned', () => {
	const text = 'See [[Target Note]] for more.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, '[['), 'jmd-wikilink-bracket');
	assert.equal(faceOf(scan, text, 'Target Note'), 'jmd-wikilink-target');
	assert.equal(faceOf(scan, text, ']]'), 'jmd-wikilink-bracket');
	assert.ok(owned(scan, text, '[[Target Note]]'));
});

test('a wikilink with an alias: | is a bracket, the alias has its face', () => {
	const text = 'See [[Target|the alias]] here.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'Target'), 'jmd-wikilink-target');
	assert.equal(faceAt(scan.captures, text.indexOf('|')), 'jmd-wikilink-bracket');
	assert.equal(faceOf(scan, text, 'the alias'), 'jmd-wikilink-alias');
});

test('a wikilink with a heading: # is a bracket, the heading is a target', () => {
	const text = 'See [[Note#Section one]] and [[#Same file]] here.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'Note#'), 'jmd-wikilink-target');
	assert.equal(faceAt(scan.captures, text.indexOf('#')), 'jmd-wikilink-bracket');
	assert.equal(faceOf(scan, text, 'Section one'), 'jmd-wikilink-target');
	// Same-file heading link: empty target, heading only.
	assert.equal(faceOf(scan, text, 'Same file'), 'jmd-wikilink-target');
});

test('a heading and an alias together', () => {
	const text = 'See [[Note#Sec|nice name]].\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'Note'), 'jmd-wikilink-target');
	assert.equal(faceOf(scan, text, 'Sec'), 'jmd-wikilink-target');
	assert.equal(faceOf(scan, text, 'nice name'), 'jmd-wikilink-alias');
});

test('an embed ![[…]]: the ! is part of the bracket run', () => {
	const text = 'Embed ![[Diagram]] inline.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceAt(scan.captures, text.indexOf('!')), 'jmd-wikilink-bracket');
	assert.equal(faceOf(scan, text, 'Diagram'), 'jmd-wikilink-target');
});

test('a wikilink inside inline code is NOT captured', () => {
	const text = 'Code `[[NotALink]]` stays plain.\n';
	const scan = scanJmarkdown(text);
	assert.equal(wikiCaptures(scan).length, 0);
});

test('a wikilink inside a fence or math is NOT captured', () => {
	const text = '```\n[[nope]]\n```\n\nMath $[[x]]$ too.\n';
	const scan = scanJmarkdown(text);
	assert.equal(wikiCaptures(scan).length, 0);
});

test('an empty [[]] is not a wikilink', () => {
	const text = 'An empty [[]] and a lone [[|alias]] are not links.\n';
	const scan = scanJmarkdown(text);
	assert.equal(wikiCaptures(scan).length, 0);
});

test('a wikilink target with a slash never italicises', () => {
	const text = 'See [[projects/notes|current]] today.\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, 'projects/notes'), 'jmd-wikilink-target');
	assert.equal(scan.captures.filter((c) => c.face === 'jmd-italic').length, 0);
});

/* ── tags (Clew's Obsidian pass) ─────────────────────────────────────── */

/** The jmd-tag captures, as their text slices. */
function tagTexts(scan, text) {
	return scan.captures
		.filter((c) => c.face === 'jmd-tag')
		.map((c) => text.slice(c.start, c.end));
}

test('tags at line start and mid-sentence', () => {
	const text = '#project kickoff, filed under #meeting_notes today.\n';
	const scan = scanJmarkdown(text);
	assert.deepEqual(tagTexts(scan, text), ['#project', '#meeting_notes']);
});

test('nested tags and hyphens', () => {
	const text = 'Filed under #philosophy/logic and #to-read now.\n';
	const scan = scanJmarkdown(text);
	assert.deepEqual(tagTexts(scan, text), ['#philosophy/logic', '#to-read']);
});

test('heading marks are never tags', () => {
	const text = '# Heading\n## Sub-heading\n#tag-at-line-start\n';
	const scan = scanJmarkdown(text);
	assert.deepEqual(tagTexts(scan, text), ['#tag-at-line-start']);
});

test('purely numeric refs and URL fragments are not tags', () => {
	const text = 'Issue #123 and https://x.test#frag stay plain.\n';
	const scan = scanJmarkdown(text);
	assert.equal(tagTexts(scan, text).length, 0);
});

test('tags never fire inside code or math', () => {
	const text = 'Code `#nope` and math $#alsono$ here.\n';
	const scan = scanJmarkdown(text);
	assert.equal(tagTexts(scan, text).length, 0);
});

test('a wikilink heading # is not a tag', () => {
	const text = 'See [[Note#topic]] for more.\n';
	const scan = scanJmarkdown(text);
	assert.equal(tagTexts(scan, text).length, 0);
});

/* ── math segments get a face of their own ───────────────────────────── */

test('math segments are faced jmd-math, delimiters included', () => {
	const text = 'Inline $a+b$ then display:\n\n$$\nx^2\n$$\n';
	const scan = scanJmarkdown(text);
	assert.equal(faceOf(scan, text, '$a+b$'), 'jmd-math');
	assert.equal(faceOf(scan, text, 'x^2'), 'jmd-math');
	const spans = scan.captures
		.filter((c) => c.face === 'jmd-math')
		.map((c) => text.slice(c.start, c.end));
	assert.deepEqual(spans, ['$a+b$', '$$\nx^2\n$$']);
});
