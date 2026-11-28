/*
	Joined quotes — `Joined quotes: true` (config, a host through configManager,
	or a document's header; default false). The owner, 2026-11-28, through
	Clew-boss: "the middle way" for a quote inside a paragraph.

	Two things change, and only while the key is on:

	1. A plain blockquote ends at the first line that does not start with `>`
	   (after up to three spaces), as a callout always has (callouts.js). Off,
	   marked's blockquote is CommonMark's: a line with no `>` straight after a
	   quote's text is a lazy continuation, drawn inside the quote. Nested
	   quotes follow the same rule, so in `> > a` / `> b` the `b` leaves the
	   inner quote and stays in the outer one.

	2. Blank lines in the source decide whether a quote joins the paragraph
	   around it. A quote or callout with a paragraph straight before it, no
	   blank line between, is "joined before"; with one straight after it is
	   "joined after", and that paragraph is a continuation. Only a paragraph
	   counts: a list, heading, `text` token (a tight list item's) or any other
	   block beside a quote leaves it as it was.
	   - HTML: `class="jmd-joined-before jmd-joined-after"` on the
	     `<blockquote>` (or the callout's element), each when it holds, and
	     `class="jmd-continued"` on the continuation's `<p>`. Every other
	     attribute (data-source-line) is the renderer's, as before.
	   - LaTeX: no blank line between the paragraph and `\begin{quote}`
	     (joined before), none after `\end{quote}` (joined after), so TeX
	     continues the paragraph unindented. A tcolorbox ends its paragraph
	     with or without one, so a callout joined after is followed by
	     `\noindent` instead (callouts.js; Clew-boss, 2026-11-28).

	How, without touching index.js:
	- A `blockquote` tokenizer override hands marked's own tokenizer only the
	  leading run of `>` lines, so its lazy continuation has nothing to reach.
	- A processAllTokens hook flags the quotes, callouts and paragraphs (the
	  `jmd…` properties below). Whether a blank line separates two neighbours
	  is read from the tokens: a blank line is a `space` token, or (a callout,
	  whose raw takes its own last newline) a raw that ends in one.
	- Renderer-only extensions for `blockquote` and `paragraph`, which marked
	  consults before any `renderer` override, return false for an unflagged
	  token — the renderers render it, byte for byte — and otherwise take the
	  renderers' own output (index.js's data-source-line one, latex-renderer.js
	  in LaTeX) and add the class or drop the newline.
	Off, the override and the renderers return false and the hook does
	nothing, so every build is what it was.
*/
import { marked, Tokenizer } from 'marked';
import { marked_copy } from './utils.js';
import { configManager } from './config-manager.js';

const joinedQuotes = () => configManager.get('Joined quotes') === true;

// The leading run of quote lines: `>` after up to three spaces (marked's own
// blockquote start, `blockquoteStart`).
const QUOTE_LINES = /^(?: {0,3}>[^\n]*(?:\n|$))+/;

const tokenizer = {
	blockquote(src) {
		if (!joinedQuotes()) return false;
		const lines = QUOTE_LINES.exec(src);
		if (!lines) return false;
		// marked's own tokenizer, given only the quote's lines. Nothing else
		// overrides `blockquote`, so this is what the chain would have run.
		return Tokenizer.prototype.blockquote.call(this, lines[0]);
	},
};

const isQuote = (token) => token?.type === 'blockquote' || token?.type === 'calloutBlock';
const endsInBlankLine = (token) => /\n[ \t]*\n$/.test(token.raw ?? '');
// Two neighbours in one token list touch when no blank line separates them:
// a blank line is a `space` token between them (so they are not neighbours),
// or a raw that ends in one (a callout takes its last newline into its raw,
// and the newline after it with that).
const touching = (first) => !endsInBlankLine(first);

function flagList(tokens) {
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (!isQuote(token)) continue;
		const before = tokens[i - 1], after = tokens[i + 1];
		if (before?.type === 'paragraph' && touching(before)) {
			token.jmdJoinedBefore = true;
			before.jmdJoinsQuote = true;           // LaTeX: no blank line after it
		}
		if (after?.type === 'paragraph' && touching(token)) {
			token.jmdJoinedAfter = true;
			after.jmdContinued = true;
		}
	}
}

// Every list of tokens in the tree — the document's, a quote's, a callout's,
// a list's items, an environment's body, a footnote's content, a description
// list's definitions — whatever array holds them: each array, then the arrays
// its elements hold. Only arrays are followed, so nothing outside the tree
// (an attributes object, a lexer) is walked.
function flagTree(list, seen) {
	if (seen.has(list)) return;
	seen.add(list);
	flagList(list);
	for (const element of list) {
		if (!element || typeof element !== 'object') continue;
		for (const value of Object.values(element)) {
			if (Array.isArray(value)) flagTree(value, seen);
		}
	}
}

const hooks = {
	processAllTokens(tokens) {
		if (joinedQuotes()) flagTree(tokens, new WeakSet());
		return tokens;
	},
};

// The class added to a rendered block's opening tag: into its class attribute
// if it has one, else as the first attribute.
export function addJoinClasses(html, classes) {
	if (!classes) return html;
	return html.replace(/^(\s*<[a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/, (tag, open, attrs) => {
		if (/\sclass="/.test(attrs)) return `${open}${attrs.replace(/\sclass="([^"]*)"/, (m, c) => ` class="${c} ${classes}"`)}>`;
		return `${open} class="${classes}"${attrs}>`;
	});
}

// The classes a quote or callout carries: '' when it joins nothing.
export function joinClasses(token) {
	return [token.jmdJoinedBefore && 'jmd-joined-before', token.jmdJoinedAfter && 'jmd-joined-after']
		.filter(Boolean).join(' ');
}

const renderers = [
	{
		name: 'blockquote',
		renderer(token) {
			if (!token.jmdJoinedBefore && !token.jmdJoinedAfter) return false;
			const out = this.parser.renderer.blockquote(token);
			if (global.isLatex) return token.jmdJoinedAfter ? out.replace(/\n\n$/, '\n') : out;
			return addJoinClasses(out, joinClasses(token));
		},
	},
	{
		name: 'paragraph',
		renderer(token) {
			if (!token.jmdContinued && !token.jmdJoinsQuote) return false;
			const out = this.parser.renderer.paragraph(token);
			if (global.isLatex) return token.jmdJoinsQuote ? out.replace(/\n\n$/, '\n') : out;
			return token.jmdContinued ? addJoinClasses(out, 'jmd-continued') : out;
		},
	},
];

for (const instance of [marked, marked_copy]) {
	instance.use({ tokenizer, hooks, extensions: renderers });
}
