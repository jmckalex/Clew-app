// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Book mode in the window (docs/dev/book-mode.md §2–§3, phase 1): which book
// a chapter belongs to and shows (D10: the one built or opened most
// recently, said), the status bar's "Ch. 2 of Book", the next/previous
// chapter commands, and the facts the Book panel shows about a chapter —
// read from disk when its index entry changes, never on a keystroke. The
// rules themselves are shared/book.js.
import { vaultStore } from './state/vault-store.js';
import { workspaceStore } from './state/workspace-store.js';
import { registerCommand } from './commands/registry.js';
import { ipc, CH } from './ipc.js';
import { currentBook, readMaster, chapterTitle, countWords, chapterStatus } from '../shared/book.js';

const baseName = (rel) => rel.split('/').pop().replace(/\.(md|jmd)$/i, '');

/** The master's entry in the index (its title and resolved chapters), or null. */
export function masterEntry(path) {
	return (path && vaultStore.index[path]?.book) || null;
}

/** The book whose numbers `path` shows, with the others it is also in. */
export function bookOfNote(path) {
	return path ? currentBook(vaultStore.index, path, workspaceStore.recentBook) : null;
}

/** A book's title: its master's `title`, else the master's file name. */
export function bookTitle(master) {
	return masterEntry(master)?.title ?? baseName(master);
}

/**
 * The book the Book panel shows: the active note's when it is a master or a
 * chapter; else the one opened most recently; else the vault's first.
 */
export function shownBook(activePath) {
	if (masterEntry(activePath)) return activePath;
	const chapterOf = bookOfNote(activePath);
	if (chapterOf) return chapterOf.master;
	const masters = vaultStore.masters();
	const recent = workspaceStore.recentBook;
	return masters.includes(recent) ? recent : (masters[0] ?? null);
}

const facts = new Map();   // path → { mtimeMs, promise }

/**
 * What the panel shows about a note, from its text: as a chapter (title,
 * words, status) and as a master (readMaster). Re-read only when the index
 * says the file changed.
 */
export function noteFacts(path) {
	const mtimeMs = vaultStore.index[path]?.mtimeMs ?? null;
	const known = facts.get(path);
	if (known && known.mtimeMs === mtimeMs) return known.promise;
	const promise = ipc.invoke(CH.NOTE_READ, { path }).then((text) => ({
		title: chapterTitle(text, path),
		words: countWords(text),
		status: chapterStatus(text),
		master: readMaster(text),
	}), () => null);
	facts.set(path, { mtimeMs, promise });
	return promise;
}

/** The status bar's item for the active note, or null when it is in no book. */
export function bookStatusItem(path) {
	const book = bookOfNote(path);
	if (!book) return null;
	const el = document.createElement('span');
	el.className = 'status-item clew-book-indicator';
	el.textContent = `Ch. ${book.number} of ${book.title}`;
	const also = book.also.length === 1 ? ` · also in ${book.also[0].title}`
		: book.also.length > 1 ? ` · also in ${book.also.length} more books` : '';
	if (also) {
		const more = document.createElement('span');
		more.className = 'clew-book-also';
		more.textContent = also;
		el.append(more);
	}
	el.title = book.also.length
		? `Chapter ${book.number} of ${book.count} in “${book.title}”, the book opened or built most recently — click to show its numbers from “${book.also[0].title}” instead`
		: `Chapter ${book.number} of ${book.count} in “${book.title}” — click to open the Book panel`;
	el.addEventListener('click', () => {
		if (book.also.length) workspaceStore.setRecentBook(book.also[0].master);
		else showBookPanel();
	});
	return el;
}

export function showBookPanel() {
	workspaceStore.setSidebar('right', { open: true, activeTool: 'book' });
}

/** The chapter `step` away from the active one in its book, opened. */
function stepChapter(step) {
	const path = workspaceStore.activeTab()?.path;
	const book = bookOfNote(path);
	if (!book) return;
	const next = masterEntry(book.master)?.chapters[book.number - 1 + step]?.resolved;
	if (next) workspaceStore.openNote(next);
}

const inBook = (ctx) => Boolean(bookOfNote(ctx.notePath));

export function installBooks() {
	// Opening a master makes it the book its chapters show (D10).
	const noteOpened = () => {
		const path = workspaceStore.activeTab()?.path;
		if (masterEntry(path)) workspaceStore.setRecentBook(path);
	};
	workspaceStore.on('active-changed', noteOpened);
	workspaceStore.on('layout-changed', noteOpened);
	vaultStore.on('vault-changed', () => facts.clear());
	registerCommand({ id: 'book:next-chapter', name: 'Book: next chapter', when: inBook, run: () => stepChapter(1) });
	registerCommand({ id: 'book:previous-chapter', name: 'Book: previous chapter', when: inBook, run: () => stepChapter(-1) });
	registerCommand({
		id: 'book:show-panel', name: 'Book: show the Book panel',
		when: (ctx) => ctx.vaultOpen && vaultStore.masters().length > 0,
		run: () => showBookPanel(),
	});
}
