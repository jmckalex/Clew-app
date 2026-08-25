// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// What would this Obsidian vault look like in Clew?
//
//   node scripts/vault-report.js /path/to/vault [--json] [--examples N]
//
// Walks a vault and reports everything Clew would not fully understand: file
// types it cannot open, code fences it would render as plain text, frontmatter
// keys belonging to plugins, and syntax it does not implement. Counts and
// example paths for each, so the answer to "what should we support next?" is a
// measurement rather than a guess.
//
// It reads only. Nothing is written, nothing is opened, no vault is modified.
//
// Honesty is the whole point: a gap listed here is one a user WILL meet, and a
// thing listed as supported had better be. When Clew gains a feature, the
// tables below are what has to change with it.
import fs from 'node:fs';
import path from 'node:path';

// ---- what Clew supports ----------------------------------------------------

// Fences Clew renders. Its own (src/engine/) plus the jmarkdown engine's.
const CLEW_FENCES = new Set([
	'mermaid', 'leaflet', 'query', 'tasks', 'kanban',          // src/engine/*
	'tikz', 'metapost', 'mathematica', 'game', 'markdown-demo', // engine blocks
]);

// A fence with a real language is just syntax highlighting, which always works.
const CODE_LANGUAGES = new Set([
	'js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx', 'json', 'jsonc', 'yaml', 'yml',
	'html', 'xml', 'svg', 'css', 'scss', 'less', 'sh', 'bash', 'zsh', 'fish', 'shell',
	'python', 'py', 'ruby', 'rb', 'php', 'go', 'rust', 'rs', 'java', 'kotlin', 'swift',
	'c', 'cpp', 'c++', 'objc', 'cs', 'csharp', 'sql', 'r', 'julia', 'matlab', 'lua',
	'perl', 'haskell', 'hs', 'scala', 'clojure', 'elixir', 'erlang', 'dart', 'zig',
	'toml', 'ini', 'diff', 'patch', 'makefile', 'dockerfile', 'nginx', 'graphql',
	'latex', 'tex', 'bibtex', 'markdown', 'md', 'text', 'txt', 'plaintext', 'console',
	'vim', 'lisp', 'scheme', 'prolog', 'fortran', 'cobol', 'asm', 'wasm', 'nix',
]);

// Extensions Clew opens: notes, drawings, canvases, and viewable media.
const CLEW_EXTENSIONS = new Set([
	'.md', '.jmd', '.canvas', '.excalidraw',
	'.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.bmp',
	'.pdf', '.mp3', '.m4a', '.wav', '.ogg', '.flac', '.mp4', '.webm', '.mov',
]);

// Files Clew has no viewer tab for but does read. Reporting these as gaps
// would be crying wolf — they are working parts of a vault, not casualties.
const CONSUMED_EXTENSIONS = {
	'.bib': 'read for citations and cite-key completion',
	'.excalidrawlib': 'Excalidraw shape libraries',
	'.json': 'vault data (clewdata.json, plugin state)',
	'.html': 'plugin assets and drawing backgrounds',
	'.css': 'snippets',
	'.js': 'vault scripts and plugin surfaces',
};

// Frontmatter Clew reads itself.
const CLEW_FRONTMATTER = new Set([
	'tags', 'aliases', 'cssclass', 'cssclasses', 'title', 'date', 'author',
	'bibliography', 'bibliography style', 'script', 'excalidraw-plugin',
]);

// ---- what belongs to a plugin ----------------------------------------------
//
// Named rather than merely counted: "37 unknown fences" is a shrug, "37
// dataview queries" is a decision.

const FENCE_PLUGINS = {
	dataview: ['Dataview', 'query language; Clew has ```query, which is close but not the same dialect'],
	dataviewjs: ['Dataview (JS)', 'arbitrary JavaScript against Dataview\'s API — not portable'],
	chart: ['Obsidian Charts', 'YAML chart spec rendered with Chart.js'],
	tracker: ['Tracker', 'time-series from note fields'],
	dice: ['Dice Roller', 'inline random rolls'],
	button: ['Buttons', 'clickable actions in a note'],
	'chartsview': ['Charts View', 'chart spec'],
	timeline: ['Timelines', 'timeline from tagged notes'],
	'excalidraw': ['Excalidraw', 'inline drawing — Clew opens drawing FILES, not this fence form'],
	todoist: ['Todoist Sync', 'external service query'],
	tasks: ['Obsidian Tasks', 'Clew has its own ```tasks — the query dialect differs'],
	music: ['Music Notation', 'ABC notation'],
	abc: ['Music Notation', 'ABC notation'],
	statblock: ['Fantasy Statblocks', 'TTRPG stat blocks'],
	calendar: ['Calendar/Periodic', 'calendar embed'],
	mapview: ['Map View', 'map embed — Clew has ```leaflet, a different dialect'],
	'ad-note': ['Admonition', 'pre-core callout; maps cleanly onto GFM alerts'],
	'ad-warning': ['Admonition', 'pre-core callout; maps cleanly onto GFM alerts'],
	'ad-info': ['Admonition', 'pre-core callout; maps cleanly onto GFM alerts'],
	'ad-tip': ['Admonition', 'pre-core callout; maps cleanly onto GFM alerts'],
	'ad-example': ['Admonition', 'pre-core callout; maps cleanly onto GFM alerts'],
	'ad-quote': ['Admonition', 'pre-core callout; maps cleanly onto GFM alerts'],
};

const FRONTMATTER_PLUGINS = {
	'kanban-plugin': ['Kanban', 'the whole note is a board; Clew already has a board renderer to point at it'],
	'banner': ['Banners', 'header image — Clew\'s Note Headers plugin does this'],
	'banner_x': ['Banners', 'header image position'],
	'banner_y': ['Banners', 'header image position'],
	'obsidianUIMode': ['core', 'forces reading/editing mode on open'],
	'kanban:settings': ['Kanban', 'board settings'],
	'dataview': ['Dataview', 'per-note config'],
	'publish': ['Obsidian Publish', 'publishing flag'],
	'permalink': ['Publish/Digital Garden', 'publishing slug'],
	'tracker': ['Tracker', 'per-note config'],
	'annotation-target': ['Annotator', 'PDF/EPUB annotation target'],
};

// GFM defines five alert types; Obsidian defines a dozen more, and the extras
// fall back to a plain blockquote rather than a coloured callout.
const GFM_ALERTS = new Set(['note', 'tip', 'important', 'warning', 'caution']);

// ---- the walk --------------------------------------------------------------

const IGNORED = new Set(['.obsidian', '.clew', '.git', 'node_modules', '.trash', '.DS_Store']);

function walk(dir, root, out) {
	let entries;
	try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
	for (const entry of entries) {
		if (IGNORED.has(entry.name)) continue;
		const abs = path.join(dir, entry.name);
		const rel = path.relative(root, abs);
		let stat;
		try { stat = fs.statSync(abs); } catch { continue; }   // follows symlinks, like Clew
		if (stat.isDirectory()) walk(abs, root, out);
		else if (stat.isFile()) out.push({ abs, rel });
	}
}

/** A tally that remembers a few example paths per key. */
function tally(limit) {
	const map = new Map();
	return {
		add(key, rel, extra) {
			const entry = map.get(key) ?? { count: 0, files: new Set(), extra };
			entry.count++;
			if (entry.files.size < limit) entry.files.add(rel);
			map.set(key, entry);
		},
		entries: () => [...map.entries()].sort((a, b) => b[1].count - a[1].count),
		total: () => [...map.values()].reduce((n, e) => n + e.count, 0),
		size: () => map.size,
	};
}

// Fenced blocks are masked before scanning prose, so a callout inside a code
// sample is not counted as one the user wrote.
const FENCE_RE = /^([ \t]*)(```+|~~~+)([^\n`]*)\n([\s\S]*?)^\1\2[ \t]*$/gm;

function scan(vault, { examples = 3 } = {}) {
	const files = [];
	walk(vault, vault, files);

	const extensions = tally(examples);
	const consumed = tally(examples);
	const fences = tally(examples);
	const frontmatter = tally(examples);
	const syntax = tally(examples);
	let noteCount = 0;
	let drawingCount = 0;

	for (const { abs, rel } of files) {
		const lower = rel.toLowerCase();
		const isDrawing = lower.endsWith('.excalidraw') || lower.endsWith('.excalidraw.md');
		if (isDrawing) drawingCount++;
		const base = path.basename(lower);
		const ext = path.extname(lower);
		// Dotfiles are housekeeping, not content.
		if (base.startsWith('.')) continue;
		if (!CLEW_EXTENSIONS.has(ext) && !(ext in CONSUMED_EXTENSIONS)) {
			extensions.add(ext || '(no extension)', rel);
		} else if (ext in CONSUMED_EXTENSIONS) {
			consumed.add(ext, rel, [null, CONSUMED_EXTENSIONS[ext]]);
		}
		if (ext !== '.md' && ext !== '.jmd') continue;
		if (isDrawing) continue;   // a drawing's body is a payload, not prose
		noteCount++;

		let text;
		try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }

		// Frontmatter keys.
		const fm = /^---\n([\s\S]*?)\n---/.exec(text);
		if (fm) {
			for (const line of fm[1].split('\n')) {
				const key = /^([A-Za-z][\w :-]*?):/.exec(line)?.[1]?.trim();
				if (key && !CLEW_FRONTMATTER.has(key.toLowerCase()) && FRONTMATTER_PLUGINS[key]) {
					frontmatter.add(key, rel, FRONTMATTER_PLUGINS[key]);
				}
			}
		}

		// Fences.
		let masked = text;
		for (const match of text.matchAll(FENCE_RE)) {
			const info = (match[3] ?? '').trim().split(/\s+/)[0].toLowerCase();
			masked = masked.replace(match[0], '');
			if (!info) continue;
			if (CLEW_FENCES.has(info) || CODE_LANGUAGES.has(info)) continue;
			fences.add(info, rel, FENCE_PLUGINS[info]);
		}

		// Prose-level syntax, outside fences.
		for (const m of masked.matchAll(/^[ \t]*>\s*\[!([a-zA-Z-]+)\]/gm)) {
			const type = m[1].toLowerCase();
			if (!GFM_ALERTS.has(type)) {
				syntax.add(`callout [!${type}]`, rel,
					['core Obsidian', 'beyond GFM\'s five alert types — renders as a plain blockquote']);
			}
		}
		if (/\[\[[^\]\n]*#\^[^\]\n]+\]\]/.test(masked)) {
			syntax.add('block reference [[note#^id]]', rel,
				['core Obsidian', 'links to a specific block; Clew resolves headings but not block ids']);
		}
		if (/^[ \t]*[-*] \[[ xX]\][^\n]*[📅⏳🛫➕✅🔁⏫🔼🔽]/m.test(masked)) {
			syntax.add('Tasks emoji fields (📅 🔁 ⏫ …)', rel,
				['Obsidian Tasks', 'due dates, recurrence and priority; Clew shows the line but cannot sort or filter by them']);
		}
		if (/%%[\s\S]*?%%/.test(masked)) {
			syntax.add('%% comments %%', rel,
				['core Obsidian', 'hidden in Obsidian\'s preview; Clew renders the text']);
		}
	}

	return { files, noteCount, drawingCount, extensions, consumed, fences, frontmatter, syntax };
}

// ---- output ----------------------------------------------------------------

const bar = (n, max, width = 24) =>
	'█'.repeat(Math.max(1, Math.round((n / Math.max(max, 1)) * width)));

function section(title, t, { verdict } = {}) {
	if (t.size() === 0) return `\n${title}\n  nothing — Clew handles everything here.\n`;
	const rows = t.entries();
	const max = rows[0][1].count;
	let out = `\n${title}\n`;
	for (const [key, entry] of rows) {
		const [plugin, why] = entry.extra ?? [];
		out += `  ${String(entry.count).padStart(5)}  ${bar(entry.count, max)}  ${key}`;
		out += plugin ? `   — ${plugin}\n` : '\n';
		if (why) out += `${' '.repeat(9)}${why}\n`;
		out += `${' '.repeat(9)}e.g. ${[...entry.files].join(', ')}\n`;
	}
	if (verdict) out += `\n  ${verdict}\n`;
	return out;
}

function report(vault, result) {
	const { files, noteCount, drawingCount, extensions, consumed, fences, frontmatter, syntax } = result;
	const gaps = extensions.total() + fences.total() + frontmatter.total() + syntax.total();
	let out = '';
	out += `\nClew compatibility report\n`;
	out += `${'─'.repeat(60)}\n`;
	out += `vault      ${vault}\n`;
	out += `files      ${files.length} (${noteCount} notes, ${drawingCount} drawings)\n`;
	out += `findings   ${gaps === 0 ? 'none — this vault opens cleanly' : `${gaps} across ${
		extensions.size() + fences.size() + frontmatter.size() + syntax.size()} kinds`}\n`;

	out += section('FILE TYPES Clew cannot open', extensions,
		{ verdict: 'These show in the explorer but have no viewer.' });
	out += section('CODE FENCES Clew would render as plain text', fences,
		{ verdict: 'Each is a block of the note that silently stops being what the author meant.' });
	out += section('FRONTMATTER belonging to plugins', frontmatter,
		{ verdict: 'Usually harmless — but a kanban-plugin key means the whole note is a board.' });
	out += section('SYNTAX Clew does not implement', syntax);
	if (consumed.size() > 0) {
		out += `\nREAD BUT NOT OPENABLE (not gaps — Clew uses these)\n`;
		for (const [ext, entry] of consumed.entries()) {
			out += `  ${String(entry.count).padStart(5)}  ${ext} — ${entry.extra[1]}\n`;
		}
	}
	out += `\n${'─'.repeat(60)}\n`;
	return out;
}

// ---- main ------------------------------------------------------------------

const args = process.argv.slice(2);
const vault = args.find((a) => !a.startsWith('--'));
const asJson = args.includes('--json');
const examples = Number(args[args.indexOf('--examples') + 1]) || 3;

if (!vault) {
	console.error('usage: node scripts/vault-report.js /path/to/vault [--json] [--examples N]');
	process.exit(2);
}
if (!fs.existsSync(vault)) {
	console.error(`No such vault: ${vault}`);
	process.exit(2);
}

const result = scan(vault, { examples });
if (asJson) {
	const plain = (t) => Object.fromEntries(t.entries().map(([k, v]) =>
		[k, { count: v.count, examples: [...v.files], plugin: v.extra?.[0] ?? null, note: v.extra?.[1] ?? null }]));
	console.log(JSON.stringify({
		vault,
		files: result.files.length,
		notes: result.noteCount,
		drawings: result.drawingCount,
		extensions: plain(result.extensions),
		fences: plain(result.fences),
		frontmatter: plain(result.frontmatter),
		syntax: plain(result.syntax),
	}, null, 2));
} else {
	console.log(report(vault, result));
}
