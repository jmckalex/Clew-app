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

const TARGETS = '[data-le-href],[data-le-target],[data-le-tag],[data-le-ref],[data-le-blockid],.le-reveal-on-click';

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
