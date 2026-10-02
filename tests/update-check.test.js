import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, parseVersion, platformKey, readFeed, decide, FEED_URL } from '../src/main/update-check.js';

test('semver precedence, prereleases included', () => {
	assert.ok(compareVersions('0.12.1', '0.12.0') > 0);
	assert.ok(compareVersions('0.12.0', '0.12.1') < 0);
	assert.equal(compareVersions('0.12.0', '0.12.0'), 0);
	assert.ok(compareVersions('0.12.1', '0.12.1-dev.1') > 0, 'a release outranks its prereleases');
	assert.ok(compareVersions('0.12.1-dev.2', '0.12.1-dev.1') > 0);
	assert.ok(compareVersions('0.12.1-dev.10', '0.12.1-dev.9') > 0, 'numeric ids compare as numbers');
	assert.ok(compareVersions('0.13.0', '0.12.99') > 0);
	assert.equal(parseVersion('banana'), null);
	assert.equal(compareVersions('banana', '1.0.0'), 0, 'unparseable: no claim');
});

test('the right file for this machine', () => {
	assert.equal(platformKey({ platform: 'darwin', arch: 'arm64' }), 'mac-arm64');
	assert.equal(platformKey({ platform: 'darwin', arch: 'x64' }), 'mac-x64');
	assert.equal(platformKey({ platform: 'win32', arch: 'x64' }), 'win-x64');
	assert.equal(platformKey({ platform: 'linux', arch: 'x64', appImage: '/x/Clew.AppImage' }), 'linux-appimage');
	assert.equal(platformKey({ platform: 'linux', arch: 'x64', appImage: undefined }), 'linux-deb');
});

const feed = {
	version: '0.13.0', released: '2026-10-10', notes: '../manual/whats-new.html#v0-13-0',
	files: {
		'mac-arm64': { url: 'Clew-0.13.0-arm64.dmg', sha512: 'abc', size: 10 },
		'win-x64': { url: 'https://evil.example/Clew-Setup.exe' },
		'linux-deb': { url: 'javascript:alert(1)' },
	},
};

test('readFeed resolves against the feed and keeps only its own origin', () => {
	const f = readFeed(feed, FEED_URL);
	assert.equal(f.files['mac-arm64'].url, 'https://clew-app.com/downloads/Clew-0.13.0-arm64.dmg');
	assert.equal(f.notes, 'https://clew-app.com/manual/whats-new.html#v0-13-0');
	assert.equal(f.files['win-x64'], undefined, 'another origin is dropped');
	assert.equal(f.files['linux-deb'], undefined, 'another scheme is dropped');
	assert.equal(readFeed({ version: 'x' }, FEED_URL), null);
	assert.equal(readFeed(null, FEED_URL), null);
	// A loopback test feed may be http; a remote http feed may not.
	assert.equal(readFeed(feed, 'http://127.0.0.1:8123/latest.json').files['mac-arm64'].url, 'http://127.0.0.1:8123/Clew-0.13.0-arm64.dmg');
	assert.deepEqual(readFeed(feed, 'http://example.com/latest.json').files, {});
});

test('decide: newer, current, skipped, and a manual check that ignores the skip', () => {
	const f = readFeed(feed, FEED_URL);
	const mac = { platform: 'darwin', arch: 'arm64' };
	assert.deepEqual(decide(f, { current: '0.12.1', platform: mac }), { status: 'available', version: '0.13.0', released: '2026-10-10', notes: 'https://clew-app.com/manual/whats-new.html#v0-13-0', download: 'https://clew-app.com/downloads/Clew-0.13.0-arm64.dmg' });
	assert.equal(decide(f, { current: '0.13.0', platform: mac }).status, 'current');
	assert.equal(decide(f, { current: '0.14.0-dev.1', platform: mac }).status, 'current');
	assert.equal(decide(f, { current: '0.12.1', skipped: '0.13.0', platform: mac }).status, 'skipped');
	assert.equal(decide(f, { current: '0.12.1', skipped: '0.13.0', manual: true, platform: mac }).status, 'available');
	assert.equal(decide(f, { current: '0.12.1', platform: { platform: 'win32', arch: 'x64' } }).download, null, 'no file for this machine: notes only');
});

test('the release feed: served names, base64 sha512, relative to the feed', async () => {
	const { artifactNames, latestJson } = await import('../scripts/write-latest-json.mjs');
	const names = artifactNames('0.13.0');
	assert.deepEqual(names['win-x64'], { built: 'Clew Setup 0.13.0.exe', served: 'Clew-Setup-0.13.0.exe' });
	const json = latestJson({ version: '0.13.0', released: '2026-10-10', notes: 'n', found: { 'mac-arm64': { served: 'Clew-0.13.0-arm64.dmg', sha512: 'x', size: 3 } } });
	assert.deepEqual(json, { version: '0.13.0', released: '2026-10-10', notes: 'n', files: { 'mac-arm64': { url: 'Clew-0.13.0-arm64.dmg', sha512: 'x', size: 3 } } });
	// What the app makes of it.
	const f = readFeed(json, FEED_URL);
	assert.equal(f.files['mac-arm64'].url, 'https://clew-app.com/downloads/Clew-0.13.0-arm64.dmg');
});
