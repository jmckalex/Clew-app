import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { noteCodeKinds, codeSummary } from '../src/main/vault-code.js';
import { requestsOf, readVaultRequests } from '../src/main/vault-requests.js';

test('noteCodeKinds finds code that announces itself, outside code', () => {
	assert.deepEqual(noteCodeKinds('# Plain\n\nNothing here.'), []);
	assert.deepEqual(noteCodeKinds('Text\n\n<script>\n  x = 1\n</script>\n'), ['script']);
	assert.deepEqual(noteCodeKinds('```dataviewjs\ndv.list([])\n```\n'), ['dataviewjs']);
	assert.deepEqual(noteCodeKinds('Load javascript: helpers.js\nTitle: x\n\nBody'), ['header']);
	assert.deepEqual(noteCodeKinds('---\nScript: a.js\n---\n# x'), ['header']);
	assert.deepEqual(noteCodeKinds('Sum ⟦1+1⟧ here'), ['mathematica']);
	assert.deepEqual(noteCodeKinds('<button onclick="go()">x</button>'), ['inline handler']);
	// Shown as code, not run: fenced and inline code hide what they hold.
	assert.deepEqual(noteCodeKinds('```html\n<script>alert(1)</script>\n```\n'), []);
	assert.deepEqual(noteCodeKinds('Write `<script>` like this.'), []);
	assert.deepEqual(noteCodeKinds('Prose with Load javascript: in it.'), []);
});

test('codeSummary counts what would run, and a vault with none is empty', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-code-'));
	fs.writeFileSync(path.join(root, 'A.md'), '# A\n\n<script>\n  go()\n</script>\n');
	fs.writeFileSync(path.join(root, 'B.md'), '# B\n\nplain\n');
	const plain = codeSummary({ root, notePaths: ['B.md'], requests: requestsOf({}) });
	assert.equal(plain.empty, true);
	fs.mkdirSync(path.join(root, '.clew', 'scripts'), { recursive: true });
	fs.writeFileSync(path.join(root, '.clew', 'scripts', 'z.js'), '');
	fs.writeFileSync(path.join(root, '.clew', 'scripts', 'a.js'), '');
	const pdir = path.join(root, '.clew', 'plugins', 'charts');
	fs.mkdirSync(pdir, { recursive: true });
	fs.writeFileSync(path.join(pdir, 'manifest.json'), JSON.stringify({ id: 'charts', name: 'Charts', surfaces: { preview: 'p.js' } }));
	fs.writeFileSync(path.join(pdir, 'p.js'), '');
	fs.writeFileSync(path.join(root, '.clew', 'vault-settings.json'), JSON.stringify({ plugins: ['charts', 'nowhere'], noteApi: true }));
	const s = codeSummary({ root, notePaths: ['A.md', 'B.md'], requests: readVaultRequests(root) });
	assert.equal(s.empty, false);
	assert.deepEqual(s.scripts, ['a.js', 'z.js']);
	assert.deepEqual(s.plugins, [{ id: 'charts', name: 'Charts' }]);
	assert.equal(s.noteCount, 1);
	assert.deepEqual(s.notes, [{ path: 'A.md', kinds: ['script'] }]);
	assert.deepEqual(s.requests, { noteApi: true, dataviewJs: false, network: false });
	assert.deepEqual(s.globalRequests, [], 'a plugin that exists nowhere is not offered');
	fs.rmSync(root, { recursive: true, force: true });
});

test('readVaultRequests: a missing file is an empty request', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-req-'));
	assert.deepEqual(readVaultRequests(root), { enable: { plugins: [], noteApi: false, dataviewJs: false, network: false } });
	fs.rmSync(root, { recursive: true, force: true });
});
