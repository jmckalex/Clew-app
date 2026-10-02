// A vault with apps in notes (docs/dev/frame-bridge.md §7–§9), for
// app-bridge-scenario.js:
//
//   node smoke/make-app-vault.mjs <dir>
//
// Apps/Probe — an app asking for note.read, query, app.kv, app.files and
// links.open, whose app.js runs every read-side method and the guards it
// should meet, leaving the results in window.__probe for app-bridge-frame.js.
// Probe.md embeds it; Other.md is a note it may NOT read (note.read is the
// embedding note only). Twin/A and Twin/B both claim the id "twin" — Dup.md
// embeds one, and both are refused by name. Escape.md links out of the vault
// through a symlink (Linked → a folder outside) for the restricted clamp.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node smoke/make-app-vault.mjs <dir>');
fs.rmSync(dir, { recursive: true, force: true });
const put = (rel, text) => {
	fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
	fs.writeFileSync(path.join(dir, rel), text);
};
put('Probe.md', '---\nkind: probe\n---\n# Probe\n\nPROBE-NOTE-TEXT [[Other]]\n\n@app+[Apps/Probe]{height=200}\n');
put('Other.md', '# Other\n\nOTHER-NOTE-TEXT\n');
put('Dup.md', '# Dup\n\n@app+[Twin/A]\n');
put('Apps/Probe/clew-app.json', JSON.stringify({ id: 'probe', name: 'Probe', capabilities: ['note.read', 'query', 'app.kv', 'app.files', 'links.open'] }, null, '\t'));
put('Apps/Probe/index.html', '<!doctype html><html><head><meta charset="utf-8"><title>Probe</title></head><body><p id="out">probe</p><script src="app.js"></script></body></html>\n');
put('Apps/Probe/app.js', `
const results = {};
const settle = async (name, fn) => {
	try { results[name] = await fn(); } catch (err) { results[name] = 'ERR ' + (err.code ?? err.name) + (err.code ? '' : ': ' + String(err.message).slice(0, 60)); }
};
(async () => {
	const ready = await clew.ready;
	results.granted = ready.granted.slice().sort().join(',');
	await settle('context', async () => (await clew.context()).path);
	await settle('note', async () => (await clew.notes.read()).includes('PROBE-NOTE-TEXT'));
	await settle('other-note', async () => (await clew.notes.read('Other.md')).length);
	await settle('properties', async () => (await clew.properties.get()).kind);
	await settle('list', async () => (await clew.notes.list()).join('|'));
	await settle('backlinks', async () => (await clew.index.backlinks('Other.md')).join(','));
	await settle('kv', async () => { await clew.kv.set('n', 7); return await clew.kv.get('n'); });
	await settle('files', async () => { await clew.files.write('saves/a.txt', 'hello'); return await clew.files.read('saves/a.txt'); });
	await settle('files-escape', async () => clew.files.write('../clew-app.json', 'x'));
	await settle('vault-read', async () => (await fetch('clew-preview://vault/')).status);
	await settle('own-file', async () => (await fetch('app.js')).ok);
	await settle('remote-image', () => new Promise((resolve) => { const img = new Image(); img.onload = () => resolve('loaded'); img.onerror = () => resolve('blocked'); img.src = 'https://clew-csp-probe.invalid/x.png'; }));
	await settle('parent-dom', async () => { try { return String(window.parent.document.title); } catch (e) { return 'blocked ' + e.name; } });
	results.ancestors = [...(location.ancestorOrigins ?? [])].join(' ');
	results.referrer = document.referrer || '(none)';
	results.origin = location.origin.startsWith('clew-frame://') ? 'clew-frame' : location.origin;
	window.__probe = results;
	document.getElementById('out').textContent = 'probe done';
})();
`);
// Apps/Writer — the write side (phase 4): its app.js appends to and
// inserts into the note it sits in, creates a note (and is refused a second
// time), is refused another note, opens Clew's Find, copies and pastes.
put('Writer.md', '# Writer\n\nWRITER-NOTE-TEXT\n\n@app+[Apps/Writer]{height=160}\n');
put('Apps/Writer/clew-app.json', JSON.stringify({ id: 'writer', name: 'Writer', capabilities: ['note.read', 'note.write', 'notes.create', 'editor.insert', 'find', 'clipboard'] }, null, '\t'));
put('Apps/Writer/index.html', '<!doctype html><html><head><meta charset="utf-8"><title>Writer</title></head><body><p id="out">writer</p><script src="app.js"></script></body></html>\n');
put('Apps/Writer/app.js', `
const results = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async (name, fn) => {
	try { const v = await fn(); results[name] = v === undefined ? 'ok' : v; } catch (err) { results[name] = 'ERR ' + (err.code ?? err.name); }
};
clew.on('find', ({ query }) => { results.findEvent = query; });
(async () => {
	await clew.ready;
	await settle('append', () => clew.notes.append(null, 'APPENDED-BY-APP'));
	await settle('insert', () => clew.editor.insert('INSERTED-BY-APP '));
	await settle('create', () => clew.notes.create('Created By App.md', '# Created\\n'));
	await settle('create-again', () => clew.notes.create('Created By App.md', 'x'));
	await settle('other-write', () => clew.notes.write('Other.md', 'x'));
	await settle('find', () => clew.find.show('WRITER'));
	await settle('copy', () => clew.clipboard.copy('COPIED-BY-APP'));
	await settle('paste', () => clew.clipboard.paste());
	await sleep(500);
	window.__writer = results;
})();
`);
put('Twin/A/clew-app.json', JSON.stringify({ id: 'twin', name: 'Twin A' }));
put('Twin/A/index.html', '<p>a</p>');
put('Twin/B/clew-app.json', JSON.stringify({ id: 'twin', name: 'Twin B' }));
put('Twin/B/index.html', '<p>b</p>');
const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-app-outside-'));
fs.writeFileSync(path.join(outside, 'secret.md'), 'OUTSIDE-SECRET');
fs.symlinkSync(outside, path.join(dir, 'Linked'));
console.log(dir);
