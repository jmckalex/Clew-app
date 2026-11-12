// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The file explorer's icons (renderer/lib/file-icons.js): which of Material
// Icon Theme's icons a name gets, that every one the table can give is in
// vendor/material-icons/ and nothing else is, and that every kind of file Clew
// opens has an icon of its own rather than the plain file's.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileIconName, folderIconName, fileIconUrl } from '../src/renderer/lib/file-icons.js';
import { FILE_ICONS } from '../src/renderer/lib/file-icons-data.js';
import { IMAGE_EXT, AUDIO_EXT, VIDEO_EXT, OFFICE_EXT, fileKind } from '../src/shared/file-types.js';
import { NOTE_EXTENSIONS } from '../src/shared/channels.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const iconDir = path.join(root, 'vendor', 'material-icons');

test('a file gets its icon by its whole name, else its longest known extension, else the plain file', () => {
	const cases = {
		'Week 3 discussion notes.md': 'markdown',
		'Chapter.JMD': 'markdown',
		'Sketch.excalidraw.md': 'excalidraw', // a drawing before it is markdown
		'Sketch.excalidraw': 'excalidraw',
		'Board.canvas': 'drawio',
		'Reading list.base': 'database',
		'ph426-week-7-handout.pdf': 'pdf',
		'Essay.docx': 'word',
		'Essay.odt': 'word',
		'Marks.xlsx': 'table',
		'Slides.pptx': 'powerpoint',
		'seminar-plan.tex': 'tex',
		'references.bib': 'bibliography',
		'index.php': 'php',
		'Week 3 discussion notes.html': 'html',
		'Photo.JPG': 'image',
		'diagram.svg': 'svg',
		'site.tar.gz': 'zip',
		'README.md': 'readme', // the theme's whole-name table wins
		'Makefile': 'makefile',
		'CLAUDE.md': 'claude', // the theme's mixed-case keys, matched lowercased
		'CNAME': 'http',
		'Caddyfile': 'caddy',
		'grammar.tmLanguage': 'xml',
		'notes.xyzzy': 'file',
		'LICENCE-ish': 'file',
		'': 'file',
	};
	for (const [name, want] of Object.entries(cases)) assert.equal(fileIconName(name), want, name);
	assert.equal(fileIconName(undefined), 'file');
	// Inherited keys are not names: a file called "constructor" is a file.
	assert.equal(fileIconName('constructor'), 'file');
	assert.equal(fileIconName('x.__proto__'), 'file');
});

test('every key in the table is lowercase, as the lookup asks for it', () => {
	for (const table of ['fileNames', 'extensions']) {
		const mixed = Object.keys(FILE_ICONS[table]).filter((key) => key !== key.toLowerCase());
		assert.deepEqual(mixed, [], `${table}: a key the lowercased name never matches`);
	}
});

test('a folder is open or closed, nothing else', () => {
	assert.equal(folderIconName(true), 'folder-open');
	assert.equal(folderIconName(false), 'folder');
	assert.equal(fileIconName('graphics'), 'file', 'a folder name is never looked up as a file');
});

test('a light page takes an icon\'s light variant where the set has one', () => {
	const withLight = FILE_ICONS.light[0];
	assert.ok(withLight, 'the set has light variants');
	assert.equal(fileIconUrl(withLight, 'light'), `file-icons/${withLight}_light.svg`);
	assert.equal(fileIconUrl(withLight, 'dark'), `file-icons/${withLight}.svg`);
	assert.equal(fileIconUrl('markdown', 'light'), 'file-icons/markdown.svg');
	assert.equal(fileIconUrl('markdown'), 'file-icons/markdown.svg');
});

test('every icon the table can give is vendored, and nothing else is', () => {
	const given = new Set([FILE_ICONS.file, FILE_ICONS.folder, FILE_ICONS.folderOpen,
		...Object.values(FILE_ICONS.extensions), ...Object.values(FILE_ICONS.fileNames)]);
	const want = new Set();
	for (const icon of given) {
		want.add(`${icon}.svg`);
		if (FILE_ICONS.light.includes(icon)) want.add(`${icon}_light.svg`);
	}
	for (const icon of FILE_ICONS.light) assert.ok(given.has(icon), `light variant of an icon never given: ${icon}`);
	const have = new Set(fs.readdirSync(iconDir).filter((f) => f.endsWith('.svg')));
	assert.deepEqual([...want].filter((f) => !have.has(f)), [], 'missing from vendor/material-icons');
	assert.deepEqual([...have].filter((f) => !want.has(f)), [], 'vendored and never given');
	for (const file of have) {
		const svg = fs.readFileSync(path.join(iconDir, file), 'utf8');
		assert.match(svg, /^\s*<svg\b[^>]*\bviewBox="/, file);
	}
	assert.match(fs.readFileSync(path.join(iconDir, 'LICENSE'), 'utf8'), /MIT License/);
});

test('every kind of file Clew opens has an icon of its own', () => {
	const samples = [
		...NOTE_EXTENSIONS, ...IMAGE_EXT, ...AUDIO_EXT, ...VIDEO_EXT, ...OFFICE_EXT,
		'.pdf', '.canvas', '.excalidraw', '.excalidraw.md', '.base', '.bib',
	].map((ext) => `Sample${ext}`);
	for (const name of samples) {
		const icon = fileIconName(name);
		assert.notEqual(icon, FILE_ICONS.file, `${name} is drawn as a plain file`);
		if (fileKind(name) === 'image') assert.ok(['image', 'svg'].includes(icon), `${name}: ${icon}`);
		if (fileKind(name) === 'audio') assert.equal(icon, 'audio', name);
		if (fileKind(name) === 'video') assert.equal(icon, 'video', name);
	}
});
