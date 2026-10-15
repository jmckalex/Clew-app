// A vault for pdf-size-scenario.js: `node smoke/make-pdf-size-vault.mjs <dir>`.
// PDFs written here by hand, each page a big number in Helvetica so a
// screenshot shows which page is in view: Paper.pdf (four US letter pages),
// A4.pdf (three A4), Wide.pdf (three landscape letter), One.pdf (a single
// letter page), Broken.pdf (not a PDF at all) and — when qpdf is on the
// PATH — Locked.pdf, One.pdf behind the password "secret". One note per
// case, each embedding one PDF, so each has one viewer.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: make-pdf-size-vault.mjs <dir>'); process.exit(1); }
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

function pdf(pages) {
	const objects = [];
	const add = (body) => { objects.push(body); return objects.length; };
	const catalog = add(null);
	const pagesObj = add(null);
	const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
	const kids = pages.map(([w, h], i) => {
		const stream = ['BT', '/F1 24 Tf', `72 ${h - 96} Td`, `(Page ${i + 1} of ${pages.length}) Tj`, 'ET',
			'BT', '/F1 200 Tf', `${w / 2 - 60} ${h / 2 - 70} Td`, `(${i + 1}) Tj`, 'ET',
			// a frame just inside the page's edge: its top and bottom show
			// whether the whole page is in view
			'2 w', `12 12 ${w - 24} ${h - 24} re S`].join('\n');
		const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
		return add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${w} ${h}] /Contents ${content} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`);
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

const letter = [612, 792];
const a4 = [595, 842];
const wide = [792, 612];
writeFileSync(join(dir, 'Paper.pdf'), pdf([letter, letter, letter, letter]), 'latin1');
writeFileSync(join(dir, 'A4.pdf'), pdf([a4, a4, a4]), 'latin1');
writeFileSync(join(dir, 'Wide.pdf'), pdf([wide, wide, wide]), 'latin1');
writeFileSync(join(dir, 'One.pdf'), pdf([letter]), 'latin1');
writeFileSync(join(dir, 'Broken.pdf'), '%PDF-1.4\nthis is not a PDF\n%%EOF\n', 'latin1');
const locked = spawnSync('qpdf', ['--encrypt', 'secret', 'secret', '256', '--', join(dir, 'One.pdf'), join(dir, 'Locked.pdf')]);
if (locked.status === 0) writeFileSync(join(dir, 'Locked.md'), '# Locked\n\nAbove the embed.\n\n![[Locked.pdf]]\n\nBelow the embed.\n');
else console.log('make-pdf-size-vault: no qpdf, so no Locked.pdf (the password case is skipped)');

const notes = {
	'Embed.md': '![[Paper.pdf]]',
	'Height.md': '![[Paper.pdf#height=400]]',
	'Width.md': '![[A4.pdf#width=60%]]',
	'Wide.md': '![[Wide.pdf]]',
	'One.md': '![[One.pdf]]',
	'Broken.md': '![[Broken.pdf]]',
	'Edit.md': '![[Paper.pdf]]',
	// #page=N
	'Page.md': '![[Paper.pdf#page=3]]',
	'PageSized.md': '![[Paper.pdf#page=2&height=400]]',
	'PageFar.md': '![[Paper.pdf#page=99]]',
};
// A note for the second pane of a split (a narrower width).
writeFileSync(join(dir, 'Spacer.md'), '# Spacer\n\nThe other pane.\n');
for (const [name, embed] of Object.entries(notes)) {
	writeFileSync(join(dir, name), `# ${name.replace(/\.md$/, '')}\n\nAbove the embed.\n\n${embed}\n\nBelow the embed.\n`);
}
