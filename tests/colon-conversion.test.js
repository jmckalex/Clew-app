// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// "Convert this vault" — the colon directives' retirement, phase 2: what a
// note's plan shows and what a choice writes (shared/colon-conversion.js), and
// the vault side (main/colon-conversion.js): the dry run writes nothing, a note
// changed since it is never written, every note written is backed up and kept
// in history, and undo puts back the bytes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { planNote, applyPlan, planIsEmpty, lineEndings, headerLoadsDirectives, configLoadsDirectives } from '../src/shared/colon-conversion.js';
import { colonConverter, backupFolderName } from '../src/main/colon-conversion.js';

const NOTE = `# Note

Today is :today and :span[x]{.y}.

:::note
Body :today.
:::

:::theorem[Big]
T
:::

:::a b
x
:::

Meta INPUT[toggle:done] here.
`;

test('a plan: same converts by default, an output change is an unticked row, the rest is left with its reason, prose is never a row', () => {
	const plan = planNote(NOTE);
	assert.deepEqual(plan.auto, [3, 5, 6]);
	assert.equal(plan.autoItems, 4);
	assert.deepEqual(plan.autoList.map((i) => i.to), ['@today', '@span[x]{.y}', '@begin(<note>)', '@today']);
	assert.deepEqual(plan.rows.map((r) => [r.line, r.kind, r.choice]), [[9, 'changes-output', true], [13, 'needs-you', false]]);
	assert.equal(plan.rows[0].items[0].to, '@begin(theorem)[Big]');
	assert.match(plan.rows[0].why, /numbered/);
	assert.match(plan.rows[1].why, /more than one name/);
	assert.deepEqual(plan.prose.map((p) => p.from), [':done']);
	assert.equal(JSON.stringify(plan.rows).includes('"prose"'), false);
	assert.equal(planIsEmpty(planNote('No directives here: none.')), true);
});

test('applying: the default is all but the output changes; a ticked row converts too; the result is idempotent', () => {
	const plan = planNote(NOTE);
	const def = applyPlan(NOTE, plan);
	assert.equal(def.converted, 4);
	assert.match(def.text, /^Today is @today and @span\[x\]\{\.y\}\.$/m);
	assert.match(def.text, /^@begin\(<note>\)\nBody @today\.\n@end\(note\)$/m);
	assert.match(def.text, /^:::theorem\[Big\]$/m, 'the output change stays as written');
	assert.match(def.text, /^:::a b$/m);
	assert.match(def.text, /INPUT\[toggle:done\]/);
	// The output change left as written is all a second dry run shows.
	const again = planNote(def.text);
	assert.deepEqual(again.auto, []);
	assert.deepEqual(again.rows.map((r) => [r.line, r.kind]), [[9, 'changes-output'], [13, 'needs-you']]);
	const all = applyPlan(NOTE, plan, [9, 13]);
	assert.equal(all.converted, 5, 'a row with no box is never converted');
	assert.match(all.text, /^@begin\(theorem\)\[Big\]\nT\n@end\(theorem\)$/m);
	const done = planNote(all.text);
	assert.deepEqual([done.auto, done.rows.map((r) => r.kind)], [[], ['needs-you']]);
	assert.equal(applyPlan(all.text, done).text, all.text);
});

test('a row is a line: every directive on it converts, or none does', () => {
	const text = 'A :today and :theorem[x] here.\n';
	const plan = planNote(text);
	assert.deepEqual(plan.auto, []);
	assert.deepEqual(plan.rows.map((r) => [r.line, r.kind, r.items.length]), [[1, 'changes-output', 2]]);
	assert.equal(applyPlan(text, plan).text, text);
	assert.equal(applyPlan(text, plan, [1]).text, 'A @today and @theorem[x] here.\n');
});

test('a note that loads directives — its header, a folder\'s config, the global one — is all needs-you, each with Convert anyway', () => {
	for (const loads of [{ by: 'folder', file: 'Sub/.jmarkdown/config.json', key: 'Directives' }, { by: 'global', file: '~/.jmarkdown/config.json', key: 'Optionals' }]) {
		const plan = planNote(NOTE, { loads });
		assert.deepEqual(plan.auto, []);
		assert.ok(plan.rows.length >= 5);
		assert.ok(plan.rows.every((r) => r.kind === 'needs-you'), JSON.stringify(plan.rows.map((r) => r.kind)));
		assert.deepEqual(plan.rows.map((r) => [r.line, r.choice]), [[3, true], [5, true], [6, true], [9, true], [13, false]]);
		assert.ok(plan.rows.every((r) => r.why.includes(loads.file) && r.why.includes(loads.key)));
		assert.match(plan.rows.find((r) => r.line === 13).why, /more than one name/);
		// Nothing goes by default; a tick converts as a note loading nothing would.
		assert.equal(applyPlan(NOTE, plan).text, NOTE);
		assert.equal(applyPlan(NOTE, plan, [9]).text, NOTE.replace(':::theorem[Big]\nT\n:::', '@begin(theorem)[Big]\nT\n@end(theorem)'));
	}
	const header = `---\ntitle: T\nLoad directives: callout from my.js\n---\n\n:::callout\nx\n:::\n\n:::note\ny\n:::\n\nNow :today.\n`;
	assert.equal(headerLoadsDirectives(header), true);
	const plan = planNote(header, { loads: { by: 'header' } });
	assert.ok(plan.rows.every((r) => r.kind === 'needs-you'));
	assert.deepEqual(plan.auto, []);
	// The header's own name stays the note's: no box for it.
	assert.deepEqual(plan.rows.map((r) => [r.items[0].name, r.choice]), [['callout', false], ['note', true], ['today', true]]);
	assert.match(plan.rows[0].why, /loads directives of its own/);
});

test('what makes a note or a config load directives', () => {
	assert.equal(headerLoadsDirectives('---\nload DIRECTIVES: x.js\n---\n'), true);
	assert.equal(headerLoadsDirectives('Load directives: x.js\n'), false, 'only a fenced header (Clew\'s style)');
	assert.equal(headerLoadsDirectives('---\ntitle: x\n---\nLoad directives: x.js\n'), false, 'the body is not the header');
	assert.equal(configLoadsDirectives({ Directives: ['a from /x.js'] }), 'Directives');
	assert.equal(configLoadsDirectives({ Directives: [], Optionals: ['draft[true]'] }), 'Optionals');
	assert.equal(configLoadsDirectives({ Directives: [], 'Custom directives': ['x'] }), null);
	assert.equal(configLoadsDirectives(null), null);
});

test('line endings: CRLF comes back CRLF; a note ending lines both ways is refused', () => {
	assert.equal(lineEndings('a\nb'), 'lf');
	assert.equal(lineEndings('a\r\nb\r\n'), 'crlf');
	assert.equal(lineEndings('a\r\nb\n'), 'mixed');
	const crlf = NOTE.replace(/\n/g, '\r\n');
	const out = applyPlan(crlf, planNote(crlf));
	assert.equal(out.text, applyPlan(NOTE, planNote(NOTE)).text.replace(/\n/g, '\r\n'));
	const mixed = NOTE.replace('\n', '\r\n');
	assert.throws(() => applyPlan(mixed, planNote(mixed)), { code: 'EMIXED' });
});

// ---- the vault side -------------------------------------------------------------

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-colon-')); });
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

/** A vault in a folder, as main's adapter presents one. */
function fixture(name, files, { globalConfig } = {}) {
	const root = path.join(tmp, name, 'vault');
	for (const [rel, text] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
		fs.writeFileSync(path.join(root, rel), text);
	}
	const kept = [];
	const writes = [];
	const vault = {
		root,
		listNotes: () => {
			const out = [];
			const walk = (dir, rel) => {
				for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
					if (e.name.startsWith('.')) continue;
					const r = rel ? `${rel}/${e.name}` : e.name;
					if (e.isDirectory()) walk(path.join(dir, e.name), r);
					else if (/\.(md|jmd)$/.test(e.name)) out.push(r);
				}
			};
			walk(root, '');
			return out.sort();
		},
		read: (rel) => fs.readFileSync(path.join(root, rel)),
		readAsync: (rel) => fs.promises.readFile(path.join(root, rel)),
		write: (rel, text) => { writes.push(rel); fs.writeFileSync(path.join(root, rel), text); },
		keepVersion: (rel, text) => kept.push([rel, text]),
	};
	let clock = Date.UTC(2026, 9, 11, 12);
	const conv = colonConverter({ vault, backupRoot: path.join(tmp, name, 'backups'), globalConfig: globalConfig ?? path.join(tmp, name, 'no-global.json'), now: () => (clock += 1000) });
	const bytes = () => Object.fromEntries(vault.listNotes().map((r) => [r, fs.readFileSync(path.join(root, r))]));
	return { root, vault, conv, kept, writes, bytes };
}

test('the dry run writes nothing and hides prose; a note changed since it is not written but planned again; undo puts back the bytes', async () => {
	const prosey = 'A Meta Bind field INPUT[toggle:done] and VIEW[{due}].\n';
	const f = fixture('roundtrip', {
		'A.md': NOTE,
		'Sub/B.md': ':::note\nx\n:::\n',
		'C.md': 'Nothing here.\n',
		'P.md': prosey,
		'W.md': NOTE.replace(/\n/g, '\r\n'),
	});
	const original = f.bytes();
	const report = await f.conv.scan();
	assert.deepEqual(f.writes, []);
	assert.deepEqual(report.notes.map((n) => n.path), ['A.md', 'Sub/B.md', 'W.md']);
	assert.equal(report.scanned, 5);
	assert.equal(/prose/i.test(JSON.stringify(report)), false, 'no prose item, nor a count of them, reaches the window');
	assert.deepEqual(report.totals, { notes: 3, auto: 9, output: 2, needsYou: 2, choices: 2, loading: 0, refused: 0 });
	assert.equal(report.restricted, false);

	// B changes under the preview: it is not written, and comes back planned.
	fs.writeFileSync(path.join(f.root, 'Sub/B.md'), ':::note\nchanged\n:::\n');
	const done = await f.conv.apply({ scanId: report.scanId, picks: { 'A.md': [9] } });
	assert.deepEqual(done.changed, ['Sub/B.md']);
	assert.deepEqual(done.again.notes.map((n) => n.path), ['Sub/B.md']);
	assert.equal(fs.readFileSync(path.join(f.root, 'Sub/B.md'), 'utf8'), ':::note\nchanged\n:::\n');
	assert.deepEqual(done.written.sort(), ['A.md', 'W.md']);
	assert.equal(done.items, 5 + 4);
	assert.match(fs.readFileSync(path.join(f.root, 'A.md'), 'utf8'), /^@begin\(theorem\)\[Big\]$/m);
	assert.ok(fs.readFileSync(path.join(f.root, 'W.md'), 'utf8').includes('@begin(<note>)\r\n'), 'CRLF kept');
	assert.deepEqual(f.kept.map(([rel]) => rel).sort(), ['A.md', 'W.md'], 'each written note kept in its history first');
	assert.equal(f.kept.find(([r]) => r === 'A.md')[1], NOTE);
	// The backup and its manifest.
	const manifest = JSON.parse(fs.readFileSync(path.join(done.backup, 'manifest.json'), 'utf8'));
	assert.equal(path.basename(path.dirname(done.backup)), backupFolderName(f.root));
	assert.deepEqual(manifest.notes.map((n) => [n.path, n.status]), [['A.md', 'written'], ['W.md', 'written']]);
	assert.ok(fs.readFileSync(path.join(done.backup, 'notes', 'A.md')).equals(original['A.md']));
	assert.equal(manifest.notes[0].after, sha(fs.readFileSync(path.join(f.root, 'A.md'))));
	// A preview is used once.
	await assert.rejects(f.conv.apply({ scanId: report.scanId }), /out of date/);

	// The planned-again note converts on its own preview.
	const second = await f.conv.apply({ scanId: done.again.scanId });
	assert.deepEqual(second.written, ['Sub/B.md']);
	assert.equal(fs.readFileSync(path.join(f.root, 'Sub/B.md'), 'utf8'), '@begin(<note>)\nchanged\n@end(note)\n');

	// Idempotent: a dry run now shows only what was left.
	const now = await f.conv.scan();
	assert.equal(now.totals.auto, 0);
	assert.deepEqual(now.notes.map((n) => [n.path, n.rows.map((r) => r.kind)]), [['A.md', ['needs-you']], ['W.md', ['changes-output', 'needs-you']]]);

	// Undo the newest (B's), then the first: every byte as it was, but a note
	// changed since the conversion stays as it is.
	assert.equal(f.conv.last().id, second.id);
	await f.conv.undo();
	fs.appendFileSync(path.join(f.root, 'W.md'), 'typed after\r\n');
	const undone = await f.conv.undo({ id: done.id });
	assert.deepEqual(undone.restored, ['A.md']);
	assert.deepEqual(undone.changed, ['W.md']);
	const after = f.bytes();
	for (const rel of ['A.md', 'C.md', 'P.md']) assert.ok(after[rel].equals(original[rel]), rel);
	assert.equal(fs.readFileSync(path.join(f.root, 'Sub/B.md'), 'utf8'), ':::note\nchanged\n:::\n', 'B back as it was before ITS conversion');
	assert.ok(after['W.md'].toString().endsWith('typed after\r\n'));
	assert.equal(f.conv.last(), null);
	await assert.rejects(f.conv.undo({ id: done.id }), /undone/);
});

test('notes open in an editor go back to the window; finish records what it did', async () => {
	const f = fixture('editor', { 'A.md': NOTE, 'B.md': ':::note\nx\n:::\n' });
	const report = await f.conv.scan();
	const done = await f.conv.apply({ scanId: report.scanId, editing: ['A.md'] });
	assert.deepEqual(done.written, ['B.md']);
	assert.deepEqual(done.editorPlans.map((p) => p.path), ['A.md']);
	assert.equal(done.editorPlans[0].before, NOTE);
	assert.equal(fs.readFileSync(path.join(f.root, 'A.md'), 'utf8'), NOTE, 'main does not write a note an editor holds');
	// The window changed it and saved.
	fs.writeFileSync(path.join(f.root, 'A.md'), done.editorPlans[0].after);
	assert.deepEqual(f.conv.finish({ id: done.id, applied: ['A.md'] }), { ok: true, notes: 2, items: 5 });
	assert.equal(f.conv.last().notes, 2);
	const undone = await f.conv.undo();
	assert.deepEqual(undone.restored.sort(), ['A.md', 'B.md']);
	assert.equal(fs.readFileSync(path.join(f.root, 'A.md'), 'utf8'), NOTE);
});

test('loading notes in a vault: a header, a folder config up the tree, the global config', async () => {
	const f = fixture('loads', {
		'Loads/Header.md': '---\nLoad directives: callout from my.js\n---\n\n:::note\nx\n:::\n',
		'Deep/Sub/Folder.md': ':::note\nx\n:::\n\nNow :today.\n',
		'Free.md': ':::note\nx\n:::\n',
		'Deep/.jmarkdown/config.json': JSON.stringify({ Directives: ['/abs/x.js'] }),
	});
	const report = await f.conv.scan();
	const by = Object.fromEntries(report.notes.map((n) => [n.path, n]));
	assert.deepEqual(by['Loads/Header.md'].loads, { by: 'header' });
	assert.deepEqual(by['Deep/Sub/Folder.md'].loads, { by: 'folder', file: 'Deep/.jmarkdown/config.json', key: 'Directives' });
	assert.equal(by['Free.md'].loads, null);
	for (const p of ['Loads/Header.md', 'Deep/Sub/Folder.md']) {
		assert.equal(by[p].autoItems, 0);
		assert.ok(by[p].rows.length && by[p].rows.every((r) => r.kind === 'needs-you' && r.choice), p);
	}
	assert.equal(report.totals.loading, 2);
	const done = await f.conv.apply({ scanId: report.scanId });
	assert.deepEqual(done.written, ['Free.md'], 'nothing in a loading note goes unticked');

	const g = path.join(tmp, 'global.json');
	fs.writeFileSync(g, JSON.stringify({ Directives: ['a from /x.js'] }));
	const f2 = fixture('global', { 'A.md': ':::note\nx\n:::\n' }, { globalConfig: g });
	const r2 = await f2.conv.scan();
	assert.deepEqual(r2.notes[0].loads, { by: 'global', file: '~/.jmarkdown/config.json', key: 'Directives' });
	const d2 = await f2.conv.apply({ scanId: r2.scanId, picks: { 'A.md': [1] } });
	assert.equal(fs.readFileSync(path.join(f2.root, 'A.md'), 'utf8'), '@begin(<note>)\nx\n@end(note)\n', 'Convert anyway');
	assert.equal(d2.items, 1);
});

test('notes never written: not UTF-8, lines ending both ways', async () => {
	const f = fixture('refused', { 'A.md': ':::note\nx\r\n:::\n' });
	fs.writeFileSync(path.join(f.root, 'L.md'), Buffer.concat([Buffer.from(':::note\ncaf'), Buffer.from([0xe9]), Buffer.from('\n:::\n')]));
	const report = await f.conv.scan();
	assert.deepEqual(report.notes.map((n) => [n.path, /both ways/.test(n.refuse) ? 'mixed' : /UTF-8/.test(n.refuse) ? 'utf8' : n.refuse]), [['A.md', 'mixed'], ['L.md', 'utf8']]);
	assert.equal(report.totals.refused, 2);
	const done = await f.conv.apply({ scanId: report.scanId, picks: { 'A.md': [1], 'L.md': [1] } });
	assert.deepEqual([done.written, done.id], [[], null]);
});

test('a note changed between the backup and its write is not written, and is planned again', async () => {
	const f = fixture('between', { 'A.md': ':::note\nx\n:::\n', 'B.md': ':::note\ny\n:::\n' });
	const readAsync = f.vault.readAsync;
	f.vault.readAsync = async (rel) => {
		// The user saves B after it was backed up, just before its write.
		if (rel === 'B.md') fs.writeFileSync(path.join(f.root, 'B.md'), ':::note\ntyped\n:::\n');
		return readAsync(rel);
	};
	const report = await f.conv.scan();
	const done = await f.conv.apply({ scanId: report.scanId });
	assert.deepEqual([done.written, done.changed], [['A.md'], ['B.md']]);
	assert.equal(fs.readFileSync(path.join(f.root, 'B.md'), 'utf8'), ':::note\ntyped\n:::\n');
	assert.deepEqual(done.again.notes.map((n) => n.path), ['B.md']);
	const manifest = JSON.parse(fs.readFileSync(path.join(done.backup, 'manifest.json'), 'utf8'));
	assert.deepEqual(manifest.notes.map((n) => [n.path, n.status]), [['A.md', 'written'], ['B.md', 'changed']]);
	const undone = await f.conv.undo();
	assert.deepEqual(undone.restored, ['A.md']);
	assert.equal(fs.readFileSync(path.join(f.root, 'B.md'), 'utf8'), ':::note\ntyped\n:::\n', 'undo leaves a note it never wrote');
});
