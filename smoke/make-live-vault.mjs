// Fixture for live-lines-scenario.js: `node smoke/make-live-vault.mjs <dir>`.
// One note holding every line and block construct live edit draws.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
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
