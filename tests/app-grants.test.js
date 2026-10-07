import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGrantStore, grantState, mergeOrigins, manifestNeed } from '../src/main/app-grants.js';

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
	store.answer('/V', 'timer', { run: true, granted: ['note.read', 'network'], code: 'h1', networkOrigins: '*' });
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

// `network` is bound to its ORIGINS (2026-10-04): the CSP is the granted
// hosts the manifest still names, and a manifest naming a new host asks
// again — for that host only — in trusted and restricted vaults alike.
const net = (network) => ({ id: 'ticker', capabilities: ['note.read', 'network'], network });
const A = 'https://api.frankfurter.dev';
const B = 'https://finnhub.io';
const trusted = { restricted: false, code: () => 'h' };

test('a granted manifest that adds a host asks for the new host only; the old one keeps working', () => {
	const store = createGrantStore({ file: file() });
	store.answer('/V', 'ticker', { granted: ['note.read', 'network'], networkOrigins: [A] });
	const st = grantState(store.get('/V', 'ticker'), net([A, B]), trusted);
	assert.deepEqual([st.ask, st.askNetwork, st.network, st.granted], [['network'], [B], [A], ['note.read', 'network']]);
	// Allowed: both.
	store.answer('/V', 'ticker', { granted: ['network'], networkOrigins: mergeOrigins([A], [B]) });
	const after = grantState(store.get('/V', 'ticker'), net([A, B]), trusted);
	assert.deepEqual([after.ask, after.network], [[], [A, B]]);
});

test('removing a host narrows at once; a host never granted is never reached', () => {
	const store = createGrantStore({ file: file() });
	store.answer('/V', 'ticker', { granted: ['note.read', 'network'], networkOrigins: [A, B] });
	assert.deepEqual(grantState(store.get('/V', 'ticker'), net([B]), trusted).network, [B]);
	// Every granted host gone from the manifest: no network at all.
	const none = grantState(store.get('/V', 'ticker'), net(['https://other.example']), trusted);
	assert.deepEqual([none.network, none.granted.includes('network'), none.askNetwork], [null, false, ['https://other.example']]);
});

test('a refused addition is not asked again, and what was granted before keeps working', () => {
	const store = createGrantStore({ file: file() });
	store.answer('/V', 'ticker', { granted: ['note.read', 'network'], networkOrigins: [A] });
	store.answer('/V', 'ticker', { declineOrigins: [B] });
	const st = grantState(store.get('/V', 'ticker'), net([A, B]), trusted);
	assert.deepEqual([st.ask, st.network, st.granted.includes('network')], [[], [A], true]);
});

test('a grant from before origins were recorded is asked once more, and reaches nothing meanwhile', () => {
	const store = createGrantStore({ file: file() });
	store.answer('/V', 'ticker', { granted: ['note.read', 'network'] });
	const st = grantState(store.get('/V', 'ticker'), net([A, B]), trusted);
	assert.deepEqual([st.ask, st.askNetwork, st.network, st.granted], [['network'], [A, B], null, ['note.read']]);
});

test('bare `network` is any host — its own grant — and a list does not cover it', () => {
	const store = createGrantStore({ file: file() });
	store.answer('/V', 'ticker', { granted: ['network'], networkOrigins: [A] });
	const st = grantState(store.get('/V', 'ticker'), { id: 'ticker', capabilities: ['network'], network: '*' }, trusted);
	assert.deepEqual([st.askNetwork, st.network], ['*', [A]]);
	assert.equal(mergeOrigins([A], '*'), '*');
	assert.deepEqual(mergeOrigins(undefined, [B]), [B]);
	// A '*' grant covers a later list, which then narrows it.
	store.answer('/V', 'ticker', { networkOrigins: '*' });
	assert.deepEqual(grantState(store.get('/V', 'ticker'), net([B]), trusted).network, [B]);
	// Denying network forgets its hosts.
	store.answer('/V', 'ticker', { denied: ['network'] });
	assert.equal(store.get('/V', 'ticker').networkOrigins, undefined);
});

// A manifest edited on disk (app-registry.js#manifestTouched): what the
// app's RUNNING frames need. `served` is the JSON of the hosts they were
// served with ('null' for an app without `network`).
test('a manifest that only asks for more is asked without a reload (§9b)', () => {
	const store = createGrantStore({ file: file() });
	store.answer('/V', 'timer', { granted: ['note.read'] });
	const st = grantState(store.get('/V', 'timer'), m(['note.read', 'app.kv']), trusted);
	assert.deepEqual([st.ask, st.mayRun], [['app.kv'], true]);
	assert.equal(manifestNeed(st, 'null'), 'ask');
	// Nothing new, nothing changed: nothing to do.
	assert.equal(manifestNeed(grantState(store.get('/V', 'timer'), m(['note.read']), trusted), 'null'), null);
});

test('a new host to ask about reloads (it reaches nothing new meanwhile)', () => {
	const store = createGrantStore({ file: file() });
	store.answer('/V', 'ticker', { granted: ['note.read', 'network'], networkOrigins: [A] });
	const st = grantState(store.get('/V', 'ticker'), net([A, B]), trusted);
	assert.deepEqual([st.ask, st.network], [['network'], [A]]);
	assert.equal(manifestNeed(st, JSON.stringify([A])), 'reload');
});

test('hosts narrowed reload at once (the CSP is fixed at load)', () => {
	const store = createGrantStore({ file: file() });
	store.answer('/V', 'ticker', { granted: ['note.read', 'network'], networkOrigins: [A, B] });
	const st = grantState(store.get('/V', 'ticker'), net([B]), trusted);
	assert.deepEqual([st.ask, st.network], [[], [B]]);
	assert.equal(manifestNeed(st, JSON.stringify([A, B])), 'reload');
	assert.equal(manifestNeed(st, null), null, 'frames never served: nothing to reload');
});

test('an app that may not run reloads when its manifest asks for more', () => {
	const store = createGrantStore({ file: file() });
	store.answer('/V', 'timer', { run: false });
	const st = grantState(store.get('/V', 'timer'), m(['note.read']), { restricted: true, code: () => 'h' });
	assert.deepEqual([st.mayRun, st.askRun, st.ask], [false, false, ['note.read']]);
	assert.equal(manifestNeed(st, 'null'), 'reload');
});

test('a run to approve again (restricted, pinned code changed) reloads', () => {
	const store = createGrantStore({ file: file() });
	store.answer('/V', 'ticker', { run: true, granted: ['note.read', 'network'], code: 'h1', networkOrigins: [A] });
	const st = grantState(store.get('/V', 'ticker'), net([A]), { restricted: true, code: () => 'h2' });
	assert.equal(st.askRun, true);
	assert.equal(manifestNeed(st, JSON.stringify([A])), 'reload');
});
