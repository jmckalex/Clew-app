// A vault for obsidian-comments-scenario.js: `node smoke/make-comments-vault.mjs <dir>`.
// Obsidian's `%%` comments (src/engine/obsidian-comments.js) in a note with no
// front matter (Comments.md), one with a header (Headed.md), a note that
// embeds the first (Embedder.md), and a copy of the demo's Kanban board
// (Board.md). Every SECRET must be hidden wherever Clew renders the note; every
// KEPT must show — inside code, inside maths, and a `%%` never closed.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node smoke/make-comments-vault.mjs <dir>');
fs.rmSync(dir, { recursive: true, force: true });
const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
const F = '```';
const BODY = `Before %%INLINE-SECRET%% after.

%% kanban:settings
${F}
{"BLOCK-SECRET":"basic"}
${F}
%%

%%
MULTI-LINE-SECRET

over a blank line
%% TRAIL-KEPT stays.

Code \`x %%CODE-KEPT%% y\` and maths $a %% b$ stay.

${F}
%% FENCE-KEPT
%%
${F}

$$
c %% DISPLAY-KEPT
$$

A stray %% UNCLOSED-KEPT stays.

End.
`;
put('Comments.md', `# Comments\n\n${BODY}`);
put('Headed.md', `---\nTitle: Headed\n---\n# Headed\n\n${BODY}`);
put('Embedder.md', '# Embedder\n\n![[Comments]]\n\nEMBEDDER-KEPT\n');
put('Board.md', fs.readFileSync(new URL('../demo-vault/Features/Project Board.md', import.meta.url), 'utf8'));
