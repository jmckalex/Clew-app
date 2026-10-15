// The app settings file (src/main/settings-store.js), over real files: what a
// stored value means when it is read back. The figure engine's
// (export-cache.js#unpinFigureEngine): every save writes every key, so
// dev.9–11 wrote their default, 'external', into the file at the first vault
// opened — only a value the user CHOSE is read; the rest take the default.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SettingsStore } from '../src/main/settings-store.js';
import { FIGURE_ENGINE_CHOSEN, unpinFigureEngine, figureEngineOptions } from '../src/main/export-cache.js';

delete process.env.CLEW_SMOKE;   // the store writes nothing under the harness
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-settings-store-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
let made = 0;
const fileIn = () => path.join(root, `profile-${++made}`, 'clew-settings.json');
// settings.js's, for the keys these touch.
const DEFAULTS = { recentVaults: [], openVaults: [], theme: 'dark', exportFigureEngine: 'auto' };
/** A launch: the store as main makes it, loaded from `file`. */
const launch = (file, defaults = DEFAULTS) => {
	const store = new SettingsStore(defaults, () => file);
	store.load();
	return store;
};
const onDisk = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const dist = '/app/mptikz';

test('a dev.11 settings file — external, no mark — reads as the default, auto, and stays so through a save', () => {
	const file = fileIn();
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, JSON.stringify({
		recentVaults: ['/v'], openVaults: ['/v'], lastVault: '/v', theme: 'light',
		latexEngine: 'auto', exportFigureEngine: 'external', updateCheck: 'on',
	}, null, 2));
	const store = launch(file);
	assert.equal(store.get('exportFigureEngine'), 'auto');
	assert.equal(store.get('theme'), 'light', 'everything else as it was');
	assert.deepEqual(store.get('recentVaults'), ['/v']);
	store.rememberVault('/w');   // a vault opened: a save of every key
	assert.equal(onDisk(file)[FIGURE_ENGINE_CHOSEN], undefined, 'no mark written for a value nobody chose');
	assert.equal(launch(file).get('exportFigureEngine'), 'auto', 'and after a relaunch');
});

test('a choice of external survives a save and a relaunch; a choice of auto is a choice too', () => {
	const file = fileIn();
	launch(file).set('exportFigureEngine', 'external');   // the Settings page
	assert.equal(onDisk(file).exportFigureEngine, 'external');
	assert.equal(onDisk(file)[FIGURE_ENGINE_CHOSEN], true, 'the mark beside it');
	const again = launch(file);
	assert.equal(again.get('exportFigureEngine'), 'external');
	again.rememberVault('/v');
	again.addOpenVault('/v');
	again.set('theme', 'light');
	assert.equal(launch(file).get('exportFigureEngine'), 'external', 'through every other save');
	launch(file).set('exportFigureEngine', 'auto');
	assert.equal(launch(file).get('exportFigureEngine'), 'auto');
	assert.equal(launch(file, { ...DEFAULTS, exportFigureEngine: 'external' }).get('exportFigureEngine'), 'auto',
		'chosen: kept whatever the default becomes');
});

test('a fresh profile reads auto, and its saves never pin it: a later default would reach it', () => {
	const file = fileIn();
	const store = launch(file);   // no file yet
	assert.equal(store.get('exportFigureEngine'), 'auto');
	store.rememberVault('/v');
	assert.equal(onDisk(file).exportFigureEngine, 'auto', 'written, as every key is');
	assert.equal(launch(file).get('exportFigureEngine'), 'auto');
	assert.equal(launch(file, { ...DEFAULTS, exportFigureEngine: 'external' }).get('exportFigureEngine'), 'external',
		'unchosen: whatever the default is at the next launch');
});

test('a restricted vault\'s exports are the library alone, whatever is stored or chosen', () => {
	const unchosen = fileIn();
	fs.mkdirSync(path.dirname(unchosen), { recursive: true });
	fs.writeFileSync(unchosen, JSON.stringify({ exportFigureEngine: 'external' }));
	const chosen = fileIn();
	launch(chosen).set('exportFigureEngine', 'external');
	const fresh = fileIn();
	for (const [file, trusted] of [[unchosen, { figureEngine: 'auto', mpTikzDist: dist }], [chosen, {}], [fresh, { figureEngine: 'auto', mpTikzDist: dist }]]) {
		const setting = launch(file).get('exportFigureEngine');
		assert.deepEqual(figureEngineOptions({ trusted: true, dist, setting }), trusted, `trusted, ${path.basename(path.dirname(file))}`);
		assert.deepEqual(figureEngineOptions({ trusted: false, dist, setting }), { figureEngine: 'wasm', mpTikzDist: dist }, `restricted, ${path.basename(path.dirname(file))}`);
	}
});

test('unpinFigureEngine: an unmarked value goes, a marked one stays, anything else passes through', () => {
	assert.deepEqual(unpinFigureEngine({ theme: 'light', exportFigureEngine: 'external' }), { theme: 'light' });
	assert.deepEqual(unpinFigureEngine({ exportFigureEngine: 'auto' }), {});
	const marked = { exportFigureEngine: 'external', [FIGURE_ENGINE_CHOSEN]: true };
	assert.equal(unpinFigureEngine(marked), marked);
	assert.deepEqual(unpinFigureEngine({ exportFigureEngine: 'external', [FIGURE_ENGINE_CHOSEN]: 'yes' }), { [FIGURE_ENGINE_CHOSEN]: 'yes' }, 'the mark is true or nothing');
	const none = { theme: 'dark' };
	assert.equal(unpinFigureEngine(none), none);
	for (const odd of [null, undefined, 'x', 3]) assert.equal(unpinFigureEngine(odd), odd);
});
