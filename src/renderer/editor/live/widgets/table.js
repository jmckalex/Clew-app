// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// A markdown table drawn as a real <table> (plan §5.5a, Tier B): built from
// the lezer tree's rows and cells, alignment from the delimiter row
// (tables.js#alignmentOf), each cell's inline markdown through the inline
// subset renderer (live/inline-dom.js). Clicking a cell puts the cursor at
// that cell's text — the block reveals as source, and the table keymap
// (Tab/Enter walk the cells) takes over; in-place cell editing is v2.
//
// Cells carry their offset from the table's first line, not a document
// position, so an edit ABOVE the table changes nothing here (`eq` is the
// table's source text); events.js adds the offset to where the widget sits.
import { WidgetType } from '@codemirror/view';
import { tokensToDom } from '../inline-dom.js';
import { mathElement } from './math.js';

export class TableWidget extends WidgetType {
	/**
	 * @param {string} source - the table's text (the identity)
	 * @param {{header: boolean, cells: {tokens: object[], offset: number}[]}[]} rows
	 * @param {(string|null)[]} align - per column
	 */
	constructor(source, rows, align) {
		super();
		this.source = source;
		this.rows = rows;
		this.align = align;
	}

	eq(other) { return other instanceof TableWidget && other.source === this.source; }

	toDOM() {
		const wrap = document.createElement('div');
		wrap.className = 'le-table-wrap';
		const table = document.createElement('table');
		table.className = 'le-table';
		const head = document.createElement('thead');
		const body = document.createElement('tbody');
		for (const row of this.rows) {
			const tr = document.createElement('tr');
			row.cells.forEach((cell, i) => {
				const td = document.createElement(row.header ? 'th' : 'td');
				if (this.align[i]) td.style.textAlign = this.align[i];
				td.dataset.leCell = String(cell.offset);
				td.append(tokensToDom(cell.tokens, mathElement));
				tr.append(td);
			});
			(row.header ? head : body).append(tr);
		}
		table.append(head, body);
		wrap.append(table);
		return wrap;
	}

	get estimatedHeight() { return 32 * this.rows.length + 8; }

	ignoreEvent(event) { return event.type !== 'mousedown'; }
}
