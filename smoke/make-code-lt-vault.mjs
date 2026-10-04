// A vault for code-lt-scenario.js: `node smoke/make-code-lt-vault.mjs <dir>`.
// Markup characters inside code — `</>`, `<b>…</b>`, `<script>` — in every
// place Clew shows code: inline, a table cell, a fence, a callout, and a
// note embed (a live-edit block frame). Each must show as TEXT; a
// `<script>` that ran sets document.title to SWALLOWED.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node smoke/make-code-lt-vault.mjs <dir>');
fs.rmSync(dir, { recursive: true, force: true });
const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
const F = '```';
put('Code.md', `# Code

Inline: \`</>\` and \`<b>bold?</b>\` and \`<script>document.title = 'SWALLOWED'</script>\`.

| Thing | Code |
| --- | --- |
| tag | \`</>\` |
| bold | \`<b>x</b>\` |

${F}html
<script>document.title = 'SWALLOWED'</script>
</>
${F}

> [!note]
> In a callout: \`</>\`

![[Snippet]]

After the code.
`);
put('Snippet.md', `# Snippet

Embedded: \`</>\` and \`<i>y</i>\`.
`);
