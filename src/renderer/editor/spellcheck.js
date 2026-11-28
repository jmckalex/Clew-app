// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Spell checking in the note editor (the owner's ask, 2026-11-28), source
// mode and live edit alike, and in a live-edit table cell. The checking is
// the PLATFORM's: CodeMirror turns the browser's checker off on its editing
// surface (`spellcheck="false"`), and this turns it back on while the
// setting `spellcheck` says so — macOS's own checker and dictionary under
// Electron, Hunspell's on Windows and Linux (main/spellcheck.js chooses the
// languages and draws the right-click menu), the system's on the iPad, whose
// WKWebView reads the same attribute and draws its own suggestions. What is
// not prose (spell-ranges.js: code, maths, citations, link targets, …) is
// marked `spellcheck="false"`, in the drawn part of the note only — the
// checker sees nothing else. A note over SPELL_MAX_DOC is not checked: the scan the
// marks need is what live edit gives up at the same size. Autocorrect stays
// off (CodeMirror's default), so nothing is changed as you type.
import { EditorView, ViewPlugin, Decoration } from '@codemirror/view';
import { StateEffect } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { scanFor } from './jmd/scan-cache.js';
import { noSpellRanges, NO_SPELL_NODES } from './spell-ranges.js';
import { settingsStore } from '../state/settings-store.js';

/** Live edit's own limit (editor/live/): above it, no checking. */
export const SPELL_MAX_DOC = 500000;
const NO_SPELL = Decoration.mark({ attributes: { spellcheck: 'false' } });
/** The setting changed: re-read it. */
const refresh = StateEffect.define();

/**
 * @param {{ enabled: () => boolean, subscribe?: (fn: () => void) => (() => void) }} source -
 *   whether checking is on (read on every update), and how to hear it change
 * @returns {import('@codemirror/state').Extension}
 */
export function spellcheck({ enabled, subscribe }) {
	const on = (view) => enabled() && view.state.doc.length <= SPELL_MAX_DOC;
	return [
		// A function source is read on every update, so a flip applies at the
		// next one — the plugin below makes one when the setting changes.
		EditorView.contentAttributes.of((view) => (on(view) ? { spellcheck: 'true' } : null)),
		ViewPlugin.fromClass(class {
			constructor(view) {
				this.view = view;
				this.was = on(view);
				this.decorations = this.build(view);
				this.off = subscribe?.(() => {
					if (on(this.view) !== this.was) this.view.dispatch({ effects: refresh.of(null) });
				});
			}

			update(u) {
				const now = on(u.view);
				if (now !== this.was || u.docChanged || u.viewportChanged
					|| syntaxTree(u.state) !== syntaxTree(u.startState)) {
					this.was = now;
					this.decorations = this.build(u.view);
				}
			}

			build(view) {
				if (!on(view) || !view.visibleRanges.length) return Decoration.none;
				const { state } = view;
				const tree = syntaxTree(state);
				const nodes = [];
				for (const { from, to } of view.visibleRanges) {
					tree.iterate({
						from, to,
						enter: (n) => {
							if (!NO_SPELL_NODES.has(n.name)) return undefined;
							nodes.push({ name: n.name, from: n.from, to: n.to });
							return false;
						},
					});
				}
				const within = { from: view.visibleRanges[0].from, to: view.visibleRanges[view.visibleRanges.length - 1].to };
				const ranges = noSpellRanges(scanFor(state.doc), nodes, (a, b) => state.doc.sliceString(a, b), within);
				return Decoration.set(ranges.map(([a, b]) => NO_SPELL.range(a, Math.min(b, state.doc.length))), true);
			}

			destroy() { this.off?.(); }
		}, { decorations: (p) => p.decorations }),
	];
}

/** The note editor's and a live-edit table cell's: the setting `spellcheck`,
 *  on unless it is false (Settings → Appearance → "Check spelling"). */
export const noteSpellcheck = () => spellcheck({
	enabled: () => settingsStore.get('spellcheck') !== false,
	subscribe: (fn) => settingsStore.on('settings-changed', fn),
});
