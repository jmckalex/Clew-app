// A vault for pdf-printed-scenario.js — quote-and-cite's printed page
// numbers over REAL PDFs: `node smoke/make-printed-vault.mjs <dir>
// <a.pdf>:2,3 <b.pdf>:1,14 …`. Each PDF is COPIED in (the original only
// read) as Papers/<its name>, cited by the .bib's `file` field as `p1`,
// `p2`, …; the pages after the colon are the ones the scenario quotes from.
// `printed.json` lists them; Draft.md is the note being written.
import { mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const [dir, ...specs] = process.argv.slice(2);
if (!dir || !specs.length) { console.error('usage: make-printed-vault.mjs <dir> <a.pdf>:2,3 …'); process.exit(1); }
rmSync(dir, { recursive: true, force: true });
mkdirSync(join(dir, 'Papers'), { recursive: true });
const list = specs.map((spec, i) => {
	const at = spec.lastIndexOf(':');
	const file = at > 0 ? spec.slice(0, at) : spec;
	const pages = at > 0 ? spec.slice(at + 1).split(',').map(Number).filter(Boolean) : [1];
	const name = basename(file);
	copyFileSync(file, join(dir, 'Papers', name));
	return { path: `Papers/${name}`, key: `p${i + 1}`, pages };
});
writeFileSync(join(dir, 'printed.json'), JSON.stringify(list, null, '\t'));
writeFileSync(join(dir, 'refs.bib'), list.map((p) => `@article{${p.key},
  author = {Author, An},
  title = {${p.path.replace(/[{}]/g, '')}},
  year = {2000},
  file = {${p.path}}
}
`).join('\n'));
writeFileSync(join(dir, 'Draft.md'), '# Draft\n\nNotes so far.\n');
mkdirSync(join(dir, '.clew'), { recursive: true });
writeFileSync(join(dir, '.clew', 'vault-settings.json'), JSON.stringify({ bibliography: 'refs.bib' }, null, '\t'));
