// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupWarnings, warningSummary } from '../src/shared/build-warnings.js';

const lint = [
	'latex-export [dollars]: "$5 and $10" is read as maths — two dollar amounts? Write \\$ for a dollar sign',
	'latex-export [braces]: an unmatched "}" in "a } b" — LaTeX stops on it; write \\}',
	'latex-export [dollars]: a lone "$" ("costs $3") starts maths in LaTeX that never ends — write \\$ for a dollar sign',
	'bibliography: cannot read "gone.bib" — no such file, so it is left out',
];

test('the lint is grouped by its code, in order of first appearance; the rest is "other"', () => {
	const g = groupWarnings(lint);
	assert.equal(g.total, 4);
	assert.deepEqual(g.codes, [{ code: 'dollars', count: 2 }, { code: 'braces', count: 1 }]);
	assert.equal(g.other, 1);
	assert.equal(g.items[0].code, 'dollars');
	assert.match(g.items[0].text, /^"\$5 and \$10" is read as maths/);
	assert.equal(g.items[3].code, null);
});

test('one line to say it', () => {
	assert.equal(warningSummary(lint), 'LaTeX export: dollars ×2, braces · 1 other');
	assert.equal(warningSummary(['latex-export [package]: \\mathbb needs amssymb']), 'LaTeX export: package');
	assert.equal(warningSummary(['crossref: "x" is not defined']), '1 other');
	assert.equal(warningSummary([]), '');
});

test('the engine\'s lint lines parse as written', async () => {
	// The format is the engine's (latex-lint.js#warn); a code it emits must group.
	const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../vendor/jmarkdown/src/latex-lint.js', import.meta.url), 'utf8'));
	assert.match(src, /`latex-export \[\$\{code\}\]: \$\{message\}`/, 'the engine still writes `latex-export [code]: message`');
	const codes = [...src.matchAll(/warn\('([a-z-]+)'/g)].map((m) => m[1]);
	assert.deepEqual([...new Set(codes)].sort(), ['backslash', 'braces', 'display-math', 'dollars', 'mathjax-only', 'package']);
});
