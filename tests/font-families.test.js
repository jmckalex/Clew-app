// What a figure's named font family is given (src/engine/font-families.js) —
// one rule for the preview (protocol.js) and an export (export-worker.mjs:
// processFile's figureFonts, jmarkdown 97caa3e): the index's files, whole;
// none ([], the engine's final "none") for a family this machine lacks or one
// past FAMILY_LIMIT, as the preview gets none; the index read from the cache
// file system-fonts.js#buildIndex keeps.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { familyFiles, readFontIndex, FAMILY_LIMIT } from '../src/engine/font-families.js';
import { familyFiles as mainFamilyFiles, FAMILY_LIMIT as mainLimit } from '../src/main/system-fonts.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-font-families-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const file = (name, bytes = 1000) => {
	const at = path.join(root, name);
	fs.writeFileSync(at, '');
	fs.truncateSync(at, bytes);   // sparse: a big file costs nothing
	return at;
};

test('a family\'s files, whole — every face a file of its own', () => {
	const faces = ['Georgia.ttf', 'Georgia Bold.ttf', 'Georgia Italic.ttf', 'Georgia Bold Italic.ttf'].map((n) => file(n));
	const index = new Map([['georgia', faces]]);
	assert.deepEqual(familyFiles(index, 'Georgia'), faces, 'its name matched without regard to case');
	assert.deepEqual(familyFiles(index, 'GEORGIA'), faces);
});

test('none for a family the machine lacks, past the cap, or whose files are gone — the engine searches no folder then', () => {
	const big = [file('Huge.ttc', FAMILY_LIMIT - 10), file('Huge Bold.ttc', 20)];
	const index = new Map([['huge', big], ['gone', [path.join(root, 'Gone.ttf')]]]);
	assert.deepEqual(familyFiles(index, 'Nowhere Sans'), []);
	assert.deepEqual(familyFiles(index, 'Huge'), [], 'together past FAMILY_LIMIT');
	assert.deepEqual(familyFiles(index, 'Gone'), [], 'a file the index names but the disk has not');
	const under = new Map([['under', [file('Under.ttc', FAMILY_LIMIT)]]]);
	assert.equal(familyFiles(under, 'Under').length, 1, 'at the cap: given');
});

test('readFontIndex: the cache buildIndex keeps, as a Map — null when it cannot be read', () => {
	const cache = path.join(root, 'system-fonts.json');
	fs.writeFileSync(cache, JSON.stringify({ stamp: 'x', families: { georgia: ['/a/Georgia.ttf'] } }));
	assert.deepEqual([...readFontIndex(cache)], [['georgia', ['/a/Georgia.ttf']]]);
	assert.equal(readFontIndex(path.join(root, 'none.json')), null);
	fs.writeFileSync(path.join(root, 'bad.json'), '{ not json');
	assert.equal(readFontIndex(path.join(root, 'bad.json')), null);
	fs.writeFileSync(path.join(root, 'odd.json'), '{"stamp":"x"}');
	assert.equal(readFontIndex(path.join(root, 'odd.json')), null);
});

test('main\'s system-fonts.js is the same rule, re-exported — the preview and an export cannot drift', () => {
	assert.equal(mainFamilyFiles, familyFiles);
	assert.equal(mainLimit, FAMILY_LIMIT);
});
