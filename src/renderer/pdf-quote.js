// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Quote-and-cite from a PDF (FEATURE-IDEAS #2): text selected in any PDF
// viewer — a tab, a canvas card, a note's embed — goes into the note being
// written, at its cursor, as a blockquote with a citation and a link back
// to the page. The pure half (the text, the escaping, where it goes) is
// shared/pdf-quote.js; the viewer's half is preview-client/pdf-core.js.
//
// Two ways in, one way out: the "Quote in note" item in the viewer's own
// selection menu sends the quote unasked, and the `pdf:quote-selection`
// command asks the document that last reported a selection for it. Both
// arrive here as one `pdf-quote` message.
import { workspaceStore } from './state/workspace-store.js';
import { vaultStore } from './state/vault-store.js';
import { vaultSettingsStore } from './state/vault-settings-store.js';
import { editorPool } from './editor/pool.js';
import { ipc, CH } from './ipc.js';
import { notice } from './plugins.js';
import { openListModal } from './components/modals/list-modal.js';
import { fromPreviewOrigin, postTo } from '../shared/message-guard.js';
import { cleanPdfText, quoteBlock, placeQuote } from '../shared/pdf-quote.js';

const REQUEST_TIMEOUT_MS = 3000;

/** The document whose viewer holds the newest selection, as the viewers
 *  report it: { source: WindowProxy, origin }. */
let selection = null;
const pending = new Map();
let requestSeq = 0;
/** The note tab most recently active in an editing mode. */
let lastNoteTab = null;

const editing = (tab) => tab?.kind === 'note' && Boolean(tab.path) && tab.view?.mode !== 'reading';

/**
 * The note the quote goes into: the active tab when it is a note being
 * edited; else the note last edited (a PDF opened beside it, or in its
 * place, has taken the focus); else the one note being edited on screen.
 * A note in reading mode has no cursor and is never written into.
 */
function targetNote() {
	const active = workspaceStore.activeTab();
	if (editing(active)) return active;
	const last = lastNoteTab && workspaceStore.findTab(lastNoteTab)?.tab;
	if (editing(last)) return last;
	const shown = workspaceStore.allGroups()
		.map((g) => g.tabs.find((t) => t.id === g.activeTabId))
		.filter(editing);
	return shown.length === 1 ? shown[0] : null;
}

/** The PDF as a wikilink target: its name when no other file in the vault
 *  has that name, else its vault path. */
function linkTarget(path) {
	const name = path.split('/').pop();
	let same = 0;
	const walk = (entries) => {
		for (const e of entries ?? []) {
			if (e.type === 'folder') walk(e.children);
			else if (e.path.split('/').pop() === name) same += 1;
		}
	};
	walk(vaultStore.tree);
	return same > 1 ? path : name;
}

/**
 * The .bib entry whose `file` field names this PDF. One → its key. Several
 * (a chapter and its book), or none while the vault has a bibliography →
 * a picker. No bibliography at all → no citation, and a notice says why.
 * @returns {Promise<{ key: string|null, cancelled?: boolean, why?: string }>}
 */
async function citationKey(path) {
	const entries = await ipc.invoke(CH.BIB_ENTRIES).catch(() => []);
	const exact = entries.filter((e) => e.pdf?.inVault && e.pdf.path === path);
	if (exact.length === 1) return { key: exact[0].key };
	if (!entries.length) return { key: null, why: 'this vault has no .bib file' };
	const name = path.split('/').pop().toLowerCase();
	// A .bib written on another machine names the file by a path that is not
	// this one; the same file NAME is the next best hint, offered first.
	const named = exact.length ? exact : entries.filter((e) => e.pdf?.path?.split(/[\\/]/).pop().toLowerCase() === name);
	const rest = exact.length ? [] : entries.filter((e) => !named.includes(e));
	const row = (e, hint) => ({
		label: e.key,
		detail: [e.authors, e.year, e.title].filter(Boolean).join(' · '),
		hint,
		run: () => resolveKey({ key: e.key }),
	});
	if (document.querySelector('.clew-modal')) return { key: null, cancelled: true };
	let resolveKey;
	const chosen = new Promise((resolve) => { resolveKey = resolve; });
	const file = path.split('/').pop();
	openListModal({
		placeholder: exact.length
			? `Several entries name ${file} — cite which?`
			: `No .bib entry names ${file} in its file field — cite which entry?`,
		items: [
			{ label: 'Quote without a citation', detail: 'just the text and the page link', run: () => resolveKey({ key: null }) },
			...named.map((e) => row(e, exact.length ? 'names this PDF' : 'same file name')),
			...rest.map((e) => row(e)),
		],
	});
	// The modal says nothing when dismissed; notice its removal instead.
	const modal = document.querySelector('.clew-modal');
	if (modal) {
		new MutationObserver((_, obs) => {
			if (!modal.isConnected) { obs.disconnect(); setTimeout(() => resolveKey({ key: null, cancelled: true }), 0); }
		}).observe(document.body, { childList: true });
	}
	return chosen;
}

/** Put a viewer's `pdf-quote` into the note being written. */
async function quote(msg) {
	if (msg.empty) { notice('Select some text in a PDF first.'); return; }
	if (msg.error === 'copy-denied') { notice('This PDF does not allow its text to be copied.'); return; }
	if (msg.error) { notice(`Could not read the selection: ${msg.error}`); return; }
	if (msg.remote) {
		notice('This PDF is from the web — save a copy to the vault (Save a copy, above it) and quote from the copy.', 6000);
		return;
	}
	const text = cleanPdfText(msg.text ?? []);
	if (!text) { notice('The selection has no text in it (a scanned page?).'); return; }
	const tab = targetNote();
	if (!tab) {
		notice('No note is being edited — open one in source or live mode and put the cursor where the quote should go.', 6000);
		return;
	}
	const path = String(msg.path);
	const page = Number(msg.page) || 1;
	const { key, cancelled, why } = await citationKey(path);
	if (cancelled) return;
	// Asked again: the picker may have taken a while, and the tab with it.
	const view = editorPool.get(tab.id)?.view;
	if (!view || !workspaceStore.findTab(tab.id)) { notice('The note closed before the quote could go in.'); return; }
	const block = quoteBlock({
		text, page, key, link: linkTarget(path),
		pandoc: vaultSettingsStore.get('pandocCitations') === true,
		normalSyntax: vaultSettingsStore.get('normalSyntax') === true,
	});
	const at = view.state.selection.main.to;
	const place = placeQuote(view.state.doc.toString(), at, block);
	view.dispatch({
		changes: { from: place.from, to: place.to, insert: place.insert },
		selection: { anchor: place.cursor },
		scrollIntoView: true,
		userEvent: 'input.paste',
	});
	// The tab's recorded cursor too: the host restores it when the note is
	// shown again (a mode switch, a split), and a recorded spot from before
	// the insert would now be inside the quote.
	const head = view.state.selection.main.head;
	workspaceStore.updateTabView(tab.id, { cursor: { anchor: head, head }, cursorLine: view.state.doc.lineAt(head).number });
	const name = tab.path.split('/').pop().replace(/\.(md|jmd)$/i, '');
	notice(why ? `Quoted p. ${page} into ${name}, without a citation: ${why}.` : `Quoted p. ${page} into ${name}.`);
}

/** The command: ask the document holding the newest selection for it. */
export function quoteSelection() {
	if (!selection || selection.source.closed) { notice('Select some text in a PDF first.'); return Promise.resolve(); }
	const requestId = ++requestSeq;
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			pending.delete(requestId);
			notice('The PDF did not answer — select the text again.');
			resolve();
		}, REQUEST_TIMEOUT_MS);
		pending.set(requestId, (msg) => { clearTimeout(timer); quote(msg).finally(resolve); });
		postTo(selection.source, { source: 'clew-pdf-host', type: 'pdf-quote-request', requestId }, selection.origin);
	});
}

/** True when a viewer has reported a selection (the command's `when`). */
export const hasPdfSelection = () => Boolean(selection && !selection.source.closed);

export function installPdfQuote() {
	const track = () => {
		const tab = workspaceStore.activeTab();
		if (editing(tab)) lastNoteTab = tab.id;
	};
	workspaceStore.on('active-changed', track);
	workspaceStore.on('layout-changed', track);
	window.addEventListener('message', (event) => {
		// A viewer anywhere under this page: a tab's or canvas card's frame, a
		// note's embed, a canvas scene inside a note — all on the preview origin.
		if (!fromPreviewOrigin(event)) return;
		const msg = event.data;
		if (msg?.source !== 'clew-pdf') return;
		if (msg.type === 'pdf-selection') {
			if (msg.has) selection = { source: event.source, origin: event.origin };
			else if (selection?.source === event.source) selection = null;
		} else if (msg.type === 'pdf-quote') {
			if (msg.requestId != null) {
				const answer = pending.get(msg.requestId);
				pending.delete(msg.requestId);
				answer?.(msg);
			} else quote(msg);
		}
	});
}
