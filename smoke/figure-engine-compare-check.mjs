#!/usr/bin/env node
// The comparison of smoke/figure-engine-compare.sh — what changes for a reader
// between two values of `exportFigureEngine` (the first is the baseline):
//
//   node smoke/figure-engine-compare-check.mjs <out-dir> [a=external] [b=auto]
//
// Reads <out-dir>/<value>/ (exports.txt, memory.tsv, the vault's fe/ and
// Books/Signals/build/, shots/) and prints:
//   time     each export, cold and warm, ms under a and b
//   memory   each cold export's peak RSS (KB, smoke/proc-sampler.mjs): the
//            worker, the TeX processes below it or run for a PDF, their sum
//   fallback each "Figure engine:" warning an export gave under b — the
//            figures the library sent to the installed tools, and why
//   figure   each figure of an HTML export (the notes, the book's pages):
//            who drew it — MetaPost by its SVG's maker (MetaPost's own SVG is
//            the library's, dvisvgm's the tools'); TikZ by its cache name (a
//            figure the tools drew carries the same name under both values,
//            the library's are keyed apart) — its size as written and as a
//            browser shows it (pt × 4/3 = px; a unitless SVG is px — or the
//            width the note sets, `{width='45%'}`), and b over a in shown width
//   latex    each MetaPost PDF a .tex includes: its page size under a and b
//   pdf      each PDF via LaTeX: pages, fonts (pdffonts, subset prefix off),
//            and per page the share of pixels that differ (60 dpi, fuzz 10%)
//   shot     each HTML page drawn, the share of pixels that differ; and
//            side-by-side/<name>.png, a left and b right
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const [dir, A = 'external', B = 'auto'] = process.argv.slice(2);
if (!dir) {
	console.error('usage: node smoke/figure-engine-compare-check.mjs <out-dir> [a] [b]');
	process.exit(2);
}
const say = (s) => console.log(s);
const run = (cmd, args) => { try { return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 }).toString(); } catch (err) { return String(err.stdout ?? '') + String(err.stderr ?? ''); } };
const vault = (s) => path.join(dir, s, 'vault');

// --- the scenario's lines ---------------------------------------------------
function exportsOf(s) {
	const file = path.join(dir, s, 'exports.txt');
	const rows = [];
	for (const line of fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : []) {
		const m = /^smoke-fec: export (\S+) (\S+) (\S+) (\S+) ms=(\d+) t0=(\d+) t1=(\d+) (.*)$/.exec(line);
		if (!m) continue;
		const [, , round, what, format, ms, t0, t1, rest] = m;
		const error = /^error=(.*)$/.exec(rest)?.[1];
		const warnings = error ? [] : JSON.parse(/warnings=(\[.*\])$/.exec(rest)?.[1] ?? '[]');
		rows.push({ round, what, format, ms: Number(ms), t0: Number(t0), t1: Number(t1), error: error ? JSON.parse(error) : null, warnings });
	}
	return rows;
}
function memoryOf(s) {
	const file = path.join(dir, s, 'memory.tsv');
	if (!fs.existsSync(file)) return [];
	return fs.readFileSync(file, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t').map(Number));
}
const peak = (mem, t0, t1) => {
	const inside = mem.filter(([t]) => t >= t0 - 100 && t <= t1 + 100);
	const max = (i) => inside.reduce((m, r) => Math.max(m, r[i]), 0);
	return { worker: max(1), tools: max(2), total: max(3), samples: inside.length };
};
const key = (r) => `${r.what}.${r.format}`;
const ex = { [A]: exportsOf(A), [B]: exportsOf(B) };
const mem = { [A]: memoryOf(A), [B]: memoryOf(B) };

say(`== time (ms)              ${A} cold/warm      ${B} cold/warm`);
for (const r of ex[A].filter((x) => x.round === 'cold')) {
	const t = (s, round) => ex[s].find((x) => x.round === round && key(x) === key(r));
	const cell = (s) => ['cold', 'warm'].map((round) => { const x = t(s, round); return x ? (x.error ? 'ERR' : String(x.ms)) : '-'; }).join('/');
	say(`time ${key(r).padEnd(22)} ${cell(A).padEnd(18)} ${cell(B)}`);
}
say(`== memory (peak RSS, MB, cold)   ${A}: worker+tools=total   ${B}: worker+tools=total`);
for (const r of ex[A].filter((x) => x.round === 'cold')) {
	const p = (s) => { const x = ex[s].find((y) => y.round === 'cold' && key(y) === key(r)); if (!x) return '-'; const m = peak(mem[s], x.t0, x.t1); return `${(m.worker / 1024).toFixed(0)}+${(m.tools / 1024).toFixed(0)}=${(m.total / 1024).toFixed(0)}`; };
	say(`memory ${key(r).padEnd(20)} ${p(A).padEnd(16)} ${p(B)}`);
}
for (const s of [A, B]) {
	const errors = ex[s].filter((x) => x.error);
	for (const e of errors) say(`error ${s} ${e.round} ${key(e)} ${e.error}`);
}
say(`== fallback (${B}; cold) — what the library did not draw, and why`);
for (const s of [A, B]) {
	const seen = new Set();
	for (const r of ex[s].filter((x) => x.round === 'cold')) {
		for (const w of r.warnings.filter((w) => /^Figure engine:|not drawn/.test(w))) {
			if (seen.has(`${key(r)}|${w}`)) continue;
			seen.add(`${key(r)}|${w}`);
			say(`fallback ${s} ${key(r)}: ${w}`);
		}
	}
	if (!seen.size) say(`fallback ${s} none`);
}

// --- the figures of each HTML export ------------------------------------------
const toPx = (v) => { const m = /^([\d.]+)\s*(pt|px)?$/.exec(String(v ?? '')); if (!m) return null; return Number(m[1]) * (m[2] === 'pt' ? 4 / 3 : 1); };
function figuresOf(html, folder) {
	const out = [];
	for (const m of html.matchAll(/<img[^>]*?src="([^"]*-figures\/(TiKZ|MetaPost)\/[^"]+\.svg)"[^>]*>/g)) {
		const rel = decodeURI(m[1]);
		// A width the note sets (`{width='45%'}`) is what a browser shows,
		// whatever the SVG says.
		const set = /style="[^"]*\bwidth:\s*([^;"]+)/.exec(m[0])?.[1]?.trim();
		const abs = path.resolve(folder, rel);
		if (!fs.existsSync(abs)) { out.push({ kind: m[2], name: path.basename(rel), missing: true }); continue; }
		const svg = fs.readFileSync(abs, 'utf8').slice(0, 2000);
		const attr = (a) => new RegExp(`<svg[^>]*\\s${a}=['"]([^'"]+)['"]`).exec(svg)?.[1];
		out.push({
			kind: m[2], name: path.basename(rel), width: attr('width'), height: attr('height'), set,
			maker: /Created by MetaPost/.test(svg) ? 'library' : /generated by dvisvgm/.test(svg) ? 'dvisvgm' : 'unknown',
		});
	}
	return out;
}
const pages = (s) => {
	const list = [];
	const fe = path.join(vault(s), 'fe', 'cold');
	for (const f of fs.existsSync(fe) ? fs.readdirSync(fe).filter((f) => f.endsWith('.html')).sort() : []) list.push({ name: f, file: path.join(fe, f) });
	const book = path.join(vault(s), 'Books', 'Signals', 'build', 'Signals');
	for (const f of fs.existsSync(book) ? fs.readdirSync(book).filter((f) => f.endsWith('.html')).sort() : []) list.push({ name: `book/${f}`, file: path.join(book, f) });
	return list;
};
const tikzNamesA = new Set(pages(A).flatMap((p) => figuresOf(fs.readFileSync(p.file, 'utf8'), path.dirname(p.file)).filter((f) => f.kind === 'TiKZ').map((f) => f.name)));
// A TikZ SVG is dvisvgm's under both, so who drew it is told by its cache
// name: the baseline's are taken as they are (`external`: the tools), and a
// figure of b's that carries a baseline name was drawn by the tools.
const drawnBy = (f, s) => {
	if (f.kind === 'MetaPost') return f.maker === 'library' ? 'library' : 'tools';
	if (s === A) return A === 'external' ? 'tools' : 'library';
	return tikzNamesA.has(f.name) ? 'tools' : 'library';
};
say(`== figure (HTML exports, cold): kind, ${A} → ${B}: who drew it, size as written (shown px), ${B}/${A} shown width`);
for (const pa of pages(A)) {
	const pb = pages(B).find((p) => p.name === pa.name);
	if (!pb) continue;
	const fa = figuresOf(fs.readFileSync(pa.file, 'utf8'), path.dirname(pa.file));
	const fb = figuresOf(fs.readFileSync(pb.file, 'utf8'), path.dirname(pb.file));
	for (let i = 0; i < Math.max(fa.length, fb.length); i++) {
		const a = fa[i], b = fb[i];
		const desc = (f, s) => f ? (f.missing ? 'MISSING' : `${drawnBy(f, s)} ${f.width}×${f.height} (${f.set ? `shown at width ${f.set}` : `${toPx(f.width)?.toFixed(0)}×${toPx(f.height)?.toFixed(0)}px`})`) : '-';
		const ratio = a?.set && a.set === b?.set ? 'same (set by the note)'
			: a && b && toPx(a.width) && toPx(b.width) ? (toPx(b.width) / toPx(a.width)).toFixed(2) : '-';
		say(`figure ${pa.name} #${i + 1} ${(a ?? b).kind}: ${desc(a, A)} → ${desc(b, B)} ratio=${ratio}`);
	}
}

// --- LaTeX: the MetaPost PDFs a .tex includes ---------------------------------
say(`== latex (MetaPost PDFs included): page size ${A} → ${B}`);
const texes = (s) => {
	const list = [];
	const fe = path.join(vault(s), 'fe', 'cold');
	for (const f of fs.existsSync(fe) ? fs.readdirSync(fe).filter((f) => f.endsWith('.tex')).sort() : []) list.push({ name: f, file: path.join(fe, f) });
	const build = path.join(vault(s), 'Books', 'Signals', 'build');
	for (const f of fs.existsSync(build) ? fs.readdirSync(build).filter((f) => /^Signals.*\.tex$/.test(f)).sort() : []) list.push({ name: `book/${f}`, file: path.join(build, f) });
	return list;
};
const includes = (t) => [...fs.readFileSync(t.file, 'utf8').matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]*MetaPost[^}]*)\}/g)].map((m) => {
	const abs = path.resolve(path.dirname(t.file), m[1]);
	const size = fs.existsSync(abs) ? /Page size:\s+([\d.]+ x [\d.]+ pts)/.exec(run('pdfinfo', [abs]))?.[1] : 'MISSING';
	return size ?? '?';
});
for (const ta of texes(A)) {
	const tb = texes(B).find((t) => t.name === ta.name);
	const ia = includes(ta), ib = tb ? includes(tb) : [];
	if (ia.length || ib.length) say(`latex ${ta.name}: ${JSON.stringify(ia)} → ${JSON.stringify(ib)}`);
}

// --- PDFs via LaTeX, and the HTML pages drawn ------------------------------------
const pdfs = (s) => {
	const list = [];
	const fe = path.join(vault(s), 'fe', 'cold');
	for (const f of fs.existsSync(fe) ? fs.readdirSync(fe).filter((f) => f.endsWith('.pdf')).sort() : []) list.push({ name: f, file: path.join(fe, f), shot: f.replace(/\.pdf$/, '') });
	const book = path.join(vault(s), 'Books', 'Signals', 'build', 'Signals.pdf');
	if (fs.existsSync(book)) list.push({ name: 'book/Signals.pdf', file: book, shot: 'book-Signals' });
	return list;
};
const fonts = (file) => [...new Set(run('pdffonts', [file]).split('\n').slice(2).map((l) => l.split(/\s+/)[0]?.replace(/^[A-Z]{6}\+/, '')).filter(Boolean))].sort();
const sideBySide = path.join(dir, 'side-by-side');
fs.mkdirSync(sideBySide, { recursive: true });
/** The share of pixels that differ between two PNGs, padded to one size. */
function differ(a, b) {
	// compare prints its metric on stderr, whatever the exit code; ImageMagick 7
	// says AE as `<scaled> (<pixels>)`, the count in the parentheses.
	const r = spawnSync('magick', ['compare', '-metric', 'AE', '-fuzz', '10%', a, b, 'null:']);
	const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
	const n = Number(/\(([\d.e+]+)\)/.exec(out)?.[1] ?? /^[\d.e+]+/.exec(out.trim())?.[0] ?? NaN);
	const [w, h] = run('magick', ['identify', '-format', '%w %h', a]).split(' ').map(Number);
	return Number.isFinite(n) && w && h ? `${((100 * n) / (w * h)).toFixed(2)}%` : `? (${out.trim().slice(0, 60)})`;
}
function pair(a, b, out) {
	run('magick', [a, b, '-background', 'white', '-gravity', 'north', '+append', out]);
}
say(`== pdf (via LaTeX): pages, fonts, and per page the pixels that differ`);
for (const pa of pdfs(A)) {
	const pb = pdfs(B).find((p) => p.name === pa.name);
	if (!pb) { say(`pdf ${pa.name}: only under ${A}`); continue; }
	const pagesOf = (f) => Number(/Pages:\s+(\d+)/.exec(run('pdfinfo', [f]))?.[1] ?? 0);
	const fa = fonts(pa.file), fb = fonts(pb.file);
	say(`pdf ${pa.name}: pages ${pagesOf(pa.file)} → ${pagesOf(pb.file)}; fonts ${JSON.stringify(fa) === JSON.stringify(fb) ? `same (${fa.length})` : `${JSON.stringify(fa)} → ${JSON.stringify(fb)}`}`);
	const shotsA = path.join(dir, A, 'shots'), shotsB = path.join(dir, B, 'shots');
	const list = fs.existsSync(shotsA) ? fs.readdirSync(shotsA).filter((f) => f.startsWith(`${pa.shot}.pdf-`)).sort() : [];
	const diffs = [];
	for (const f of list) {
		if (!fs.existsSync(path.join(shotsB, f))) { diffs.push(`${f}: only ${A}`); continue; }
		const d = differ(path.join(shotsA, f), path.join(shotsB, f));
		diffs.push(`p${/-(\d+)\.png$/.exec(f)?.[1]}=${d}`);
		if (d !== '0.00%') pair(path.join(shotsA, f), path.join(shotsB, f), path.join(sideBySide, f));
	}
	say(`pdf ${pa.name}: differ ${diffs.join(' ')}`);
}
say(`== shot (HTML pages drawn at 900 px): the pixels that differ`);
const shotsA = path.join(dir, A, 'shots'), shotsB = path.join(dir, B, 'shots');
for (const f of (fs.existsSync(shotsA) ? fs.readdirSync(shotsA) : []).filter((f) => f.endsWith('.html.png')).sort()) {
	if (!fs.existsSync(path.join(shotsB, f))) { say(`shot ${f}: only under ${A}`); continue; }
	const d = differ(path.join(shotsA, f), path.join(shotsB, f));
	say(`shot ${f}: ${d}`);
	if (d !== '0.00%') pair(path.join(shotsA, f), path.join(shotsB, f), path.join(sideBySide, f));
}
say(`side-by-side: ${sideBySide} (${A} left, ${B} right; only what differs)`);
