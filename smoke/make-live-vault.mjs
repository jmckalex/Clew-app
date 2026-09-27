// Fixtures for live-lines-scenario.js and live-tables-scenario.js:
// `node smoke/make-live-vault.mjs <dir>`. Blocks.md holds every line and
// block construct live edit draws; Tables.md the Tier B ones (a table with
// inline markdown in its cells, and images of every kind).
import { mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: make-live-vault.mjs <dir>'); process.exit(1); }
rmSync(join(dir, '.clew'), { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'Blocks.md'), `---
status: open
priority: 3
tags: [demo, live]
---
# Heading one

{{TOC}}

## A list

- first *item*
  - nested item
- [ ] a task
- [x] a done task
1. numbered

> A quote with **intense** text.

> [!tip]- Folded *tip*
> Hidden body.

> [!warning] Mind the gap
> Visible body.

>> Centred text <<

***

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

\`\`\`js
const x = 1;
\`\`\`

:::theorem[Pythagoras]
Body with $a^2+b^2=c^2$.
:::

Term:: definition here.

Last line.
`);

mkdirSync(join(dir, 'Attachments'), { recursive: true });
copyFileSync(new URL('../demo-vault/Attachments/clew-gradient.png', import.meta.url), join(dir, 'Attachments', 'pic.png'));
writeFileSync(join(dir, 'Tables.md'), `# Tables

| Name | Style | Value |
| :--- | :---: | ---: |
| one | *strong* | $x^2$ |
| two | [[Blocks\\|a link]] | \`code\` |

![[pic.png|120]]

![Markdown path](Attachments/pic.png)

![Remote](https://example.org/x.png)

![[nowhere.png]]

Text with an inline ![[pic.png|20]] image.

Last line.
`);

// Frames.md (live-blocks-scenario.js): Tier C — engine-rendered frames.
copyFileSync(new URL('../demo-vault/Attachments/sample.pdf', import.meta.url), join(dir, 'Attachments', 'sample.pdf'));
writeFileSync(join(dir, 'Child.md'), '# Child\n\nORIGINAL child text.\n');
mkdirSync(join(dir, 'Projects'), { recursive: true });
writeFileSync(join(dir, 'Projects', 'Alpha.md'), '---\nstatus: open\npriority: 1\n---\n# Alpha\n');
const extra = Array.from({ length: 20 }, (_, i) => `\`\`\`mermaid\ngraph LR\n  N${i}A --> N${i}B\n\`\`\`\n`).join('\n');
writeFileSync(join(dir, 'Frames.md'), `# Frames

\`\`\`mermaid
graph TD
  A[Start] --> B[End]
\`\`\`

\`\`\`query
table: status, priority
from: Projects
\`\`\`

![[Child]]

@reveal[Nothing/]

![[sample.pdf]]

Paragraph between the frames and the rest.

${extra}
Last line.
`);

// Pane.md (preview-pane-scenario.js): inline and display maths, a mermaid
// fence, a tikz fence (its phase runs only where mp-tikz-wasm is staged).
writeFileSync(join(dir, 'Pane.md'), `# Pane

Inline $a^2 + b^2$ here.

$$
x = 1
$$

\`\`\`mermaid
graph TD
  A[Start] --> B[End]
\`\`\`

\`\`\`tikz
\\begin{tikzpicture}
\\draw (0,0) -- (1,1);
\\end{tikzpicture}
\`\`\`

Last line.
`);

// Footnotes.md (live-footnotes-scenario.js): a one-line note, a long one of
// three paragraphs with a list in the second, and a trailing one-line note.
writeFileSync(join(dir, 'Footnotes.md'), `# Footnotes

A short note[fn: One line.] and a long one[^long: The first paragraph of the long note.

- an item in the second paragraph
- another item

The third paragraph.] and a last one[fn: Trailing.] ends the sentence.

Last line.
`);

// Sidenotes.md (sidenotes-scenario.js): three notes, two on one line so their
// sidenotes collide.
writeFileSync(join(dir, 'Sidenotes.md'), `# Sidenotes

First paragraph with a note.[fn: The first note.] More text follows here to fill the line out a little.

Second paragraph holds two notes on one line.[fn: The second note, which runs long enough to wrap onto a second line in the margin, and then some.] And another.[fn: The third note.]

Last line.
`);

// Slash.md (slash-menu-scenario.js): prose, a code fence, a table.
writeFileSync(join(dir, 'Slash.md'), `# Slash

Some prose here.

\`\`\`js
const x = 1;
\`\`\`

| A | B |
| --- | --- |
| a1 | b1 |

Last line.
`);

// Nested.md (live-nested-fence-scenario.js): emphasis nested both ways,
// and a code fence whose closer must not read as a blank line.
writeFileSync(join(dir, 'Nested.md'), `# Nested

Boldface and /*italics*/, then */strong italics/* here.

- [ ] What should I do? *Boldface* and /*tasked*/.
- [ ] Should I do this?

\`\`\`javascript
let i = 10;
function foo() {
}
\`\`\`

Last line.
`);

// Headerless.md (live-headerless-table-scenario.js): the engine's two
// headerless forms — pure pipes (the owner's grades table), separator-first.
writeFileSync(join(dir, 'Headerless.md'), `# Headerless

The categories:

| *Description* | *Grade* |
| Lively and perceptive | 80 |
| Reasonable | 65 |

Between the tables.

|:---|---:|
| left | 1 |
| more | 2 |

Last line.
`);

// Cells.md (live-table-edit-scenario.js): a plain table to edit in place.
writeFileSync(join(dir, 'Cells.md'), `# Cells

| A | B | C |
| --- | --- | --- |
| a1 | b1 | c1 |
| a2 | b2 | c2 |

Last line.
`);
