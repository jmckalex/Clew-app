// What clew-app://app serves (src/main/app-files.js; frame-bridge.md §2.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { appFileFor, appPageCsp } from '../src/main/app-files.js';

const root = path.resolve('/tmp/clew-dist/renderer');

test('the app page and its files, typed', () => {
	assert.deepEqual(appFileFor(root, 'clew-app://app/index.html'), { file: path.join(root, 'index.html'), type: 'text/html; charset=utf-8', isPage: true });
	assert.equal(appFileFor(root, 'clew-app://app/').file, path.join(root, 'index.html'));
	assert.equal(appFileFor(root, 'clew-app://app/bundle.js').type, 'text/javascript; charset=utf-8');
	assert.equal(appFileFor(root, 'clew-app://app/styles/main.css').type, 'text/css; charset=utf-8');
	assert.equal(appFileFor(root, 'clew-app://app/vendor/xterm.css').file, path.join(root, 'vendor', 'xterm.css'));
	assert.equal(appFileFor(root, 'clew-app://app/styles/index.html').isPage, false);
});

test('nothing outside the folder, no other host, nothing untyped', () => {
	// Dot segments are resolved by the URL parser itself, inside the folder…
	assert.ok(appFileFor(root, 'clew-app://app/../main/main.js').file.startsWith(root + path.sep));
	assert.ok(appFileFor(root, 'clew-app://app/%2e%2e/main/main.js').file.startsWith(root + path.sep));
	// …and an encoded separator, decoded after it, is caught by the clamp.
	assert.equal(appFileFor(root, 'clew-app://app/..%2F..%2Fetc/passwd.js'), null);
	assert.equal(appFileFor(root, 'clew-app://app/x%2F..%2F..%2F..%2Fmain%2Fmain.js'), null);
	assert.equal(appFileFor(root, 'clew-app://other/index.html'), null);
	assert.equal(appFileFor(root, 'clew-preview://vault/index.html'), null);
	assert.equal(appFileFor(root, 'clew-app://app/Notes/Some%20note.md'), null);
	assert.equal(appFileFor(root, 'clew-app://app/x.exe'), null);
	assert.equal(appFileFor(root, 'not a url'), null);
});

test('the page CSP header is its own meta policy plus frame-ancestors none', () => {
	const html = '<meta http-equiv="Content-Security-Policy"\n\t\tcontent="default-src \'self\'; img-src \'self\' data:">';
	assert.equal(appPageCsp(html), "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
	assert.equal(appPageCsp('<html></html>'), "default-src 'self'; frame-ancestors 'none'");
});
