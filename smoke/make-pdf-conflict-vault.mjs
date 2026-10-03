// A vault for pdf-conflict-scenario.js: `node smoke/make-pdf-conflict-vault.mjs
// <dir> <mine|theirs|both|later> [tab|embed] [gone]`. Paper.pdf (three
// pages, written here) and Embed.md embedding it; `case.json` says which
// choice the scenario makes, where the viewer is, and whether it is gone
// (its tab closed) before the choice.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const [dir, choice = 'both', surface = 'tab', gone] = process.argv.slice(2);
if (!dir) { console.error('usage: make-pdf-conflict-vault.mjs <dir> <mine|theirs|both|later>'); process.exit(1); }
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

function pdf(pages) {
	const objects = [];
	const add = (body) => { objects.push(body); return objects.length; };
	const catalog = add(null);
	const pagesObj = add(null);
	const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
	const kids = pages.map((line) => {
		const stream = ['BT', '/F1 24 Tf', '72 700 Td', `(${line}) Tj`, 'ET'].join('\n');
		const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
		return add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Contents ${content} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`);
	});
	objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
	objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
	let out = '%PDF-1.4\n';
	const offsets = [];
	objects.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
	const xref = out.length;
	out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
	out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return out;
}

writeFileSync(join(dir, 'Paper.pdf'), pdf(['Page one of the paper', 'Page two', 'Page three']), 'latin1');
writeFileSync(join(dir, 'Note.md'), '# Note\n\nReading the paper.\n');
writeFileSync(join(dir, 'Embed.md'), '# Embed\n\n![[Paper.pdf]]\n');
writeFileSync(join(dir, 'case.json'), JSON.stringify({ choice, surface, gone: gone === 'gone' }));
