// A scratch copy of the demo vault plus Hover.md, for
// link-preview-scenario.js: `node smoke/make-hover-vault.mjs <dir>`.
// The demo vault is copied without its .clew/ state, so every run starts
// with a clean workspace.
import { cpSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2];
if (!dir) { console.error('usage: make-hover-vault.mjs <dir>'); process.exit(1); }
const demo = join(dirname(fileURLToPath(import.meta.url)), '..', 'demo-vault');
rmSync(dir, { recursive: true, force: true });
cpSync(demo, dir, { recursive: true, filter: (src) => !src.includes('/.clew') });
// One link per line (a popover opens BELOW its link, so a link on the next
// line would sit under it); the section link and the unresolved one share a
// line, so moving from one to the other is a link-to-link move. The long
// alias fills several lines, so reading mode's hover lands on it without
// knowing the preview's exact layout.
const long = Array(14).fill('a link to the guide section of the welcome note').join(' ');
writeFileSync(join(dir, 'Hover.md'), `# Hover

[[Welcome#The guide|${long}]]

[[Welcome]]

[[Welcome#The guide]] and then, further along the same line, [[Nowhere]]

[[sample.pdf|external]]

[site](https://example.com)

Last.
`);
