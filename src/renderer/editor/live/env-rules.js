// Live edit's environment frames, one rule per LEVEL (the owner's ask,
// 2026-11-26: "without the @end marker shown, it will remain ambiguous").
// Every line inside `@begin(x)` … `@end(x)` (or a `:::x` directive) carries a
// rule for each environment around it, outermost first, a step apart; an
// environment's closing line ends its own rule in a foot — └ — so where each
// one ends reads with its `@end` concealed, and its opening line starts it
// with one turned over — ┌ — (the owner's ask the same day: a foot at the
// bottom alone looked odd). `@begin(clew-only)`'s rule is dashed, on its own
// level only; its feet are solid.
//
// Until then each environment drew a border on its lines, and a line has one
// border: a theorem inside a clew-only block shared the block's rule at the
// same indent, its end shown only by a blank line, and the text after it read
// as the theorem's. The rules are a line's background layers (an inline style,
// one per line, from the whole stack), never borders.
//
// A BLOCK inside an environment — display maths, a table, a diagram's frame —
// is no line, so block-field.js wraps its widget (widgets/framed-block.js) in
// a box with the same rules and indent: the rules run through it, and it
// stands inside its frame, not across the page.
//
// Pure: inline-layer.js and block-field.js hand in the model's environments
// and ask for a line's or a block's style.

/** Where the outermost rule stands: the line's own padding (theme.js's
 *  `.cm-line { padding: 0 24px }`), where text starts outside any frame. */
export const ENV_RULE_X = 24;
/** One level's step: each rule, and the text inside the innermost, this far
 *  in from the last. 22px is what a frame's text stood in before levels. */
export const ENV_STEP = 22;

const INK = 'var(--clew-accent)';
const SOLID = `linear-gradient(${INK}, ${INK})`;
const DASHED = `repeating-linear-gradient(${INK} 0 4px, transparent 4px 7px)`;

/** An environment or directive construct (live/model.js) as a frame: its
 *  first and last line numbers, whether it closes (an unclosed one has no
 *  foot), whether its rule is dashed. */
export function frameOf(c, doc) {
	const bodyTo = c.body?.end ?? c.body?.to ?? c.to;
	return {
		open: doc.lineAt(c.openLine.from).number,
		close: doc.lineAt(c.closeLine ? c.closeLine.from : bodyTo).number,
		foot: Boolean(c.closeLine),
		dashed: Boolean(c.clewOnly),
	};
}

/** The frames around a block on lines `first`…`last`, outermost first:
 *  opened above it and closed below it (an unclosed one runs to its body's
 *  last line, which may be the block's). */
export function framesAround(frames, first, last) {
	return frames
		.filter((f) => f.open < first && (f.foot ? f.close > last : f.close >= last))
		.sort((a, b) => a.open - b.open || b.close - a.close);
}

/**
 * Every line in `frames` mapped to the environments around it, outermost
 * first. A frame: `{ open, close, foot, dashed }` — its first and last line
 * numbers, whether its last is a closer (an unclosed environment has no
 * foot), and whether its rule is dashed. `wanted(n)` limits it to the lines
 * drawn (the viewport).
 *
 * @returns {Map<number, object[]>}
 */
export function envStacks(frames, wanted = () => true) {
	const stacks = new Map();
	for (const f of frames) {
		for (let n = f.open; n <= f.close; n += 1) {
			if (!wanted(n)) continue;
			const stack = stacks.get(n);
			if (stack) stack.push(f);
			else stacks.set(n, [f]);
		}
	}
	// Outermost first: the one opened earlier, and of two opened on one line
	// (never, in the dialect) the longer.
	for (const stack of stacks.values()) stack.sort((a, b) => a.open - b.open || b.close - a.close);
	return stacks;
}

/**
 * The style of line `n` inside `stack`: `--le-env-x`, how far its text stands
 * in (live-edit.css pads by it), and one rule per level as background layers —
 * with a foot along the top where `n` is that level's opener (┌) and along the
 * bottom where it is its closer (└; none for an unclosed environment). A
 * block's is asked with no line (`n` null): no foot.
 */
export function envRuleStyle(stack, n) {
	const images = [];
	const sizes = [];
	const positions = [];
	stack.forEach((f, level) => {
		const x = `${ENV_RULE_X + level * ENV_STEP}px`;
		images.push(f.dashed ? DASHED : SOLID);
		sizes.push('2px 100%');
		positions.push(`${x} 0`);
		if (n === f.open) {
			images.push(SOLID);
			sizes.push('10px 2px');
			positions.push(`${x} 0`);
		}
		if (f.foot && n === f.close) {
			images.push(SOLID);
			sizes.push('10px 2px');
			positions.push(`${x} 100%`);
		}
	});
	return [
		`--le-env-x: ${stack.length * ENV_STEP}px`,
		`background-image: ${images.join(', ')}`,
		`background-size: ${sizes.join(', ')}`,
		`background-position: ${positions.join(', ')}`,
		'background-repeat: no-repeat',
	].join('; ');
}
