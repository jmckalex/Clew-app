import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { fetchRemotePdf, nodeTransport, RemoteError } from '../src/main/remote-fetch.js';

// Every rule of the fetcher driven through a fake resolver and a fake
// transport: no network is touched, and no test loosens the address guard —
// the fakes stand where DNS and sockets would be.

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

/** Answers per host; an IP literal resolves to itself, as the OS does. */
function fakeResolve(table, calls = []) {
	return async (host) => {
		calls.push(host);
		if (net.isIP(host)) return [{ address: host, family: net.isIP(host) }];
		const answers = table[host];
		if (!answers) throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
		return answers.map((address) => ({ address, family: net.isIP(address) }));
	};
}

/** Responses per URL; records every request it was asked to make. */
function fakeTransport(routes, calls = []) {
	return async ({ url, address, headers }) => {
		calls.push({ url: url.href, address, headers });
		const route = routes[url.href];
		if (!route) throw Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
		if (route.hang) return new Promise(() => {});
		return {
			status: route.status ?? 200,
			headers: route.headers ?? { 'content-type': 'application/pdf' },
			body: route.body ?? (async function* () { yield route.bytes ?? PDF; })(),
		};
	};
}

const PUBLIC = { 'papers.example': ['93.184.216.34'] };
const code = (c) => (err) => err instanceof RemoteError && err.code === c;

test('a public PDF is fetched from the pinned address, with no credentials sent', async () => {
	const resolves = [];
	const calls = [];
	const got = await fetchRemotePdf('https://papers.example/a.pdf#page=3', {
		resolve: fakeResolve(PUBLIC, resolves),
		transport: fakeTransport({ 'https://papers.example/a.pdf': { headers: { 'content-type': 'application/pdf', etag: '"v1"' } } }, calls),
		userAgent: 'Clew/9.9',
	});
	assert.equal(got.notModified, false);
	assert.deepEqual(got.bytes, PDF);
	assert.equal(got.etag, '"v1"');
	assert.equal(calls.length, 1);
	assert.equal(calls[0].address, '93.184.216.34', 'connected to the vetted address');
	assert.equal(calls[0].url, 'https://papers.example/a.pdf', 'the fragment is not sent');
	assert.deepEqual(resolves, ['papers.example'], 'resolved once');
	const sent = Object.keys(calls[0].headers).map((h) => h.toLowerCase());
	assert.deepEqual(sent.sort(), ['accept', 'user-agent']);
	assert.equal(calls[0].headers['User-Agent'], 'Clew/9.9');
});

test('a host that resolves to a local, private or metadata address is never connected to', async () => {
	for (const address of ['127.0.0.1', '10.1.2.3', '192.168.1.10', '169.254.169.254', '100.64.0.9', '::1', 'fd00::5', '::ffff:127.0.0.1', '64:ff9b::a9fe:a9fe']) {
		const calls = [];
		await assert.rejects(fetchRemotePdf('http://evil.example/x.pdf', {
			resolve: fakeResolve({ 'evil.example': [address] }),
			transport: fakeTransport({}, calls),
		}), code('refused-address'), address);
		assert.equal(calls.length, 0, `${address}: no request made`);
	}
});

test('an IP literal in the URL is judged the same way', async () => {
	for (const raw of ['http://127.0.0.1/x.pdf', 'http://[::1]/x.pdf', 'http://169.254.169.254/latest/x.pdf', 'http://[::ffff:10.0.0.1]/x.pdf']) {
		await assert.rejects(fetchRemotePdf(raw, { resolve: fakeResolve({}), transport: fakeTransport({}) }), code('refused-address'), raw);
	}
});

test('mixed DNS — one public answer and one private — refuses the host', async () => {
	const calls = [];
	await assert.rejects(fetchRemotePdf('https://split.example/x.pdf', {
		resolve: fakeResolve({ 'split.example': ['93.184.216.34', '10.0.0.7'] }),
		transport: fakeTransport({}, calls),
	}), code('refused-address'));
	assert.equal(calls.length, 0);
});

test('the answer that was vetted is the one connected to — a later DNS answer is never asked for', async () => {
	// A rebinding resolver: public on the first ask, private on any other.
	let asks = 0;
	const rebinding = async () => (++asks === 1 ? [{ address: '93.184.216.34', family: 4 }] : [{ address: '127.0.0.1', family: 4 }]);
	const calls = [];
	await fetchRemotePdf('https://rebind.example/x.pdf', {
		resolve: rebinding,
		transport: fakeTransport({ 'https://rebind.example/x.pdf': {} }, calls),
	});
	assert.equal(asks, 1);
	assert.equal(calls[0].address, '93.184.216.34');
});

test('a redirect into a refused range is refused, and every hop is re-vetted', async () => {
	const calls = [];
	await assert.rejects(fetchRemotePdf('https://papers.example/a.pdf', {
		resolve: fakeResolve({ ...PUBLIC, 'intranet.example': ['192.168.0.20'] }),
		transport: fakeTransport({
			'https://papers.example/a.pdf': { status: 302, headers: { location: 'http://intranet.example/secret.pdf' } },
		}, calls),
	}), code('refused-address'));
	assert.equal(calls.length, 1, 'the private hop is never requested');
	// …and straight to an address literal:
	await assert.rejects(fetchRemotePdf('https://papers.example/a.pdf', {
		resolve: fakeResolve(PUBLIC),
		transport: fakeTransport({ 'https://papers.example/a.pdf': { status: 301, headers: { location: 'http://169.254.169.254/x.pdf' } } }),
	}), code('refused-address'));
});

test('a redirect to a public host is followed, relative locations too', async () => {
	const calls = [];
	const got = await fetchRemotePdf('https://papers.example/a.pdf', {
		resolve: fakeResolve({ ...PUBLIC, 'cdn.example': ['151.101.1.1'] }),
		transport: fakeTransport({
			'https://papers.example/a.pdf': { status: 301, headers: { location: '/b.pdf' } },
			'https://papers.example/b.pdf': { status: 307, headers: { location: 'https://cdn.example/c.pdf' } },
			'https://cdn.example/c.pdf': {},
		}, calls),
	});
	assert.equal(got.url, 'https://cdn.example/c.pdf');
	assert.deepEqual(calls.map((c) => c.address), ['93.184.216.34', '93.184.216.34', '151.101.1.1']);
});

test('more than five redirects, or one to another scheme, is refused', async () => {
	const routes = {};
	for (let i = 0; i < 7; i++) routes[`https://papers.example/${i}.pdf`] = { status: 302, headers: { location: `/${i + 1}.pdf` } };
	await assert.rejects(fetchRemotePdf('https://papers.example/0.pdf', { resolve: fakeResolve(PUBLIC), transport: fakeTransport(routes) }), code('too-many-redirects'));
	for (const location of ['file:///etc/passwd', 'ftp://papers.example/a.pdf', 'javascript:alert(1)']) {
		await assert.rejects(fetchRemotePdf('https://papers.example/a.pdf', {
			resolve: fakeResolve(PUBLIC),
			transport: fakeTransport({ 'https://papers.example/a.pdf': { status: 302, headers: { location } } }),
		}), code('bad-url'), location);
	}
});

test('only http(s) URLs without credentials are fetched', async () => {
	for (const raw of ['file:///Users/x/a.pdf', 'ftp://papers.example/a.pdf', 'https://user:pw@papers.example/a.pdf', 'not a url']) {
		await assert.rejects(fetchRemotePdf(raw, { resolve: fakeResolve(PUBLIC), transport: fakeTransport({}) }), code('bad-url'), raw);
	}
});

test('the answer must be a 200 PDF: statuses, web pages and other types are named', async () => {
	const one = (route) => fetchRemotePdf('https://papers.example/a.pdf', {
		resolve: fakeResolve(PUBLIC), transport: fakeTransport({ 'https://papers.example/a.pdf': route }),
	});
	await assert.rejects(one({ status: 404 }), (err) => err.code === 'http-status' && /404/.test(err.message));
	await assert.rejects(one({ headers: { 'content-type': 'text/html; charset=utf-8' } }), (err) => err.code === 'web-page' && /sign in/.test(err.message));
	await assert.rejects(one({ headers: { 'content-type': 'image/png' } }), code('not-pdf'));
	await assert.rejects(one({ bytes: Buffer.from('<html>not a pdf</html>') , headers: { 'content-type': 'application/octet-stream' } }), code('not-pdf'));
	// The spec allows junk before the header, within the first 1024 bytes only.
	const late = Buffer.concat([Buffer.alloc(1100, 0x20), PDF]);
	await assert.rejects(one({ bytes: late }), code('not-pdf'));
	const early = Buffer.concat([Buffer.alloc(500, 0x20), PDF]);
	assert.equal((await one({ bytes: early })).bytes.length, early.length);
	// A generic binary type is fine.
	assert.ok((await one({ headers: { 'content-type': 'application/octet-stream' } })).bytes);
});

test('the size cap is counted while streaming, whatever Content-Length claims', async () => {
	let pulled = 0;
	const body = (async function* () {
		yield PDF;
		for (let i = 0; i < 100; i++) { pulled++; yield Buffer.alloc(1024); }
	})();
	await assert.rejects(fetchRemotePdf('https://papers.example/big.pdf', {
		resolve: fakeResolve(PUBLIC),
		transport: fakeTransport({ 'https://papers.example/big.pdf': { headers: { 'content-type': 'application/pdf', 'content-length': '10' }, body } }),
		limits: { maxBytes: 4096 },
	}), code('too-large'));
	assert.ok(pulled < 10, `stopped reading early (read ${pulled} chunks)`);
});

test('a conditional request sends the validators and takes a 304 as fresh', async () => {
	const calls = [];
	const got = await fetchRemotePdf('https://papers.example/a.pdf', {
		resolve: fakeResolve(PUBLIC),
		transport: fakeTransport({ 'https://papers.example/a.pdf': { status: 304, headers: {} } }, calls),
		validators: { etag: '"v1"', lastModified: 'Wed, 30 Sep 2026 10:00:00 GMT' },
	});
	assert.equal(got.notModified, true);
	assert.equal(calls[0].headers['If-None-Match'], '"v1"');
	assert.equal(calls[0].headers['If-Modified-Since'], 'Wed, 30 Sep 2026 10:00:00 GMT');
	// Without validators a 304 is just a status that is not 200.
	await assert.rejects(fetchRemotePdf('https://papers.example/a.pdf', {
		resolve: fakeResolve(PUBLIC), transport: fakeTransport({ 'https://papers.example/a.pdf': { status: 304, headers: {} } }),
	}), code('http-status'));
});

test('timeouts: no answer, and a body that stalls', async () => {
	await assert.rejects(fetchRemotePdf('https://papers.example/slow.pdf', {
		resolve: fakeResolve(PUBLIC),
		transport: fakeTransport({ 'https://papers.example/slow.pdf': { hang: true } }),
		limits: { headersMs: 50, totalMs: 5000 },
	}), code('headers-timeout'));
	const stalling = (async function* () { yield PDF; await new Promise(() => {}); })();
	await assert.rejects(fetchRemotePdf('https://papers.example/stall.pdf', {
		resolve: fakeResolve(PUBLIC),
		transport: fakeTransport({ 'https://papers.example/stall.pdf': { body: stalling } }),
		limits: { totalMs: 100 },
	}), code('timeout'));
});

test('DNS failure and a refused connection are named', async () => {
	await assert.rejects(fetchRemotePdf('https://nowhere.example/a.pdf', { resolve: fakeResolve({}), transport: fakeTransport({}) }), code('dns'));
	await assert.rejects(fetchRemotePdf('https://papers.example/gone.pdf', { resolve: fakeResolve(PUBLIC), transport: fakeTransport({}) }), code('network'));
});

test('the real transport connects to the PINNED address, not what the name resolves to', async () => {
	// A name that does not exist anywhere: only the pinned lookup can reach
	// the local server — which is exactly the property the guard relies on.
	// (The transport alone: the guard, which would refuse 127.0.0.1, is not
	// in this path.)
	const seen = [];
	const server = http.createServer((req, res) => {
		seen.push({ host: req.headers.host, cookie: req.headers.cookie, ua: req.headers['user-agent'] });
		res.writeHead(200, { 'content-type': 'application/pdf' });
		res.end(PDF);
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const port = server.address().port;
	try {
		const res = await nodeTransport({
			url: new URL(`http://pinned.invalid:${port}/x.pdf`),
			address: '127.0.0.1', family: 4,
			headers: { 'User-Agent': 'Clew/test' },
			connectMs: 2000,
		});
		const chunks = [];
		for await (const c of res.body) chunks.push(c);
		assert.equal(res.status, 200);
		assert.deepEqual(Buffer.concat(chunks), PDF);
		assert.equal(seen[0].host, `pinned.invalid:${port}`, 'the Host header is still the URL\'s');
		assert.equal(seen[0].cookie, undefined);
		assert.equal(seen[0].ua, 'Clew/test');
	} finally {
		server.close();
	}
});
