// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Filesystem helpers shared across the main process.
//
// Symlink-aware directory-walk helpers, shared by every vault walk (explorer
// tree, indexer, canvas-rename rewrite, bib scan). Dirents answer false to
// both isFile() and isDirectory() for symlinks, which is how symlinked notes
// and folders end up invisible in naive walks (the classic Obsidian
// weakness) — so classify through stat, which follows links, and guard
// recursion with realpaths so link cycles can't recurse forever.
//
// Plus writeFileAtomic, the write path for everything a crash must not be
// able to truncate: notes, PDFs, office documents, .clew/ state, settings.
import fs from 'node:fs';
import path from 'node:path';

// Never shown in the explorer, never indexed.
export const IGNORED_DIRS = new Set(['.obsidian', '.clew', '.git', 'node_modules', '.trash']);

// The watcher holds one open descriptor per watched FILE, and the ceiling
// that matters is a PROCESS one: past ~10,240 open descriptors libuv stops
// being able to fork at all — measured 2026-09-25 on macOS 15, 10,000 held
// descriptors → fork OK, 10,240 → `spawn EBADF`. The render worker IS a
// fork (render-service.js#spawnStandby), so a vault that watches everything
// does not merely get slow: it stops being able to RENDER, and the error
// surfaces as an unreadable `spawn EBADF` in the preview.
//
// The owner's ph341 vault is how this was found: five presentation folders
// symlink one 309 MB reveal.js library, and the watcher held 100,169
// descriptors (99,580 of them under that library, the same real tree
// watched five times over).
//
// So: a budget, shared by every window because the descriptors are, and
// well under the ceiling — the rest of the app needs descriptors too.
export const WATCH_BUDGET = 8000;

/**
 * The watcher's gate: chokidar's `ignored` predicate plus the bookkeeping
 * behind it. Pure enough to unit-test (tests/watch-filter.test.js) — the
 * only I/O is the caller's.
 *
 * chokidar passes ABSOLUTE paths even when `cwd` is set, and asks about the
 * same path more than once (with and without a stats object), so the rules
 * are applied to the vault-RELATIVE path and acceptance is remembered.
 * Testing segments of the absolute path, as this once did, ignores every
 * file in a vault that merely lives under a dot-directory (`~/.notes/…`).
 *
 * @param {object} options
 * @param {string} options.root the vault root
 * @param {Set<string>} [options.duplicates] relative dirs already reached by another path
 * @param {() => boolean} [options.take] claim one unit of budget; false when spent
 */
export function watchFilter({ root, duplicates = new Set(), take = () => true }) {
	const accepted = new Set();
	const state = { accepted, skipped: 0, firstSkipped: null };
	const ignored = (abs) => {
		const rel = path.relative(root, abs);
		// The root itself, and the parent chokidar watches to notice the root
		// being renamed, are its own bookkeeping — leave them alone.
		if (rel === '' || rel.startsWith('..')) return false;
		const segments = rel.split(path.sep);
		if (segments.some((seg) => seg.startsWith('.') || IGNORED_DIRS.has(seg))) return true;
		// A second way into a tree already watched through another link, or
		// anything beneath one. chokidar has no cycle guard of its own; the
		// vault walk's realpath dedupe (shouldRecurse, below) is where these
		// come from. Checking the ancestors costs a handful of Set lookups
		// and does not depend on chokidar refusing to descend for us.
		if (duplicates.size > 0) {
			for (let i = 1; i <= segments.length; i++) {
				if (duplicates.has(segments.slice(0, i).join('/'))) return true;
			}
		}
		if (accepted.has(rel)) return false;
		if (!take()) {
			state.skipped += 1;
			state.firstSkipped ??= rel;
			return true;
		}
		accepted.add(rel);
		return false;
	};
	return { ignored, state };
}

/**
 * What a dirent really is, following symlinks: 'file' | 'dir' | null
 * (null covers sockets, dangling links, and anything unreadable).
 */
export function direntKind(dir, entry) {
	if (entry.isFile()) return 'file';
	if (entry.isDirectory()) return 'dir';
	if (entry.isSymbolicLink()) {
		try {
			const stat = fs.statSync(path.join(dir, entry.name));
			return stat.isFile() ? 'file' : stat.isDirectory() ? 'dir' : null;
		} catch {
			return null; // dangling link
		}
	}
	return null;
}

/**
 * Cycle guard for recursive walks: true exactly once per real directory.
 * Seed `seen` via `walkGuard(root)` so links pointing back into the walk's
 * own root are skipped too.
 */
export function shouldRecurse(absDir, seen) {
	try {
		const real = fs.realpathSync(absDir);
		if (seen.has(real)) return false;
		seen.add(real);
		return true;
	} catch {
		return false;
	}
}

/** A fresh `seen` set for one walk, pre-seeded with the root's realpath. */
export function walkGuard(root) {
	const seen = new Set();
	try {
		seen.add(fs.realpathSync(root));
	} catch { /* root itself unreadable; walk will no-op */ }
	return seen;
}

/**
 * Write a file so that a crash at any moment leaves either the old content
 * or the new — never a truncated half. The bytes land in a temp file beside
 * the target (same directory, so the rename can't cross filesystems), are
 * fsynced, and only then renamed into place.
 *
 * The temp name is dot-prefixed, which keeps it out of every vault walk and
 * the chokidar watcher for free (both skip dotfiles), and FIXED per target,
 * so a temp orphaned by a crash is swept up by the next successful save of
 * the same file. Measured on macOS/fsevents: the rename still reaches the
 * watcher as a plain 'change' on the target, so editors and previews see
 * exactly what a bare writeFileSync produced.
 *
 * Symlinks are written THROUGH (vaults support symlinked notes; renaming
 * onto the link itself would replace it with a regular file and orphan the
 * real note), and the target's permissions survive the inode swap.
 */
export function writeFileAtomic(file, data) {
	let target = file;
	try {
		target = fs.realpathSync(file);
	} catch { /* new file — nothing to follow */ }
	const temp = path.join(path.dirname(target), `.${path.basename(target)}.clew-tmp`);
	let mode;
	try {
		mode = fs.statSync(target).mode;
	} catch { /* new file — default mode */ }
	const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
	const fd = fs.openSync(temp, 'w');
	try {
		if (mode !== undefined) fs.fchmodSync(fd, mode);
		for (let off = 0; off < buf.length;) {
			off += fs.writeSync(fd, buf, off);
		}
		fs.fsyncSync(fd);
		fs.closeSync(fd);
	} catch (err) {
		try { fs.closeSync(fd); } catch { /* already closed */ }
		fs.rmSync(temp, { force: true });
		throw err;
	}
	fs.renameSync(temp, target);
}
