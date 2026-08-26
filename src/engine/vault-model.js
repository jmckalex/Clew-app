// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The vault as a table of PAGES — one row per note, with the implicit `file.*`
// fields Dataview and Bases both query over, and the link graph they both
// need. `query-fences.js` reads its own, simpler model; this is the richer one
// those two dialects share, so there is one place that decides what
// `file.inlinks` means.
//
// Everything is cached at module level, which in this codebase means "for
// exactly one build": the render worker is one-shot (see CLAUDE.md), so a
// note holding six queries scans the vault once, and the next render starts
// from a clean process.
//
// Deliberately does NOT import wikilinks.js. That file needs to reach bases.js
// to render a `![[Board.base]]` embed, so anything wikilinks imports must not
// import it back — hence the small resolver below rather than reusing
// `resolveTarget`.
import fs from 'node:fs';
import path from 'node:path';
import { readFrontmatter, readInlineFields, extractTasks } from './query-fences.js';

const NOTE_FILE = /\.(md|jmd)$/i;
const IGNORED = new Set(['.obsidian', '.clew', '.git', 'node_modules', '.trash']);

// ---- links -----------------------------------------------------------------

/**
 * A link value. Dataview compares these by target, not by display text, so
 * `contains(this.file.inlinks, file.link)` works regardless of how either
 * side was written.
 */
export function makeLink(target, display = null, subpath = null) {
	return { __link: true, path: target, display, subpath };
}

export const isLink = (v) => v !== null && typeof v === 'object' && v.__link === true;

/** The comparable identity of a link, page, or plain string. */
export function linkKey(value) {
	if (isLink(value)) return stripExt(value.path).toLowerCase();
	if (value !== null && typeof value === 'object' && value.file?.link) {
		return stripExt(value.file.link.path).toLowerCase();
	}
	if (typeof value === 'string') return stripExt(value.replace(/^\[\[|\]\]$/g, '').split('|')[0]).toLowerCase();
	return null;
}

const stripExt = (p) => String(p).replace(NOTE_FILE, '');

// ---- the scan --------------------------------------------------------------

let cache = null;

const FENCE_MASK = /^(```|~~~)[^\n]*$[\s\S]*?^\1\s*$/gm;
const INLINE_CODE = /`[^`\n]*`/g;
const mask = (text) => text
	.replace(FENCE_MASK, (m) => m.replace(/[^\n]/g, ' '))
	.replace(INLINE_CODE, (m) => ' '.repeat(m.length));

const WIKILINK = /\[\[([^\[\]|#\n]*)(?:#([^\[\]|\n]+))?(?:\|([^\[\]\n]+))?\]\]/g;
const BODY_TAG = /(^|[\s(,;])#([A-Za-z0-9_][A-Za-z0-9_/-]*)/g;

function walk(root) {
	const files = [];
	const seen = new Set();
	const step = (dir, rel) => {
		let real;
		try { real = fs.realpathSync(dir); } catch { return; }
		if (seen.has(real)) return;      // symlink cycles — vaults may contain them
		seen.add(real);
		let entries;
		try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
		for (const entry of entries) {
			if (entry.name.startsWith('.') || IGNORED.has(entry.name)) continue;
			const childRel = rel ? `${rel}/${entry.name}` : entry.name;
			const abs = path.join(dir, entry.name);
			let stat;
			try { stat = fs.statSync(abs); } catch { continue; }   // follows symlinks
			if (stat.isDirectory()) step(abs, childRel);
			else files.push({ abs, rel: childRel, stat });
		}
	};
	step(root, '');
	return files;
}

/**
 * Every note in the vault as a page object. Non-note files are indexed by
 * name only, so a link to an attachment still resolves.
 */
export function scanPages() {
	if (cache) return cache;
	const root = process.env.CLEW_VAULT_ROOT;
	if (!root) return (cache = { pages: [], byPath: new Map(), byName: new Map() });

	const pages = [];
	const files = walk(root);
	const byName = new Map();
	const addName = (key, rel) => {
		const k = key.toLowerCase();
		if (!byName.has(k)) byName.set(k, []);
		byName.get(k).push(rel);
	};

	for (const { abs, rel, stat } of files) {
		const base = rel.split('/').pop();
		addName(base, rel);                                  // with extension
		if (NOTE_FILE.test(base)) addName(base.replace(NOTE_FILE, ''), rel);
		if (!NOTE_FILE.test(base)) continue;

		let text;
		try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
		const fm = readFrontmatter(text);
		const inline = readInlineFields(text);
		const sources = {};
		for (const key of Object.keys(inline.fields)) sources[key] = `line:${inline.lines[key]}`;
		for (const key of Object.keys(fm)) sources[key] = 'fm';

		const name = base.replace(NOTE_FILE, '');
		const folder = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
		const masked = mask(text);

		const tags = new Set();
		const fmTags = Array.isArray(fm.tags) ? fm.tags : fm.tags ? [fm.tags] : [];
		for (const t of fmTags) if (String(t).trim()) tags.add('#' + String(t).replace(/^#/, ''));
		for (const [, , tag] of masked.matchAll(BODY_TAG)) tags.add('#' + tag.replace(/\/+$/, ''));

		const aliases = Array.isArray(fm.aliases) ? fm.aliases
			: fm.aliases ? [fm.aliases] : Array.isArray(fm.alias) ? fm.alias : fm.alias ? [fm.alias] : [];

		pages.push({
			path: rel, name, folder, ext: base.slice(base.lastIndexOf('.') + 1),
			size: stat.size, ctime: stat.birthtimeMs || stat.ctimeMs, mtime: stat.mtimeMs,
			tags: [...tags], aliases: aliases.map(String),
			fields: { ...inline.fields, ...fm },
			sources, text, rawLinks: [...masked.matchAll(WIKILINK)].map((m) => ({
				target: m[1].trim(), display: m[3]?.trim() ?? null,
			})),
			tasks: extractTasks(text),
			outlinks: [], inlinks: [],
		});
	}

	const byPath = new Map(pages.map((p) => [p.path, p]));
	cache = { pages, byPath, byName };

	// The link graph, resolved once. Obsidian's rule: an explicit path wins,
	// otherwise the shortest matching path.
	for (const page of pages) {
		for (const raw of page.rawLinks) {
			if (!raw.target) continue;                       // [[#heading]] — same note
			const target = resolvePath(raw.target);
			if (!target) continue;
			page.outlinks.push(makeLink(target, raw.display));
			const to = byPath.get(target);
			if (to && to !== page) to.inlinks.push(makeLink(page.path));
		}
		delete page.rawLinks;
	}
	return cache;
}

/** A wikilink target → vault-relative path, or null. */
export function resolvePath(target) {
	const { byName, byPath } = scanPages();
	const clean = String(target).trim();
	if (!clean) return null;
	if (clean.includes('/')) {
		for (const candidate of [clean, `${clean}.md`, `${clean}.jmd`]) {
			if (byPath.has(candidate)) return candidate;
		}
		return null;
	}
	const matches = byName.get(clean.toLowerCase());
	if (!matches?.length) return null;
	return [...matches].sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
}

/** The page a `.base` view or a query is being rendered INSIDE, or null.
 *  `global.current_file` is set by the engine for every build (index.js), the
 *  same way `global.isLatex` is — which is what makes `this` cost nothing. */
export function currentPage() {
	const file = global.current_file;
	if (!file || file === '<stdin>') return null;
	const root = process.env.CLEW_VAULT_ROOT;
	if (!root) return null;
	const rel = path.relative(root, file).split(path.sep).join('/');
	return scanPages().byPath.get(rel) ?? null;
}

/** Reset the per-build cache. Tests only — a real worker builds once. */
export function resetCache() { cache = null; }

// ---- the `file.*` namespace -------------------------------------------------

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Dataview's implicit fields for a page. */
export function fileFields(page) {
	return {
		name: page.name,
		folder: page.folder,
		path: page.path,
		ext: page.ext,
		link: makeLink(page.path, null),
		size: page.size,
		ctime: new Date(page.ctime),
		cday: iso(page.ctime),
		mtime: new Date(page.mtime),
		mday: iso(page.mtime),
		tags: page.tags,
		etags: page.tags,
		aliases: page.aliases,
		inlinks: page.inlinks,
		outlinks: page.outlinks,
		tasks: page.tasks,
		day: page.fields.date ?? null,
	};
}

/**
 * Resolve a bare field name against a page: user fields first (frontmatter,
 * then inline), then the file namespace, so a note may not accidentally
 * shadow `file` but may define anything else.
 */
export function pageValue(page, field) {
	if (field === 'file') return fileFields(page);
	if (field === 'this') return page;
	if (field in page.fields) return page.fields[field];
	return undefined;
}
