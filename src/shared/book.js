// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Book mode (docs/dev/book-mode.md, phase 1): the pure half. A BOOK is a
// master note whose front matter says `book: true` and lists its chapters
// as wikilinks; every chapter stays an ordinary note. This file reads a
// master, names a chapter, counts its words, reads its status, and answers
// "which books is this note a chapter of" from the index. Shared by main
// (the index, renames) and the renderer (the Book panel, the status bar);
// electron-free, tested (tests/book.test.js).
import { parseProperties, applyProperties } from './frontmatter.js';
import { maskSource } from './note-metadata.js';

/** A chapter's progress, from its own `status:` (§9 D13). */
export const BOOK_STATUSES = Object.freeze(['draft', 'revised', 'done']);

/** What a master may say that phase 1 does not build yet (§9 D7): the key
 *  and the words a refusal names it by. */
const LATER = Object.freeze({
	parts: 'parts',
	frontmatter: 'front matter',
	appendices: 'appendices',
	backmatter: 'back matter',
});

const LINK_RE = /^\[\[([^\]|#^]*)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/;
const H1_RE = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/;

const keyOf = (entries, name) => entries.find((e) => e.key.toLowerCase() === name);
const baseName = (rel) => rel.split('/').pop().replace(/\.(md|jmd)$/i, '');

/**
 * What a master note says, or null when the note is not a master.
 *
 * @returns {null | {
 *   title: string|null,
 *   numbering: 'per chapter'|'continuous',
 *   chapters: Array<{ link: string, target: string }>,
 *   later: string[],      // keys named for later (parts, front matter …), as words
 *   problems: string[],   // what the reader could not take, by name
 *   clean: boolean,       // false: the front matter is beyond the editable subset
 * }}
 */
export function readMaster(text) {
	const { present, entries, clean } = parseProperties(String(text ?? ''));
	if (!present || keyOf(entries, 'book')?.value !== true) return null;
	const problems = [];
	const title = keyOf(entries, 'title')?.value;
	let numbering = 'per chapter';
	const asked = keyOf(entries, 'numbering')?.value;
	if (asked !== undefined && asked !== '') {
		const said = String(asked).trim().toLowerCase().replace(/[-_]+/g, ' ');
		if (said === 'continuous') numbering = 'continuous';
		else if (said !== 'per chapter') problems.push(`numbering "${asked}" is not "per chapter" or "continuous" — per chapter is used`);
	}
	const listed = keyOf(entries, 'chapters')?.value;
	const items = listed === undefined || listed === '' ? [] : Array.isArray(listed) ? listed : [listed];
	const chapters = [];
	const seen = new Set();
	for (const item of items) {
		const link = String(item).trim();
		const match = LINK_RE.exec(link);
		const target = match?.[1].trim();
		if (!target) {
			problems.push(`chapters: "${link}" is not a [[link]] to a note`);
			continue;
		}
		const key = target.toLowerCase().replace(/\.(md|jmd)$/i, '');
		if (seen.has(key)) {
			problems.push(`chapters: [[${target}]] is listed twice — the second is left out`);
			continue;
		}
		seen.add(key);
		chapters.push({ link, target });
	}
	const later = entries.map((e) => LATER[e.key.toLowerCase()]).filter(Boolean);
	return {
		title: typeof title === 'string' && title.trim() ? title.trim() : null,
		numbering,
		chapters,
		later,
		problems,
		clean,
	};
}

/** The sentence that names what a master asks for and phase 1 leaves out. */
export function laterNotice(later) {
	if (!later?.length) return null;
	const list = later.length === 1 ? later[0] : `${later.slice(0, -1).join(', ')} and ${later.at(-1)}`;
	return `${list[0].toUpperCase()}${list.slice(1)} ${later.length === 1 && !/s$/.test(later[0]) ? 'is' : 'are'} not supported yet — the book is built from its chapters.`;
}

/** The master as the index keeps it: its title and chapter links, nothing
 *  else (the index entry of every OTHER note is unchanged). */
export function masterIndexEntry(text) {
	const master = readMaster(text);
	if (!master) return null;
	return { title: master.title, chapters: master.chapters.map(({ target }) => ({ target })) };
}

/** The body of a note: everything after its front matter. */
function bodyOf(text) {
	const { present, end } = parseProperties(text);
	return present ? text.slice(end) : text;
}

/**
 * A chapter's title (§9 D2): its first `#` heading; failing that its
 * front-matter `title`; failing that its file name. A heading's trailing
 * attribute block (`{#ch:intro}`) is not part of the title.
 */
export function chapterTitle(text, path) {
	const source = String(text ?? '');
	const lines = maskSource(bodyOf(source)).split('\n');
	for (const line of lines) {
		const h1 = H1_RE.exec(line);
		if (h1) {
			const title = h1[1].replace(/\s*\{[^}]*\}\s*$/, '').trim();
			if (title) return title;
		}
	}
	const { entries } = parseProperties(source);
	const title = keyOf(entries, 'title')?.value;
	if (typeof title === 'string' && title.trim()) return title.trim();
	return baseName(path ?? '');
}

/**
 * A chapter's words: its prose, by the status bar's own idea of a word, with
 * front matter, code, maths and comments left out — what a writer means by
 * the length of a chapter. The status bar counts the whole text; this counts
 * what will be read.
 */
export function countWords(text) {
	const body = maskSource(bodyOf(String(text ?? '')))
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/%%[\s\S]*?%%/g, ' ');
	return (body.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;
}

/** A chapter's `status:` when it is one of BOOK_STATUSES, else null. */
export function chapterStatus(text) {
	const { entries } = parseProperties(String(text ?? ''));
	const value = keyOf(entries, 'status')?.value;
	const said = typeof value === 'string' ? value.trim().toLowerCase() : '';
	return BOOK_STATUSES.includes(said) ? said : null;
}

/**
 * Every book `path` is a chapter of, from the index (`{ [rel]: meta }`, each
 * master's `meta.book.chapters[i].resolved` set by the indexer), ordered by
 * the master's path.
 * @returns {Array<{ master: string, title: string, number: number, count: number }>}
 */
export function booksOf(index, path) {
	const out = [];
	for (const [master, meta] of Object.entries(index ?? {})) {
		const chapters = meta?.book?.chapters;
		if (!chapters) continue;
		const at = chapters.findIndex((c) => c.resolved === path);
		if (at === -1) continue;
		out.push({ master, title: meta.book.title ?? baseName(master), number: at + 1, count: chapters.length });
	}
	return out.sort((a, b) => a.master.localeCompare(b.master));
}

/** Every master in the index, by path. */
export function mastersOf(index) {
	return Object.keys(index ?? {}).filter((rel) => index[rel]?.book).sort();
}

/**
 * The book whose numbers a chapter shows (§9 D10): the one built or opened
 * most recently (`recent`, a master path, when the note is in it), else the
 * first by path — and the others it is also in.
 */
export function currentBook(index, path, recent = null) {
	const books = booksOf(index, path);
	if (!books.length) return null;
	const book = books.find((b) => b.master === recent) ?? books[0];
	return { ...book, also: books.filter((b) => b !== book) };
}

/** The chapter list with `moved` (an index) put at `to`; a new array. */
export function moveChapter(list, moved, to) {
	const next = [...list];
	if (moved < 0 || moved >= next.length) return next;
	const [item] = next.splice(moved, 1);
	next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
	return next;
}

/**
 * The master's text with its `chapters:` replaced by `links` (the strings
 * written there). Null when the front matter is beyond the editable subset —
 * it is never rewritten then (shared/frontmatter.js's rule).
 */
export function withChapters(text, links) {
	const { entries, clean, present } = parseProperties(text);
	if (!present || !clean) return null;
	const entry = keyOf(entries, 'chapters');
	if (entry) entry.value = [...links];
	else entries.push({ key: 'chapters', value: [...links] });
	return applyProperties(text, entries);
}

/** The link a chapter list writes for a note: `[[Name]]` when the name is
 *  unambiguous, the vault path (no extension) otherwise. */
export function chapterLink(path, unambiguous) {
	const name = baseName(path);
	return `[[${unambiguous ? name : path.replace(/\.(md|jmd)$/i, '')}]]`;
}
