// The fixture for office-bridges-scenario.js: one Word file (made by macOS
// textutil, as the manual's office recipe does) opened three ways — in an
// office tab, as a LIVE embed in a note (two frames deep, posting to
// window.top), and as a thumbnail embed.
//
//   node smoke/make-office-bridges-vault.mjs /tmp/office-bridges-vault
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = process.argv[2];
if (!dir) {
	console.error('usage: node smoke/make-office-bridges-vault.mjs <dir>');
	process.exit(1);
}
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const html = path.join(dir, 'report.html');
fs.writeFileSync(html, '<html><head><meta charset="utf-8"></head><body><h1>Report</h1><p>A document for the office bridges.</p></body></html>');
execFileSync('textutil', ['-convert', 'docx', html, '-output', path.join(dir, 'Report.docx')]);
fs.rmSync(html);
fs.writeFileSync(path.join(dir, 'Live.md'), '# Live\n\n![[Report.docx|live]]\n');
fs.writeFileSync(path.join(dir, 'Thumb.md'), '# Thumb\n\n![[Report.docx]]\n');
