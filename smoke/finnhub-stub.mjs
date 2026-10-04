// A stand-in for Finnhub's /api/v1/quote, for ticker-live-scenario.js:
//   node smoke/finnhub-stub.mjs <port> <expected-key> <log-file>
// CORS as Finnhub's own (measured 2026-10-04): `Access-Control-Allow-Origin:
// *`, and a preflight that allows NO request headers — so an
// X-Finnhub-Token header fails here exactly as it does there. Quotes:
// AAPL and MSFT fresh, ZZZZ unknown (zeros, as Finnhub answers); the 4th
// request is a 429 (with Retry-After: 3, EXPOSED so the test need not wait
// Finnhub's unexposed minute — live.js's default is unit-tested); from then
// on every timestamp is three days old, so the market reads closed. Each
// request is logged as a JSON line — whether a token came and matched,
// never the token itself.
import fs from 'node:fs';
import http from 'node:http';

const [port, expected, logFile] = process.argv.slice(2);
let n = 0;
const log = (entry) => fs.appendFileSync(logFile, JSON.stringify({ at: Date.now(), ...entry }) + '\n');

http.createServer((req, res) => {
	const url = new URL(req.url, `http://127.0.0.1:${port}`);
	const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Expose-Headers': 'Content-Length, Retry-After' };
	if (req.method === 'OPTIONS') {
		log({ method: 'OPTIONS', path: url.pathname, asked: req.headers['access-control-request-headers'] ?? null });
		res.writeHead(200, cors);
		res.end();
		return;
	}
	if (url.pathname !== '/api/v1/quote') { res.writeHead(404, cors); res.end(); return; }
	n++;
	const token = url.searchParams.get('token');
	const entry = { method: req.method, n, symbol: url.searchParams.get('symbol'), token: token == null ? 'absent' : token === expected ? 'ok' : 'wrong', header: 'x-finnhub-token' in req.headers };
	const json = (status, body, extra = {}) => {
		log({ ...entry, status });
		res.writeHead(status, { 'Content-Type': 'application/json', ...cors, ...extra });
		res.end(JSON.stringify(body));
	};
	if (token !== expected) return json(401, { error: 'Invalid API key.' });
	if (n === 4) return json(429, { error: 'API limit reached.' }, { 'Retry-After': '3' });
	const now = Math.floor(Date.now() / 1000);
	const t = n > 4 ? now - 3 * 86400 : now - 60;
	if (entry.symbol === 'AAPL') return json(200, { c: 227.5, d: 1.25, dp: 0.5525, h: 228, l: 225, o: 226, pc: 226.25, t });
	if (entry.symbol === 'MSFT') return json(200, { c: 412.1, d: -2.3, dp: -0.555, h: 415, l: 410, o: 414, pc: 414.4, t });
	return json(200, { c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 });
}).listen(Number(port), '127.0.0.1', () => log({ listening: Number(port) }));
