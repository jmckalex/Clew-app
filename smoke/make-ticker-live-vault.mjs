// A vault for ticker-live-scenario.js:
//   node smoke/make-ticker-live-vault.mjs <dir> <stub|real> [port]
// <dir>/vault/Ticker.md embeds the demo vault's Stock Ticker over a table of
// AAPL, MSFT and ZZZZ (no such symbol). `stub`: the app is a TEST COPY
// whose Finnhub base and manifest origin point at smoke/finnhub-stub.mjs on
// 127.0.0.1:<port> — written here, into the scratch vault, so nothing of it
// can reach the shipped app (its name says "test copy"). `real`: the app as
// shipped, against finnhub.io and api.frankfurter.dev. <dir>/ud is a fresh
// userData (restricted: the app behind its prompt).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [dir, kind = 'stub', port = '48731'] = process.argv.slice(2);
if (!dir) throw new Error('usage: node smoke/make-ticker-live-vault.mjs <dir> <stub|real> [port]');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vault = path.join(dir, 'vault');
const app = path.join(vault, 'Apps', 'Ticker');
fs.rmSync(dir, { recursive: true, force: true });
fs.cpSync(path.join(repo, 'demo-vault', 'Apps', 'Ticker'), app, { recursive: true });
if (kind === 'stub') {
	const stub = `http://127.0.0.1:${port}`;
	const code = fs.readFileSync(path.join(app, 'app.js'), 'utf8');
	const swapped = code.replace("const FINNHUB_API = 'https://finnhub.io/api/v1';", `const FINNHUB_API = '${stub}/api/v1';`);
	if (swapped === code) throw new Error('app.js no longer names FINNHUB_API as expected');
	fs.writeFileSync(path.join(app, 'app.js'), swapped);
	const manifest = JSON.parse(fs.readFileSync(path.join(app, 'clew-app.json'), 'utf8'));
	manifest.name = 'Stock Ticker (test copy)';
	manifest.network = [stub, 'https://api.frankfurter.dev'];
	fs.writeFileSync(path.join(app, 'clew-app.json'), JSON.stringify(manifest, null, '\t'));
}
fs.mkdirSync(path.join(dir, 'ud'), { recursive: true });
fs.writeFileSync(path.join(vault, 'ticker-mode.txt'), `${kind}\n`);
fs.writeFileSync(path.join(vault, 'Ticker.md'), `# Ticker

The band:

@app+[Apps/Ticker]{height=170}

| Symbol | Price |
| --- | ---: |
| AAPL | 220.00 |
| MSFT | 400.00 |
| ZZZZ | 10.00 |
`);
console.log(`ticker live fixture: ${vault} (${kind})`);
