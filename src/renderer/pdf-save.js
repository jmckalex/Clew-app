// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// PDF annotation autosave, app-page side.
//
// PDF viewers run in three different frames (a rendered note preview, the
// file tab's viewer page, a canvas node's viewer page) but all three are
// children of this window and all three post the same message, so one
// listener serves them rather than three near-identical cases in three
// components.
//
// This is NOT a general binary-write channel for previews: main-side
// vault.writePdf refuses anything that is not an existing .pdf inside the
// vault, so the worst a hostile note could do with it is overwrite a PDF the
// user already has — the same thing annotating does on purpose.
import { ipc } from './ipc.js';
import { CH } from '../shared/channels.js';

export function installPdfSaveBridge() {
	window.addEventListener('message', async (event) => {
		const msg = event.data;
		if (!msg || msg.source !== 'clew-pdf' || msg.type !== 'pdf-save') return;
		const reply = (ok, error) => event.source?.postMessage(
			{ source: 'clew-pdf-host', type: 'pdf-save-result', id: msg.id, ok, error }, '*');
		try {
			await ipc.invoke(CH.PDF_WRITE, { path: msg.path, bytes: msg.bytes });
			reply(true);
		} catch (err) {
			console.warn('[clew] PDF save failed:', err);
			reply(false, String(err?.message ?? err));
		}
	});
}
