// A vault for pdf-annotations-scenario.js: `node smoke/make-pdf-vault.mjs <dir>`.
// Paper.pdf is written here, by hand — four pages of Helvetica text, no
// annotations — so the scenario has a page 3 to link to (with room to
// scroll it to the top) and known words to highlight. (The demo's
// sample.pdf has one page.)
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: make-pdf-vault.mjs <dir>'); process.exit(1); }
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const pages = [
	['The first page of the paper.', 'Morality evolves by imitation.', 'A second line to highlight.'],
	['The second page of the paper.'],
	['The third page of the paper.', 'Signals acquire meaning.'],
	['The fourth page of the paper.'],
];
const objects = [];
const add = (body) => { objects.push(body); return objects.length; };
const catalog = add(null);
const pagesObj = add(null);
const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
const kids = pages.map((lines) => {
	const stream = ['BT', '/F1 18 Tf', '72 720 Td', '24 TL', ...lines.map((l) => `(${l}) Tj T*`), 'ET'].join('\n');
	const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
	return add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Contents ${content} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`);
});
objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((body, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
const xref = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(join(dir, 'Paper.pdf'), pdf, 'latin1');
writeFileSync(join(dir, 'Welcome.md'), '# Welcome\n\nThe paper: [[Paper.pdf]].\n');
