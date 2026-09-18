// Inline footnotes in the SOURCE pane: `[^label: …]` / `[fn: …]` painted
// by the dialect overlay (jmd-footnote on the delimiters, jmd-footnote-body
// on the body) instead of by stock markdown's link parser — which used to
// be the only thing colouring a note's body, and which stops dead at a
// blank line, so a note that grew a second paragraph lost its highlighting
// halfway through (the owner's report, 2026-09-18).
//
// Fixture (any disposable vault):
//
//   mkdir -p /tmp/fn-vault && printf '%s\n' \
//     '# Footnotes' '' \
//     'One line[^one: a short note with /italic/ and [[Target]].] on.' '' \
//     'Two lines[^two: a note that runs past the' \
//     'end of the line, still one paragraph.] on.' '' \
//     'Two paragraphs[^three: the first paragraph of the note.' '' \
//     '	the second paragraph, /italic/ and [[Target]] again.] on.' '' \
//     'Anonymous[fn: no label at all.] and grouped[^g(asides): in a group.] on.' '' \
//     'A real [link](https://example.org) must still be a link.' \
//     > /tmp/fn-vault/Footnotes.md
//   printf '# Target\n' > /tmp/fn-vault/Target.md
//
// Expect: every note's body, in all five shapes, reports
// `jmd-footnote-body` — including the `cont` line, the second paragraph of
// a note, which is the regression; `cmt-link` ONLY on the real markdown
// link (`link-line`); `jmd-footnote` on every `[`…`]`; and the constructs
// inside a body keeping their own faces (`jmd-italic`,
// `jmd-wikilink-target`) in both paragraphs.
//
// Then phase two: the cursor is put after the multi-paragraph note's
// closing `]` and `brackets=` reports what bracket matching made of it.
// Both ends must be `cm-matchingBracket` — the opener and the closer are
// one node type (footnote-parser.js), so a note's brackets pair across the
// blank line. Lose that and every note wears a red `cm-nonmatchingBracket`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
workspaceStore.openNote('Footnotes.md', { newTab: true, defaultMode: 'source' });
await sleep(3000);
const content = document.querySelector('.cm-content');
const lineFor = (prefix) => [...content.querySelectorAll('.cm-line')]
	.find((l) => l.textContent.trim().startsWith(prefix));
const spansOf = (prefix) => {
	const line = lineFor(prefix);
	if (!line) return 'NOT FOUND';
	return [...line.querySelectorAll('span')]
		.map((s) => (s.className || '(none)').replace(/\s+/g, '.') + ':' + JSON.stringify(s.textContent))
		.join(' | ');
};
for (const [name, prefix] of [
	['one', 'One line'],
	['two', 'Two lines'],
	['two-cont', 'end of the line'],
	['three', 'Two paragraphs'],
	['cont', 'the second paragraph'],
	['anon', 'Anonymous'],
	['link-line', 'A real'],
]) {
	console.log(`smoke-footnote: ${name}=${spansOf(prefix)}`);
}
const counts = {};
for (const cls of ['jmd-footnote', 'jmd-footnote-body', 'cmt-link', 'jmd-italic', 'jmd-wikilink-target']) {
	counts[cls] = content.querySelectorAll('.' + cls).length;
}
console.log('smoke-footnote: counts=' + JSON.stringify(counts));

// Phase two — real input, because bracket matching follows the cursor: a
// click just after the `]` that ends the multi-paragraph note.
const cont = lineFor('the second paragraph');
const box = cont.getBoundingClientRect();
const closer = [...cont.querySelectorAll('span')].reverse()
	.find((s) => s.textContent === ']')?.getBoundingClientRect();
window.__clewSmokeInput = [
	{ click: { x: Math.round((closer?.right ?? box.right) - 1), y: Math.round(box.top + box.height / 2) } },
	{ wait: 800 },
];
setTimeout(() => {
	const marks = [...content.querySelectorAll('.cm-matchingBracket, .cm-nonmatchingBracket')]
		.map((s) => s.className.replace(/\s+/g, '.') + ':' + JSON.stringify(s.textContent));
	console.log('smoke-footnote: brackets=' + (marks.join(' | ') || 'NONE'));
}, 2000);
