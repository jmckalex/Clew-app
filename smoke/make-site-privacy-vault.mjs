// A vault for site-privacy-scenario.js: `node smoke/make-site-privacy-vault.mjs <dir>`.
// make-app-vault.mjs's apps (Apps/Probe embedded by Probe.md, the symlink out
// of the vault behind Escape.md), plus the private state a website export
// must leave out — clewdata.json (the Note API's shared state and every
// app's app.kv) and Apps/Probe/data/ (app.files) — each holding a marker
// the scenario searches the whole site for; and an ordinary `Research/data/`
// folder, which is vault content and must go out.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node smoke/make-site-privacy-vault.mjs <dir>');
execFileSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'make-app-vault.mjs'), dir]);
const put = (rel, text) => {
	fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
	fs.writeFileSync(path.join(dir, rel), text);
};
put('clewdata.json', JSON.stringify({ 'apps/probe/score': 'PRIVATE-KV-MARKER', 'note/state': 'PRIVATE-NOTE-API-MARKER' }, null, '\t'));
put('Apps/Probe/data/saves/a.txt', 'PRIVATE-APP-FILE-MARKER\n');
put('Research/data/table.csv', 'a,b\n1,2\n');
put('Welcome.md', '# Welcome\n\nThe probe: [[Probe]].\n');
