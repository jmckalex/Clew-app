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
