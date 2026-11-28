// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The desktop host's half of spell checking (the owner's ask, 2026-11-28),
// pure: what the right-click menu of an editable place offers, and which
// Hunspell dictionaries to ask for on Windows and Linux. main/spellcheck.js
// hands them Electron's values. Electron shows no menu of its own, so until
// this a right-click in a note did nothing. The iPad's WKWebView draws its own
// suggestions and has nothing to take from here.

/**
 * The menu for a right-click: the checker's suggestions for a misspelt word,
 * Learn Spelling (macOS's name; "Add to Dictionary" elsewhere), then Cut,
 * Copy, Paste and Select All — for an editable place only. Electron's
 * `context-menu` fires only where the page did not take the right-click
 * itself (a live-edit table's menu, the explorer's, a tab's).
 *
 * @param {{ isEditable?: boolean, misspelledWord?: string,
 *   dictionarySuggestions?: string[], editFlags?: { canCut?: boolean,
 *   canCopy?: boolean, canPaste?: boolean, canSelectAll?: boolean } }} params -
 *   Electron's ContextMenuParams
 * @param {{ platform?: string }} [host]
 * @returns {({ type: 'separator' } | { label: string, enabled?: boolean,
 *   role?: 'cut'|'copy'|'paste'|'selectAll',
 *   action?: { kind: 'replace'|'learn', word: string } })[]}
 */
export function editMenuItems(params, { platform = process.platform } = {}) {
	if (!params?.isEditable) return [];
	const items = [];
	const word = params.misspelledWord ?? '';
	if (word) {
		const suggestions = (params.dictionarySuggestions ?? []).filter(Boolean).slice(0, 6);
		for (const s of suggestions) items.push({ label: s, action: { kind: 'replace', word: s } });
		if (!suggestions.length) items.push({ label: 'No Guesses Found', enabled: false });
		items.push({ type: 'separator' });
		items.push({ label: platform === 'darwin' ? 'Learn Spelling' : 'Add to Dictionary', action: { kind: 'learn', word } });
		items.push({ type: 'separator' });
	}
	const flags = params.editFlags ?? {};
	items.push(
		{ label: 'Cut', role: 'cut', enabled: Boolean(flags.canCut) },
		{ label: 'Copy', role: 'copy', enabled: Boolean(flags.canCopy) },
		{ label: 'Paste', role: 'paste', enabled: Boolean(flags.canPaste) },
		{ type: 'separator' },
		{ label: 'Select All', role: 'selectAll', enabled: Boolean(flags.canSelectAll) },
	);
	return items;
}

/** `en_gb` and ` EN-GB ` are `en-GB`'s spelling. */
const norm = (code) => String(code ?? '').trim().replace(/_/g, '-').toLowerCase();

/**
 * The Hunspell dictionaries to ask for (Windows and Linux; macOS's checker
 * follows the system's own languages): the codes the setting names that
 * Electron has — `en_gb` read as `en-GB` — else the first of the system's
 * preferred languages Electron has a dictionary for, as itself, then its
 * language alone (`de-CH` → `de`), then the first of that language Electron
 * has — one, as Electron's own default is the system locale's — else
 * `en-US`, Electron's fallback. A code Electron does not have is returned as `unknown`, for the
 * settings row to name — `setSpellCheckerLanguages` throws on one.
 *
 * @param {unknown} wanted - the setting `spellcheckLanguages`
 * @param {string[]} available - session.availableSpellCheckerLanguages
 * @param {string[]} preferred - app.getPreferredSystemLanguages()
 * @returns {{ languages: string[], unknown: string[], fromSystem: boolean }}
 */
export function spellLanguages(wanted, available, preferred) {
	const byNorm = new Map((available ?? []).map((code) => [norm(code), code]));
	const languages = [];
	const unknown = [];
	const add = (code) => { if (code && !languages.includes(code)) languages.push(code); };
	for (const code of Array.isArray(wanted) ? wanted : []) {
		if (!norm(code)) continue;
		const hit = byNorm.get(norm(code));
		if (hit) add(hit);
		else unknown.push(String(code).trim());
	}
	if (languages.length) return { languages, unknown, fromSystem: false };
	for (const locale of preferred ?? []) {
		const exact = byNorm.get(norm(locale));
		const base = norm(locale).split('-')[0];
		const match = exact ?? byNorm.get(base)
			?? (available ?? []).find((code) => norm(code).startsWith(`${base}-`));
		if (match) { add(match); break; }
	}
	if (!languages.length && byNorm.has('en-us')) add(byNorm.get('en-us'));
	return { languages, unknown, fromSystem: true };
}
