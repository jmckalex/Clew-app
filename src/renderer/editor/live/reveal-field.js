// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The live state both decoration providers read: the construct model of the
// current document (live/model.js) and which of its constructs the
// selection reveals (live/reveal.js). A StateField so the block field and
// the inline layer see the same answer in the same transaction.
//
// The value object is REPLACED only when something a provider cares about
// changed — the model (a new document or a finished parse) or the revealed
// set's signature — so providers compare it by identity to skip rebuilds.
// Cursor movement inside prose touches nothing and costs one range test
// per construct.
import { StateField } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { liveModel } from './model.js';
import { revealSet } from './reveal.js';
import { liveConfigFacet } from './config.js';

/**
 * @typedef {object} LiveState
 * @property {object[]} model      liveModel(state)
 * @property {Set<string>} revealed construct ids the selection reveals
 * @property {string} signature    of `revealed`
 * @property {object} config       the liveConfigFacet value it was built with
 */

/** @returns {LiveState} */
function compute(state, previous) {
	const config = state.facet(liveConfigFacet);
	const model = liveModel(state, config);
	const { ids, signature } = revealSet(model, state.selection.ranges, config.reveal);
	if (previous && previous.model === model && previous.signature === signature
		&& previous.config === config) return previous;
	return { model, revealed: ids, signature, config };
}

export const liveStateField = StateField.define({
	create: (state) => compute(state, null),
	update(value, tr) {
		const treeMoved = syntaxTree(tr.state) !== syntaxTree(tr.startState);
		const configMoved = tr.state.facet(liveConfigFacet) !== tr.startState.facet(liveConfigFacet);
		if (!tr.docChanged && !tr.selection && !treeMoved && !configMoved) return value;
		return compute(tr.state, value);
	},
});

/** Is this construct concealed (in the model and not revealed)? */
export function concealed(live, construct) {
	return !live.revealed.has(construct.id);
}
