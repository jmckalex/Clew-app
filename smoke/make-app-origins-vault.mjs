// A vault for app-origins-scenario.js:
//   node smoke/make-app-origins-vault.mjs <dir> <portA> <portB>
// Apps/Probe asks for `network` naming host A only; on EVERY load it fetches
// host A and host B (smoke/probe-stub.mjs on the two ports) and appends
// what happened to a history in its own storage — a prompt is modal, so the
// probe cannot wait for a click, and a reload is what a host change causes.
// Probe.md embeds it; <dir>/ud-trusted knows the vault (trusted),
// <dir>/ud-restricted does not.
import fs from 'node:fs';
import path from 'node:path';

const [dir, portA, portB] = process.argv.slice(2);
if (!dir || !portA || !portB) throw new Error('usage: node smoke/make-app-origins-vault.mjs <dir> <portA> <portB>');
const vault = path.join(dir, 'vault');
fs.rmSync(dir, { recursive: true, force: true });
const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(vault, rel)), { recursive: true }); fs.writeFileSync(path.join(vault, rel), text); };
const A = `http://127.0.0.1:${portA}`;
const B = `http://127.0.0.1:${portB}`;
put('Apps/Probe/clew-app.json', JSON.stringify({ id: 'origin-probe', name: 'Origin Probe', version: '1.0.0', entry: 'index.html', capabilities: ['network'], network: [A] }, null, '\t'));
put('Apps/Probe/index.html', '<!doctype html><html><head><meta charset="utf-8"><title>Origin Probe</title></head><body><p id="out">…</p><script src="app.js"></script></body></html>\n');
put('Apps/Probe/app.js', `// Each load: can this frame reach A, and B?
const hosts = { A: ${JSON.stringify(A)}, B: ${JSON.stringify(B)} };
(async () => {
	await clew.ready.catch(() => null);
	const got = {};
	for (const [name, url] of Object.entries(hosts)) {
		got[name] = await fetch(url + '/ping?' + name, { cache: 'no-store' }).then(() => 'reached').catch(() => 'blocked');
	}
	let history = [];
	try { history = JSON.parse(localStorage.getItem('history') || '[]'); } catch { /* none */ }
	history.push(\`A=\${got.A} B=\${got.B}\`);
	try { localStorage.setItem('history', JSON.stringify(history)); } catch { /* none */ }
	document.getElementById('out').textContent = history.join(' | ');
	document.body.dataset.history = JSON.stringify(history);
})();
`);
put('Probe.md', '# Probe\n\n@app+[Apps/Probe]{height=80}\n');
for (const ud of ['ud-trusted', 'ud-restricted']) fs.mkdirSync(path.join(dir, ud), { recursive: true });
fs.writeFileSync(path.join(dir, 'ud-trusted', 'clew-settings.json'), JSON.stringify({ recentVaults: [vault] }));
console.log(`app origins fixture: ${vault} (A ${A}, B ${B})`);
