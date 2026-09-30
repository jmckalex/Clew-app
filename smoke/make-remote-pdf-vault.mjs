// A vault whose note embeds two WEB PDFs, and a device cache pre-seeded so
// that one of them is served with no network at all (docs/dev/
// pdf-unification.md §6: the page-side flow — registration, the route,
// read-only, Save a copy, Open in browser — exercised without the network,
// and without any switch that loosens the address guard):
//
//   node smoke/make-remote-pdf-vault.mjs <vault> <userData>
//
// Web.md: `https://papers.example.org/paper.pdf#page=2` (in the cache,
// checked just now, so nothing revalidates) and `https://127.0.0.1/x.pdf`
// (refused by the address guard before any connection — no fetch leaves).
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [vault, userData] = process.argv.slice(2);
if (!vault || !userData) throw new Error('usage: node smoke/make-remote-pdf-vault.mjs <vault> <userData>');
const here = path.dirname(fileURLToPath(import.meta.url));
execFileSync(process.execPath, [path.join(here, 'make-pdf-vault.mjs'), vault]);
fs.rmSync(userData, { recursive: true, force: true });

const URL_OK = 'https://papers.example.org/paper.pdf';
const URL_REFUSED = 'https://127.0.0.1/x.pdf';
fs.writeFileSync(path.join(vault, 'Web.md'), [
	'# Web PDFs',
	'',
	`<iframe src="${URL_OK}#page=2" width="640" height="420"></iframe>`,
	'',
	`<iframe src="${URL_REFUSED}" width="640" height="200"></iframe>`,
	'',
].join('\n'));

const pdf = fs.readFileSync(path.join(vault, 'Paper.pdf'));
const key = crypto.createHash('sha256').update(URL_OK).digest('hex');
const dir = path.join(userData, 'remote-pdfs');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, `${key}.pdf`), pdf);
const now = Date.now();
fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify({
	url: URL_OK, finalUrl: URL_OK, fetchedAt: now - 3 * 60 * 60 * 1000, checkedAt: now,
	lastUsed: now, etag: null, lastModified: null, size: pdf.length,
}, null, '\t'));
console.log(`${vault}  (cache: ${key}.pdf)`);
