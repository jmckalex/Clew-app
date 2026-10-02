import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { previewCsp, inlineScriptHashes, isScriptableDocument, CLEW_SCRIPT_SOURCES } from '../src/main/preview-csp.js';

const sha = (s) => `'sha256-${crypto.createHash('sha256').update(s, 'utf8').digest('base64')}'`;

test('a trusted vault with the network keeps exactly what it had: no CSP', () => {
	assert.equal(previewCsp({ kind: 'note', trusted: true, network: true }), null);
	assert.equal(previewCsp({ kind: 'vault', trusted: true, network: true }), null);
});

test('a trusted vault without the network: scripts run, data stays home', () => {
	const csp = previewCsp({ kind: 'note', trusted: true, network: false });
	assert.equal(csp, "connect-src 'self' blob: data:; form-action 'none'; worker-src 'self' blob:");
	assert.ok(!/script-src/.test(csp));
});

test('a restricted vault: only Clew\'s own scripts, by URL and by hash; vault HTML runs nothing', () => {
	const note = previewCsp({ kind: 'note', trusted: false, hashes: ["'sha256-abc'"] });
	assert.ok(note.startsWith(`script-src ${CLEW_SCRIPT_SOURCES.join(' ')} 'sha256-abc' 'wasm-unsafe-eval'; connect-src`));
	assert.ok(!/unsafe-inline|'self'.*script|unsafe-eval'(?!.*wasm)/.test(note.split(';')[0].replace("'wasm-unsafe-eval'", '')));
	// The network is closed in a restricted vault whatever its record says.
	assert.equal(previewCsp({ kind: 'note', trusted: false, network: true }).includes("connect-src 'self'"), true);
	assert.equal(previewCsp({ kind: 'vault', trusted: false }),
		"script-src 'none'; connect-src 'self' blob: data:; form-action 'none'; worker-src 'self' blob:");
});

test('inlineScriptHashes hashes inline scripts only, once each', () => {
	const html = '<head><script>\n\tA = 1;\n</script><script src="/x.js"></script></head>'
		+ '<body><script type="module">B()</script><script>\n\tA = 1;\n</script></body>';
	assert.deepEqual(inlineScriptHashes(html), [sha('\n\tA = 1;\n'), sha('B()')]);
});

test('scriptable vault documents', () => {
	for (const f of ['a.html', 'b.HTM', 'c.svg', 'd.xhtml', 'e.xml']) assert.equal(isScriptableDocument(f), true, f);
	for (const f of ['a.png', 'b.md', 'c.pdf', 'd.js']) assert.equal(isScriptableDocument(f), false, f);
});
