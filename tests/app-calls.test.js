import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { callApp } from '../src/main/app-calls.js';
import { compileExcludes } from '../src/main/vault-excludes.js';

// One temp root for this file, removed when it is done. Fixtures used to be
// left in the system's temp folder, each with a link out of itself — one of
// them to the temp folder ITSELF, a web of cycles that grew by one per run
// (429 found, 2026-10-03) for any walk that follows links.
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-calls-'));
after(() => fs.rmSync(base, { recursive: true, force: true }));

function fixture({ restricted = false, granted = [] } = {}) {
	const root = fs.mkdtempSync(path.join(base, 'vault-'));
	const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
	put('Here.md', '---\ntitle: Here\n---\n# Here\n[[There]]');
	put('There.md', '# There');
	put('.clew/vault-settings.json', '{}');
	put('Apps/T/clew-app.json', '{"id":"t"}');
	const outside = fs.mkdtempSync(path.join(base, 'outside-'));
	fs.writeFileSync(path.join(outside, 'secret.md'), 'SECRET');
	fs.symlinkSync(outside, path.join(root, 'Linked'));
	const kv = new Map();
	const ctx = {
		root, restricted, excludes: compileExcludes({}), notePath: 'Here.md',
		app: { abs: path.join(root, 'Apps/T'), manifest: { id: 't' } },
		granted: new Set(granted),
		indexer: { notes: new Map([['Here.md', { links: [{ target: 'There', resolved: 'There.md' }] }], ['There.md', { links: [] }]]) },
		search: { search: (q) => [{ path: 'Here.md', q }] },
		kv: { get: (k) => kv.get(k), set: (k, v) => (kv.set(k, v), v), delete: (k) => (kv.delete(k), null), list: (pre) => Object.fromEntries([...kv].filter(([k]) => k.startsWith(pre))) },
	};
	return { ctx, root, kv, outside };
}

test('note.read reads the embedding note only; notes.read any text file', async () => {
	const { ctx } = fixture({ granted: ['note.read'] });
	assert.equal((await callApp(ctx, 'notes.read', {})).result.startsWith('---'), true);
	assert.equal((await callApp(ctx, 'notes.read', { path: 'There.md' })).error.code, 'denied');
	assert.deepEqual((await callApp(ctx, 'properties.get', {})).result, { title: 'Here' });
	ctx.granted.add('notes.read');
	assert.equal((await callApp(ctx, 'notes.read', { path: 'There.md' })).result, '# There');
	assert.equal((await callApp(ctx, 'notes.read', { path: '.clew/vault-settings.json' })).error.code, 'not-found', 'never .clew/');
	assert.equal((await callApp(ctx, 'notes.read', { path: '../etc/passwd.md' })).error.code, 'bad-params');
	assert.equal((await callApp(ctx, 'notes.read', { path: 'Apps/T/x.png' })).error.code, 'denied');
});

test('a restricted vault: a symlink out of the vault reads as not-found (§6); trusted, the link is followed', async () => {
	const restricted = fixture({ restricted: true, granted: ['notes.read', 'query'] });
	assert.equal((await callApp(restricted.ctx, 'notes.read', { path: 'Linked/secret.md' })).error.code, 'not-found');
	// …and the index never even NAMES it (the indexer follows links).
	restricted.ctx.indexer.notes.set('Linked/secret.md', { links: [{ target: 'There', resolved: 'There.md' }] });
	restricted.ctx.search = { search: () => [{ path: 'Linked/secret.md' }, { path: 'Here.md' }] };
	assert.deepEqual((await callApp(restricted.ctx, 'notes.list')).result, ['Here.md', 'There.md']);
	assert.deepEqual((await callApp(restricted.ctx, 'search', { query: 'x' })).result.map((h) => h.path), ['Here.md']);
	assert.equal((await callApp(restricted.ctx, 'index.get', { path: 'Linked/secret.md' })).result, null);
	assert.deepEqual((await callApp(restricted.ctx, 'index.backlinks', { path: 'There.md' })).result, ['Here.md']);
	const trusted = fixture({ restricted: false, granted: ['notes.read'] });
	assert.equal((await callApp(trusted.ctx, 'notes.read', { path: 'Linked/secret.md' })).result, 'SECRET');
});

test('query, kv in the app\'s own namespace, and denied without the grant', async () => {
	const { ctx, kv } = fixture({ granted: ['query', 'app.kv'] });
	assert.deepEqual((await callApp(ctx, 'notes.list')).result, ['Here.md', 'There.md']);
	assert.deepEqual((await callApp(ctx, 'index.backlinks', { path: 'There.md' })).result, ['Here.md']);
	await callApp(ctx, 'kv.set', { key: 'best', value: 42 });
	assert.equal(kv.get('apps/t/best'), 42);
	assert.deepEqual((await callApp(ctx, 'kv.list')).result, { best: 42 });
	assert.equal((await callApp(ctx, 'files.list')).error.code, 'denied');
	assert.equal((await callApp(ctx, 'command', {})).error.code, 'unknown-method', 'never Tier 1');
});

test('app.files: inside data/, no dot names, no notes, limits', async () => {
	const { ctx, root, outside } = fixture({ granted: ['app.files'] });
	assert.deepEqual((await callApp(ctx, 'files.write', { path: 'saves/one.json', data: '{"a":1}' })).result, { path: 'saves/one.json', size: 7 });
	assert.equal(fs.readFileSync(path.join(root, 'Apps/T/data/saves/one.json'), 'utf8'), '{"a":1}');
	assert.equal((await callApp(ctx, 'files.read', { path: 'saves/one.json' })).result, '{"a":1}');
	assert.deepEqual([...(await callApp(ctx, 'files.read', { path: 'saves/one.json', as: 'bytes' })).result].length, 7);
	assert.deepEqual((await callApp(ctx, 'files.list', { path: 'saves' })).result, [{ name: 'one.json', kind: 'file', size: 7 }]);
	assert.equal((await callApp(ctx, 'files.write', { path: '../clew-app.json', data: 'x' })).error.code, 'bad-params');
	assert.equal((await callApp(ctx, 'files.write', { path: '.hidden', data: 'x' })).error.code, 'denied');
	assert.equal((await callApp(ctx, 'files.write', { path: 'note.md', data: 'x' })).error.code, 'denied');
	assert.equal((await callApp(ctx, 'files.write', { path: 'big.bin', data: new Uint8Array(25 * 1024 * 1024 + 1) })).error.code, 'too-large');
	// A link out of the data folder — to this fixture's own outside folder,
	// never to the temp folder at large.
	fs.symlinkSync(outside, path.join(root, 'Apps/T/data/out'));
	assert.equal((await callApp(ctx, 'files.write', { path: 'out/escape.txt', data: 'x' })).error.code, 'denied', 'a link cannot carry a write out');
	assert.equal((await callApp(ctx, 'files.delete', { path: 'saves/one.json' })).result, true);
});

test('the write side: authorized here, performed by the host; create never overwrites', async () => {
	const { ctx, root } = fixture({ granted: ['note.write', 'notes.create', 'editor.insert', 'find'] });
	assert.deepEqual((await callApp(ctx, 'notes.write', { content: 'x' })).result, { perform: 'write', path: 'Here.md' });
	assert.equal((await callApp(ctx, 'notes.write', { path: 'There.md', content: 'x' })).error.code, 'denied', 'note.write is the embedding note only');
	assert.equal((await callApp(ctx, 'notes.write', { content: 7 })).error.code, 'bad-params');
	assert.deepEqual((await callApp(ctx, 'properties.set', { key: 'k', value: 1 })).result, { perform: 'properties', path: 'Here.md' });
	assert.deepEqual((await callApp(ctx, 'notes.append', { text: 'more' })).result, { perform: 'append', path: 'Here.md' });
	assert.deepEqual((await callApp(ctx, 'notes.create', { path: 'New/Made.md', content: '# Made' })).result, { created: 'New/Made.md' });
	assert.equal(fs.readFileSync(path.join(root, 'New/Made.md'), 'utf8'), '# Made');
	assert.equal((await callApp(ctx, 'notes.create', { path: 'Here.md', content: 'clobber' })).error.code, 'conflict');
	assert.equal(fs.readFileSync(path.join(root, 'Here.md'), 'utf8').includes('# Here'), true, 'untouched');
	assert.equal((await callApp(ctx, 'notes.create', { path: '.clew/x.md' })).error.code, 'denied', 'never .clew/');
	// Restricted: a new note in the vault is fine; one under a link out is not.
	const r = fixture({ restricted: true, granted: ['notes.create'] });
	assert.deepEqual((await callApp(r.ctx, 'notes.create', { path: 'Fresh/One.md' })).result, { created: 'Fresh/One.md' });
	assert.equal((await callApp(r.ctx, 'notes.create', { path: 'Linked/planted.md' })).error.code, 'denied');
	assert.equal((await callApp(ctx, 'notes.create', { path: 'x.txt' })).error.code, 'bad-params');
	assert.deepEqual((await callApp(ctx, 'editor.insert', { text: 'hi' })).result, { perform: 'insert', path: 'Here.md' });
	assert.deepEqual((await callApp(ctx, 'find.show', { query: 'q' })).result, { perform: 'find', path: 'Here.md', query: 'q' });
	assert.equal((await callApp(ctx, 'clipboard.copy', { text: 'x' })).error.code, 'denied');
	const withClip = fixture({ granted: ['clipboard'] });
	let copied = null;
	withClip.ctx.clipboard = { writeText: (t) => { copied = t; }, readText: () => 'pasted' };
	assert.equal((await callApp(withClip.ctx, 'clipboard.copy', { text: 'x' })).result, true);
	assert.equal(copied, 'x');
	assert.equal((await callApp(withClip.ctx, 'clipboard.paste')).result, 'pasted');
});

test('app.secrets: kept by name, limits by code, and never a value without the grant', async () => {
	// An async store, as Clew-iOS's Keychain is: callApp awaits it.
	const kept = new Map();
	const store = {
		get: async (n) => kept.get(n) ?? null,
		set: async (n, v) => { kept.set(n, v); return true; },
		delete: async (n) => kept.delete(n),
		names: async () => [...kept.keys()],
	};
	const without = fixture();
	without.ctx.secrets = store;
	kept.set('api-key', 'KEY-VALUE');
	for (const [method, params] of [['secrets.get', { name: 'api-key' }], ['secrets.set', { name: 'api-key', value: 'other' }], ['secrets.delete', { name: 'api-key' }]]) {
		const out = await callApp(without.ctx, method, params);
		assert.equal(out.ok, false, method);
		assert.equal(out.error.code, 'denied', `${method}: not granted (or revoked) is denied`);
		assert.ok(!JSON.stringify(out).includes('KEY-VALUE'), `${method}: no value in a refusal`);
	}
	assert.equal(kept.get('api-key'), 'KEY-VALUE', 'a refused set changes nothing');
	kept.clear();

	const { ctx } = fixture({ granted: ['app.secrets'] });
	ctx.secrets = store;
	assert.equal((await callApp(ctx, 'secrets.get', { name: 'api-key' })).result, null);
	assert.equal((await callApp(ctx, 'secrets.set', { name: 'api-key', value: 'KEY-VALUE' })).result, true);
	assert.equal((await callApp(ctx, 'secrets.get', { name: 'api-key' })).result, 'KEY-VALUE');
	assert.equal((await callApp(ctx, 'secrets.delete', { name: 'api-key' })).result, true);
	assert.equal((await callApp(ctx, 'secrets.delete', { name: 'api-key' })).result, false, 'gone already');
	assert.equal((await callApp(ctx, 'secrets.get', { name: 'api-key' })).result, null);

	assert.equal((await callApp(ctx, 'secrets.set', { name: '../x', value: 'v' })).error.code, 'bad-params');
	assert.equal((await callApp(ctx, 'secrets.set', { name: 'x'.repeat(65), value: 'v' })).error.code, 'bad-params');
	assert.equal((await callApp(ctx, 'secrets.set', { name: 'n', value: 7 })).error.code, 'bad-params');
	const tooLarge = await callApp(ctx, 'secrets.set', { name: 'n', value: 'é'.repeat(4097) });   // 8,194 bytes
	assert.equal(tooLarge.error.code, 'too-large');
	assert.ok(!tooLarge.error.message.includes('é'), 'the message never carries the value');
	for (let i = 0; i < 32; i++) await callApp(ctx, 'secrets.set', { name: `k${i}`, value: 'v' });
	assert.equal((await callApp(ctx, 'secrets.set', { name: 'k32', value: 'v' })).error.code, 'too-many');
	assert.equal((await callApp(ctx, 'secrets.set', { name: 'k0', value: 'replaced' })).result, true, 'replacing one is not a 33rd');

	const noStore = fixture({ granted: ['app.secrets'] });
	assert.equal((await callApp(noStore.ctx, 'secrets.get', { name: 'n' })).error.code, 'unavailable');
});
