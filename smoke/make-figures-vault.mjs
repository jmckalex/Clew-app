// The fixture for figures-scenario.js, figures-edit-scenario.js and
// fence-highlight-scenario.js: one vault, three notes.
//
//   node smoke/make-figures-vault.mjs /tmp/fig-vault
//
// Figures.md holds every syntax that reaches mp-tikz-wasm — the five
// picture forms, the ```latex and ```tex documents, and the `show=` modes
// (code only, code then figure, on a fence, a directive and an environment)
// — plus a ```mermaid fence as a control (it is the other client-side
// diagram in a Clew preview, and the one to compare against when something
// looks off — data-source-line stamping, say).
//
// Edit.md is deliberately minimal: one fence and one line of prose, which is
// what the edit scenario rewrites to test the morph guard both ways.
//
// Highlight.md is short enough to fit one editor viewport: the fences the
// SOURCE pane highlights with their own grammars, one of each.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
	console.error('usage: node smoke/make-figures-vault.mjs <dir>');
	process.exit(1);
}
fs.mkdirSync(dir, { recursive: true });

const figures = `# Figures

## A tikz fence

\`\`\`tikz libraries="arrows.meta"
\\draw[->,thick] (0,0) -- (2,1) node[right] {$x^2$};
\\draw[fill=blue!20] (0,0) circle (0.3);
\`\`\`

## A TikZJax-dialect fence

\`\`\`tikz
\\usepackage{amsmath}
\\begin{document}
\\begin{tikzpicture}
\\draw[thick,rounded corners=8pt] (0,0) -- (0,2) -- (1,3.25) -- (2,2) -- (2,0) -- (0,2) -- (2,2) -- (0,0) -- (2,0);
\\node at (1,-0.5) {$\\int_0^1 x\\,dx$};
\\end{tikzpicture}
\\end{document}
\`\`\`

## A metapost fence

\`\`\`metapost
draw fullcircle scaled 60 withcolor (0.8,0.2,0.2);
label.top(btex $\\pi r^2$ etex, (0,30));
\`\`\`

## The colon directive

:::TiKZ
\\node[draw,rounded corners] (a) at (0,0) {start};
\\node[draw,rounded corners] (b) at (3,0) {end};
\\draw[->] (a) -- (b);
:::

## The at-sigil environment

@begin(metapost){width='45%'}
beginfig(1);
for i = 0 upto 7:
  draw (0,0) -- 50 * dir(45i) withpen pencircle scaled 0.8;
endfor
draw fullcircle scaled 100;
endfig;
@end(metapost)

## The directive's own library list

Every library \`:::TiKZ\` preloads must be in the wasm bundle: one that is
not takes the whole figure down. \`calligraphy\` (from spath3) is the one
that was missing, so this figure is the regression test.

:::TiKZ
\\calligraphy[copperplate, pen colour=blue] (0,0) to[out=60,in=120] (3,0.4);
:::

## A classic arrow tip on a horizontal line

TikZ leaves its classic tips (\`>=latex\`) out of the bounding box, so only
the standalone border keeps this arrowhead on the page: cropped tight, the
figure is a line with no head (the owner's report, 2026-09-16). The frame
script reports the viewBox; its height must exceed the line width by the
border on both sides — well above 4.

\`\`\`tikz
\\begin{tikzpicture}[scale=2,>=latex]
\\draw[very thick, ->] (0,0) -- (1,0);
\\end{tikzpicture}
\`\`\`

## Graph drawing (LuaTeX, loaded on demand)

\`\`\`tikz gdlibraries="layered"
\\graph[layered layout, sibling distance=9mm, level distance=12mm]{a -> {b, c} -> d -> e};
\`\`\`

## A LaTeX snippet (LuaLaTeX, wrapped in varwidth standalone)

\`\`\`latex
A paragraph long enough to wrap at the standalone class's line width, with
inline math $e^{i\\pi} + 1 = 0$ and a display:
\\begin{align}
  \\nabla \\cdot \\mathbf{E} &= \\frac{\\rho}{\\varepsilon_0} \\\\
  \\nabla \\cdot \\mathbf{B} &= 0
\\end{align}
\`\`\`

## A complete article (it says \\pagestyle{empty} itself; prose right below)

\`\`\`latex
\\documentclass[12pt]{article}
\\usepackage[dvisvgm]{graphicx}
\\pagestyle{empty}
\\begin{document}
The quick brown fox jumped over the lazy dog and then ran out for pizza and beer.
This is \\rotatebox{45}{rotated text}.
\\begin{enumerate}
\\item foo
\\item bar
\\end{enumerate}
\\end{document}
\`\`\`

AFTER-THE-ARTICLE: this paragraph must sit directly under the list.

## Plain TeX on LuaTeX (a \\sqrt: the DVI-rule trap regression)

\`\`\`tex
\\centerline{Plain \\TeX, $\\sqrt{2}$ and all.}
\`\`\`

## show=code: the source, highlighted, nothing typeset

\`\`\`tikz show=code
\\draw[->,thick] (0,0) -- (2,1) node[right] {$x^2$}; % a comment
\`\`\`

## show=both on a metapost fence

\`\`\`metapost both
draw fullcircle scaled 40 withcolor (0.2,0.4,0.8);
\`\`\`

## show=both on the environment

@begin(TiKZ){show=both}
\\draw[fill=yellow!30] (0,0) rectangle (1.5,0.6);
@end(TiKZ)

## Control: a mermaid fence

\`\`\`mermaid
graph LR
  A[one] --> B[two]
\`\`\`
`;

const edit = `# Edit

PROSE-ONE

\`\`\`tikz
\\draw[thick] (0,0) rectangle (2,1);
\`\`\`
`;

const highlight = `# Highlight

\`\`\`tikz libraries="arrows.meta"
\\begin{tikzpicture}[>=Latex]
\\draw[->,thick] (0,0) -- (2.5cm,1) node[right] {$x^2$}; % axis
\\end{tikzpicture}
\`\`\`

\`\`\`metapost
pair a; a := (2cm, 1.5); % solved
draw fullcircle scaled 60 withcolor red;
label.top(btex $\\alpha_1$ etex, origin);
\`\`\`

\`\`\`latex
\\begin{align} a &= b \\end{align}
\`\`\`

\`\`\`js
const x = 1; // not ours: plain text
\`\`\`

:::TiKZ
\\draw (0,0) circle (1);
:::
`;

fs.writeFileSync(path.join(dir, 'Figures.md'), figures);
fs.writeFileSync(path.join(dir, 'Edit.md'), edit);
fs.writeFileSync(path.join(dir, 'Highlight.md'), highlight);
console.log(`figures fixture: ${dir} (Figures.md, Edit.md, Highlight.md)`);
