import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTrustStore, fingerprintOf, identityKey, effectiveAccess, normalizeEnable } from '../src/main/vault-trust.js';

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

// ---- enablements (the full §4, store version 2) ---------------------------

// The shape vault-requests.js#readVaultRequests really returns: every key
// present (a stub that left `network` out once hid a migration bug).
const requests = (enable) => () => ({ enable: { plugins: [], noteApi: false, dataviewJs: false, network: false, ...enable } });

test('a legacy entry copies the vault\'s own enablements once, network on when trusted', () => {
	const { file, vault } = scratch();
	const a = vault('A');
	const b = vault('B');
	// A version-1 store, as the interim guard wrote it.
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, JSON.stringify({ version: 1, migratedAt: 'x', vaults: {
		[identityKey(a)]: { trusted: true, fingerprint: fingerprintOf(a), source: 'migrated', at: 'x' },
		[identityKey(b)]: { trusted: false, fingerprint: fingerprintOf(b), source: 'user', at: 'x' },
	} }));
	const store = createTrustStore({ file });
	const access = store.accessFor(a, requests({ plugins: ['charts', 'header'], noteApi: true, dataviewJs: true }));
	assert.deepEqual(access, { trusted: true, scripts: true, plugins: ['charts', 'header'], noteApi: true, dataviewJs: true, network: true, decided: true });
	// Copied ONCE: a later change of the vault's file is a request, never a grant.
	const again = store.accessFor(a, requests({ plugins: ['evil'], noteApi: false }));
	assert.deepEqual(again.plugins, ['charts', 'header']);
	assert.equal(again.noteApi, true);
	// A restricted legacy vault keeps its list, but trust gates what runs.
	const r = store.accessFor(b, requests({ plugins: ['charts'], noteApi: true }));
	assert.deepEqual(r, { trusted: false, scripts: false, plugins: ['charts'], noteApi: false, dataviewJs: false, network: false, decided: true });
	assert.equal(store.enablements(b).network, false);
});

test('an unknown vault is undecided and may run nothing', () => {
	const { file, vault } = scratch();
	const store = createTrustStore({ file });
	store.migrate([]);
	const access = store.accessFor(vault('New'), requests({ plugins: ['charts'], noteApi: true }));
	assert.deepEqual(access, { trusted: false, scripts: false, plugins: [], noteApi: false, dataviewJs: false, network: false, decided: false });
});

test('trusting with the vault\'s request enables exactly that; revoking keeps it for later', () => {
	const { file, vault } = scratch();
	const a = vault('A');
	const store = createTrustStore({ file });
	store.migrate([]);
	store.trust(a, 'user', { plugins: ['charts'], noteApi: true, network: false });
	assert.deepEqual(store.accessFor(a), { trusted: true, scripts: true, plugins: ['charts'], noteApi: true, dataviewJs: false, network: false, decided: true });
	store.revoke(a);
	assert.deepEqual(store.accessFor(a), { trusted: false, scripts: false, plugins: ['charts'], noteApi: false, dataviewJs: false, network: false, decided: true });
	store.trust(a);
	assert.equal(store.accessFor(a).noteApi, true, 'kept across a revoke');
});

test('a setting changed for an undecided vault leaves it undecided', () => {
	const { file, vault } = scratch();
	const a = vault('A');
	const store = createTrustStore({ file });
	store.migrate([]);
	store.setEnable(a, { plugins: ['global-one'] });
	const access = store.accessFor(a);
	assert.equal(access.decided, false);
	assert.deepEqual(access.plugins, ['global-one'], 'a global plugin may run in a restricted vault (plugins.js decides scope)');
	assert.equal(access.trusted, false);
});

test('a different vault at a trusted path inherits none of its enablements', () => {
	const { file, vault } = scratch();
	const a = vault('A');
	const store = createTrustStore({ file });
	store.migrate([]);
	store.trust(a, 'user', { plugins: ['charts'], noteApi: true, network: true });
	fs.rmSync(a, { recursive: true });
	fs.mkdirSync(a);
	assert.deepEqual(store.accessFor(a), { trusted: false, scripts: false, plugins: [], noteApi: false, dataviewJs: false, network: false, decided: false });
	store.revoke(a);
	assert.deepEqual(store.enablements(a).plugins, [], 'the old vault\'s list is not carried over');
});

test('forget makes the next open a first open', () => {
	const { file, vault } = scratch();
	const a = vault('A');
	const store = createTrustStore({ file });
	store.migrate([a]);
	store.forget(a);
	assert.equal(store.accessFor(a).decided, false);
	assert.equal(store.isTrusted(a), false);
});

test('the one-time notice: once for a version-1 store, never for a fresh one', () => {
	const { file } = scratch();
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, JSON.stringify({ version: 1, migratedAt: 'x', vaults: {} }));
	const store = createTrustStore({ file });
	assert.equal(store.takeNotice(), true);
	assert.equal(store.takeNotice(), false);
	assert.equal(createTrustStore({ file }).takeNotice(), false, 'persisted');
	const fresh = scratch();
	assert.equal(createTrustStore({ file: fresh.file }).takeNotice(), false);
});

test('normalizeEnable keeps only the five keys and well-formed ids; effectiveAccess gates on trust', () => {
	assert.deepEqual(normalizeEnable({ plugins: ['ok', 'Bad Id', 7, 'ok'], noteApi: 'yes', extra: true }),
		{ scripts: false, plugins: ['ok'], noteApi: false, dataviewJs: false, network: false });
	assert.deepEqual(effectiveAccess(false, { scripts: true, plugins: ['p'], noteApi: true, dataviewJs: true, network: true }),
		{ trusted: false, scripts: false, plugins: ['p'], noteApi: false, dataviewJs: false, network: false });
});
