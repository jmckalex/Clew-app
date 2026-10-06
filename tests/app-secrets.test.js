// An app's secrets on this device (src/main/app-secrets.js; frame-bridge.md §9c).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSecretStore } from '../src/main/app-secrets.js';

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-secrets-'));
after(() => fs.rmSync(base, { recursive: true, force: true }));

// A stand-in for safeStorage: reversible, and visibly not the plaintext.
const fakeCipher = (key = 7) => ({
	available: () => true,
	encrypt: (text) => Buffer.from([...Buffer.from(text, 'utf8')].map((b) => b ^ key)),
	decrypt: (buf) => Buffer.from([...buf].map((b) => b ^ key)).toString('utf8'),
});
const fileIn = (name) => path.join(fs.mkdtempSync(path.join(base, `${name}-`)), 'app-secrets.json');

test('kept by name, encrypted on disk, read back by a new store', () => {
	const file = fileIn('round');
	const store = createSecretStore({ file, cipher: fakeCipher() });
	const one = store.scoped('/vaults/A', 'ticker');
	assert.equal(one.get('finnhub-key'), null);
	assert.equal(one.set('finnhub-key', 'PLAINTEXT-KEY-123'), true);
	assert.equal(one.get('finnhub-key'), 'PLAINTEXT-KEY-123');
	const disk = fs.readFileSync(file, 'utf8');
	assert.ok(!disk.includes('PLAINTEXT-KEY-123'), 'never the plaintext on disk');
	assert.equal(fs.statSync(file).mode & 0o777, 0o600, 'the owner\'s alone');
	const again = createSecretStore({ file, cipher: fakeCipher() });
	assert.equal(again.scoped('/vaults/A', 'ticker').get('finnhub-key'), 'PLAINTEXT-KEY-123');
	assert.deepEqual(again.scoped('/vaults/A', 'ticker').names(), ['finnhub-key']);
	assert.equal(again.count('/vaults/A', 'ticker'), 1);
});

test('one app\'s scope: another app, and the same app in another vault, see nothing', () => {
	const store = createSecretStore({ file: fileIn('scope'), cipher: fakeCipher() });
	store.scoped('/vaults/A', 'ticker').set('k', 'mine');
	assert.equal(store.scoped('/vaults/A', 'timer').get('k'), null);
	assert.equal(store.scoped('/vaults/B', 'ticker').get('k'), null);
	assert.equal(store.scoped('/vaults/A', 'ticker').get('k'), 'mine');
});

test('delete says whether there was one; Revoke clears an app, Forget a vault', () => {
	const file = fileIn('clear');
	const store = createSecretStore({ file, cipher: fakeCipher() });
	const ticker = store.scoped('/vaults/A', 'ticker');
	ticker.set('a', '1');
	ticker.set('b', '2');
	store.scoped('/vaults/A', 'timer').set('c', '3');
	store.scoped('/vaults/B', 'ticker').set('d', '4');
	assert.equal(ticker.delete('a'), true);
	assert.equal(ticker.delete('a'), false);
	assert.equal(store.clearApp('/vaults/A', 'ticker'), true);
	assert.equal(ticker.get('b'), null);
	assert.equal(store.scoped('/vaults/A', 'timer').get('c'), '3', 'another app keeps its own');
	assert.equal(store.clearVault('/vaults/A'), true);
	assert.equal(store.scoped('/vaults/A', 'timer').get('c'), null);
	assert.equal(store.scoped('/vaults/B', 'ticker').get('d'), '4', 'another vault keeps its own');
	assert.equal(store.clearVault('/vaults/A'), false);
	const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
	assert.deepEqual(Object.keys(disk.vaults), ['/vaults/B'], 'emptied apps and vaults are dropped');
});

test('a value this device cannot decrypt reads as absent and is not destroyed', () => {
	const file = fileIn('foreign');
	createSecretStore({ file, cipher: fakeCipher(7) }).scoped('/v', 'app').set('k', 'value');
	const throwing = { available: () => true, encrypt: (t) => Buffer.from(t), decrypt: () => { throw new Error('Error while decrypting the ciphertext'); } };
	const other = createSecretStore({ file, cipher: throwing });
	assert.equal(other.scoped('/v', 'app').get('k'), null);
	assert.equal(other.count('/v', 'app'), 1, 'still there for the build that can read it');
	assert.equal(createSecretStore({ file, cipher: fakeCipher(7) }).scoped('/v', 'app').get('k'), 'value');
});

test('no secure storage: set refuses by code, nothing is written', () => {
	const file = fileIn('none');
	const store = createSecretStore({ file, cipher: { ...fakeCipher(), available: () => false } });
	assert.throws(() => store.scoped('/v', 'app').set('k', 'value'), (err) => err.code === 'unavailable' && !err.message.includes('value'));
	assert.equal(store.scoped('/v', 'app').get('k'), null);
	assert.equal(fs.existsSync(file), false);
	assert.equal(createSecretStore({ file, cipher: null }).scoped('/v', 'app').get('k'), null);
});

test('persist: false (a smoke run) keeps it in memory and writes nothing', () => {
	const file = fileIn('memory');
	const store = createSecretStore({ file, cipher: fakeCipher(), persist: false });
	store.scoped('/v', 'app').set('k', 'value');
	assert.equal(store.scoped('/v', 'app').get('k'), 'value');
	assert.equal(fs.existsSync(file), false);
});
