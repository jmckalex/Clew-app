// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Autosave bridges for the two editors that live in their own documents:
// the PDF viewer's annotations, and the Excalidraw editor's drawings.
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
import { isExcalidrawPath } from '../shared/excalidraw-file.js';

/**
 * Excalidraw saves, app-page side. The editor runs in an iframe under
 * __clew_assets__, so it cannot reach IPC itself and posts here instead.
 *
 * Constrained the same way vault.writePdf is: the path must be a drawing.
 * NOTE_WRITE will happily write any text anywhere, and a preview document is
 * vault-authored content, so the gate is that this bridge only ever forwards
 * a path isExcalidrawPath() recognises.
 */
export function installExcalidrawSaveBridge() {
	window.addEventListener('message', async (event) => {
		const msg = event.data;
		if (!msg || msg.source !== 'clew-excalidraw' || msg.type !== 'excalidraw-save') return;
		const reply = (ok, error) => event.source?.postMessage(
			{ source: 'clew-excalidraw-host', type: 'excalidraw-save-result', id: msg.id, ok, error }, '*');
		if (!isExcalidrawPath(msg.path ?? '')) {
			reply(false, 'not a drawing');
			return;
		}
		try {
			await ipc.invoke(CH.NOTE_WRITE, { path: msg.path, content: msg.text });
			reply(true);
		} catch (err) {
			console.warn('[clew] drawing save failed:', err);
			reply(false, String(err?.message ?? err));
		}
	});
}

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
