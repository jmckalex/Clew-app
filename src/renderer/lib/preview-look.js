// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// What a rendered document is told of the app's look — one message, so every
// host of a note's rendering (reading view, a link preview, live edit's block
// frames, canvas cards; the print view's is main's, print-pdf.js) says the
// same: its theme, and how its paragraphs are set apart (Settings →
// Appearance → Paragraphs, the owner's choice 2026-11-28: `spaced`, a line of
// space between them, or `indented`, each new one indented as in a book).
// preview-client/client.js puts both on the document's <html>; preview.css
// does the rest.
import { settingsStore } from '../state/settings-store.js';

/** The settings a rendered document's look follows. */
export const LOOK_KEYS = new Set(['theme', 'readingParagraphs']);

/** How paragraphs are set apart: 'spaced' unless the setting says 'indented'. */
export const paragraphStyle = () => (settingsStore.get('readingParagraphs') === 'indented' ? 'indented' : 'spaced');

/** The `theme` message a preview document is sent. */
export const themeMessage = () => ({ type: 'theme', theme: document.body.dataset.theme ?? 'dark', paragraphs: paragraphStyle() });
