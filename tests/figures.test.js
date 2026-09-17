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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	ENGINE_TIKZ_LIBRARIES, UNBUNDLED_TIKZ_LIBRARIES, TiKZ, metapost,
	figureElement, metapostFence, parseFigureAttrs, tikzDirective, tikzFence, unwrapTikzJax,
} from '../src/engine/figures.js';
import { figureMatches, hasFigures } from '../src/main/figure-bake.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ---- attributes ------------------------------------------------------------

test('attribute tails: quoted, bare and flag forms', () => {
	assert.deepEqual(parseFigureAttrs(`libraries="arrows.meta,calc" border=4pt show-console`),
		{ libraries: 'arrows.meta,calc', border: '4pt', 'show-console': 'true' });
	assert.deepEqual(parseFigureAttrs(`{width='45%'}`), { width: '45%' });
	assert.deepEqual(parseFigureAttrs(''), {});
	assert.deepEqual(parseFigureAttrs(undefined), {});
});

test('a quoted value keeps its spaces and does not spill into new keys', () => {
	assert.deepEqual(parseFigureAttrs(`preamble="\\usepackage[T1]{fontenc} \\usepackage{lmodern}" border=1pt`),
		{ preamble: '\\usepackage[T1]{fontenc} \\usepackage{lmodern}', border: '1pt' });
});

// ---- the TikZJax dialect ---------------------------------------------------

test('a TikZJax body becomes a preamble and a picture', () => {
	const source = '\\usepackage{pgfplots}\n\\begin{document}\n\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}\n\\end{document}';
	const { source: body, attrs } = unwrapTikzJax(source, {});
	assert.equal(body, '\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}');
	assert.equal(attrs.preamble, '\\usepackage{pgfplots}');
});

test('an existing preamble attribute is kept, with the body preamble after it', () => {
	const source = '\\usepackage{amsmath}\n\\begin{document}\nx\n\\end{document}';
	const { attrs } = unwrapTikzJax(source, { preamble: '\\usetikzlibrary{fit}' });
	assert.equal(attrs.preamble, '\\usetikzlibrary{fit}\n\\usepackage{amsmath}');
});

test('a complete document and a plain picture both pass through untouched', () => {
	const complete = '\\documentclass{standalone}\n\\begin{document}\\tikz\\draw (0,0)--(1,1);\\end{document}';
	assert.equal(unwrapTikzJax(complete, {}).source, complete);
	assert.deepEqual(unwrapTikzJax(complete, {}).attrs, {});
	const plain = '\\draw (0,0) circle (1);';
	assert.equal(unwrapTikzJax(plain, {}).source, plain);
});

// ---- the emitted element ---------------------------------------------------

const attrOf = (html, name) => new RegExp(`${name}="([^"]*)"`).exec(html)?.[1] ?? null;

test('the element carries the source as text, escaped for an HTML parser', () => {
	const html = figureElement('tikz', '\\node {$a < b$ & more};');
	assert.match(html, /^<tikz-diagram /);
	assert.match(html, /\\node \{\$a &lt; b\$ &amp; more\};/);
	assert.match(html, /<\/tikz-diagram>\n$/);
});

test('mathjax_ignore is on the element: MathJax must not claim a $…$ in TikZ source', () => {
	assert.match(figureElement('tikz', '\\node {$x^2$};'), /class="mathjax_ignore"/);
	assert.match(figureElement('metapost', 'label(btex $\\pi$ etex, origin);'), /class="mathjax_ignore"/);
});

test('metapost source gets the metapost element', () => {
	assert.match(figureElement('metapost', 'draw fullcircle scaled 20;'), /^<metapost-diagram /);
});

test('library attributes pass through as data-*, presentation ones as style', () => {
	const html = figureElement('tikz', 'x', { libraries: 'calc', border: '4pt', width: '45%', scale: '2' });
	assert.equal(attrOf(html, 'data-libraries'), 'calc');
	assert.equal(attrOf(html, 'data-border'), '4pt');
	assert.match(attrOf(html, 'style'), /width: 45%/);
	assert.match(attrOf(html, 'style'), /transform: scale\(2\)/);
});

test('the native path’s own attributes are dropped, not passed on', () => {
	const html = figureElement('tikz', 'x', { embed: 'true', 'empty-cache': 'true', nonsense: '1' });
	assert.doesNotMatch(html, /data-embed|data-empty-cache|data-nonsense/);
});

test('an attribute value cannot break out of the attribute', () => {
	const html = figureElement('tikz', 'x', { alt: 'a "quoted" <caption>' });
	assert.equal(attrOf(html, 'data-alt'), 'a &quot;quoted&quot; &lt;caption&gt;');
});

test('data-fig-key tracks the figure: source, attributes, kind', () => {
	const key = (html) => attrOf(html, 'data-fig-key');
	const base = figureElement('tikz', '\\draw (0,0)--(1,1);');
	assert.equal(key(base), key(figureElement('tikz', '\\draw (0,0)--(1,1);')), 'same figure, same key');
	assert.notEqual(key(base), key(figureElement('tikz', '\\draw (0,0)--(2,2);')), 'changed source');
	assert.notEqual(key(base), key(figureElement('tikz', '\\draw (0,0)--(1,1);', { border: '4pt' })), 'changed attribute');
	assert.notEqual(key(base), key(figureElement('metapost', '\\draw (0,0)--(1,1);')), 'changed kind');
	assert.match(key(base), /^[0-9a-f]{12}$/);
});

// ---- fences ----------------------------------------------------------------

test('the tikz fence claims its own language and nothing that merely starts with it', () => {
	const fence = '```tikz\n\\draw (0,0) circle (1);\n```\n';
	assert.equal(tikzFence.start(fence), 0);
	assert.equal(tikzFence.tokenizer(fence).text, '\\draw (0,0) circle (1);');
	// ```tikzcd is a different language (tikz-cd matrices) and stays a code block.
	assert.equal(tikzFence.start('```tikzcd\nA \\to B\n```\n'), undefined);
	assert.equal(tikzFence.tokenizer('```tikzcd\nA \\to B\n```\n'), undefined);
	assert.equal(tikzFence.start('```tikzpicture\nx\n```\n'), undefined);
});

test('a fence info string carries attributes', () => {
	const token = tikzFence.tokenizer('```tikz libraries="arrows.meta" border=4pt\nx\n```\n');
	assert.deepEqual(token.figureAttrs, { libraries: 'arrows.meta', border: '4pt' });
	assert.match(tikzFence.renderer(token), /data-libraries="arrows.meta"/);
});

test('the metapost fence is its own language', () => {
	const token = metapostFence.tokenizer('```metapost\ndraw unitsquare scaled 40;\n```\n');
	assert.equal(token.text, 'draw unitsquare scaled 40;');
	assert.match(metapostFence.renderer(token), /^<metapost-diagram /);
	assert.equal(metapostFence.start('```metapostx\nx\n```\n'), undefined);
});

test('a fence keeps a blank line inside the figure', () => {
	const token = tikzFence.tokenizer('```tikz\n\\draw (0,0)--(1,1);\n\n\\draw (1,1)--(2,2);\n```\n');
	assert.equal(token.text, '\\draw (0,0)--(1,1);\n\n\\draw (1,1)--(2,2);');
});

// ---- the :::TiKZ directive -------------------------------------------------

test('the colon directive takes its body to the closing marker', () => {
	const src = ':::TiKZ\n\\draw (0,0)--(1,1);\n:::\n\nProse after.\n';
	assert.equal(tikzDirective.start(src), 0);
	const token = tikzDirective.tokenizer(src);
	assert.equal(token.text, '\\draw (0,0)--(1,1);');
	assert.ok(!token.raw.includes('Prose after'), 'the block ends at :::');
});

test('the colon directive reads an attribute tail on its opening line', () => {
	const token = tikzDirective.tokenizer(':::TiKZ{scale=2}\n\\draw (0,0)--(1,1);\n:::\n');
	assert.deepEqual(token.figureAttrs, { scale: '2' });
	assert.equal(token.text, '\\draw (0,0)--(1,1);');
});

test('a marker mid-line is not a directive (start must be a line start)', () => {
	assert.equal(tikzDirective.start('## The :::TiKZ directive\n\nprose\n'), undefined);
});

// ---- the @begin environments ----------------------------------------------

test('the environment handlers render the same element, verbatim body', () => {
	const html = TiKZ.html({ rawText: '\\draw (0,0)--(1,1);', attrs: { width: '30%' } });
	assert.match(html, /^<tikz-diagram /);
	assert.match(html, /\\draw \(0,0\)--\(1,1\);/);
	assert.match(attrOf(html, 'style'), /width: 30%/);
	assert.equal(TiKZ.mode, 'verbatim');
	assert.equal(metapost.mode, 'verbatim');
	assert.match(metapost.html({ rawText: 'draw fullcircle scaled 20;', attrs: {} }), /^<metapost-diagram /);
});

test('the directives keep the engine’s library promise, plus the author’s', () => {
	const libraries = attrOf(TiKZ.html({ rawText: 'x', attrs: { libraries: 'spy' } }), 'data-libraries').split(',');
	for (const lib of ENGINE_TIKZ_LIBRARIES.split(',')) {
		if (UNBUNDLED_TIKZ_LIBRARIES.has(lib)) continue;
		assert.ok(libraries.includes(lib), `${lib} is promised by :::TiKZ`);
	}
	assert.ok(libraries.includes('spy'), 'the author’s own library is added');
	assert.equal(new Set(libraries).size, libraries.length, 'no duplicates');
	// A fence promises nothing it was not asked for.
	assert.equal(attrOf(figureElement('tikz', 'x'), 'data-libraries'), null);
});

test('the library list still matches the engine it mirrors', () => {
	// vendor/jmarkdown/src/tikz.js is re-synced from the master wholesale, so
	// this is the one place a changed list would otherwise go unnoticed.
	const engine = fs.readFileSync(path.join(root, 'vendor', 'jmarkdown', 'src', 'tikz.js'), 'utf8');
	const declared = /const TIKZ_LIBRARIES = '([^']+)'/.exec(engine)?.[1];
	assert.ok(declared, 'the engine still declares TIKZ_LIBRARIES');
	assert.equal(ENGINE_TIKZ_LIBRARIES, declared,
		'src/engine/figures.js mirrors vendor/jmarkdown/src/tikz.js — re-check UNBUNDLED_TIKZ_LIBRARIES too');
});

test('every library the directives load is one the wasm bundle actually has', (t) => {
	// The staged engines (scripts/stage-mptikz.js) are not on every machine.
	const assets = process.env.CLEW_MPTIKZ_DIR
		?? [path.join(os.homedir(), 'Source', 'mp-tikz-wasm', 'dist'), path.join(root, 'mptikz-assets')]
			.find((dir) => fs.existsSync(path.join(dir, 'bundles')));
	if (!assets) return t.skip('no staged mp-tikz-wasm build to check against');
	const files = new Set();
	for (const entry of fs.readdirSync(path.join(assets, 'bundles'), { withFileTypes: true, recursive: true })) {
		if (entry.isFile()) files.add(entry.name);
	}
	const missing = ENGINE_TIKZ_LIBRARIES.split(',').filter((lib) =>
		!files.has(`tikzlibrary${lib}.code.tex`) && !files.has(`pgflibrary${lib}.code.tex`));
	// \usetikzlibrary failing takes the whole figure with it, so anything the
	// bundle lacks MUST be named in UNBUNDLED_TIKZ_LIBRARIES.
	assert.deepEqual(missing, [...UNBUNDLED_TIKZ_LIBRARIES],
		'the bundle’s libraries changed: update UNBUNDLED_TIKZ_LIBRARIES in src/engine/figures.js');
});

// ---- the export bake -------------------------------------------------------

test('a page scan finds every figure, however often it is scanned', () => {
	const page = ['<h1>Note</h1>',
		figureElement('tikz', '\\draw (0,0)--(1,1);'),
		'<p>between</p>',
		figureElement('metapost', 'draw fullcircle scaled 20;'),
	].join('\n');
	// hasFigures() first, deliberately: a shared /g/ regex would leave
	// lastIndex past figure one and matchAll (which copies it) would skip it,
	// which is how the first figure on every exported page came out unbaked.
	assert.equal(hasFigures(page), true);
	assert.equal(hasFigures(page), true);
	const found = figureMatches(page);
	assert.equal(found.length, 2);
	assert.equal(found[0][1], 'tikz-diagram');
	assert.match(found[0][3], /\\draw \(0,0\)--\(1,1\);/);
	assert.equal(found[1][1], 'metapost-diagram');
	assert.equal(figureMatches(page).length, 2, 'and again');
});

test('a page with no figure is left alone', () => {
	assert.equal(hasFigures('<h1>Note</h1><p>No figures here.</p>'), false);
	assert.equal(hasFigures('<p>the word tikz-diagram in prose</p>'), false);
});
