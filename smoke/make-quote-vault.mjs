// A vault for pdf-quote-scenario.js: `node smoke/make-quote-vault.mjs <dir>
// [--pandoc] [--chord] [--real <a.pdf>] [--real-unlisted <b.pdf>]`.
//
// Papers/Paper.pdf (written here: two pages of Helvetica, a word broken
// across a line, a price, a superscript) is the .bib's `skyrms:1996` by its
// `file` field; Papers/Unlisted.pdf is in no entry. `--real` copies a real
// PDF in as Papers/Real.pdf, cited as `real:paper`; `--real-unlisted` one
// with no entry. Two entries name no file at all, so the picker has rows.
// Draft.md is the note being written; Embed.md embeds the unlisted PDF.
import { mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const dir = args[0];
if (!dir) { console.error('usage: make-quote-vault.mjs <dir> [--pandoc] [--real a.pdf] [--real-unlisted b.pdf]'); process.exit(1); }
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
rmSync(dir, { recursive: true, force: true });
mkdirSync(join(dir, 'Papers'), { recursive: true });

function pdf(pages) {
	const objects = [];
	const add = (body) => { objects.push(body); return objects.length; };
	const catalog = add(null);
	const pagesObj = add(null);
	const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
	const kids = pages.map((lines) => {
		const stream = ['BT', '/F1 16 Tf', '72 720 Td', '22 TL', ...lines.map((l) => `(${l.replace(/[()\\]/g, (c) => `\\${c}`)}) Tj T*`), 'ET'].join('\n');
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

writeFileSync(join(dir, 'Papers', 'Paper.pdf'), pdf([
	['Conventions are equilibria in a game', 'of coordination; their evo-', 'lutionary dynamics are slow.', 'A bet costs $5 and pays $10 when x^2 > 4.'],
	['Signals acquire meaning by reinforcement.', 'The end of the second page.'],
]), 'latin1');
writeFileSync(join(dir, 'Papers', 'Unlisted.pdf'), pdf([
	['A paper that no entry names.', 'Its second line.'],
]), 'latin1');
const real = opt('--real');
if (real) copyFileSync(real, join(dir, 'Papers', 'Real.pdf'));
const realUnlisted = opt('--real-unlisted');
if (realUnlisted) copyFileSync(realUnlisted, join(dir, 'Papers', 'Real Unlisted.pdf'));

writeFileSync(join(dir, 'refs.bib'), `@book{skyrms:1996,
  author = {Skyrms, Brian},
  title = {Evolution of the Social Contract},
  year = {1996},
  publisher = {Cambridge University Press},
  file = {Papers/Paper.pdf}
}

@book{lewis:1969,
  author = {Lewis, David},
  title = {Convention},
  year = {1969},
  publisher = {Harvard University Press}
}

@book{skyrms:2010,
  author = {Skyrms, Brian},
  title = {Signals},
  year = {2010},
  publisher = {Oxford University Press}
}
${real ? `
@article{real:paper,
  author = {Real, Author},
  title = {A Real Paper},
  year = {2016},
  journal = {A Journal},
  file = {Papers/Real.pdf}
}
` : ''}`);
writeFileSync(join(dir, 'Draft.md'), '# Draft\n\nNotes so far.\n\nA closing line.\n');
writeFileSync(join(dir, 'Embed.md'), '# Embed\n\n![[Unlisted.pdf]]\n');
if (args.includes('--chord')) writeFileSync(join(dir, 'quote-mode.txt'), 'chord\n');
mkdirSync(join(dir, '.clew'), { recursive: true });
writeFileSync(join(dir, '.clew', 'vault-settings.json'), JSON.stringify({
	bibliography: 'refs.bib',
	...(args.includes('--pandoc') ? { pandocCitations: true } : {}),
}, null, '\t'));
