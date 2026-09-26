// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Clicks on concealed constructs (plan §5.2, and the §13 decision): a
// concealed link FOLLOWS on click — Obsidian's behaviour — and ⌥-click puts
// the cursor in it instead, which reveals it for editing. ⌘/Ctrl-click opens
// a note link in a new tab. A tag opens the search panel on that tag; a
// block-id badge copies a link to its block; a `:ref[…]` jumps to its
// `:label[…]`. Every rendered stand-in (math, a footnote number, a citation
// chip) reveals its source when clicked.
//
// The targets are read from `data-le-*` attributes the inline layer put on
// the marks and widgets, never re-parsed from the text here.
import { EditorView } from '@codemirror/view';
import * as actions from '../../commands/actions.js';
import { openExternal } from '../../lib/external-links.js';
import { runCommand } from '../../commands/registry.js';
import { setCalloutFold, calloutFolded } from './block-field.js';
import { liveStateField } from './reveal-field.js';

const TARGETS = '[data-le-cell],[data-le-task],[data-le-fold],[data-le-copy],[data-le-goto],[data-le-command],[data-le-href],[data-le-target],[data-le-tag],[data-le-ref],[data-le-blockid],.le-reveal-on-click';

/** Put the cursor at `pos` (revealing whatever is there) and focus. */
function placeCursor(view, pos) {
	view.dispatch({ selection: { anchor: pos } });
	view.focus();
}

export const liveEvents = EditorView.domEventHandlers({
	mousedown(event, view) {
		if (event.button !== 0) return false;
		const el = event.target.closest?.(TARGETS);
		if (!el || !view.contentDOM.contains(el)) return false;
		const revealOnly = el.classList.contains('le-reveal-on-click');
		// ⌥-click edits: CodeMirror places the cursor, the construct reveals.
		if (event.altKey && !revealOnly) return false;
		event.preventDefault();

		if (el.dataset.leCell !== undefined) {
			// A table cell: the cursor to that cell's text, which reveals the
			// table as source (the widget sits at the table's first line).
			const table = el.closest('.le-table-wrap');
			placeCursor(view, view.posAtDOM(table) + Number(el.dataset.leCell));
			return true;
		}
		if (el.dataset.leTask) {
			// The checkbox replaces `[ ]` / `[x]`: flip that one character.
			const pos = view.posAtDOM(el);
			const marker = view.state.doc.sliceString(pos, pos + 3);
			if (/^\[[ xX]\]$/.test(marker)) {
				view.dispatch({
					changes: { from: pos + 1, to: pos + 2, insert: marker[1] === ' ' ? 'x' : ' ' },
					userEvent: 'input.task',
				});
			}
			return true;
		}
		if (el.dataset.leFold) {
			const callout = view.state.field(liveStateField).model.find((c) => c.id === el.dataset.leFold);
			if (callout) {
				view.dispatch({ effects: setCalloutFold.of({ id: callout.id, folded: !calloutFolded(view.state, callout) }) });
			}
			return true;
		}
		if (el.dataset.leCopy) {
			const pos = view.posAtDOM(el);
			const fence = view.state.field(liveStateField).model
				.find((c) => c.kind === 'codeFence' && pos >= c.openLine.from && pos <= c.openLine.to);
			if (fence) navigator.clipboard.writeText(view.state.doc.sliceString(fence.body.from, fence.body.to)).catch(() => {});
			return true;
		}
		if (el.dataset.leGoto) {
			const pos = Math.min(Number(el.dataset.leGoto), view.state.doc.length);
			view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'start' }) });
			view.focus();
			return true;
		}
		if (el.dataset.leCommand) {
			runCommand(el.dataset.leCommand);
			return true;
		}
		if (el.dataset.leBlockid) {
			placeCursor(view, view.posAtDOM(el));
			runCommand('editor:copy-block-ref');
			return true;
		}
		if (el.dataset.leHref) {
			const url = el.dataset.leHref;
			if (/^[a-z][a-z0-9+.-]*:/i.test(url)) openExternal(url);
			else actions.openWikilink(decodeURI(url).replace(/\.(md|jmd)$/i, ''), { newTab: event.metaKey || event.ctrlKey });
			return true;
		}
		if (el.dataset.leExternal) {
			actions.openFileExternally(el.dataset.leExternal);
			return true;
		}
		if (el.dataset.leTarget !== undefined) {
			actions.openWikilink(el.dataset.leTarget, { newTab: event.metaKey || event.ctrlKey });
			return true;
		}
		if (el.dataset.leTag) {
			document.querySelector('clew-app')?.openSearch?.(`tag:#${el.dataset.leTag}`);
			return true;
		}
		if (el.dataset.leRef) {
			const text = view.state.doc.toString();
			const at = text.search(new RegExp(`:label\\[${el.dataset.leRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`));
			placeCursor(view, at === -1 ? view.posAtDOM(el) : at);
			if (at !== -1) view.dispatch({ effects: EditorView.scrollIntoView(at, { y: 'center' }) });
			return true;
		}
		placeCursor(view, view.posAtDOM(el));
		return true;
	},
});
