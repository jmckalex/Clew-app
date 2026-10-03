import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGrantStore, grantState } from '../src/main/app-grants.js';

// One temp root for this file, removed when it is done: fixtures used to
// be left in the system's temp folder, thousands of them over the runs.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-grants-'));
after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const file = () => path.join(fs.mkdtempSync(path.join(tmpRoot, 'clew-grants-')), 'app-grants.json');
const m = (caps) => ({ id: 'timer', capabilities: caps });

test('answers persist, per vault and id; a new capability is asked for alone', () => {
	const f = file();
	const store = createGrantStore({ file: f });
	store.answer('/V', 'timer', { granted: ['note.read'], denied: ['app.kv'], folder: 'Apps/Timer' });
	const again = createGrantStore({ file: f }).get('/V', 'timer');
	assert.ok(again.granted['note.read'] && again.denied['app.kv']);
	assert.equal(again.folder, 'Apps/Timer');
	assert.equal(createGrantStore({ file: f }).get('/Other', 'timer'), null, 'grants never cross vaults');
	const s = grantState(again, m(['note.read', 'app.kv', 'query']), { restricted: false, code: () => 'h' });
	assert.deepEqual(s.ask, ['query']);
	assert.deepEqual(s.granted, ['note.read']);
	assert.equal(s.mayRun, true, 'a trusted vault\'s app runs at once');
});

test('a restricted vault: the app waits for its run approval (choice B), and a Don\'t allow sticks', () => {
	const store = createGrantStore({ file: file() });
	const none = grantState(null, m([]), { restricted: true, code: () => 'h' });
	assert.deepEqual([none.askRun, none.mayRun], [true, false], 'even an app that asks for nothing');
	store.answer('/V', 'timer', { run: true });
	assert.deepEqual(grantState(store.get('/V', 'timer'), m([]), { restricted: true, code: () => 'h' }).mayRun, true);
	store.answer('/V', 'timer', { run: false });
	const denied = grantState(store.get('/V', 'timer'), m([]), { restricted: true, code: () => 'h' });
	assert.deepEqual([denied.askRun, denied.mayRun], [false, false]);
});

test('choice C: pinned code that changed asks again, for everything', () => {
	const store = createGrantStore({ file: file() });
	store.answer('/V', 'timer', { run: true, granted: ['note.read', 'network'], code: 'h1' });
	const same = grantState(store.get('/V', 'timer'), m(['note.read', 'network']), { restricted: true, code: () => 'h1' });
	assert.deepEqual([same.changed, same.mayRun, same.granted], [false, true, ['note.read', 'network']]);
	const moved = grantState(store.get('/V', 'timer'), m(['note.read', 'network']), { restricted: true, code: () => 'h2' });
	assert.deepEqual([moved.changed, moved.mayRun, moved.askRun, moved.granted, moved.ask], [true, false, true, [], ['note.read', 'network']]);
	// Trusted, the pin is not consulted.
	assert.equal(grantState(store.get('/V', 'timer'), m(['note.read']), { restricted: false, code: () => 'h2' }).changed, false);
});

test('revoke forgets the app here', () => {
	const store = createGrantStore({ file: file() });
	store.answer('/V', 'timer', { granted: ['note.read'] });
	assert.equal(store.revoke('/V', 'timer'), true);
	assert.equal(store.get('/V', 'timer'), null);
	assert.equal(store.revoke('/V', 'timer'), false);
});
