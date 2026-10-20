// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// One column of a list's indentation as live edit draws it: the width of a
// space in the note's own font, as `--le-col` on the scroller, which
// live-edit.css multiplies a line's --le-indent (its item marker's column,
// inline-layer.js#listIndent) by. A nested item's first line is indented by
// its leading whitespace, DRAWN — spaces, and tabs to their stops in the same
// spaces (tab-size) — while a quote in the item and the item's text past its
// first line are indented by that CSS, their whitespace concealed; the two
// agree only when the column is the font's space. A fixed 0.3em was Avenir
// Next's 0.25em by a fifth: a quote in a nested item stood 2px right of the
// item's text, reading view's 0 (Clew-iOS's measure, 2026-10-20). Measured
// with a canvas — nothing is added to the editor's DOM — as an em of the
// content's font size, so a size setting changes nothing, and again whenever
// the editor's geometry changes, as a new face does.
import { ViewPlugin } from '@codemirror/view';

/** A space's width as an em of the font's size: `0.25em`. Null for nothing measurable. */
export function columnEm(spaceWidth, fontSize) {
	if (!(spaceWidth > 0) || !(fontSize > 0)) return null;
	return `${Math.round((spaceWidth / fontSize) * 10000) / 10000}em`;
}

let context = null;

export const columnWidth = ViewPlugin.fromClass(class {
	constructor(view) {
		this.view = view;
		this.font = null;
		this.schedule();
	}

	update(update) {
		if (update.geometryChanged) this.schedule();
	}

	schedule() {
		this.view.requestMeasure({
			key: this,
			read: (view) => {
				const cs = getComputedStyle(view.contentDOM);
				return { font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, size: parseFloat(cs.fontSize) };
			},
			write: ({ font, size }, view) => {
				if (font === this.font) return;
				this.font = font;
				context ??= document.createElement('canvas').getContext('2d');
				context.font = font;
				const em = columnEm(context.measureText(' ').width, size);
				if (em) view.scrollDOM.style.setProperty('--le-col', em);
				else view.scrollDOM.style.removeProperty('--le-col');
			},
		});
	}

	destroy() {
		this.view.scrollDOM.style.removeProperty('--le-col');
	}
});
