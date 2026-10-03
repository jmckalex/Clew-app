import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseManifest, appKey, appsById, resolveApp, appFile, appCsp, injectBridge, codeHash, describeCapabilities } from '../src/main/app-frames.js';

// One temp root for this file, removed when it is done: fixtures used to
// be left in the system's temp folder, thousands of them over the runs.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-apps-'));
after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const vault = () => fs.mkdtempSync(path.join(tmpRoot, 'clew-apps-'));
const put = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const manifest = (o) => JSON.stringify({ id: 'timer', name: 'Timer', ...o });

test('parseManifest: a good one, defaults filled', () => {
	const { manifest: m } = parseManifest(manifest({ capabilities: ['note.read', 'app.kv'] }));
	assert.deepEqual(m, { id: 'timer', name: 'Timer', version: '0.0.0', entry: 'index.html', capabilities: ['note.read', 'app.kv'], network: null });
	assert.equal(parseManifest(manifest({ capabilities: ['network'] })).manifest.network, '*');
	assert.deepEqual(parseManifest(manifest({ capabilities: ['network'], network: ['https://api.example.com/v1', 'https://api.example.com'] })).manifest.network, ['https://api.example.com']);
});

test('parseManifest refuses by name, never half-read', () => {
	assert.match(parseManifest('{').refusal, /not valid JSON/);
	assert.match(parseManifest(JSON.stringify({ id: 'Timer!' })).refusal, /id "Timer!"/);
	assert.match(parseManifest(manifest({ entry: '../x.html' })).refusal, /entry/);
	assert.match(parseManifest(manifest({ entry: 'app.js' })).refusal, /entry/);
	assert.match(parseManifest(manifest({ capabilities: ['note.read', 'root'] })).refusal, /"root"/);
	assert.match(parseManifest(manifest({ capabilities: ['network'], network: ['ftp://x'] })).refusal, /http\(s\) origins/);
	assert.match(parseManifest(manifest({ network: ['https://x.example'] })).refusal, /without asking/);
});

test('appKey: the vault and the id, never the folder; a DNS label', () => {
	const a = appKey('/Users/x/Vault', 'timer');
	assert.match(a, /^[0-9a-f]{40}$/);
	assert.equal(a, appKey('/Users/x/Vault', 'timer'));
	assert.notEqual(a, appKey('/Users/x/Other', 'timer'), 'two vaults never share an origin');
	assert.notEqual(a, appKey('/Users/x/Vault', 'flashcards'));
});

test('resolveApp: the refusals, and two folders with one id both refused', () => {
	const root = vault();
	put(root, 'Apps/Timer/clew-app.json', manifest());
	put(root, 'Apps/Timer/index.html', '<p>t</p>');
	put(root, 'Note.md', '# n');
	assert.equal(resolveApp(root, 'Apps/Timer', ['Apps/Timer']).manifest.id, 'timer');
	assert.equal(resolveApp(root, './Apps/Timer/', ['Apps/Timer']).folder, 'Apps/Timer');
	assert.match(resolveApp(root, 'https://x.example/app', []).refusal, /remote apps are not supported yet/);
	assert.match(resolveApp(root, '../Elsewhere', []).refusal, /climbs out/);
	assert.match(resolveApp(root, 'Nowhere', []).refusal, /found nothing/);
	assert.match(resolveApp(root, 'Note.md', []).refusal, /is a file/);
	put(root, 'Empty/x.txt', '');
	assert.match(resolveApp(root, 'Empty', []).refusal, /no clew-app.json/);
	put(root, 'Old/Timer/clew-app.json', manifest());
	put(root, 'Old/Timer/index.html', '');
	const dup = resolveApp(root, 'Apps/Timer', ['Apps/Timer', 'Old/Timer']);
	assert.match(dup.refusal, /Two apps in this vault say they are "timer": Apps\/Timer, Old\/Timer/);
	assert.match(resolveApp(root, 'Old/Timer', ['Apps/Timer', 'Old/Timer']).refusal, /Two apps/, 'both, never the first');
	assert.deepEqual([...appsById(root, ['Apps/Timer', 'Old/Timer']).get('timer')], ['Apps/Timer', 'Old/Timer']);
	put(root, 'NoEntry/clew-app.json', JSON.stringify({ id: 'other' }));
	assert.match(resolveApp(root, 'NoEntry', ['NoEntry']).refusal, /entry "index.html" is not in the folder/);
	fs.rmSync(root, { recursive: true, force: true });
});

test('appFile: inside the app folder by realpath — a link cannot reach out', () => {
	const root = vault();
	put(root, 'Apps/T/index.html', 'x');
	put(root, 'Apps/T/js/app.js', 'y');
	put(root, 'secret.md', 's');
	fs.symlinkSync(path.join(root, 'secret.md'), path.join(root, 'Apps/T/leak.md'));
	const folder = path.join(root, 'Apps/T');
	assert.equal(appFile(folder, '/js/app.js'), fs.realpathSync(path.join(folder, 'js/app.js')));
	assert.equal(appFile(folder, '/leak.md'), null);
	assert.equal(appFile(folder, '/..%2Fsecret.md'), null);
	assert.equal(appFile(folder, '/js'), null, 'a folder is not a file');
	assert.equal(appFile(folder, '/missing.js'), null);
	fs.rmSync(root, { recursive: true, force: true });
});

test('appCsp: self only by default; network opens the granted origins', () => {
	const closed = appCsp();
	assert.match(closed, /^default-src 'self' data: blob:;/);
	assert.match(closed, /connect-src 'self' data: blob:;/);
	assert.match(closed, /form-action 'none'/);
	assert.match(closed, /frame-ancestors clew-preview:\/\/vault clew-app:\/\/app/);
	assert.doesNotMatch(closed, /https:/);
	const scoped = appCsp({ network: ['https://api.example.com'] });
	assert.match(scoped, /connect-src 'self' data: blob: https:\/\/api.example.com;/);
	assert.match(scoped, /form-action https:\/\/api.example.com/);
	assert.match(appCsp({ network: '*' }), /connect-src 'self' data: blob: https: http: wss: ws:;/);
});

test('injectBridge puts the client first in <head>', () => {
	assert.equal(injectBridge('<html><head><title>x</title></head></html>'), '<html><head><script src="/__clew_bridge__.js"></script><title>x</title></head></html>');
	assert.equal(injectBridge('<p>bare</p>'), '<script src="/__clew_bridge__.js"></script><p>bare</p>');
});

test('codeHash: the code, not the data', () => {
	const root = vault();
	put(root, 'index.html', 'a');
	put(root, 'data/state.json', '1');
	const h1 = codeHash(root);
	put(root, 'data/state.json', '2');
	assert.equal(codeHash(root), h1, 'data changes nothing');
	put(root, 'index.html', 'b');
	assert.notEqual(codeHash(root), h1, 'code does');
	fs.rmSync(root, { recursive: true, force: true });
});

test('describeCapabilities says scoped network by host', () => {
	assert.deepEqual(describeCapabilities(['note.read', 'network'], ['https://api.example.com']), ['read this note', 'send data to api.example.com']);
	assert.deepEqual(describeCapabilities(['network'], '*'), ['send data to the internet']);
});
