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
import { chooseLatexEngine, latexmkFlag, firstLatexError } from '../src/main/latex-engine.js';

const doc = (preamble) => `\\documentclass{article}\n\\usepackage[T1]{fontenc}\n${preamble}\n\\begin{document}\nHello.\n\\end{document}\n`;

test('a plain document stays on pdfLaTeX', () => {
	assert.equal(chooseLatexEngine(doc('\\usepackage{natbib}\n\\usepackage{tcolorbox}')).engine, 'pdflatex');
});

test('fontspec, unicode-math, polyglossia, Lua code → LuaLaTeX, with the line', () => {
	const owner = chooseLatexEngine(doc('\\usepackage{fontspec}\n\\setmainfont{Optima}'));
	assert.equal(owner.engine, 'lualatex');
	assert.match(owner.reason, /line 3: \\usepackage\{fontspec\}/);
	for (const p of ['\\usepackage[math-style=ISO]{unicode-math}', '\\usepackage{polyglossia}', '\\usepackage{luacode}',
		'\\RequirePackage{fontspec}', '\\setmainfont{Avenir Next}', '\\newfontfamily\\x{Menlo}', '\\directlua{tex.print("x")}',
		'\\usepackage{amsmath,fontspec}']) {
		assert.equal(chooseLatexEngine(doc(p)).engine, 'lualatex', p);
	}
});

test('XeTeX-only packages → XeLaTeX', () => {
	assert.equal(chooseLatexEngine(doc('\\usepackage{xeCJK}')).engine, 'xelatex');
});

test('a commented-out line does not count; an escaped % does not hide one', () => {
	assert.equal(chooseLatexEngine(doc('% \\usepackage{fontspec}')).engine, 'pdflatex');
	assert.equal(chooseLatexEngine(doc('50\\% off \\usepackage{fontspec}')).engine, 'lualatex');
});

test('the setting wins, and says so', () => {
	const forced = chooseLatexEngine(doc('\\usepackage{fontspec}'), 'pdflatex');
	assert.equal(forced.engine, 'pdflatex');
	assert.match(forced.reason, /Settings/);
	assert.equal(chooseLatexEngine(doc(''), 'xelatex').engine, 'xelatex');
	assert.equal(chooseLatexEngine(doc(''), 'nonsense').engine, 'pdflatex');
});

test('latexmk flags and the first error of a log', () => {
	assert.deepEqual(['pdflatex', 'lualatex', 'xelatex'].map(latexmkFlag), ['-pdf', '-lualatex', '-xelatex']);
	const log = 'This is pdfTeX\n(./x.tex\n! Fatal Package fontspec Error: The fontspec package requires either XeTeX or\n(fontspec)                      LuaTeX.\n\nmore';
	assert.match(firstLatexError(log), /^! Fatal Package fontspec Error: .* LuaTeX\.$/);
	assert.equal(firstLatexError('all fine'), '');
});
