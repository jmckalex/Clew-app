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
import { vaultFileUrl, pdfViewerUrl, excalidrawUrl } from '../../lib/preview-url.js';
import { officeDock } from '../../office-dock.js';

class ClewFileView extends ClewElement {
	tabId = null;
	path = null;

	subscribe() {
		if (fileKind(this.path) === 'office') {
			// Engine install progress, the one-instance guard freeing up (in
			// this window or another), boots and teardowns — all re-render.
			this.listen(officeDock, 'changed', () => this.render());
		}
	}

	cleanup() {
		officeDock.detach(this);
	}

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
			// ZetaOffice (LibreOffice wasm). The iframe itself belongs to the
			// office dock (an overlay that survives tab switches — see
			// office-dock.js); this view contributes only the host rectangle
			// the dock tracks, or a notice/download panel when it can't run.
			el = this.#officeContent();
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

	#officeContent() {
		const engine = officeDock.engineStatus();
		if (engine.pending) {
			return this.#notice('');
		}
		if (engine.downloading || !engine.installed) {
			return this.#downloadPanel(engine);
		}
		const host = document.createElement('div');
		host.className = 'office-host';
		const { verdict, path } = officeDock.claim(this, host);
		if (verdict === 'mine') return host;
		const which = path ? `“${basename(path)}”` : 'another document';
		return this.#notice(verdict === 'other-window'
			? `One office document at a time — ${which} is open in another window. Close it and this document opens by itself.`
			: `One office document at a time — ${which} is open in another tab. Close it and this document opens by itself.`);
	}

	/**
	 * The first-open offer (and progress) for the LibreOffice engine, which
	 * is downloaded on demand rather than shipped — 53 MB against the pins
	 * in zeta-manifest.json. Settings → Office documents is the same
	 * control with a remove button.
	 */
	#downloadPanel(engine) {
		const panel = document.createElement('div');
		panel.className = 'panel-empty office-download';
		const mb = (bytes) => `${Math.round((bytes ?? 0) / 1048576)} MB`;
		const text = document.createElement('p');
		const detail = document.createElement('p');
		detail.className = 'office-download-detail';
		panel.append(text, detail);
		if (engine.downloading) {
			const p = engine.progress ?? {};
			text.textContent = 'Downloading the office engine…';
			detail.textContent = p.file
				? `${p.file} — ${mb(p.received)}${p.expected ? ` of ${mb(p.expected)}` : ''} (file ${p.done + 1} of ${p.total})`
				: 'Starting…';
			return panel;
		}
		text.textContent = 'Editing Word, Excel and PowerPoint documents in Clew uses LibreOffice, '
			+ `a one-time ${mb(engine.wireBytes)} download. Nothing is fetched until you ask.`;
		if (engine.lastError) {
			detail.textContent = `The last download did not finish: ${engine.lastError}`;
		}
		const button = document.createElement('button');
		button.textContent = `Download LibreOffice (${mb(engine.wireBytes)})`;
		button.addEventListener('click', () => officeDock.downloadEngine());
		panel.append(button);
		return panel;
	}

	#notice(message) {
		const el = document.createElement('div');
		el.className = 'panel-empty';
		el.textContent = message;
		return el;
	}
}

const basename = (p) => String(p ?? '').split('/').pop();

customElements.define('clew-file-view', ClewFileView);
