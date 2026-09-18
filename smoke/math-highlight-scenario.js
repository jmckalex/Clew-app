// Math in the SOURCE pane: a formula belongs to the dialect whole, and
// markdown's punctuation is inert inside it.
//
// The owner's report, 2026-09-18: `the notation $R^*$ is incomplete … we
// need $R_w^*(S)$` went BOLD from the first asterisk to the second —
// stock markdown knows nothing about `$…$`, so the `*` in one formula
// paired with the `*` in the next and took the prose between them.
// jmd/math-parser.js claims each segment before any inline parser sees
// inside it (the segments come from the same scanner that paints them).
//
// Fixture (any disposable vault):
//
//   mkdir -p /tmp/math-vault && printf '%s\n' \
//     '# Math' '' \
//     'Star: the notation $R^*$ is incomplete, and here we need $R_w^*(S)$ instead.' '' \
//     'Control: this *is strong* and this **is intense** in ordinary prose.' '' \
//     'Delimiters: $x$, $$y$$, \(z\) and \[w\] all count.' '' \
//     'Code: the shell `$PATH` and `$HOME` are not math.' '' \
//     'Escaped: it costs \$5 and \$10 today.' \
//     > /tmp/math-vault/Math.md
//
// Expect: `star` reports TWO `jmd-math` spans and NOTHING else — a single
// `cmt-emphasis` on that line is the regression; `control` still reports
// `cmt-emphasis` for `*is strong*` and `cmt-strong` for `**is intense**`
// (the fix must not disarm emphasis in prose); `delims` reports all four
// pairs as `jmd-math`; `code` reports `cmt-code`, not math (InlineCode
// parses first); and `escaped` reports NO spans at all — `\$` is not a
// delimiter, which is the escape for a line about prices.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
workspaceStore.openNote('Math.md', { newTab: true, defaultMode: 'source' });
await sleep(3000);
const content = document.querySelector('.cm-content');
const spansOf = (prefix) => {
	const line = [...content.querySelectorAll('.cm-line')]
		.find((l) => l.textContent.trim().startsWith(prefix));
	if (!line) return 'NOT FOUND';
	return [...line.querySelectorAll('span')]
		.map((s) => (s.className || '(none)').replace(/\s+/g, '.') + ':' + JSON.stringify(s.textContent))
		.join(' | ') || 'NO SPANS';
};
for (const [name, prefix] of [
	['star', 'Star:'],
	['control', 'Control:'],
	['delims', 'Delimiters:'],
	['code', 'Code:'],
	['escaped', 'Escaped:'],
]) {
	console.log(`smoke-math: ${name}=${spansOf(prefix)}`);
}
console.log('smoke-math: counts=' + JSON.stringify({
	'jmd-math': content.querySelectorAll('.jmd-math').length,
	'cmt-emphasis': content.querySelectorAll('.cmt-emphasis').length,
	'cmt-strong': content.querySelectorAll('.cmt-strong').length,
}));
