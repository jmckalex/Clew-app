// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// An `@app[…]` embed in a preview document (docs/dev/frame-bridge.md §7):
// main resolved it as the document was served (app-embeds-rewrite.js — key,
// name, entry URL on its own origin). This tells the HOST (the app page,
// window.top) the embed is here, and builds the frame only when the host
// says the app may run: in a vault this device has not trusted, that is
// after the user's answer (R1, choice B). The frame is sandboxed —
// `allow-scripts allow-same-origin allow-forms` is safe because its origin
// is not this document's — and carries no referrer, so this document's URL
// (which holds the session id) never reaches it. The `<clew-app-embed>` is a
// custom element, so a re-render keeps the running frame.
import { topOrigin, postTo } from '../shared/message-guard.js';

const asked = new WeakSet();

function label(el, text) {
	let span = el.querySelector(':scope > .clew-app-label');
	if (!span) {
		span = document.createElement('span');
		span.className = 'clew-app-label';
		el.prepend(span);
	}
	span.textContent = text;
	span.hidden = !text;
}

function embedsFor(key) {
	return [...document.querySelectorAll('clew-app-embed[data-app-key]')].filter((el) => el.dataset.appKey === key);
}

function start(el) {
	if (el.querySelector(':scope > iframe.clew-app-frame')) return;
	const frame = document.createElement('iframe');
	frame.className = 'clew-app-frame';
	frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
	frame.setAttribute('referrerpolicy', 'no-referrer');
	frame.title = el.dataset.appName ?? 'App';
	el.append(frame);
	frame.src = el.dataset.appSrc;   // after insertion: a parser-made frame detached early never loads
	label(el, '');
}

function stop(el, text) {
	el.querySelector(':scope > iframe.clew-app-frame')?.remove();
	label(el, text);
}

/** Announce every embed not yet announced (on load, and after a re-render). */
export function scanAppEmbeds() {
	for (const el of document.querySelectorAll('clew-app-embed[data-app-key]')) {
		if (asked.has(el)) continue;
		asked.add(el);
		label(el, el.dataset.appRestricted ? `${el.dataset.appName ?? 'App'} — waiting for your answer` : `${el.dataset.appName ?? 'App'} — starting…`);
		postTo(window.top, { source: 'clew-preview', type: 'app-embed', key: el.dataset.appKey, notePath: el.dataset.appNote ?? null }, topOrigin());
	}
}

window.addEventListener('message', (event) => {
	if (event.source !== window.top) return;
	const msg = event.data;
	if (msg?.source !== 'clew-preview-host' || typeof msg.key !== 'string') return;
	if (msg.type === 'app-run') {
		for (const el of embedsFor(msg.key)) start(el);
	} else if (msg.type === 'app-denied') {
		for (const el of embedsFor(msg.key)) stop(el, `${el.dataset.appName ?? 'App'} — not allowed to run here (Settings → This vault → Apps)`);
	} else if (msg.type === 'app-reload') {
		// Its grants changed: start over — the host asks again if it must.
		for (const el of embedsFor(msg.key)) {
			stop(el, '');
			asked.delete(el);
		}
		scanAppEmbeds();
	}
});
