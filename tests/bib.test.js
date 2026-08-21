import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBib } from '../src/shared/bib.js';

const SAMPLE = `
@book{lewis1969,
	author = {Lewis, David},
	title = {Convention: A Philosophical Study},
	year = {1969}
}

@article{msp1973,
	author = {Maynard Smith, John and Price, George R.},
	title = "The Logic of {Animal} Conflict",
	journal = {Nature},
	year = 1973
}
@comment{ignore me }
@incollection{three,
	author = {A, One and B, Two and C, Three},
	title = {Chapter},
	year = {2001}
}
`;

test('parses keys, types, and fields from both delimiter styles', () => {
	const entries = parseBib(SAMPLE);
	assert.deepEqual(entries.map((e) => e.key), ['lewis1969', 'msp1973', 'three']);
	assert.equal(entries[0].authors, 'Lewis');
	assert.equal(entries[0].year, '1969');
	assert.equal(entries[1].title, 'The Logic of Animal Conflict');
	assert.equal(entries[1].year, '1973');
});

test('author shortening: two names use &, three+ use et al.', () => {
	const entries = parseBib(SAMPLE);
	assert.equal(entries[1].authors, 'Maynard Smith & Price');
	assert.equal(entries[2].authors, 'A et al.');
});

test('entries without blank-line separation still parse', () => {
	const entries = parseBib('@book{a,\n year={1}\n}\n@book{b,\n year={2}\n}');
	assert.deepEqual(entries.map((e) => e.key), ['a', 'b']);
});
