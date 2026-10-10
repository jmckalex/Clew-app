#!/usr/bin/env node
// The file checks of smoke/export-cache-scenario.js — what an export left,
// and where — around a run over <dir>/vault with the profile <dir>/ud:
//
//   node smoke/export-cache-check.mjs <dir> before   # before the run: what is there
//   node smoke/export-cache-check.mjs <dir> after    # after it
//
// `after` prints `ec-check: …` lines:
//   new         every file the run added to the vault (outside .clew/)
//   in-vault    files in a cache folder of the engine's (mermaid/, MetaPost/,
//               TiKZ/, Video/, Mathematica/) outside any `-figures/` copy: 0
//   tmp-left    temporary build or cache folders left in the system's: 0
//   cache       the profile's export cache: files and bytes (trusted), or
//               `absent` (restricted — nothing of it anywhere)
//   figures     each new `-figures/` folder: marked, its kinds, its files
//   pdf-folder  what xn/pdf/ holds: only the PDF
//   kept-tex    with the export cache DELETED: xn/diagrams.tex compiled where
//               it is written — `compiled=true pages=N missing=0`
//   html        the same: xn/diagrams.html's figures all on disk
//   book        build/Signals-figures/ marked, the .tex's and the pages'
//               figures all on disk
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chooseLatexEngine, latexmkFlag } from '../src/main/latex-engine.js';

const [dir, phase] = process.argv.slice(2);
if (!dir || !['before', 'after'].includes(phase)) {
	console.error('usage: node smoke/export-cache-check.mjs <dir> before|after');
	process.exit(2);
}
const vault = path.join(dir, 'vault');
const ud = path.join(dir, 'ud');
const record = path.join(dir, 'ec-before.json');
const log = (s) => console.log(`ec-check: ${s}`);
const KINDS = new Set(['mermaid', 'MetaPost', 'TiKZ', 'Video', 'Mathematica']);

function files(root, rel = '') {
	const out = [];
	let entries = [];
	try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return out; }
	for (const e of entries) {
		const r = rel ? `${rel}/${e.name}` : e.name;
		if (!rel && e.name === '.clew') continue;
		if (e.isDirectory()) out.push(...files(root, r));
		else out.push(r);
	}
	return out;
}
const temps = () => fs.readdirSync(os.tmpdir()).filter((n) => /^clew-(figures|export)-/.test(n));

if (phase === 'before') {
	fs.writeFileSync(record, JSON.stringify({ vault: files(vault), tmp: temps() }));
	process.exit(0);
}

const before = JSON.parse(fs.readFileSync(record, 'utf8'));
const known = new Set(before.vault);
const added = files(vault).filter((f) => !known.has(f));
log(`new=${JSON.stringify(added.filter((f) => !/\/[^/]+-figures\//.test(f)))} (+${added.filter((f) => /\/[^/]+-figures\//.test(f)).length} in -figures/)`);
log(`in-vault=${added.filter((f) => f.split('/').some((p) => KINDS.has(p)) && !/-figures\//.test(f)).length}`);
log(`tmp-left=${temps().filter((n) => !before.tmp.includes(n)).length}`);
const cacheRoot = path.join(ud, 'export-cache');
const cached = fs.existsSync(cacheRoot) ? files(cacheRoot) : null;
log(`cache=${cached ? `files=${cached.length} bytes=${cached.reduce((n, f) => n + fs.statSync(path.join(cacheRoot, f)).size, 0)}` : 'absent'}`);
const figureDirs = [...new Set(added.map((f) => /^(.*?[^/]+-figures)\//.exec(f)?.[1]).filter(Boolean))];
for (const d of figureDirs) {
	const inside = files(path.join(vault, d));
	log(`figures ${d} marked=${inside.includes('.jmarkdown-figures')} kinds=${JSON.stringify([...new Set(inside.filter((f) => f.includes('/')).map((f) => f.split('/')[0]))].sort())} files=${inside.filter((f) => f !== '.jmarkdown-figures').length}`);
}
const pdfDir = path.join(vault, 'xn', 'pdf');
if (fs.existsSync(pdfDir)) log(`pdf-folder=${JSON.stringify(fs.readdirSync(pdfDir))}`);

// From here the export cache is GONE: a kept .tex or .html must stand on its own.
fs.rmSync(cacheRoot, { recursive: true, force: true });

/** The figures a .tex or an .html names (relative), and how many are on disk from `from`. */
function present(text, from, pattern) {
	const refs = [...new Set(text.match(pattern) ?? [])];
	return `${refs.filter((r) => fs.existsSync(path.join(from, decodeURI(r)))).length}/${refs.length}`;
}
const texRefs = /[\w./-]*-figures\/[\w-]+\/[\w.-]+/g;
const tex = path.join(vault, 'xn', 'diagrams.tex');
if (fs.existsSync(tex)) {
	const text = fs.readFileSync(tex, 'utf8');
	const { engine } = chooseLatexEngine(text, 'auto');
	let compiled = false;
	try {
		execFileSync('latexmk', [latexmkFlag(engine), '-g', '-interaction=nonstopmode', '-quiet', 'diagrams.tex'], {
			cwd: path.dirname(tex), stdio: 'ignore', timeout: 180000,
			env: { ...process.env, TEXINPUTS: `${path.join(vault, 'Features')}${path.delimiter}` },
		});
		compiled = true;
	} catch { compiled = fs.existsSync(tex.replace(/\.tex$/, '.pdf')); }
	const texLog = fs.existsSync(tex.replace(/\.tex$/, '.log')) ? fs.readFileSync(tex.replace(/\.tex$/, '.log'), 'utf8') : '';
	let pages = 0;
	try { pages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [tex.replace(/\.tex$/, '.pdf')]).toString())?.[1] ?? 0); } catch { /* none */ }
	log(`kept-tex engine=${engine} compiled=${compiled} pages=${pages} missing=${(texLog.match(/not found|File `[^']*' not found/g) ?? []).length} figures=${present(text, path.dirname(tex), texRefs)}`);
}
const html = path.join(vault, 'xn', 'diagrams.html');
if (fs.existsSync(html)) log(`html figures=${present(fs.readFileSync(html, 'utf8'), path.dirname(html), /[\w./%-]*-figures\/[\w-]+\/[\w.%-]+/g)}`);
const bookTex = path.join(vault, 'Books', 'Signals', 'build', 'Signals.tex');
if (fs.existsSync(bookTex)) {
	const pagesDir = path.join(vault, 'Books', 'Signals', 'build', 'Signals');
	const pageText = fs.existsSync(pagesDir) ? fs.readdirSync(pagesDir).filter((f) => f.endsWith('.html')).map((f) => fs.readFileSync(path.join(pagesDir, f), 'utf8')).join('\n') : '';
	log(`book marked=${fs.existsSync(path.join(vault, 'Books', 'Signals', 'build', 'Signals-figures', '.jmarkdown-figures'))} tex=${present(fs.readFileSync(bookTex, 'utf8'), path.dirname(bookTex), texRefs)} pages=${present(pageText, pagesDir, /[\w./%-]*-figures\/[\w-]+\/[\w.%-]+/g)}`);
}
const trashed = path.join(ud, 'smoke-trash');
log(`trashed=${JSON.stringify(fs.existsSync(trashed) ? fs.readdirSync(trashed).map((n) => n.replace(/^\d+-/, '')).sort() : [])}`);
