// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// What Dataview and Bases does a vault actually use, and how much of it does
// Clew run?   npm run dataview-report -- /path/to/vault
//
// This is the measuring instrument the Dataview and Bases support was built
// from, kept in the repository because the numbers in HANDOVER are only worth
// anything if the next person can reproduce them. It reads the vault; it never
// writes to it.
//
// Three sections:
//   1. WHAT IS THERE      every construct, counted — the survey
//   2. WHAT CLEW COVERS   each ```dataview block run through the real parser
//   3. DATAVIEWJS         each ```dataviewjs block actually executed
//
// Sections 2 and 3 import src/engine, so they measure the shipping code rather
// than a description of it: if a query stops working, this notices.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const vault = process.argv[2];
if (!vault || !fs.existsSync(vault)) {
	console.error('usage: npm run dataview-report -- <vault directory>');
	process.exit(1);
}

function walk(dir, out = []) {
	let entries;
	try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
	for (const entry of entries) {
		if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
		const p = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(p, out);
		else out.push(p);
	}
	return out;
}

const files = walk(vault);
const notes = files.filter((f) => /\.md$/i.test(f));
const baseFiles = files.filter((f) => /\.base$/i.test(f));

const DQL_FENCE = /^[ \t]*```+[ \t]*dataview\b[^\n]*\n([\s\S]*?)^[ \t]*```+[ \t]*$/gm;
const JS_FENCE = /^[ \t]*```+[ \t]*dataviewjs\b[^\n]*\n([\s\S]*?)^[ \t]*```+[ \t]*$/gm;
const BASE_FENCE = /^[ \t]*```+[ \t]*base\b[^\n]*\n([\s\S]*?)^[ \t]*```+[ \t]*$/gm;

const dql = [];
const js = [];
const inlineDql = [];
const inlineJs = [];
const baseEmbeds = [];
const inlineBases = [];
let notesUsing = 0;

const blank = (m) => m.replace(/[^\n]/g, ' ');

/**
 * Blank fenced blocks that are not themselves a query fence, so an example
 * shown inside a documentation fence is not counted as a real query.
 */
const maskFences = (text) => text.replace(
	/^([ \t]*)(```+|~~~+)[ \t]*([^\n]*)\n([\s\S]*?)^[ \t]*\2[ \t]*$/gm,
	(match, _indent, _fence, info) =>
		(/^(dataview|dataviewjs|base)\b/i.test(info.trim()) ? match : blank(match)));

/**
 * And blank inline code spans on top of that.
 *
 * Used ONLY for the `![[X.base]]` scan, not for inline queries: an inline
 * query IS a code span, so masking those would report zero of them. Without
 * this the tool cries wolf on Clew's own guide note, which writes
 * `![[Board.base]]` in backticks to show the syntax.
 */
const maskCodeSpans = (text) => text.replace(/`[^`\n]*`/g, blank);

for (const file of notes) {
	const text = fs.readFileSync(file, 'utf8');
	const queryScan = maskFences(text);
	const proseScan = maskCodeSpans(queryScan);
	let touched = false;
	for (const m of text.matchAll(DQL_FENCE)) { dql.push({ file, body: m[1] }); touched = true; }
	for (const m of text.matchAll(JS_FENCE)) { js.push({ file, body: m[1] }); touched = true; }
	for (const m of text.matchAll(BASE_FENCE)) { inlineBases.push({ file, body: m[1] }); touched = true; }
	for (const m of queryScan.matchAll(/`(\$?)=\s+([^`\n]+)`/g)) {
		(m[1] ? inlineJs : inlineDql).push({ file, expr: m[2] });
		touched = true;
	}
	for (const m of proseScan.matchAll(/!\[\[([^\]]*\.base)(?:#([^\]]*))?\]\]/g)) {
		baseEmbeds.push({ file, base: m[1], view: m[2] ?? null });
		touched = true;
	}
	if (touched) notesUsing++;
}

const bar = '='.repeat(66);
console.log(`\n${bar}\n${path.basename(path.resolve(vault))} — ${notes.length} notes, ${notesUsing} using a query format\n${bar}`);
console.log('\n1. WHAT IS THERE\n');
const row = (label, n) => console.log(`   ${String(n).padStart(5)}  ${label}`);
row('```dataview blocks', dql.length);
row('```dataviewjs blocks', js.length);
row('inline `= …` queries', inlineDql.length);
row('inline `$= …` queries', inlineJs.length);
row('.base files', baseFiles.length);
row('![[*.base]] embeds', baseEmbeds.length);
row('   …naming a view', baseEmbeds.filter((b) => b.view).length);
row('```base fences', inlineBases.length);

if (dql.length) {
	const kinds = new Map();
	for (const { body } of dql) {
		const head = body.trim().split(/\s+/)[0]?.toUpperCase() ?? '(empty)';
		kinds.set(head, (kinds.get(head) ?? 0) + 1);
	}
	console.log('\n   query types: '
		+ [...kinds].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} (${n})`).join(', '));
}

// ---- 2 and 3 run the real engine ---------------------------------------------

process.env.CLEW_VAULT_ROOT = path.resolve(vault);
process.env.CLEW_DATAVIEW_JS = '1';

const { unsupportedIn, parseQuery } = await import(path.join(root, 'src/engine/dataview.js'));
const { renderDataviewJs } = await import(path.join(root, 'src/engine/dataview-js.js'));

if (dql.length) {
	console.log('\n2. WHAT CLEW COVERS\n');
	let covered = 0;
	const refusals = new Map();
	for (const { body } of dql) {
		const reasons = unsupportedIn(body, parseQuery(body));
		if (!reasons.length) { covered++; continue; }
		for (const reason of reasons) refusals.set(reason, (refusals.get(reason) ?? 0) + 1);
	}
	const pct = Math.round((covered / dql.length) * 100);
	console.log(`   ${covered}/${dql.length} queries run (${pct}%); the rest are refused by name.`);
	if (refusals.size) {
		console.log('\n   why the others are refused:');
		for (const [reason, n] of [...refusals].sort((a, b) => b[1] - a[1])) {
			console.log(`   ${String(n).padStart(5)}  ${reason}`);
		}
	}
}

if (js.length) {
	console.log('\n3. DATAVIEWJS (each block actually executed)\n');
	let ok = 0;
	let quiet = 0;
	let failed = 0;
	const why = new Map();
	for (const { file, body } of js) {
		global.current_file = file;
		let html;
		try { html = renderDataviewJs(body); } catch (error) { html = `did not finish ${error?.message}`; }
		if (/did not finish/.test(html)) {
			failed++;
			const reason = /<div class="clew-query-note">([^<]{0,80})/.exec(html)?.[1] ?? '(unknown)';
			const key = reason.replace(/["'].*/, '').replace(/\s+/g, ' ').trim().slice(0, 58);
			why.set(key, (why.get(key) ?? 0) + 1);
		} else if (/is-empty/.test(html)) quiet++;
		else ok++;
	}
	console.log(`   ${ok} rendered output, ${quiet} ran but produced none, ${failed} reported a named failure.`);
	console.log('   ("produced none" is usually correct — many blocks are conditional.)');
	if (why.size) {
		console.log('\n   named failures:');
		for (const [reason, n] of [...why].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
			console.log(`   ${String(n).padStart(5)}  ${reason}`);
		}
	}
}

if (!dql.length && !js.length && !baseFiles.length) {
	console.log('\nNo Dataview or Bases content in this vault.');
}
console.log();
