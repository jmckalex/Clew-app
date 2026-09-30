// A vault holding every construct the engine's `Run note code` switch
// refuses (jmarkdown note-code.js), for trust-guard-scenario.js:
//
//   node smoke/make-trust-vault.mjs <dir>
//
// Trust.md runs them all; each leaves a mark in the page when it runs (the
// script block prints what the four Load keys set), so "refused" and "ran"
// are both visible in the document. Plain.md has no note code at all.
// Inline func(…) is left out: the engine cannot run it (the build aborts —
// a known engine bug, being fixed upstream), so it would prove nothing.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node smoke/make-trust-vault.mjs <dir>');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(path.join(dir, 'Code'), { recursive: true });
const put = (rel, text) => fs.writeFileSync(path.join(dir, rel), text);

put('Code/load.js', "global.loadjs = 'LOADJS-RAN';\n");
put('Code/ext.mjs', "globalThis.extLoaded = 'EXT-RAN';\nexport default [];\n");
put('Code/dir.mjs', "globalThis.dirLoaded = 'DIR-RAN';\nexport default [];\n");
put('Code/env.mjs', "globalThis.envLoaded = 'ENV-RAN';\nexport default {};\n");
put('Code/Trust.md', `---
Load javascript: load.js
Load extensions: ext.mjs
Load directives: dir.mjs
Load environments: env.mjs
Extension shout: << >>
<b class="shout">\${content1}</b>
---
# Note code

<script data-type="jmarkdown">
global.output = ['SCRIPT-RAN', global.loadjs, globalThis.extLoaded, globalThis.dirLoaded, globalThis.envLoaded].join(' ');
</script>

<script data-type="jmarkdown-postprocess">
global.html = global.html.replace('POSTPROCESS-MARK', 'POSTPROCESS-RAN');
</script>

POSTPROCESS-MARK

Prose with Math.max(1, 41) inline and a calc("40+2") call.

function() { return 'FUNCBLOCK-RAN'; }

A mathjs math.sqrt(16) call, and shouting <<LOUD>>.

:::Mathematica
2+2
:::
`);
// A project config the vault carries, as a CLI user's folder might: a
// trusted vault's export reads it (today's behaviour), a restricted one's
// must not (export.js) — the body class says which.
fs.mkdirSync(path.join(dir, 'Code', '.jmarkdown'), { recursive: true });
put('Code/.jmarkdown/config.json', JSON.stringify({ 'Body classes': 'vault-config-read' }) + '\n');
put('Plain.md', '# Plain\n\nNo code here: $x^2$, a [[Code/Trust|link]], and a list.\n\n- one\n- two\n');
put('Welcome.md', '# Trust fixture\n');
console.log(dir);
