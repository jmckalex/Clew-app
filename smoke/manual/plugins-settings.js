// Manual screenshot: Settings → This vault, scrolled to the plugin list —
// this vault's three plugins beside a globally installed one. Run with
// CLEW_USER_DATA pointing at the userdata half of make-global-plugin.mjs's
// fixture, over the demo vault. manual/images/plugins-settings.png —
// plugins.html.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, registry } = window.__clew;
workspaceStore.openNote('Guide/Plugins.md', { defaultMode: 'reading' });
await sleep(1500);
registry.runCommand('app:settings');
await sleep(2500);
const row = [...document.querySelectorAll('.settings-section .settings-row, .settings-section > *')]
	.find((el) => el.textContent.includes('Open global plugin folder'));
row?.scrollIntoView({ block: 'center' });
await sleep(300);
console.log('smoke-manual: plugin-rows=' + [...document.querySelectorAll('.settings-section *')]
	.filter((el) => /· (global|this vault)$/.test(el.textContent.trim())).length);
