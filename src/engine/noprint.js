// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// `@begin(noprint)` … `@end(noprint)` — what is for the SCREEN only (the
// owner's ask, 2026-11-24: marking essays, the controls at the top of each
// one — a "marked" button, a grade — have no place in the PDF that goes back
// to the student). A Clew environment, as `@reveal` and `@app` are: one entry
// serves `@begin(noprint)`, the block `@noprint+[…]` and the inline
// `@noprint[…]`.
//
// Its body is markdown, drawn in reading view and live edit as anywhere else,
// inside a `.clew-noprint` box that preview.css hides from PRINT — so the
// reading-view PDF (print-pdf.js prints the preview's own document, a note's or
// a book's) leaves it out, with no gap where it was. LaTeX gets nothing, so a
// LaTeX export and a PDF via LaTeX leave it out too. An HTML export keeps it:
// the engine's `web` environment's rule (HTML only), and an export's page has
// no preview.css. Loaded by the preview's generated config (render-service.js
// `Environments`, which the site export shares) and registered by every export
// (export-config.js#EXPORT_ENVIRONMENTS), as the `%%` comments' rules are.
//
// Not the engine's `print`/`web` pair: those choose an OUTPUT FORMAT (LaTeX,
// HTML), and the reading-view PDF is HTML — `@begin(web)` prints there.

export const noprint = {
	mode: 'markdown',
	html: (ctx) => {
		const tag = ctx.inline ? 'span' : 'div';
		return `<${tag} class="clew-noprint">${ctx.inner}</${tag}>`;
	},
	latex: () => '',
};
