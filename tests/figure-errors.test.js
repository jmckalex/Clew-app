// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFigureError, locateFigureError, mermaidErrorLine } from '../src/shared/figure-errors.js';

// What mp-tikz-wasm put in the owner's console (2026-10-03): its diagnostic,
// then pdfTeX's log, whose context names the line by its TEXT.
const TIKZ_LOG = `error: Undefined control sequence. (line 4)
This is pdfTeX, Version 3.141592653-2.6-1.40.27 (TeX Live 2025) (preloaded format=latex)
 entering extended mode
(./doc.tex
LaTeX2e <2025-06-01> patch level 1
! Undefined control sequence.
l.4 ...ealth, ->] (0,0) node {$a\\lpha
                                                  $} to[out=135, in=272] (1,1);
No pages of output.`;

const FENCE = [
	'```tikz',
	'\\begin{tikzpicture}[scale=2]',
	'  \\draw[thick, >=stealth, ->] (0,0) node {$a\\lpha$} to[out=135, in=272] (1,1);',
	'\\end{tikzpicture}',
	'```',
];

test('the first error, and TeX\'s context for it', () => {
	const err = parseFigureError(TIKZ_LOG);
	assert.equal(err.message, 'Undefined control sequence.');
	assert.equal(err.docLine, 4, 'the COMPILED document\'s line — not the fence\'s');
	assert.equal(err.before, '...ealth, ->] (0,0) node {$a\\lpha');
	assert.equal(err.after, '$} to[out=135, in=272] (1,1);');
	assert.equal(parseFigureError(''), null);
});

test('the fence line is found by its text, whatever the wrapper added', () => {
	assert.equal(locateFigureError(FENCE, parseFigureError(TIKZ_LOG)), 2);
	// The same body indented differently: whitespace does not count.
	const reindented = FENCE.map((l) => l.replace(/^ {2}/, '\t\t'));
	assert.equal(locateFigureError(reindented, parseFigureError(TIKZ_LOG)), 2);
});

test('MetaPost prints the same l.N context', () => {
	const log = `error: Isolated expression. (line 3)
! Isolated expression.
<to be read again>
                   (
l.3   drawarow (
                  0,0)--(1cm,1cm);`;
	const fence = ['```metapost', 'beginfig(1);', '  draw fullcircle scaled 2cm;', '  drawarow (0,0)--(1cm,1cm);', 'endfig;', '```'];
	assert.equal(locateFigureError(fence, parseFigureError(log)), 3);
});

test('no context and no line: not found; mermaid counts from the body', () => {
	assert.equal(locateFigureError(FENCE, { message: 'x' }), -1);
	assert.equal(mermaidErrorLine('Parse error on line 3:\n...B --> > C\n-------^'), 3);
	assert.equal(mermaidErrorLine('No diagram type detected'), null);
	const mermaid = ['```mermaid', 'graph LR', '  A[Start] --> B[End]', '  B --> > C', '```'];
	assert.equal(locateFigureError(mermaid, { relLine: 3 }), 3);
	assert.equal(locateFigureError(mermaid, { relLine: 9 }), -1, 'a line past the fence is no line');
});
