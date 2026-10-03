// A vault for pdf-link-scenario.js: `node smoke/make-pdf-link-vault.mjs
// <dir> <live|reading> <single|split|background> [mod]`. Note.md links to
// Papers/Five.pdf (five pages, written here, each saying its number) at
// page 3; `link-case.json` tells the scenario which case to set up. `mod`:
// the click carries ⌘ (live and reading view's "this pane" gesture).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const [dir, mode = 'live', layout = 'single', mod] = process.argv.slice(2);
if (!dir) { console.error('usage: make-pdf-link-vault.mjs <dir> <live|reading> <single|split|background> [mod]'); process.exit(1); }
rmSync(dir, { recursive: true, force: true });
mkdirSync(join(dir, 'Papers'), { recursive: true });

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

writeFileSync(join(dir, 'Papers', 'Five.pdf'), pdf(['Page one', 'Page two', 'Page three', 'Page four', 'Page five']), 'latin1');
writeFileSync(join(dir, 'Note.md'), '# Note\n\nA quote from the paper.\n\nSee [[Five.pdf#page=3|PDF p. 3]] for the source.\n');
writeFileSync(join(dir, 'link-case.json'), JSON.stringify({ mode, layout, mod: mod === 'mod' }));
