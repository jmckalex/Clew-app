// A vault for live-vars-scenario.js: `node smoke/make-vars-vault.mjs <dir>`.
// Vars.md's header sets a few keys; its body uses them, a name the header
// does not set, a name with spaces inside its braces (no key, as the engine
// reads it) and one of the engine's own markers. Generic words only.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: make-vars-vault.mjs <dir>'); process.exit(1); }
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'Vars.md'), `---
title: Hello world
author: A. Writer
html: <b>bold</b> text
blank:
---
# {{title}}

Written by {{author}}; then {{html}}; an empty [{{blank}}]; an unknown {{nothing}}; spaced {{ title }}.

{{LOF}}

Last.
`);
