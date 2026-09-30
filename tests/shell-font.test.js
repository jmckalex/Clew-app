import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridFontFamily } from '../src/renderer/lib/shell-font.js';

test('the default list: Clew mono face first, symbol faces after, monospace last', () => {
	const list = gridFontFamily('', "'SF Mono', Menlo, Consolas, monospace");
	assert.ok(list.startsWith("'SF Mono', Menlo, Consolas, "));
	assert.ok(list.includes("'Hack Nerd Font Mono'"));
	assert.ok(list.includes("'Fira Mono for Powerline'"));
	assert.ok(list.endsWith(', monospace'));
	assert.equal(list.split('monospace').length - 1, 1, 'the generic family once, at the end');
});

test('the shellFont setting goes first, quoted when it needs it', () => {
	assert.ok(gridFontFamily('MesloLGS NF', 'Menlo').startsWith("'MesloLGS NF', Menlo, "));
	assert.ok(gridFontFamily('Menlo', "'SF Mono'").startsWith("Menlo, 'SF Mono', "));
	// A list as typed is kept as typed.
	assert.ok(gridFontFamily("'Iosevka Term', Menlo", "'SF Mono'").startsWith("'Iosevka Term', Menlo, 'SF Mono', "));
});

test('no mono token at all still yields a usable list', () => {
	const list = gridFontFamily(undefined, '');
	assert.ok(list.startsWith("'SF Mono', Menlo, "));
});
