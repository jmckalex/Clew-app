import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTrustStore, fingerprintOf, identityKey } from '../src/main/vault-trust.js';

function scratch() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-trust-'));
	const vault = (name) => {
		const root = path.join(dir, name);
		fs.mkdirSync(root, { recursive: true });
		return root;
	};
	return { dir, file: path.join(dir, 'userData', 'vault-trust.json'), vault };
}

test('an unknown vault is not trusted', () => {
	const { file, vault } = scratch();
	const store = createTrustStore({ file });
	store.migrate([]);
	assert.equal(store.isTrusted(vault('New')), false);
});

test('migration trusts every vault the device already knew, once', () => {
	const { file, vault } = scratch();
	const a = vault('A');
	const b = vault('B');
	const store = createTrustStore({ file });
	assert.equal(store.migrate([a, b, a]), 2);
	assert.equal(store.isTrusted(a), true);
	assert.equal(store.isTrusted(b), true);
	// A second launch: already migrated, so a vault first seen now stays unknown.
	const later = createTrustStore({ file });
	const c = vault('C');
	assert.equal(later.migrate([a, b, c]), 0);
	assert.equal(later.isTrusted(c), false);
	assert.equal(later.isTrusted(a), true);
});

test('a different vault unpacked at a trusted path asks again', () => {
	const { file, vault } = scratch();
	const a = vault('A');
	const store = createTrustStore({ file });
	store.migrate([]);
	store.trust(a);
	assert.equal(store.isTrusted(a), true);
	fs.rmSync(a, { recursive: true });
	fs.mkdirSync(a);   // same path, new directory: a new inode
	assert.equal(store.isTrusted(a), false);
});

test('the identity is the realpath, so a symlinked path is the same vault', () => {
	const { dir, file, vault } = scratch();
	const a = vault('A');
	const link = path.join(dir, 'link-to-A');
	fs.symlinkSync(a, link);
	const store = createTrustStore({ file });
	store.migrate([]);
	store.trust(link);
	assert.equal(store.isTrusted(a), true);
	assert.equal(identityKey(link), fs.realpathSync(a));
});

test('revoking restricts it again, and the decision persists', () => {
	const { file, vault } = scratch();
	const a = vault('A');
	const store = createTrustStore({ file });
	store.migrate([a]);
	store.revoke(a);
	assert.equal(store.isTrusted(a), false);
	assert.equal(createTrustStore({ file }).isTrusted(a), false);
	createTrustStore({ file }).trust(a);
	assert.equal(createTrustStore({ file }).isTrusted(a), true);
});

test('a known vault absent at migration takes its fingerprint when next seen', () => {
	const { dir, file } = scratch();
	const away = path.join(dir, 'Away');
	const store = createTrustStore({ file });
	store.migrate([away]);
	assert.equal(store.entries()[path.resolve(away)].fingerprint, null);
	fs.mkdirSync(away);
	assert.equal(store.isTrusted(away), true);
	assert.deepEqual(createTrustStore({ file }).entries()[fs.realpathSync(away)].fingerprint, fingerprintOf(away));
});

test('a damaged store trusts nothing and never re-migrates', () => {
	const { file, vault } = scratch();
	const a = vault('A');
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, '{ not json');
	const warn = console.warn;
	console.warn = () => {};
	try {
		const store = createTrustStore({ file });
		assert.equal(store.migrate([a]), 0);
		assert.equal(store.isTrusted(a), false);
	} finally {
		console.warn = warn;
	}
});

test('persist: false keeps every decision in memory (the smoke harness)', () => {
	const { file, vault } = scratch();
	const a = vault('A');
	const store = createTrustStore({ file, persist: false });
	store.migrate([a]);
	store.trust(vault('B'));
	assert.equal(store.isTrusted(a), true);
	assert.equal(fs.existsSync(file), false);
});
