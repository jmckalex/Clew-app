import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listPlugins, enabledPlugins, engineExtensionEntries, previewPluginPaths } from '../src/main/plugins.js';

function vaultWith(plugins) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-plug-'));
	for (const [id, files] of Object.entries(plugins)) {
		const dir = path.join(root, '.clew', 'plugins', id);
		fs.mkdirSync(dir, { recursive: true });
		for (const [name, content] of Object.entries(files)) {
			fs.writeFileSync(path.join(dir, name), content);
		}
	}
	return root;
}

test('discovers valid plugins, skips broken ones', () => {
	const root = vaultWith({
		good: {
			'manifest.json': JSON.stringify({
				id: 'good', name: 'Good', version: '1.0.0',
				surfaces: { preview: 'p.js', engine: { file: 'e.js', extensions: 'fenceA' } },
			}),
			'p.js': '// p', 'e.js': '// e',
		},
		'bad-id': { 'manifest.json': JSON.stringify({ id: 'mismatch', surfaces: {} }) },
		'no-manifest': { 'p.js': '// orphan' },
		'missing-file': {
			'manifest.json': JSON.stringify({ id: 'missing-file', surfaces: { preview: 'gone.js' } }),
		},
		'too-new': {
			'manifest.json': JSON.stringify({ id: 'too-new', apiVersion: 99, surfaces: {} }),
		},
		escape: {
			'manifest.json': JSON.stringify({ id: 'escape', surfaces: { preview: '../../evil.js' } }),
		},
	});
	const plugins = listPlugins(root);
	assert.deepEqual(plugins.map((p) => p.id).sort(), ['escape', 'good', 'missing-file']);
	const good = plugins.find((p) => p.id === 'good');
	assert.deepEqual(Object.keys(good.surfaces).sort(), ['engine', 'preview']);
	// Path-escaping and missing surface files are dropped, not resolved.
	assert.deepEqual(plugins.find((p) => p.id === 'escape').surfaces, {});
	assert.deepEqual(plugins.find((p) => p.id === 'missing-file').surfaces, {});
	fs.rmSync(root, { recursive: true, force: true });
});

test('enabled subset, engine entries, preview paths', () => {
	const root = vaultWith({
		alpha: {
			'manifest.json': JSON.stringify({
				id: 'alpha', surfaces: { engine: { file: 'e.js', extensions: 'x, y' }, preview: 'p.js' },
			}),
			'e.js': '', 'p.js': '',
		},
		beta: {
			'manifest.json': JSON.stringify({ id: 'beta', surfaces: { preview: 'p.js' } }),
			'p.js': '',
		},
	});
	const settings = { plugins: ['alpha'] };
	assert.deepEqual(enabledPlugins(root, settings).map((p) => p.id), ['alpha']);
	const entries = engineExtensionEntries(root, settings);
	assert.equal(entries.length, 1);
	assert.ok(entries[0].startsWith('x, y from '));
	assert.ok(entries[0].endsWith('.clew/plugins/alpha/e.js'));
	assert.deepEqual(previewPluginPaths(root, settings), ['.clew/plugins/alpha/p.js']);
	assert.deepEqual(previewPluginPaths(root, {}), []);
	fs.rmSync(root, { recursive: true, force: true });
});
