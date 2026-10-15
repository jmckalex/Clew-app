// The index cache's save (src/main/indexer.js#saveCache): the same file as
// before — `JSON.stringify({ version, notes })` — built in slices and written
// off main's thread (fs-utils.js#writeFileAtomicAsync), a newer index
// superseding a save under way.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Indexer, indexCacheJson } from '../src/main/indexer.js';
import { writeFileAtomicAsync } from '../src/main/fs-utils.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-index-cache-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
let made = 0;
const vaultWith = (files) => {
	const dir = path.join(root, `vault-${++made}`);
	fs.mkdirSync(path.join(dir, '.clew'), { recursive: true });   // the vault's, made as it opens
	for (const [rel, text] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
		fs.writeFileSync(path.join(dir, rel), text);
	}
	return dir;
};
const cacheOf = (dir) => JSON.parse(fs.readFileSync(path.join(dir, '.clew', 'cache.json'), 'utf8'));

test('indexCacheJson: byte for byte what one JSON.stringify gave, however many slices', async () => {
	const notes = new Map([
		['A.md', { title: 'A', links: [{ target: 'B', resolved: 'B.md' }], tags: ['x'], none: undefined }],
		['Fold/Ünïcödé “quoted”.md', { title: 'é\n"\\', headings: [], nested: { deep: [1, null, true] } }],
		['empty.md', {}],
	]);
	for (let i = 0; i < 500; i++) notes.set(`Bulk/${i}.md`, { title: `Note ${i}`, words: i, links: [] });
	const whole = JSON.stringify({ version: 5, notes: Object.fromEntries(notes) });
	let yields = 0;
	const sliced = await indexCacheJson(5, notes, () => { yields += 1; return false; }, 0);
	assert.equal(sliced, whole);
	assert.ok(yields >= notes.size - 1, `yielded between entries (${yields})`);
	assert.equal(await indexCacheJson(5, new Map()), JSON.stringify({ version: 5, notes: {} }));
});

test('indexCacheJson: null once a newer index makes it pointless', async () => {
	const notes = new Map(Array.from({ length: 50 }, (_, i) => [`${i}.md`, { i }]));
	let asked = 0;
	assert.equal(await indexCacheJson(5, notes, () => ++asked > 3, 0), null);
});

test('writeFileAtomicAsync: written whole, or — stale before its rename — not at all, no temp left', async () => {
	const dir = path.join(root, 'writes');
	fs.mkdirSync(dir);
	const file = path.join(dir, 'cache.json');
	fs.writeFileSync(file, 'old');
	fs.chmodSync(file, 0o640);
	assert.equal(await writeFileAtomicAsync(file, 'new'), true);
	assert.equal(fs.readFileSync(file, 'utf8'), 'new');
	assert.equal(fs.statSync(file).mode & 0o777, 0o640, 'its mode kept');
	assert.equal(await writeFileAtomicAsync(file, 'newer, but stale', () => true), false);
	assert.equal(fs.readFileSync(file, 'utf8'), 'new', 'untouched');
	assert.deepEqual(fs.readdirSync(dir), ['cache.json'], 'no temp file left');
});

test('saveCache: the cache read back is the index, and a new Indexer opens from it', async () => {
	const dir = vaultWith({ 'A.md': '# A\n\n[[B]] #tag\n', 'B.md': '# B\n', 'Sub/C.md': '---\ntitle: C\n---\nText.\n' });
	const indexer = new Indexer();
	indexer.restricted = false;
	indexer.openVault(dir);
	await indexer.saveCache();
	const cache = cacheOf(dir);
	assert.deepEqual(cache, JSON.parse(JSON.stringify({ version: cache.version, ...indexer.snapshot() })));
	assert.deepEqual(Object.keys(cache.notes).sort(), ['A.md', 'B.md', 'Sub/C.md']);
	const again = new Indexer();
	again.restricted = false;
	again.openVault(dir);
	assert.deepEqual(again.snapshot(), indexer.snapshot(), 'opened from the cache, the same index');
	indexer.closeVault();
	again.closeVault();
});

test('saveCache: a change under way supersedes the older save — the newest index is what lands', async () => {
	const files = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`N${i}.md`, `# N${i}\n\n${'words '.repeat(50)}\n`]));
	const dir = vaultWith(files);
	const indexer = new Indexer();
	indexer.restricted = false;
	indexer.openVault(dir);
	const older = indexer.saveCache();
	fs.writeFileSync(path.join(dir, 'N0.md'), '# Changed title\n');
	indexer.onFileChanged('N0.md');   // the newer index: the older save is now pointless
	const newer = indexer.saveCache();
	await older;
	await newer;
	assert.equal(cacheOf(dir).notes['N0.md'].headings[0].text, 'Changed title');
	assert.deepEqual(fs.readdirSync(path.join(dir, '.clew')).filter((f) => f.includes('clew-tmp')), [], 'no temp file left');
	indexer.closeVault();
});

test('saveCache: a vault closed while its save is under way is not written', async () => {
	const dir = vaultWith(Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`N${i}.md`, `# N${i}\n`])));
	const indexer = new Indexer();
	indexer.restricted = false;
	indexer.openVault(dir);
	const saving = indexer.saveCache();
	indexer.closeVault();
	await saving;
	assert.equal(fs.existsSync(path.join(dir, '.clew', 'cache.json')), false);
});
