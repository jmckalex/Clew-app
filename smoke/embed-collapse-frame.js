await new Promise((r) => setTimeout(r, 600));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = (tag) => {
	for (const el of document.querySelectorAll('.internal-embed')) {
		console.log(`smoke-collapse-frame: ${tag} tag=${el.tagName}`
			+ ` open=${el.tagName === 'DETAILS' ? el.open : 'n/a'}`
			+ ` line=${el.dataset.embedLine ?? '-'}`
			+ ` title=${JSON.stringify(el.querySelector('.embed-title')?.textContent.trim())}`
			+ ` shows-body=${/child body/.test(el.textContent)}`);
	}
};
report('before');
// Unfold the closed one by clicking its summary (not its title link, which
// opens the note instead — that is the whole point of the two behaviours).
const closed = [...document.querySelectorAll('details.internal-embed')].find((d) => !d.open);
console.log('smoke-collapse-frame: clicking-line=' + closed?.dataset.embedLine);
closed?.querySelector('summary')?.click();
await sleep(2500);
report('after');
