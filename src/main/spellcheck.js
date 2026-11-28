// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Spell checking, the desktop host's side (the owner's ask, 2026-11-28; the
// editor's side is renderer/editor/spellcheck.js). Electron's checker is the
// session's: macOS's own on a Mac (its languages the system's, nothing
// downloaded), Hunspell on Windows and Linux, whose dictionaries Chromium
// downloads from Google's servers the first time a language is used (the
// owner's choice: Electron's default; no typed word is ever sent). This turns
// it on or off with the setting `spellcheck`, chooses the dictionaries off
// the Mac (`spellcheckLanguages`, else the system's — spell-menu.js), and
// draws the right-click menu of an editable place, which Electron does not.
//
// Under CLEW_SMOKE the menu is never drawn (a native menu would hold the
// harness): `smoke-context-menu: …` says what it would hold, and the item a
// scenario names in `window.__clewSmokeMenuChoice` is carried out — but
// Learn Spelling only logs `smoke-spell-learn: <word>`, because on macOS and
// Windows Electron writes the word into the OS's own dictionary as well.
// `CLEW_SMOKE_SPELL_LANGUAGES=1` shows the languages row on a Mac
// (`setSpellCheckerLanguages` is a no-op there), so a scenario can drive it.
import { app, Menu, session as electronSession } from 'electron';
import { settings } from './settings.js';
import { editMenuItems, spellLanguages } from './spell-menu.js';

const SMOKE = Boolean(process.env.CLEW_SMOKE);

/** Whether this host lets the user choose the dictionaries. */
const choosesLanguages = () => process.platform !== 'darwin' || (SMOKE && process.env.CLEW_SMOKE_SPELL_LANGUAGES === '1');

/** The dictionaries for the setting, and the codes Electron does not have. */
function languagesFor(ses) {
	return spellLanguages(settings.get('spellcheckLanguages'), ses.availableSpellCheckerLanguages, app.getPreferredSystemLanguages());
}

/** The setting onto the session: at launch, and when either key changes. */
export function applySpellSettings(ses = electronSession.defaultSession) {
	const on = settings.get('spellcheck') !== false;
	ses.setSpellCheckerEnabled(on);
	// Off the Mac only: there the OS checker follows the system, and the
	// call is a no-op. Off, nothing is asked for — and nothing downloaded.
	if (process.platform === 'darwin' || !on) return;
	const { languages } = languagesFor(ses);
	try {
		if (languages.length) ses.setSpellCheckerLanguages(languages);
	} catch (err) {
		console.warn('spellcheck languages:', err?.message ?? err);
	}
}

/** For Settings: whether languages can be chosen here, and what is in use. */
export function spellInfo(ses = electronSession.defaultSession) {
	const { languages, unknown, fromSystem } = languagesFor(ses);
	return {
		chooseLanguages: choosesLanguages(),
		platform: process.platform,
		available: ses.availableSpellCheckerLanguages,
		languages: process.platform === 'darwin' ? ses.getSpellCheckerLanguages() : languages,
		unknown,
		fromSystem,
	};
}

/** Carry out a menu item. */
function perform(win, item, word) {
	const contents = win.webContents;
	if (item.action?.kind === 'replace') contents.replaceMisspelling(item.action.word);
	else if (item.action?.kind === 'learn') {
		if (SMOKE) console.log(`smoke-spell-learn: ${word}`);
		else contents.session.addWordToSpellCheckerDictionary(word);
	} else if (item.role) contents[item.role]?.();
}

/** The right-click menu of an editable place in `win` (spell-menu.js). */
export function attachEditMenu(win) {
	win.webContents.on('context-menu', async (_event, params) => {
		const items = editMenuItems(params);
		if (!items.length || win.isDestroyed()) return;
		const word = params.misspelledWord ?? '';
		if (SMOKE) {
			const said = items.map((i) => (i.type === 'separator' ? '-' : `${i.label}${i.enabled === false ? '(off)' : ''}`)).join('|');
			// (Electron's `spellcheckEnabled` is not said: it reads false while
			// the checker marks words — measured, Electron 43.)
			console.log(`smoke-context-menu: misspelled=${word} items=${said}`);
			const choice = await win.webContents.executeJavaScript('window.__clewSmokeMenuChoice ?? null').catch(() => null);
			const item = choice && items.find((i) => i.label === choice && i.enabled !== false);
			if (item) perform(win, item, word);
			return;
		}
		const template = items.map((item) => (item.type === 'separator' ? { type: 'separator' } : {
			label: item.label,
			enabled: item.enabled !== false,
			click: () => perform(win, item, word),
		}));
		Menu.buildFromTemplate(template).popup({ window: win, frame: params.frame ?? undefined });
	});
}
