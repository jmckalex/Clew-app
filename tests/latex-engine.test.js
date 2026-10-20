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
import { latexmkFlag, latexPdfRefusal } from '../src/main/latex-engine.js';
import { chooseLatexEngine, firstLatexError, pdfViaLatexFailure } from '../src/shared/latex-engine.js';
import { readFileSync } from 'node:fs';
import { LATEX_ENGINE_SETTING } from '../src/shared/latex-engine-setting.js';

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
	assert.equal(forced.reason, 'set in Settings → Appearance → LaTeX engine (PDF via LaTeX export): pdfLaTeX');
	assert.equal(chooseLatexEngine(doc(''), 'xelatex').engine, 'xelatex');
	assert.equal(chooseLatexEngine(doc(''), 'nonsense').engine, 'pdflatex');
});

test('latexmk flags and the first error of a log', () => {
	assert.deepEqual(['pdflatex', 'lualatex', 'xelatex'].map(latexmkFlag), ['-pdf', '-lualatex', '-xelatex']);
	const log = 'This is pdfTeX\n(./x.tex\n! Fatal Package fontspec Error: The fontspec package requires either XeTeX or\n(fontspec)                      LuaTeX.\n\nmore';
	assert.match(firstLatexError(log), /^! Fatal Package fontspec Error: .* LuaTeX\.$/);
	assert.equal(firstLatexError('all fine'), '');
});

test('the reason names the section the Settings view really draws the row in', () => {
	// The row's label comes from LATEX_ENGINE_SETTING; its section is the
	// nearest `#section('…'` before it in the view's source.
	const view = readFileSync(new URL('../src/renderer/components/views/clew-settings-view.js', import.meta.url), 'utf8');
	const row = view.indexOf("this.#selectRow(LATEX_ENGINE_SETTING.label, 'latexEngine'");
	assert.ok(row > 0, 'the view draws the row from LATEX_ENGINE_SETTING.label');
	const sections = [...view.slice(0, row).matchAll(/this\.#section\('([^']+)'/g)];
	assert.equal(sections.at(-1)?.[1], LATEX_ENGINE_SETTING.section);
});

test('a vault this device does not trust: each PDF via LaTeX refused by name, saying why and what instead', () => {
	const note = latexPdfRefusal('note', 'this Mac');
	assert.match(note, /^A PDF via LaTeX is not made in a vault this Mac does not trust: it would run your TeX installation over the vault's own TeX/);
	assert.match(note, /Export the note as PDF \(reading view\), or trust the vault \(Settings → This vault\)\.$/);
	assert.match(latexPdfRefusal('book', 'this computer'), /^A book's PDF via LaTeX is not made in a vault this computer does not trust.*Build the book as PDF \(reading view\), or trust the vault/);
	assert.match(latexPdfRefusal('proof', 'this Mac'), /^A chapter proof \(a PDF via LaTeX\) is not made.*Trust the vault \(Settings → This vault\)\.$/);
});

test('a host without an engine: the document that needs it is refused in words, never run on another', () => {
	const xe = doc('\\usepackage{xeCJK}');
	const ipad = { available: ['pdflatex', 'lualatex'], host: 'Clew on the iPad' };
	const refused = chooseLatexEngine(xe, 'auto', ipad);
	assert.equal(refused.engine, 'xelatex');
	assert.equal(refused.unavailable, true);
	assert.equal(refused.refusal, 'This document needs XeLaTeX (the document needs a Unicode engine — line 3: \\usepackage{xeCJK}), which Clew on the iPad does not have.');
	assert.equal(chooseLatexEngine(xe, 'auto').unavailable, undefined, 'every engine by default: the Mac\'s answer unchanged');
	assert.deepEqual(chooseLatexEngine(doc('\\usepackage{fontspec}'), 'auto', ipad), chooseLatexEngine(doc('\\usepackage{fontspec}'), 'auto'));
	assert.match(chooseLatexEngine(doc(''), 'xelatex', ipad).refusal, /^This document needs XeLaTeX \(set in Settings → Appearance → LaTeX engine \(PDF via LaTeX export\): XeLaTeX\), which Clew on the iPad/);
});

test('a failed PDF via LaTeX says the engine, why, and the first error — else the run\'s own error, else that none came out', () => {
	const log = '! Undefined control sequence.\nl.3 \\foo\n\nmore';
	assert.equal(pdfViaLatexFailure({ engine: 'lualatex', reason: 'r', log, error: 'exit 1' }),
		'PDF via LaTeX failed — LuaLaTeX ran (r). First error: ! Undefined control sequence. l.3 \\foo');
	assert.equal(pdfViaLatexFailure({ engine: 'pdflatex', reason: 'r', log: 'fine', error: 'spawn ENOENT' }), 'PDF via LaTeX failed — pdfLaTeX ran (r). First error: spawn ENOENT');
	assert.equal(pdfViaLatexFailure({ engine: 'xelatex', reason: 'r' }), 'PDF via LaTeX failed — XeLaTeX ran (r). First error: no PDF was produced');
});
