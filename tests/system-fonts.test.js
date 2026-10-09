// A figure's named font families (src/engine/figure-fonts.js) and the
// machine's fonts by family (src/main/system-fonts.js).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { namedFontFamilies } from '../src/engine/figure-fonts.js';
import { familiesOfFile, buildIndex, familyFiles } from '../src/main/system-fonts.js';

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-sysfonts-'));
after(() => fs.rmSync(base, { recursive: true, force: true }));

test('the families a figure names: every fontspec form, never a file or a macro', () => {
	const text = String.raw`\usepackage{fontspec}
\setmainfont{Optima}
\setsansfont[Ligatures=TeX]{Gill Sans}
\setmonofont{Menlo}[Scale=0.9]
\newfontfamily\head{Hoefler Text}[Color=red]
\newfontface \quote {Baskerville}
{\fontspec{Optima} again}
\setmainfont{NoteFont-Regular.ttf}[Path=./]
\setmathfont{\mathfont}`;
	assert.deepEqual(namedFontFamilies(text), ['Optima', 'Gill Sans', 'Menlo', 'Hoefler Text', 'Baskerville']);
	assert.deepEqual(namedFontFamilies('\\draw (0,0) circle (1);'), []);
	assert.deepEqual(namedFontFamilies(null), []);
});

// A minimal OpenType file: a table directory holding one `name` table whose
// records give the families (Windows platform, UTF-16BE).
function nameTable(records) {
	const strings = records.map(([, text]) => Buffer.from(text, 'utf16le').swap16());
	const head = Buffer.alloc(6 + 12 * records.length);
	head.writeUInt16BE(0, 0);
	head.writeUInt16BE(records.length, 2);
	head.writeUInt16BE(head.length, 4);
	let at = 0;
	records.forEach(([id], i) => {
		const o = 6 + 12 * i;
		head.writeUInt16BE(3, o); head.writeUInt16BE(1, o + 2); head.writeUInt16BE(0x409, o + 4);
		head.writeUInt16BE(id, o + 6); head.writeUInt16BE(strings[i].length, o + 8); head.writeUInt16BE(at, o + 10);
		at += strings[i].length;
	});
	return Buffer.concat([head, ...strings]);
}
/** One face whose directory sits at `offset` in its file. */
function face(records, offset = 0) {
	const name = nameTable(records);
	const dir = Buffer.alloc(28);
	dir.writeUInt32BE(0x00010000, 0);
	dir.writeUInt16BE(1, 4);
	dir.write('name', 12, 'latin1');
	dir.writeUInt32BE(offset + 28, 20);
	dir.writeUInt32BE(name.length, 24);
	return Buffer.concat([dir, name]);
}
function collection(faces) {
	const head = Buffer.alloc(12 + 4 * faces.length);
	head.write('ttcf', 0, 'latin1');
	head.writeUInt32BE(0x00010000, 4);
	head.writeUInt32BE(faces.length, 8);
	const parts = [];
	let offset = head.length;
	faces.forEach((records, i) => {
		head.writeUInt32BE(offset, 12 + 4 * i);
		const f = face(records, offset);
		parts.push(f);
		offset += f.length;
	});
	return Buffer.concat([head, ...parts]);
}

test('a file\'s families: a single face, and every face of a collection', () => {
	const dir = fs.mkdtempSync(path.join(base, 'fonts-'));
	fs.writeFileSync(path.join(dir, 'Optima.ttc'), collection([[[1, 'Optima']], [[1, 'Optima'], [16, 'Optima']]]));
	fs.writeFileSync(path.join(dir, 'AvenirNext-Demi.otf'), face([[1, 'Avenir Next Demi Bold'], [16, 'Avenir Next']]));
	fs.writeFileSync(path.join(dir, 'notes.txt'), 'not a font');
	assert.deepEqual(familiesOfFile(path.join(dir, 'Optima.ttc')), ['Optima']);
	assert.deepEqual(familiesOfFile(path.join(dir, 'AvenirNext-Demi.otf')).sort(), ['Avenir Next', 'Avenir Next Demi Bold']);
});

test('the index: by family, case-insensitive, sub-folders too, kept against the folders\' mtimes', () => {
	const dir = fs.mkdtempSync(path.join(base, 'fonts-'));
	fs.mkdirSync(path.join(dir, 'more'));
	fs.writeFileSync(path.join(dir, 'Optima.ttc'), collection([[[1, 'Optima']], [[1, 'Optima']]]));
	fs.writeFileSync(path.join(dir, 'more', 'GillSans.ttf'), face([[1, 'Gill Sans']]));
	const cache = path.join(base, 'index.json');
	const index = buildIndex([dir], cache);
	assert.deepEqual(familyFiles(index, 'optima').map((f) => path.basename(f)), ['Optima.ttc']);
	assert.deepEqual(familyFiles(index, 'Gill Sans').map((f) => path.basename(f)), ['GillSans.ttf']);
	assert.deepEqual(familyFiles(index, 'Nowhere'), []);
	// Kept: with the folders unchanged, a second build answers from the cache.
	assert.ok(fs.existsSync(cache));
	const again = buildIndex([dir], cache);
	assert.deepEqual([...again.keys()].sort(), ['gill sans', 'optima']);
	// A font added changes the folder's mtime: the index is rebuilt.
	fs.writeFileSync(path.join(dir, 'Menlo.ttc'), collection([[[1, 'Menlo']]]));
	const later = new Date(Date.now() + 5000);
	fs.utimesSync(dir, later, later);
	assert.deepEqual(familyFiles(buildIndex([dir], cache), 'Menlo').map((f) => path.basename(f)), ['Menlo.ttc']);
});
