// Obsidian-style wikilinks for jmarkdown, loaded into the render worker via
// the vault's generated .jmarkdown/config.json:
//
//     "Extensions": ["wikiembed, wikilink from <dist>/engine/wikilinks.js"]
//
// Syntax (Obsidian-compatible):
//     [[Note]]  [[Note|alias]]  [[Note#Heading]]  [[Note#Heading|alias]]
//     ![[Note]] / ![[Note#Heading]] on its own line — block embed (transclusion)
//
// This file runs inside a one-shot jmarkdown worker: module-level caches last
// exactly one build, so the lazy vault scan below is per-build by construction.
// The vault root comes from CLEW_VAULT_ROOT (set by Clew's render service);
// without it, links render unresolved but nothing breaks.
import fs from 'node:fs';
import path from 'node:path';

const NOTE_EXT = /\.(md|jmd)$/i;
const IGNORED = new Set(['.obsidian', '.clew', '.git', 'node_modules', '.trash']);

let noteIndex = null; // Map<lowercased basename-no-ext, string[] of vault-relative paths>

function vaultRoot() {
	return process.env.CLEW_VAULT_ROOT || null;
}

function buildIndex(root) {
	const index = new Map();
	const walk = (dir, rel) => {
		let entries;
		try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
		for (const entry of entries) {
			if (entry.name.startsWith('.') || IGNORED.has(entry.name)) continue;
			const childRel = rel ? `${rel}/${entry.name}` : entry.name;
			if (entry.isDirectory()) walk(path.join(dir, entry.name), childRel);
			else if (NOTE_EXT.test(entry.name)) {
				const key = entry.name.replace(NOTE_EXT, '').toLowerCase();
				if (!index.has(key)) index.set(key, []);
				index.get(key).push(childRel);
			}
		}
	};
	walk(root, '');
	return index;
}

/**
 * Resolve a wikilink target to a vault-relative path, Obsidian-style:
 * an explicit path (contains '/') resolves directly; a bare name matches by
 * basename with the shortest path winning. Returns null when unresolved.
 */
export function resolveTarget(target) {
	const root = vaultRoot();
	if (!root) return null;
	if (noteIndex === null) noteIndex = buildIndex(root);

	const clean = target.trim();
	if (!clean) return null;
	if (clean.includes('/')) {
		for (const candidate of [clean, `${clean}.md`, `${clean}.jmd`]) {
			if (fs.existsSync(path.join(root, candidate)) && NOTE_EXT.test(candidate)) return candidate;
		}
		return null;
	}
	const matches = noteIndex.get(clean.replace(NOTE_EXT, '').toLowerCase());
	if (!matches || matches.length === 0) return null;
	return [...matches].sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
}

const escapeAttr = (s) =>
	s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeHtml = escapeAttr;

// [[target]] / [[target#heading]] / [[target|alias]] — target may be empty
// for same-file heading links ([[#Heading]]).
const LINK_RE = /^\[\[([^\[\]|#\n]*)(?:#([^\[\]|\n]+))?(?:\|([^\[\]\n]+))?\]\]/;

function parseLink(match) {
	const target = match[1].trim();
	const heading = match[2]?.trim() ?? null;
	const alias = match[3]?.trim() ?? null;
	const label = alias ?? (target && heading ? `${target} § ${heading}` : target || heading || '');
	const full = target + (heading ? `#${heading}` : '');
	return { target, heading, alias, label, full };
}

export const wikilink = {
	name: 'wikilink',
	level: 'inline',
	start(src) { return src.indexOf('[['); },
	tokenizer(src) {
		const match = LINK_RE.exec(src);
		if (!match) return;
		const link = parseLink(match);
		if (!link.target && !link.heading) return; // [[]] is not a link
		return { type: 'wikilink', raw: match[0], ...link };
	},
	renderer(token) {
		if (global.isLatex) return token.label;
		const resolved = token.target ? resolveTarget(token.target) !== null : true;
		const cls = resolved ? 'internal-link' : 'internal-link unresolved';
		return `<a class="${cls}" href="#" data-href="${escapeAttr(token.full)}">${escapeHtml(token.label)}</a>`;
	},
};

// Transclusion depth guard: embeds may nest (an embedded note with its own
// embeds) but cycles and runaway chains must not hang a build.
const embedStack = [];
const MAX_EMBED_DEPTH = 3;

/** Slice a heading's section out of a note: from the heading line to the next
 *  heading of the same or higher level. */
function sliceHeading(content, heading) {
	const lines = content.split('\n');
	const headingRe = /^(#{1,6})\s+(.*?)\s*(?:\{[^}]*\})?\s*$/;
	let start = -1;
	let level = 0;
	for (let i = 0; i < lines.length; i++) {
		const m = headingRe.exec(lines[i]);
		if (m && m[2].toLowerCase() === heading.toLowerCase()) {
			start = i;
			level = m[1].length;
			break;
		}
	}
	if (start === -1) return null;
	let end = lines.length;
	for (let i = start + 1; i < lines.length; i++) {
		const m = headingRe.exec(lines[i]);
		if (m && m[1].length <= level) { end = i; break; }
	}
	return lines.slice(start, end).join('\n');
}

export const wikiembed = {
	name: 'wikiembed',
	level: 'block',
	start(src) { return src.indexOf('![['); },
	tokenizer(src) {
		// Own-line block embeds only; a mid-sentence ![[…]] falls through (the
		// '!' becomes text and [[…]] renders as an ordinary wikilink).
		const match = /^!\[\[([^\[\]|#\n]*)(?:#([^\[\]|\n]+))?(?:\|([^\[\]\n]+))?\]\][ \t]*(?:\n+|$)/.exec(src);
		if (!match) return;
		const link = parseLink(match);
		const token = { type: 'wikiembed', raw: match[0], ...link, tokens: [], failed: null };

		const rel = link.target ? resolveTarget(link.target) : null;
		if (!rel) {
			token.failed = 'unresolved';
			return token;
		}
		const abs = path.join(vaultRoot(), rel);
		if (embedStack.includes(abs) || embedStack.length >= MAX_EMBED_DEPTH) {
			token.failed = 'cycle';
			return token;
		}
		let content;
		try { content = fs.readFileSync(abs, 'utf8'); } catch { token.failed = 'unreadable'; return token; }
		// Strip YAML frontmatter — the embed shows the body only.
		content = content.replace(/^---\n[\s\S]*?\n---\n/, '');
		if (link.heading) {
			const section = sliceHeading(content, link.heading);
			if (section === null) { token.failed = 'missing-heading'; return token; }
			content = section;
		}
		embedStack.push(abs);
		try {
			this.lexer.blockTokens(content, token.tokens);
		} finally {
			embedStack.pop();
		}
		return token;
	},
	renderer(token) {
		if (global.isLatex) {
			return token.failed ? '' : this.parser.parse(token.tokens);
		}
		const title = escapeHtml(token.label);
		const target = escapeAttr(token.full);
		if (token.failed) {
			const reason = token.failed === 'cycle' ? 'circular embed' : 'not found';
			return `<div class="internal-embed unresolved" data-href="${target}">`
				+ `<div class="embed-title">${title}</div>`
				+ `<div class="embed-note">(${reason})</div></div>\n`;
		}
		return `<div class="internal-embed" data-href="${target}">`
			+ `<div class="embed-title"><a class="internal-link" href="#" data-href="${target}">${title}</a></div>`
			+ `<div class="embed-content">\n${this.parser.parse(token.tokens)}</div></div>\n`;
	},
};

export default [wikiembed, wikilink];
