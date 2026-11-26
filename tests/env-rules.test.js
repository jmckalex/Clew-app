// Live edit's environment frames, one rule per level (src/renderer/editor/
// live/env-rules.js; the owner's ask, 2026-11-26: with `@end` concealed,
// where does each nested environment end?). Pure: which environments stand
// around a line or a block, outermost first, and the line's style — its
// indent, a rule per level, a foot where a level closes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Text } from '@codemirror/state';
import { envStacks, envRuleStyle, framesAround, frameOf, ENV_RULE_X, ENV_STEP } from '../src/renderer/editor/live/env-rules.js';

const outer = { open: 3, close: 10, foot: true, dashed: true };
const inner = { open: 5, close: 8, foot: true, dashed: false };

test('each line has the environments around it, outermost first', () => {
	const stacks = envStacks([inner, outer]);
	assert.deepEqual([...stacks.keys()].sort((a, b) => a - b), [3, 4, 5, 6, 7, 8, 9, 10]);
	assert.deepEqual(stacks.get(4), [outer]);
	assert.deepEqual(stacks.get(6), [outer, inner], 'outermost first, whatever order they came in');
	assert.deepEqual(stacks.get(9), [outer], 'after the inner one closes, the outer alone');
	assert.deepEqual([...envStacks([outer], (n) => n >= 9).keys()], [9, 10], 'only the lines asked for');
});

test('a line draws a rule per level, a step apart, with its text past the innermost', () => {
	const style = envRuleStyle([outer, inner], 6);
	assert.match(style, new RegExp(`--le-env-x: ${2 * ENV_STEP}px`));
	assert.match(style, /background-size: 2px 100%, 2px 100%;/);
	assert.match(style, new RegExp(`background-position: ${ENV_RULE_X}px 0, ${ENV_RULE_X + ENV_STEP}px 0;`));
	assert.match(style, /background-image: repeating-linear-gradient\(.*\), linear-gradient\(/, 'the clew-only level dashed, the theorem solid');
	assert.match(style, /background-repeat: no-repeat/);
});

test('a level ends in a foot on its own closer, and only there', () => {
	const innerClose = envRuleStyle([outer, inner], 8);
	assert.match(innerClose, /background-size: 2px 100%, 2px 100%, 10px 2px;/);
	assert.match(innerClose, new RegExp(`${ENV_RULE_X + ENV_STEP}px 100%`), 'the inner level\'s foot, at its rule');
	const outerClose = envRuleStyle([outer], 10);
	assert.match(outerClose, /background-size: 2px 100%, 10px 2px;/);
	assert.match(outerClose, new RegExp(`${ENV_RULE_X}px 100%`));
	assert.doesNotMatch(envRuleStyle([{ ...outer, foot: false }], 10), /10px 2px/, 'an unclosed environment has no foot');
	assert.doesNotMatch(envRuleStyle([outer, inner], null), /10px 2px/, 'a block has none');
});

test('a block is inside the environments opened above it and closed below it', () => {
	assert.deepEqual(framesAround([inner, outer], 6, 7), [outer, inner]);
	assert.deepEqual(framesAround([inner, outer], 9, 9), [outer]);
	assert.deepEqual(framesAround([inner, outer], 3, 3), [], 'not inside the one it opens on');
	const unclosed = { open: 2, close: 6, foot: false, dashed: false };
	assert.deepEqual(framesAround([unclosed], 5, 6), [unclosed], 'an unclosed one runs to its last line, the block\'s');
});

test('an environment construct as a frame', () => {
	const doc = Text.of(['a', '@begin(clew-only)', 'x', '@end(clew-only)', 'b']);
	const line = (n) => ({ from: doc.line(n).from, to: doc.line(n).to });
	const c = { openLine: line(2), closeLine: line(4), body: { from: doc.line(3).from, to: doc.line(3).to }, clewOnly: true };
	assert.deepEqual(frameOf(c, doc), { open: 2, close: 4, foot: true, dashed: true });
	assert.deepEqual(frameOf({ ...c, closeLine: null, clewOnly: false }, doc), { open: 2, close: 3, foot: false, dashed: false });
});
