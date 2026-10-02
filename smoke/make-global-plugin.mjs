// Build the global-plugin smoke fixture: an isolated userData directory
// holding one installed plugin that exercises all three surfaces, plus a
// vault whose note uses its fence.
//
//   node smoke/make-global-plugin.mjs /tmp/gp
//   CLEW_USER_DATA=/tmp/gp/userdata CLEW_SMOKE=/tmp/gp/out.png \
//     CLEW_SMOKE_SCRIPT=smoke/global-plugin-scenario.js \
//     CLEW_SMOKE_FRAME_SCRIPT=smoke/global-plugin-frame.js \
//     CLEW_SMOKE_VAULT=/tmp/gp/vault CLEW_SMOKE_LOG=1 npx electron .
//
// Pass --enabled to pre-enable it for the vault (the state after a restart):
// since the full vault-trust design (frame-bridge.md §4.7) the enable lives
// ON THE DEVICE — userdata/vault-trust.json, written here through the real
// store — and the vault's own vault-settings.json only asks. The vault stays
// UNTRUSTED: a global plugin is the user's code and runs anyway. Without
// --enabled nothing is enabled, which is how the gate is checked.
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2];
if (!base) { console.error('usage: node smoke/make-global-plugin.mjs <dir> [--enabled]'); process.exit(1); }
const enabled = process.argv.includes('--enabled');

const plugin = path.join(base, 'userdata', 'plugins', 'hello-global');
const vault = path.join(base, 'vault');
fs.rmSync(base, { recursive: true, force: true });
fs.mkdirSync(plugin, { recursive: true });
fs.mkdirSync(path.join(vault, '.clew'), { recursive: true });

fs.writeFileSync(path.join(plugin, 'manifest.json'), JSON.stringify({
	id: 'hello-global',
	name: 'Hello Global',
	version: '1.0.0',
	description: 'Smoke fixture: one globally installed plugin, all three surfaces.',
	apiVersion: 1,
	surfaces: {
		engine: { file: 'engine.js', extensions: 'helloFence' },
		preview: 'preview.js',
		app: 'app.js',
	},
}, null, '\t') + '\n');

fs.writeFileSync(path.join(plugin, 'engine.js'), `export const helloFence = {
	name: 'helloFence',
	level: 'block',
	start(src) { return src.match(/^\`\`\`hello[ \\t]*$/m)?.index; },
	tokenizer(src) {
		const match = /^\`\`\`hello[ \\t]*\\n([\\s\\S]*?)\\n\`\`\`[ \\t]*(?:\\n+|$)/.exec(src);
		if (!match) return undefined;
		return { type: 'helloFence', raw: match[0], text: match[1] };
	},
	renderer(token) {
		if (global.isLatex) return '';
		return \`<div class="hello-global-fence">GLOBAL ENGINE: \${token.text}</div>\\n\`;
	},
};
`);

// Siblings load the house way: relative to this script's own URL. A bare
// relative fetch would resolve against the NOTE's URL instead.
fs.writeFileSync(path.join(plugin, 'preview.js'), `const scriptUrl = document.currentScript && document.currentScript.src;
document.body.setAttribute('data-hello-global-preview', 'loaded');
fetch(new URL('sibling.json', scriptUrl).href)
	.then((r) => r.json())
	.then((d) => document.body.setAttribute('data-hello-global-sibling', d.ok))
	.catch((e) => document.body.setAttribute('data-hello-global-sibling', 'ERR ' + e));
`);
fs.writeFileSync(path.join(plugin, 'sibling.json'), '{"ok":"yes"}\n');
fs.writeFileSync(path.join(plugin, 'app.js'), `clew.commands.register({
	id: 'greet',
	name: 'Hello from a global plugin',
	run: () => clew.ui.notice('global plugin command ran'),
});
`);

fs.writeFileSync(path.join(vault, 'Note.md'), '# Global plugin test\n\n```hello\nit works\n```\n');
if (enabled) {
	fs.writeFileSync(path.join(vault, '.clew', 'vault-settings.json'),
		JSON.stringify({ plugins: ['hello-global'] }, null, '\t') + '\n');
	const { createTrustStore } = await import('../src/main/vault-trust.js');
	const store = createTrustStore({ file: path.join(base, 'userdata', 'vault-trust.json') });
	store.migrate([]);
	store.setEnable(vault, { plugins: ['hello-global'] });
}
console.log(`fixture in ${base} (vault ${enabled ? 'ENABLES' : 'does not enable'} the plugin)`);
