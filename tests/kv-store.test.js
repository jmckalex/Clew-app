import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { KvStore, KV_FILE } from '../src/main/kv-store.js';

function makeStore() {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-kv-'));
	const store = new KvStore();
	const events = [];
	store.send = (_ch, payload) => events.push(payload);
	store.open(root);
	return { root, store, events };
}

test('set/get/delete/list with prefix, events per change', () => {
	const { store, events } = makeStore();
	store.set('habits:mon', 3);
	store.set('habits:tue', { done: true });
	store.set('other', 'x');
	assert.equal(store.get('habits:mon'), 3);
	assert.deepEqual(store.list('habits:'), { 'habits:mon': 3, 'habits:tue': { done: true } });
	store.delete('other');
	assert.equal(store.get('other'), undefined);
	assert.equal(events.length, 4);
	assert.deepEqual(events.at(-1).changes, [{ key: 'other', value: null }]);
	store.close();
});

test('persists sorted, reloads, null set means delete', () => {
	const { root, store } = makeStore();
	store.set('b', 2);
	store.set('a', 1);
	store.set('b', null); // delete via null
	store.flush();
	const text = fs.readFileSync(path.join(root, KV_FILE), 'utf8');
	assert.equal(text, '{\n\t"a": 1\n}\n');
	const second = new KvStore();
	second.open(root);
	assert.equal(second.get('a'), 1);
	second.close();
	store.close();
});

test('externalChange diffs and broadcasts, ignores own echo', () => {
	const { root, store, events } = makeStore();
	store.set('x', 1);
	store.flush();
	events.length = 0;
	store.externalChange(); // echo of our own write
	assert.equal(events.length, 0);
	fs.writeFileSync(path.join(root, KV_FILE), JSON.stringify({ x: 2, y: 'new' }));
	store.externalChange();
	assert.equal(events.length, 1);
	const changes = events[0].changes.sort((a, b) => a.key.localeCompare(b.key));
	assert.deepEqual(changes, [{ key: 'x', value: 2 }, { key: 'y', value: 'new' }]);
	assert.equal(store.get('y'), 'new');
	store.close();
});

test('rejects non-JSON-safe values and bad keys', () => {
	const { store } = makeStore();
	assert.throws(() => store.set('', 1));
	assert.throws(() => store.set('cycle', (() => { const o = {}; o.self = o; return o; })()));
	store.close();
});
