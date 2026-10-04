// A loopback host for app-origins-scenario.js: `node smoke/probe-stub.mjs
// <port> <log-file>` — answers anything 200 with `Access-Control-Allow-
// Origin: *` and logs each request that REACHED it, one JSON line each.
import fs from 'node:fs';
import http from 'node:http';

const [port, logFile] = process.argv.slice(2);
http.createServer((req, res) => {
	fs.appendFileSync(logFile, JSON.stringify({ at: Date.now(), port: Number(port), method: req.method, path: req.url }) + '\n');
	res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
	res.end('ok');
}).listen(Number(port), '127.0.0.1');
