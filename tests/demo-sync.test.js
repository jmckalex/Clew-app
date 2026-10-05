// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The bundled demo vault brought up to date in the user's copy
// (main/demo-sync.js): new files added, untouched old ones updated, the
// user's changes and deletions left alone, no code slipped into .clew.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listFiles, planDemoSync, syncDemoVault, demoSyncNotice, readRecord, shippedSince } from '../src/main/demo-sync.js';
import realHistory from '../src/main/demo-history.json' with { type: 'json' };

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-demo-sync-'));
after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const put = (root, rel, text) => {
	fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
	fs.writeFileSync(path.join(root, rel), text);
};
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const has = (root, rel) => fs.existsSync(path.join(root, rel));
const h = (text) => crypto.createHash('sha256').update(text).digest('hex');
const map = (o) => new Map(Object.entries(o));

test('the plan, with a record of hashes: untouched updated, edited kept, deleted left deleted, new added', () => {
	const plan = planDemoSync({
		bundled: map({ 'Apps/Ticker/app.js': h('new ticker'), 'Welcome.md': h('welcome v2'), 'Old.md': h('old'), 'New.md': h('new') }),
		current: map({ 'Apps/Ticker/app.js': h('old ticker'), 'Welcome.md': h('welcome, my edit') }),
		record: map({ 'Apps/Ticker/app.js': h('old ticker'), 'Welcome.md': h('welcome v1'), 'Old.md': h('old') }),
	});
	assert.deepEqual([plan.add, plan.update], [['New.md'], ['Apps/Ticker/app.js']]);
	assert.equal(plan.record.get('Welcome.md'), h('welcome v1'), 'the user’s edit keeps the hash we gave');
	assert.equal(plan.record.get('Apps/Ticker/app.js'), h('new ticker'));
});

test('a copy with no record (dev.6’s): a version Clew shipped is updated; anything else is the user’s', () => {
	const history = { 'Apps/Ticker/app.js': { [h('old ticker')]: 2 }, 'Welcome.md': { [h('welcome v1')]: 1 } };
	const plan = planDemoSync({
		bundled: map({ 'Apps/Ticker/app.js': h('new ticker'), 'Welcome.md': h('welcome v2'), 'Features/App Gallery.md': h('g') }),
		current: map({ 'Apps/Ticker/app.js': h('old ticker'), 'Welcome.md': h('welcome, my edit') }),
		record: null,
		history,
	});
	assert.deepEqual([plan.add, plan.update], [['Features/App Gallery.md'], ['Apps/Ticker/app.js']]);
	assert.equal(plan.record.get('Welcome.md'), null, 'given, hash unknown');
});

test('2619e1c’s record (a list, no hashes) counts as given; the history still recognises a shipped version', () => {
	const dir = path.join(tmpRoot, 'legacy');
	put(dir, '.clew/demo-files.json', JSON.stringify({ files: ['Welcome.md', 'Gone.md'] }));
	const record = readRecord(dir);
	assert.deepEqual([...record], [['Welcome.md', null], ['Gone.md', null]]);
	const plan = planDemoSync({
		bundled: map({ 'Welcome.md': h('v2'), 'Gone.md': h('g') }),
		current: map({ 'Welcome.md': h('v1') }),
		record,
		history: { 'Welcome.md': { [h('v1')]: 1 } },
	});
	assert.deepEqual([plan.add, plan.update], [[], ['Welcome.md']]);
});

test('no record: the copy is dated by its untouched files — a note shipped by then and missing stays deleted, a later one is added', () => {
	// Shipped in order: Welcome v1 (1), Old.md (2), the old ticker (3), the
	// App Gallery (4), Welcome v2 (5). The copy's newest shipped file is the
	// old ticker: it came from Clew at 3 or later, so it was given Old.md.
	const history = {
		'Welcome.md': { [h('welcome v1')]: 1, [h('welcome v2')]: 5 },
		'Guide/Old.md': { [h('old')]: 2 },
		'Apps/Ticker/app.js': { [h('old ticker')]: 3, [h('new ticker')]: 5 },
		'Features/App Gallery.md': { [h('g')]: 4 },
	};
	const current = map({ 'Apps/Ticker/app.js': h('old ticker'), 'Welcome.md': h('welcome v1') });
	assert.equal(shippedSince(current, history), 3);
	const plan = planDemoSync({
		bundled: map({ 'Apps/Ticker/app.js': h('new ticker'), 'Welcome.md': h('welcome v2'), 'Guide/Old.md': h('old'), 'Features/App Gallery.md': h('g') }),
		current, record: null, history,
	});
	assert.deepEqual([plan.add, plan.update], [['Features/App Gallery.md'], ['Apps/Ticker/app.js', 'Welcome.md']]);
	assert.equal(plan.record.has('Guide/Old.md'), true, 'recorded as given: deleted, it stays so');
	assert.equal(plan.record.get('Guide/Old.md'), null);
});

test('no record and nothing recognisable (an empty copy, or every file edited): everything missing is added', () => {
	const history = { 'Welcome.md': { [h('welcome v1')]: 1 }, 'Guide/Old.md': { [h('old')]: 2 } };
	const bundled = map({ 'Welcome.md': h('welcome v2'), 'Guide/Old.md': h('old') });
	for (const current of [map({}), map({ 'Welcome.md': h('my own welcome'), 'Mine.md': h('mine') })]) {
		assert.equal(shippedSince(current, history), null);
		const plan = planDemoSync({ bundled, current, record: null, history });
		assert.deepEqual(plan.add, current.has('Welcome.md') ? ['Guide/Old.md'] : ['Welcome.md', 'Guide/Old.md']);
		assert.deepEqual(plan.update, []);
	}
});

test('the real history: a copy as dev.6 made it, one old note deleted — not brought back; the Books notes are added', () => {
	// The copy each file's newest version shipped by dev.6 (the commit before
	// the Books notes first shipped) would be, without Reading/Evolutionary
	// Game Theory.md; the bundle is demo-vault/ as it is now.
	const first = (rel) => Math.min(...Object.values(realHistory[rel]));
	const dev6 = first('Books/Signals/Signals.md') - 1;
	const bundled = new Map(listFiles('demo-vault').map((rel) => [rel, h(fs.readFileSync(path.join('demo-vault', rel)))]));
	const current = new Map();
	for (const rel of bundled.keys()) {
		const shipped = Object.entries(realHistory[rel] ?? {}).filter(([, at]) => at <= dev6).sort((a, b) => b[1] - a[1]);
		if (shipped.length) current.set(rel, shipped[0][0]);
	}
	const gone = 'Reading/Evolutionary Game Theory.md';
	assert.ok(current.delete(gone), 'dev.6 shipped it');
	const plan = planDemoSync({ bundled, current, record: null, history: realHistory });
	assert.equal(plan.add.includes(gone), false);
	for (const rel of bundled.keys()) if (rel.startsWith('Books/')) assert.ok(plan.add.includes(rel), rel);
	assert.ok(plan.add.length > 0 && plan.add.every((rel) => first(rel) > dev6), JSON.stringify(plan.add));
});

test('on disk: the old ticker updated, Welcome’s edit kept, a deleted note left deleted, .clew untouched', () => {
	const source = path.join(tmpRoot, 'bundle');
	const target = path.join(tmpRoot, 'copy');
	put(source, 'Apps/Ticker/app.js', 'new ticker\n');
	put(source, 'Welcome.md', 'Welcome, v2.\n');
	put(source, 'Guide/Old.md', 'old\n');
	put(source, 'Features/App Gallery.md', '# App Gallery\n');
	put(source, '.clew/plugins/p/main.js', '// code\n');
	// A copy as dev.6 made it: no record; the ticker as shipped, Welcome
	// edited, Guide/Old.md deleted by the user — shipped before that ticker,
	// so it was given, and it stays deleted; the App Gallery came later.
	put(target, 'Apps/Ticker/app.js', 'old ticker\n');
	put(target, 'Welcome.md', 'Welcome, v1 — and my own edit.\n');
	const history = {
		'Welcome.md': { [h('Welcome, v1.\n')]: 1 }, 'Guide/Old.md': { [h('old\n')]: 2 },
		'Apps/Ticker/app.js': { [h('old ticker\n')]: 3 }, 'Features/App Gallery.md': { [h('# App Gallery\n')]: 4 },
	};
	const first = syncDemoVault(source, target, { history });
	assert.deepEqual(first, { added: ['Features/App Gallery.md'], updated: ['Apps/Ticker/app.js'] });
	assert.equal(has(target, 'Guide/Old.md'), false);
	assert.equal(read(target, 'Apps/Ticker/app.js'), 'new ticker\n');
	assert.equal(read(target, 'Welcome.md'), 'Welcome, v1 — and my own edit.\n');
	assert.equal(has(target, '.clew/plugins/p/main.js'), false);
	assert.equal(JSON.parse(read(target, '.clew/demo-files.json')).version, 2);
	// Now with a record: deleting a demo note sticks; a second opening is quiet.
	fs.rmSync(path.join(target, 'Features/App Gallery.md'));
	assert.deepEqual(syncDemoVault(source, target, { history }), { added: [], updated: [] });
	assert.equal(has(target, 'Features/App Gallery.md'), false);
	// A newer bundle: the untouched ticker follows it, the edited Welcome does not.
	put(source, 'Apps/Ticker/app.js', 'newer ticker\n');
	put(source, 'Welcome.md', 'Welcome, v3.\n');
	assert.deepEqual(syncDemoVault(source, target, { history }), { added: [], updated: ['Apps/Ticker/app.js'] });
	assert.equal(read(target, 'Welcome.md'), 'Welcome, v1 — and my own edit.\n');
	assert.deepEqual(listFiles(target), ['Apps/Ticker/app.js', 'Welcome.md']);
});

test('the notice names notes and apps, then counts', () => {
	assert.equal(demoSyncNotice({}), null);
	assert.equal(demoSyncNotice({ added: ['Apps/Ticker/app.js', 'Apps/Ticker/live.js', 'Features/App Gallery.md', 'Reading/A.md'], updated: ['Apps/Ticker/index.html'] }),
		'The demo vault is up to date with this version of Clew: added Features/App Gallery, Reading/A, Apps/Ticker; updated Apps/Ticker. Notes you changed were left as they are.');
	assert.equal(demoSyncNotice({ added: ['Attachments/x.png'] }),
		'The demo vault is up to date with this version of Clew: added 1 file. Notes you changed were left as they are.');
});
