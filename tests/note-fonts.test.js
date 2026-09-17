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
import {
	extractFace, faceExtension, faceNames, faceOffsets, fileChecksum, noteFontFiles,
	prepareNoteFonts, readNoteFonts, tableChecksum, tableDirectory,
} from '../src/main/note-fonts.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'clew-note-fonts-'));

// ---- a collection built by hand, so the extractor is tested everywhere ----

/** A `name` table (format 0) holding Windows-Unicode family and subfamily strings. */
function nameTable(family, subfamily) {
	const strings = [[1, family], [2, subfamily]];
	const encoded = strings.map(([id, text]) => [id, Buffer.from(text, 'utf16le').swap16()]);
	const stringData = Buffer.concat(encoded.map(([, b]) => b));
	const header = Buffer.alloc(6 + 12 * encoded.length);
	header.writeUInt16BE(0, 0);
	header.writeUInt16BE(encoded.length, 2);
	header.writeUInt16BE(header.length, 4);
	let offset = 0;
	encoded.forEach(([id, bytes], i) => {
		const at = 6 + 12 * i;
		header.writeUInt16BE(3, at); header.writeUInt16BE(1, at + 2); header.writeUInt16BE(0x409, at + 4);
		header.writeUInt16BE(id, at + 6); header.writeUInt16BE(bytes.length, at + 8); header.writeUInt16BE(offset, at + 10);
		offset += bytes.length;
	});
	return Buffer.concat([header, stringData]);
}

/** Two faces sharing one `glyf`, each with its own `name` and `head` — the shape of a real .ttc. */
function collection() {
	const glyf = Buffer.from('shared-glyph-data!!'); // 19 bytes: alignment padding matters
	const head = (adjust) => { const b = Buffer.alloc(54); b.writeUInt32BE(0x00010000, 0); b.writeUInt32BE(adjust, 8); b.writeUInt16BE(1000, 18); return b; };
	const faces = [
		{ head: head(0x11111111), name: nameTable('Test Family', 'Regular') },
		{ head: head(0x22222222), name: nameTable('Test Family', 'Bold') },
	];
	// Layout: ttcf header, two directories, then the table data.
	const dirSize = 12 + 16 * 3;
	const headerSize = 12 + 4 * faces.length;
	let cursor = headerSize + dirSize * faces.length;
	const place = (buf) => { const at = cursor; cursor = (cursor + buf.length + 3) & ~3; return at; };
	const glyfAt = place(glyf);
	const placed = faces.map((f) => ({ ...f, headAt: place(f.head), nameAt: place(f.name) }));
	const out = Buffer.alloc(cursor);
	out.write('ttcf', 0, 'latin1'); out.writeUInt32BE(0x00010000, 4); out.writeUInt32BE(faces.length, 8);
	placed.forEach((f, i) => {
		const dir = headerSize + dirSize * i;
		out.writeUInt32BE(dir, 12 + 4 * i);
		out.writeUInt32BE(0x00010000, dir); out.writeUInt16BE(3, dir + 4);
		const records = [['glyf', glyfAt, glyf.length, 7], ['head', f.headAt, f.head.length, 8], ['name', f.nameAt, f.name.length, 9]];
		records.forEach(([tag, at, length, checksum], j) => {
			const r = dir + 12 + 16 * j;
			out.write(tag, r, 'latin1'); out.writeUInt32BE(checksum, r + 4); out.writeUInt32BE(at, r + 8); out.writeUInt32BE(length, r + 12);
		});
		glyf.copy(out, glyfAt); f.head.copy(out, f.headAt); f.name.copy(out, f.nameAt);
	});
	return out;
}

test('a collection lists its faces, and each names itself', () => {
	const ttc = collection();
	const offsets = faceOffsets(ttc);
	assert.equal(offsets.length, 2);
	assert.deepEqual(faceNames(ttc, offsets[0]), { family: 'Test Family', subfamily: 'Regular' });
	assert.deepEqual(faceNames(ttc, offsets[1]), { family: 'Test Family', subfamily: 'Bold' });
	assert.deepEqual(faceOffsets(Buffer.from('\x00\x01\x00\x00plain-font', 'latin1')), [0], 'a plain font is one face at 0');
});

test('an extracted face is a standalone font: same tables, aligned, summing to the sfnt magic', () => {
	const ttc = collection();
	const [, boldAt] = faceOffsets(ttc);
	const bold = extractFace(ttc, boldAt);
	assert.deepEqual(faceOffsets(bold), [0]);
	const dir = tableDirectory(bold, 0);
	assert.deepEqual(dir.records.map((r) => r.tag), ['glyf', 'head', 'name']);
	for (const r of dir.records) assert.equal(r.offset % 4, 0, `${r.tag} is 4-byte aligned`);
	const original = tableDirectory(ttc, boldAt).records;
	for (const r of dir.records) {
		const o = original.find((x) => x.tag === r.tag);
		assert.equal(r.length, o.length);
		if (r.tag === 'head') {
			// The spec's value: the table summed with checkSumAdjustment zeroed — not the collection's word.
			const copy = Buffer.from(bold.subarray(r.offset, r.offset + r.length));
			copy.writeUInt32BE(0, 8);
			assert.equal(r.checksum, tableChecksum(copy, 0, copy.length), 'head’s record checksum is recomputed for this file');
			assert.notEqual(r.checksum, o.checksum, 'and the collection’s word (for its own adjustment) is not what is written');
		} else {
			assert.equal(r.checksum, o.checksum, 'per-table checksums carry over — the bytes are the same bytes');
			assert.deepEqual(bold.subarray(r.offset, r.offset + r.length), ttc.subarray(o.offset, o.offset + o.length));
		}
	}
	assert.equal(tableChecksum(Buffer.from([0, 0, 0, 1, 0, 0, 0, 2, 0xff]), 0, 9), (3 + 0xff000000) >>> 0, 'the tail is zero-padded to a word');
	assert.equal(fileChecksum(bold), 0xB1B0AFBA, 'head.checkSumAdjustment was recomputed for the new file');
	assert.deepEqual(faceNames(bold, 0), { family: 'Test Family', subfamily: 'Bold' });
	assert.equal(faceExtension(bold), '.ttf');
	assert.equal(faceExtension(Buffer.from('OTTO....')), '.otf');
});

test('the file-per-face platforms copy what is there and index it; a face missing is a face missing', () => {
	const fonts = tmp();
	const winDir = path.join(fonts, 'win');
	fs.mkdirSync(path.join(winDir, 'Fonts'), { recursive: true });
	for (const f of ['segoeui.ttf', 'segoeuib.ttf', 'segoeuiz.ttf']) fs.writeFileSync(path.join(winDir, 'Fonts', f), `bytes of ${f}`);
	const dir = path.join(fonts, 'out');
	const index = prepareNoteFonts(dir, { platform: 'win32', env: { WINDIR: winDir } });
	assert.equal(index.family, 'Segoe UI');
	assert.deepEqual(index.faces, { Regular: 'NoteFont-Regular.ttf', Bold: 'NoteFont-Bold.ttf', BoldItalic: 'NoteFont-BoldItalic.ttf' }, 'no italic file, no Italic face');
	assert.equal(fs.readFileSync(path.join(dir, 'NoteFont-Bold.ttf'), 'utf8'), 'bytes of segoeuib.ttf');
	assert.deepEqual(readNoteFonts(dir), index, 'index.json says the same');
	assert.deepEqual(Object.keys(noteFontFiles(dir)).sort(), ['NoteFont-Bold.ttf', 'NoteFont-BoldItalic.ttf', 'NoteFont-Regular.ttf']);
	assert.ok(noteFontFiles(dir)['NoteFont-Regular.ttf'] instanceof Uint8Array, 'the shape addFiles takes');
	// A second run over an unchanged source is a no-op; a platform with nothing listed writes an empty index.
	assert.deepEqual(prepareNoteFonts(dir, { platform: 'win32', env: { WINDIR: winDir } }), index);
	const none = prepareNoteFonts(path.join(fonts, 'none'), { platform: 'freebsd', env: {} });
	assert.deepEqual(none.faces, {});
	assert.equal(none.family, null);
	assert.deepEqual(noteFontFiles(path.join(fonts, 'none')), {});
	fs.rmSync(fonts, { recursive: true, force: true });
});

test('macOS: the four Avenir Next faces come out of the system collection, one file each', (t) => {
	const collectionPath = '/System/Library/Fonts/Avenir Next.ttc';
	if (process.platform !== 'darwin' || !fs.existsSync(collectionPath)) return t.skip('not a Mac with Avenir Next');
	const dir = tmp();
	const index = prepareNoteFonts(dir, { platform: 'darwin', env: {} });
	assert.equal(index.family, 'Avenir Next');
	assert.deepEqual(Object.keys(index.faces).sort(), ['Bold', 'BoldItalic', 'Italic', 'Regular']);
	const want = { Regular: 'Regular', Bold: 'Bold', Italic: 'Italic', BoldItalic: 'Bold Italic' };
	for (const [face, file] of Object.entries(index.faces)) {
		const bytes = fs.readFileSync(path.join(dir, file));
		assert.deepEqual(faceNames(bytes, 0), { family: 'Avenir Next', subfamily: want[face] }, `${file} is the ${face} face, not the collection’s index 0 (which is Bold)`);
		assert.equal(fileChecksum(bytes), 0xB1B0AFBA, `${file} sums to the magic`);
		assert.ok(bytes.length > 100000, `${file} carries its outlines`);
	}
	assert.equal(fs.readdirSync(dir).filter((f) => f.startsWith('NoteFont-')).length, 4, 'nothing else written');
	fs.rmSync(dir, { recursive: true, force: true });
});
