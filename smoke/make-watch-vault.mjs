// A synthetic vault shaped like ph341 (never the owner's own): ~80 notes in
// week folders, and FIVE lecture folders each symlinking ONE shared 20k-file
// "reveal.js" tree that lives OUTSIDE the vault.
//   node smoke/make-watch-vault.mjs <dir>   → <dir>/vault, <dir>/reveal
// (smoke/watch-repro.mjs measures the watcher over it)
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
fs.rmSync(dir, { recursive: true, force: true });
const vault = path.join(dir, 'vault');
const reveal = path.join(dir, 'reveal');
let files = 0;
const put = (p, text = 'x') => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); files++; };
// The vendored tree: dist/, plugin/*, css/theme/*, lib/font/<family>/<n>.svg …
for (let f = 0; f < 40; f++) for (let n = 0; n < 400; n++) put(path.join(reveal, 'lib', 'font', `family-${f}`, `glyph-${n}.svg`), '<svg/>');
for (let p = 0; p < 20; p++) for (let n = 0; n < 150; n++) put(path.join(reveal, 'plugin', `p${p}`, `m${n}.js`), '//');
for (let n = 0; n < 1000; n++) put(path.join(reveal, 'dist', 'theme', `t${n}.css`), '/**/');
const revealFiles = files;
for (let w = 1; w <= 10; w++) for (let n = 1; n <= 8; n++) put(path.join(vault, `Week ${w}`, `Note ${n}.md`), `# Week ${w} note ${n}\n`);
for (let l = 1; l <= 5; l++) {
	put(path.join(vault, `Lecture ${l}`, 'index.md'), `# Lecture ${l}\n`);
	fs.symlinkSync(reveal, path.join(vault, `Lecture ${l}`, 'reveal.js'));
}
put(path.join(vault, 'Welcome.md'), '# ph341-shaped\n');
console.log(`reveal files ${revealFiles}, vault notes ${files - revealFiles}`);
