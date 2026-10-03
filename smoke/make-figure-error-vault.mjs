// A vault for figure-error-scenario.js: `node smoke/make-figure-error-vault.mjs
// <dir> <source|live> [tikz|metapost|latex|mermaid] [arrows|click] [at] [noesc]` (`at`: where the figure's line-before sits, as a fraction of the window's height; 0.62 by default). Note.md: twenty
// paragraphs, then a figure with a typo in it (the owner's `\a\lpha`, or its
// MetaPost/LaTeX/mermaid equivalent), then a closing paragraph — so the
// figure can be scrolled to the lower part of the window, where the owner
// met it (2026-10-03).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const [dir, mode = 'source', kind = 'tikz', input = 'arrows', at = '0.62', esc] = process.argv.slice(2);
if (!dir) { console.error('usage: make-figure-error-vault.mjs <dir> <source|live> [tikz|metapost|latex|mermaid] [arrows|click]'); process.exit(1); }
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const FIGURES = {
	tikz: { fence: 'tikz', body: ['\\begin{tikzpicture}[scale=2]', '  \\draw[thick, >=stealth, ->] (0,0) node {$a\\lpha$} to[out=135, in=272] (1,1);', '\\end{tikzpicture}'], typo: 'a\\lpha', fix: '\\alpha' },
	metapost: { fence: 'metapost', body: ['beginfig(1);', '  draw fullcircle scaled 2cm withpen pencircle scaled 1pt;', '  drawarow (0,0)--(1cm,1cm);', 'endfig;'], typo: 'drawarow', fix: 'drawarrow' },
	latex: { fence: 'latex', body: ['Some text and $\\a\\lpha + \\beta$ here.'], typo: '\\a\\lpha', fix: '\\alpha' },
	mermaid: { fence: 'mermaid', body: ['graph LR', '  A[Start] --> B[End]', '  B --> > C'], typo: '--> >', fix: '-->' },
};
const f = FIGURES[kind];
const paragraphs = Array.from({ length: 20 }, (_, i) => `Paragraph ${i + 1} of the opening, long enough to fill a line or two of the column before the figure arrives.`);
writeFileSync(join(dir, 'Note.md'), `# Figure with a typo\n\n${paragraphs.join('\n\n')}\n\nThe line before the figure.\n\n\`\`\`${f.fence}\n${f.body.join('\n')}\n\`\`\`\n\nA closing paragraph after the figure.\n`);
writeFileSync(join(dir, 'case.json'), JSON.stringify({ mode, kind, input, at: Number(at), esc: esc !== 'noesc', typo: f.typo, fix: f.fix }));
