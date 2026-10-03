import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRemotePdfCache, remoteKey } from '../src/main/remote-pdf-cache.js';

// One temp root for this file, removed when it is done: fixtures used to
// be left in the system's temp folder, thousands of them over the runs.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-remote-'));
after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const PDF = (n = 1) => Buffer.from(`%PDF-1.7\n${'x'.repeat(n)}\n%%EOF\n`);
const DAY = 24 * 60 * 60 * 1000;

function setup({ responses = {}, limits } = {}) {
	const dir = fs.mkdtempSync(path.join(tmpRoot, 'clew-remote-'));
	let clock = 1_000_000;
	const calls = [];
	const fetchPdf = async (url, opts) => {
		calls.push({ url, validators: opts?.validators ?? null });
		const r = responses[url];
		if (!r) throw Object.assign(new Error('offline'), { code: 'network' });
		if (typeof r === 'function') return r(opts);
		return r;
	};
	const cache = createRemotePdfCache({ dir, fetchPdf, now: () => clock, limits });
	return { dir, cache, calls, tick: (ms) => { clock += ms; }, responses };
}

const ok = (bytes, extra = {}) => ({ notModified: false, bytes, url: extra.url ?? 'x', etag: extra.etag ?? null, lastModified: extra.lastModified ?? null });

test('keys are sha256 of the URL alone', () => {
	assert.equal(remoteKey('https://a.example/x.pdf').length, 64);
	assert.notEqual(remoteKey('https://a.example/x.pdf'), remoteKey('https://a.example/y.pdf'));
});

test('the first ask fetches and stores; the next is served from the device, no network', async () => {
	const url = 'https://a.example/x.pdf';
	const { dir, cache, calls } = setup({ responses: { [url]: ok(PDF(), { etag: '"1"' }) } });
	const first = await cache.get(url);
	assert.deepEqual(fs.readFileSync(first.file), PDF());
	assert.equal(first.meta.url, url);
	assert.equal(first.meta.etag, '"1"');
	assert.ok(first.file.startsWith(dir) && path.basename(first.file) === `${remoteKey(url)}.pdf`);
	const again = await cache.get(url);
	assert.equal(again.file, first.file);
	assert.equal(calls.length, 1, 'served from the cache');
});

test('a copy older than a day is served at once and revalidated in the background', async () => {
	const url = 'https://a.example/x.pdf';
	const { cache, calls, tick, responses } = setup({ responses: { 'https://a.example/x.pdf': ok(PDF(), { etag: '"1"' }) } });
	await cache.get(url);
	tick(DAY + 1);
	responses[url] = { notModified: true, url };
	const stale = await cache.get(url);
	assert.equal(stale.error, undefined);
	await new Promise((r) => setTimeout(r, 20));
	assert.equal(calls.length, 2);
	assert.deepEqual(calls[1].validators, { etag: '"1"', lastModified: null }, 'a conditional request');
	// …and not again the same day.
	tick(60_000);
	await cache.get(url);
	await new Promise((r) => setTimeout(r, 20));
	assert.equal(calls.length, 2);
});

test('reload refetches now; failing, it serves the copy with the error attached', async () => {
	const url = 'https://a.example/x.pdf';
	const { cache, calls, responses } = setup({ responses: { 'https://a.example/x.pdf': ok(PDF(3)) } });
	await cache.get(url);
	responses[url] = ok(PDF(9));
	const fresh = await cache.get(url, { reload: true });
	assert.equal(calls.length, 2);
	assert.deepEqual(fs.readFileSync(fresh.file), PDF(9));
	delete responses[url];   // offline now
	const offline = await cache.get(url, { reload: true });
	assert.equal(offline.error.code, 'network');
	assert.deepEqual(fs.readFileSync(offline.file), PDF(9), 'the saved copy');
});

test('no copy and no network: the fetch error, by name', async () => {
	const { cache } = setup();
	await assert.rejects(cache.get('https://a.example/never.pdf'), (err) => err.code === 'network');
});

test('past the cap, the least recently used copies go first', async () => {
	const urls = ['https://a.example/1.pdf', 'https://a.example/2.pdf', 'https://a.example/3.pdf'];
	const size = PDF(100).length;
	const { cache, tick } = setup({
		responses: Object.fromEntries(urls.map((u) => [u, ok(PDF(100))])),
		limits: { maxTotalBytes: size * 2 },
	});
	await cache.get(urls[0]); tick(10);
	await cache.get(urls[1]); tick(10);
	await cache.get(urls[0]); tick(10);     // 1 used again: 2 is now the oldest
	await cache.get(urls[2]);
	assert.ok(cache.fileOf(remoteKey(urls[0])), '1 kept');
	assert.equal(cache.fileOf(remoteKey(urls[1])), null, '2 evicted');
	assert.ok(cache.fileOf(remoteKey(urls[2])), '3 kept');
});

test('asks for the same URL at once share one fetch', async () => {
	const url = 'https://a.example/x.pdf';
	let release;
	const gate = new Promise((r) => { release = r; });
	const { cache, calls } = setup({ responses: { [url]: async () => { await gate; return ok(PDF()); } } });
	const both = Promise.all([cache.get(url), cache.get(url)]);
	release();
	const [a, b] = await both;
	assert.equal(a.file, b.file);
	assert.equal(calls.length, 1);
});

test('a copy planted without its record is not served', async () => {
	// The cache is the DEVICE's; still, a bare .pdf with no .json is not an entry.
	const url = 'https://a.example/x.pdf';
	const { dir, cache, calls, responses } = setup({ responses: { [url]: ok(PDF(5)) } });
	fs.writeFileSync(path.join(dir, `${remoteKey(url)}.pdf`), 'planted');
	const got = await cache.get(url);
	assert.equal(calls.length, 1, 'fetched, not trusted');
	assert.deepEqual(fs.readFileSync(got.file), PDF(5));
	assert.ok(responses);
});
