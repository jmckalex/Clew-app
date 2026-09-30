// Exports under the interim vault-trust guard (export.js; the owner's Q9),
// over `node smoke/make-trust-vault.mjs <dir>` opened as a vault this device
// has never seen. Restricted: the export refuses the note's code by name and
// never reads the vault's own Code/.jmarkdown/config.json → `restricted
// refused=12 marks=0 vault-config=false`. Trusted (after VAULT_TRUST_SET): as
// today, from the note's own folder → `trusted refused=0 marks=9
// vault-config=true`. Both exports stay inside the fixture.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const MARKS = ['SCRIPT-RAN', 'LOADJS-RAN', 'EXT-RAN', 'DIR-RAN', 'ENV-RAN', 'POSTPROCESS-RAN', 'FUNCBLOCK-RAN', 'class="shout"', 'mathematica txt'];
const report = async (label, out) => {
	await ipc.invoke('clew:export-note', { path: 'Code/Trust.md', format: 'html', outFile: out });
	const html = await ipc.invoke('clew:note-read', { path: out });
	const text = typeof html === 'string' ? html : (html?.text ?? html?.content ?? '');
	const refused = new Set([...text.matchAll(/data-jmd-refused="([^"]*)"/g)].map((m) => m[1])).size;
	const marks = MARKS.filter((m) => text.includes(m)).length;
	console.log(`smoke-trust-export: ${label} refused=${refused} marks=${marks} vault-config=${text.includes('vault-config-read')}`);
};
await report('restricted', 'out-restricted.html');
await ipc.invoke('clew:vault-trust-set', { trusted: true });
await report('trusted', 'out-trusted.html');
