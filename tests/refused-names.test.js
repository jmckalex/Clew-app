import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refusedNames } from '../src/shared/refused-names.js';

test('reads each refused construct once, in document order, entities decoded', () => {
	const html = '<div class="jmd-error jmd-refused" data-jmd-refused="Load javascript">[…]</div>'
		+ '<p>x <span class="jmd-refused" data-jmd-refused="Math">[…]</span> y '
		+ '<span data-jmd-refused="Math">[…]</span> <span data-jmd-refused="a &amp; &quot;b&quot; &lt;c&gt;">…</span></p>';
	assert.deepEqual(refusedNames(html), ['Load javascript', 'Math', 'a & "b" <c>']);
});

test('a document with nothing refused reads empty', () => {
	assert.deepEqual(refusedNames('<p>plain</p>'), []);
	assert.deepEqual(refusedNames(''), []);
});
