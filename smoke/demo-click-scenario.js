// First-run scenario: a stranger clicks "Explore the demo vault".
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const btn = document.querySelector('.welcome-demo');
console.log('smoke-demo: button=' + !!btn);
btn?.click();
// The vault copies (8 MB), opens, indexes, and the tree renders.
for (let i = 0; i < 60; i++) {
	await sleep(500);
	if (window.__clew?.vaultStore?.vault) break;
}
console.log('smoke-demo: vault=' + (window.__clew?.vaultStore?.vault?.name ?? 'NONE'));
await sleep(2000);
