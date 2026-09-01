// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// <clew-file-view>: viewer tab for non-note files — images, PDFs (Chromium's
// built-in viewer), audio, video — served through clew-preview://.
import { ClewElement } from '../base/clew-element.js';
import { fileKind } from '../../lib/file-types.js';
import { vaultFileUrl, pdfViewerUrl, excalidrawUrl, zetaOfficeUrl } from '../../lib/preview-url.js';

class ClewFileView extends ClewElement {
	tabId = null;
	path = null;

	render() {
		this.classList.add('file-view');
		const url = vaultFileUrl(this.path);
		const kind = fileKind(this.path);

		let el;
		if (kind === 'excalidraw') {
			// The Excalidraw editor, in its own document. React is confined to
			// that iframe and loads only when a drawing is opened.
			el = document.createElement('iframe');
			el.className = 'excalidraw-frame';
			el.allow = 'fullscreen; clipboard-write';
			el.src = excalidrawUrl(this.path);
		} else if (kind === 'image') {
			el = document.createElement('img');
			el.src = url;
			el.alt = this.path;
		} else if (kind === 'pdf') {
			// Our own EmbedPDF page rather than Chromium's plugin, so the tab
			// gains annotation and matches both the note-embed surface and
			// Clew-iOS. Unsandboxed: the viewer fetches the PDF from its own
			// origin.
			el = document.createElement('iframe');
			el.className = 'pdf-frame';
			el.allow = 'fullscreen';
			el.src = pdfViewerUrl(url);
		} else if (kind === 'office') {
			// ZetaOffice (LibreOffice wasm) in its own document, like the PDF
			// viewer: the 160 MB wasm lives on the preview origin, never the
			// app page. Save-back flows over the office-save bridge. One
			// instance at a time (each costs ~1.6 GB — spike decision), so a
			// second office tab gets a notice, not a second LibreOffice.
			const other = [...document.querySelectorAll('iframe.office-frame')]
				.some((frame) => !this.contains(frame));
			if (other) {
				el = document.createElement('div');
				el.className = 'panel-empty';
				el.textContent = 'One office document at a time — close the other office tab, then reopen this one.';
			} else {
				el = document.createElement('iframe');
				el.className = 'office-frame';
				el.src = zetaOfficeUrl(this.path);
			}
		} else if (kind === 'audio') {
			el = document.createElement('audio');
			el.controls = true;
			el.src = url;
		} else if (kind === 'video') {
			el = document.createElement('video');
			el.controls = true;
			el.src = url;
		} else {
			el = document.createElement('div');
			el.className = 'panel-empty';
			el.textContent = 'No viewer for this file type';
		}
		this.replaceChildren(el);
	}
}

customElements.define('clew-file-view', ClewFileView);
