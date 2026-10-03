// A vault for live-figure-click-scenario.js: `node
// smoke/make-figure-click-vault.mjs <dir> [main|extra]`. Note.md holds a
// TikZ arrow (the owner's, from ph226-426 "Week 3 new lecture"), a MetaPost
// circle, a mermaid diagram and a collapsible embed of Other.md, a paragraph
// between each; `mode.txt` says which half of the scenario to run.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const [dir, mode = 'main'] = process.argv.slice(2);
if (!dir) { console.error('usage: make-figure-click-vault.mjs <dir> [main|extra]'); process.exit(1); }
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'Note.md'), `# Figures

An opening paragraph, where the cursor starts.

\`\`\`tikz
\\begin{tikzpicture}[scale=2]
  \\draw[thick, >=stealth, ->] (0,0) to[out=135, in=272] (1,1);
\\end{tikzpicture}
\`\`\`

A paragraph after the TikZ figure.

\`\`\`metapost
beginfig(1);
  draw fullcircle scaled 2cm withpen pencircle scaled 1pt;
endfig;
\`\`\`

A paragraph after the MetaPost figure.

\`\`\`mermaid
graph LR
  A[Start] --> B[End]
\`\`\`

A paragraph after the mermaid diagram.

![[Other|collapsed]]

A closing paragraph.
`);
writeFileSync(join(dir, 'Other.md'), '# Other\n\nThe embedded note.\n');
writeFileSync(join(dir, 'mode.txt'), mode + '\n');
