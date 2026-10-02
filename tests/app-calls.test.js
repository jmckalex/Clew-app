import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { callApp } from '../src/main/app-calls.js';
import { compileExcludes } from '../src/main/vault-excludes.js';

function fixture({ restricted = false, granted = [] } = {}) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-calls-'));
	const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
	put('Here.md', '---\ntitle: Here\n---\n# Here\n[[There]]');
	put('There.md', '# There');
	put('.clew/vault-settings.json', '{}');
	put('Apps/T/clew-app.json', '{"id":"t"}');
	const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-outside-'));
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
	return { ctx, root, kv };
}

test('note.read reads the embedding note only; notes.read any text file', () => {
	const { ctx } = fixture({ granted: ['note.read'] });
	assert.equal(callApp(ctx, 'notes.read', {}).result.startsWith('---'), true);
	assert.equal(callApp(ctx, 'notes.read', { path: 'There.md' }).error.code, 'denied');
	assert.deepEqual(callApp(ctx, 'properties.get', {}).result, { title: 'Here' });
	ctx.granted.add('notes.read');
	assert.equal(callApp(ctx, 'notes.read', { path: 'There.md' }).result, '# There');
	assert.equal(callApp(ctx, 'notes.read', { path: '.clew/vault-settings.json' }).error.code, 'not-found', 'never .clew/');
	assert.equal(callApp(ctx, 'notes.read', { path: '../etc/passwd.md' }).error.code, 'bad-params');
	assert.equal(callApp(ctx, 'notes.read', { path: 'Apps/T/x.png' }).error.code, 'denied');
});

test('a restricted vault: a symlink out of the vault reads as not-found (§6); trusted, the link is followed', () => {
	const restricted = fixture({ restricted: true, granted: ['notes.read', 'query'] });
	assert.equal(callApp(restricted.ctx, 'notes.read', { path: 'Linked/secret.md' }).error.code, 'not-found');
	// …and the index never even NAMES it (the indexer follows links).
	restricted.ctx.indexer.notes.set('Linked/secret.md', { links: [{ target: 'There', resolved: 'There.md' }] });
	restricted.ctx.search = { search: () => [{ path: 'Linked/secret.md' }, { path: 'Here.md' }] };
	assert.deepEqual(callApp(restricted.ctx, 'notes.list').result, ['Here.md', 'There.md']);
	assert.deepEqual(callApp(restricted.ctx, 'search', { query: 'x' }).result.map((h) => h.path), ['Here.md']);
	assert.equal(callApp(restricted.ctx, 'index.get', { path: 'Linked/secret.md' }).result, null);
	assert.deepEqual(callApp(restricted.ctx, 'index.backlinks', { path: 'There.md' }).result, ['Here.md']);
	const trusted = fixture({ restricted: false, granted: ['notes.read'] });
	assert.equal(callApp(trusted.ctx, 'notes.read', { path: 'Linked/secret.md' }).result, 'SECRET');
});

test('query, kv in the app\'s own namespace, and denied without the grant', () => {
	const { ctx, kv } = fixture({ granted: ['query', 'app.kv'] });
	assert.deepEqual(callApp(ctx, 'notes.list').result, ['Here.md', 'There.md']);
	assert.deepEqual(callApp(ctx, 'index.backlinks', { path: 'There.md' }).result, ['Here.md']);
	callApp(ctx, 'kv.set', { key: 'best', value: 42 });
	assert.equal(kv.get('apps/t/best'), 42);
	assert.deepEqual(callApp(ctx, 'kv.list').result, { best: 42 });
	assert.equal(callApp(ctx, 'files.list').error.code, 'denied');
	assert.equal(callApp(ctx, 'command', {}).error.code, 'unknown-method', 'never Tier 1');
});

test('app.files: inside data/, no dot names, no notes, limits', () => {
	const { ctx, root } = fixture({ granted: ['app.files'] });
	assert.deepEqual(callApp(ctx, 'files.write', { path: 'saves/one.json', data: '{"a":1}' }).result, { path: 'saves/one.json', size: 7 });
	assert.equal(fs.readFileSync(path.join(root, 'Apps/T/data/saves/one.json'), 'utf8'), '{"a":1}');
	assert.equal(callApp(ctx, 'files.read', { path: 'saves/one.json' }).result, '{"a":1}');
	assert.deepEqual([...callApp(ctx, 'files.read', { path: 'saves/one.json', as: 'bytes' }).result].length, 7);
	assert.deepEqual(callApp(ctx, 'files.list', { path: 'saves' }).result, [{ name: 'one.json', kind: 'file', size: 7 }]);
	assert.equal(callApp(ctx, 'files.write', { path: '../clew-app.json', data: 'x' }).error.code, 'bad-params');
	assert.equal(callApp(ctx, 'files.write', { path: '.hidden', data: 'x' }).error.code, 'denied');
	assert.equal(callApp(ctx, 'files.write', { path: 'note.md', data: 'x' }).error.code, 'denied');
	assert.equal(callApp(ctx, 'files.write', { path: 'big.bin', data: new Uint8Array(25 * 1024 * 1024 + 1) }).error.code, 'too-large');
	fs.symlinkSync(os.tmpdir(), path.join(root, 'Apps/T/data/out'));
	assert.equal(callApp(ctx, 'files.write', { path: 'out/escape.txt', data: 'x' }).error.code, 'denied', 'a link cannot carry a write out');
	assert.equal(callApp(ctx, 'files.delete', { path: 'saves/one.json' }).result, true);
});
