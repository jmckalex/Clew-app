// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Live edit's static configuration: the facts every live-edit extension
// reads that come from settings rather than from the document. Held in a
// facet, so a settings change is ONE compartment reconfiguration of every
// live editor (editorPool.reconfigureLive) rather than each extension
// listening for itself.
import { Facet } from '@codemirror/state';

/**
 * @typedef {object} LiveConfig
 * @property {boolean} normalSyntax   the vault's dialect switch
 * @property {'construct'|'line'} reveal  what the cursor reveals
 * @property {boolean} renderMath     typeset math in place
 * @property {boolean} renderFences   engine frames for rich fences
 * @property {boolean} renderEmbeds   engine frames for embeds and media
 * @property {number} frameCap        live block documents per editor
 * @property {string[]} richFences    extra fence names plugins render
 * @property {string|null} notePath   the note this editor holds (vault-relative)
 */

/** @type {LiveConfig} */
export const DEFAULT_LIVE_CONFIG = Object.freeze({
	normalSyntax: false,
	reveal: 'construct',
	renderMath: true,
	renderFences: true,
	renderEmbeds: true,
	frameCap: 16,
	richFences: [],
	notePath: null,
});

export const liveConfigFacet = Facet.define({
	combine: (values) => values.length ? values[values.length - 1] : DEFAULT_LIVE_CONFIG,
});

/**
 * The config from the app settings and the vault's settings.
 *
 * @param {{ get(key: string): any }} settings
 * @param {{ get(key: string): any }} vaultSettings
 * @returns {LiveConfig}
 */
export function readLiveConfig(settings, vaultSettings) {
	const cap = Number(settings.get('liveFrameCap'));
	return {
		normalSyntax: vaultSettings.get('normalSyntax') === true,
		reveal: settings.get('liveReveal') === 'line' ? 'line' : 'construct',
		renderMath: settings.get('liveRenderMath') !== false,
		renderFences: settings.get('liveRenderFences') !== false,
		renderEmbeds: settings.get('liveRenderEmbeds') !== false,
		frameCap: Number.isFinite(cap) ? Math.min(64, Math.max(4, Math.round(cap))) : 16,
		richFences: [],
		notePath: null,
	};
}
