// A vault for app-pin-scenario.js: `node smoke/make-app-pin-vault.mjs <dir>`.
// Pinning an app within its note (shared/app-pin.js, the owner's ask
// 2026-10-04), and live edit's three @app forms:
//
//   Pin.md     the Ticker `@app+[…]{height=150 pin=top}` near the top, ~200
//              lines of prose, and the Timer in the ENVIRONMENT form
//              `@begin(app){height=280 pin=bottom}` … `@end(app)` at the end
//              — both pins, both block forms, at once
//   Forms.md   Docs' three forms: `@app[Apps/Picker]` inline in a sentence
//              (a chip in live edit), `@app+[Apps/Ticker]` and
//              `@begin(app)` Apps/Timer `@end(app)` (frames)
//
// <dir>/vault holds the demo vault's Ticker, Timer and Picker; <dir>/ud is a
// fresh userData (the vault restricted: every app behind its prompt);
// `pin-mode.txt` (reading | live | control | forms) picks the scenario's case.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [dir, mode = 'reading'] = process.argv.slice(2);
if (!dir) throw new Error('usage: node smoke/make-app-pin-vault.mjs <dir> [reading|live|control|forms]');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vault = path.join(dir, 'vault');
fs.rmSync(dir, { recursive: true, force: true });
for (const app of ['Ticker', 'Timer', 'Picker']) {
	fs.cpSync(path.join(repo, 'demo-vault', 'Apps', app), path.join(vault, 'Apps', app), { recursive: true });
}
fs.mkdirSync(path.join(dir, 'ud'), { recursive: true });
const put = (rel, text) => fs.writeFileSync(path.join(vault, rel), text);
put('pin-mode.txt', `${mode}\n`);
const prose = [...Array(100)].map((_, i) => `Paragraph ${i + 1}. The ticker stays at the top and the timer at the bottom while this scrolls past.\n`).join('\n');
put('Pin.md', `# Pinned apps

The ticker is pinned to the top, the timer to the bottom.

@app+[Apps/Ticker]{height=150 pin=top}

| Symbol | Price |
| --- | ---: |
| CLEW | 128.40 |
| STAG | 77.50 |

${prose}
@begin(app){height=280 pin=bottom}
Apps/Timer
@end(app)

The end.
`);
put('Forms.md', `# Three forms

An inline one, @app[Apps/Picker], sits in this sentence.

@app+[Apps/Ticker]{height=150}

| Symbol | Price |
| --- | ---: |
| CLEW | 128.40 |

@begin(app){height=280}
Apps/Timer
@end(app)

The end.
`);
// The control: the same note with no pins (app-pin-scenario.js `control`).
if (mode === 'control') {
	const pinned = fs.readFileSync(path.join(vault, 'Pin.md'), 'utf8');
	put('Pin.md', pinned.replace(' pin=top}', '}').replace(' pin=bottom}', '}'));
}
console.log(`app pin fixture: ${vault} (${mode})`);
