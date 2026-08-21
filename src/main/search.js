// Full-text vault search. Scan-based with an mtime-validated in-memory text
// cache — precise line-level matches with no index to maintain. Fast enough
// for multi-thousand-note vaults with the renderer's debounce in front.
//
// Query syntax (Obsidian-ish):
//   plain terms        AND'd, case-insensitive substring
//   "quoted phrase"    exact substring
//   path:Projects      path filter (substring)
//   file:design        filename filter (substring)
//   tag:#demo / tag:demo   notes carrying the tag (via the indexer)
import fs from 'node:fs';
import path from 'node:path';

const MAX_RESULTS = 200;
const MAX_MATCHES_PER_FILE = 20;

export class SearchService {
	#vaults;
	#indexer;
	#textCache = new Map(); // relPath -> {mtimeMs, text}

	constructor({ vaults, indexer }) {
		this.#vaults = vaults;
		this.#indexer = indexer;
	}

	#textFor(relPath) {
		const abs = path.join(this.#vaults.root, relPath);
		let stat;
		try { stat = fs.statSync(abs); } catch { return null; }
		const cached = this.#textCache.get(relPath);
		if (cached && cached.mtimeMs === stat.mtimeMs) return cached.text;
		let text;
		try { text = fs.readFileSync(abs, 'utf8'); } catch { return null; }
		this.#textCache.set(relPath, { mtimeMs: stat.mtimeMs, text });
		return text;
	}

	search(query) {
		if (!this.#vaults.isOpen || !query.trim()) return [];
		const { terms, phrases, pathFilters, fileFilters, tagFilters } = parseQuery(query);
		const needles = [...terms, ...phrases].map((s) => s.toLowerCase());

		const results = [];
		for (const relPath of this.#indexer.notes.keys()) {
			if (results.length >= MAX_RESULTS) break;
			const lowerPath = relPath.toLowerCase();
			if (pathFilters.some((f) => !lowerPath.includes(f))) continue;
			const fileName = relPath.split('/').pop().toLowerCase();
			if (fileFilters.some((f) => !fileName.includes(f))) continue;
			if (tagFilters.length) {
				const noteTags = (this.#indexer.notes.get(relPath)?.tags ?? []).map((t) => t.tag.toLowerCase());
				if (tagFilters.some((f) => !noteTags.some((t) => t === f || t.startsWith(f + '/')))) continue;
			}

			// Filters only (no content terms): the file itself is the hit.
			if (needles.length === 0) {
				results.push({ path: relPath, matches: [] });
				continue;
			}

			const text = this.#textFor(relPath);
			if (text === null) continue;
			const lower = text.toLowerCase();
			if (!needles.every((n) => lower.includes(n))) continue;

			// Line-level matches for the first needle-bearing lines.
			const lines = text.split('\n');
			const matches = [];
			for (let i = 0; i < lines.length && matches.length < MAX_MATCHES_PER_FILE; i++) {
				const lineLower = lines[i].toLowerCase();
				const needle = needles.find((n) => lineLower.includes(n));
				if (!needle) continue;
				// Column relative to the trimmed snippet the renderer displays.
				const leading = lines[i].length - lines[i].trimStart().length;
				matches.push({
					line: i + 1,
					column: Math.max(0, lineLower.indexOf(needle) - leading),
					length: needle.length,
					snippet: lines[i].trim().slice(0, 240),
				});
			}
			results.push({ path: relPath, matches });
		}
		return results;
	}
}

export function parseQuery(query) {
	const phrases = [];
	const rest = query.replace(/"([^"]*)"/g, (_, phrase) => {
		if (phrase) phrases.push(phrase);
		return ' ';
	});
	const terms = [];
	const pathFilters = [];
	const fileFilters = [];
	const tagFilters = [];
	for (const token of rest.split(/\s+/).filter(Boolean)) {
		const lower = token.toLowerCase();
		if (lower.startsWith('path:')) pathFilters.push(lower.slice(5));
		else if (lower.startsWith('file:')) fileFilters.push(lower.slice(5));
		else if (lower.startsWith('tag:')) tagFilters.push(lower.slice(4).replace(/^#/, ''));
		else terms.push(token);
	}
	return { terms, phrases, pathFilters, fileFilters, tagFilters };
}
