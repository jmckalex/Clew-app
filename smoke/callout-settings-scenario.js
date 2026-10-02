// Settings → Callouts (settings-callouts.js) on the custom-callout fixture
// (smoke/make-custom-callout-vault.sh): each row says what it is or why it
// is skipped — `smoke-cs: vault:<i> name=… note=…`, the three refused rows
// (1bad, evil, nosuch) with their reasons, warning "Changes the built-in" —
// then the icon picker opens from the remark row by a REAL click, is searched
// for "flask" by real typing (`smoke-cs: picker open=true search="flask"
// status="2 icons" first=solid:flask`), and the screenshot shows it;
// `palette remark=true … evil=false` (the palette's "Insert … callout"
// commands follow the table). The boot log has `smoke-callouts: icon table
// loaded` from the vault's own definitions (main resolving them).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, actions } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
actions.openSettings();
let section = null;
for (let i = 0; i < 100 && !(section = document.querySelector('.callouts-section')); i++) await sleep(50);
await sleep(1500);
section.scrollIntoView({ block: 'start' });
await sleep(300);
for (const group of section.querySelectorAll('.callout-def-group')) {
	[...group.querySelectorAll('.callout-def-row')].forEach((row, i) => {
		console.log(`smoke-cs: ${group.dataset.scope}:${i} name=${row.querySelector('.callout-def-name').value}`
			+ ` icon=${row.querySelector('.callout-def-icon span')?.textContent} note=${JSON.stringify(row.querySelector('.callout-def-note').textContent)}`);
	});
	console.log(`smoke-cs: ${group.dataset.scope} group-notes=${JSON.stringify(group.querySelector('.callout-def-group-notes').textContent)}`);
}
// The custom types are in the palette as well ("Insert … callout").
const { registry } = window.__clew;
const inserts = registry.allCommands().filter((c) => c.id.startsWith('format:callout-')).map((c) => c.id.slice(15));
console.log(`smoke-cs: palette ${['remark', 'pale', 'deep', 'warning', 'suggestion'].map((t) => `${t}=${inserts.includes(t)}`).join(' ')} evil=${inserts.includes('evil')}`
	+ ` warning-name=${JSON.stringify(registry.allCommands().find((c) => c.id === 'format:callout-warning')?.name)}`);
const remark = [...section.querySelectorAll('.callout-def-row')].find((r) => r.querySelector('.callout-def-name').value === 'remark');
const sample = remark.querySelector('.callout-sample.is-light .callout-sample-title');
console.log(`smoke-cs: preview light-title-color=${getComputedStyle(sample).color} text=${JSON.stringify(sample.textContent)}`);
remark.scrollIntoView({ block: 'center' });
await sleep(300);
const b = remark.querySelector('.callout-def-icon').getBoundingClientRect();
const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
console.log(`smoke-cs: click-target=${hit?.closest('.callout-def-icon') ? 'icon-button' : hit?.className}`);
// Queued input runs after this script returns, so the check after it runs
// detached (callout-fold-scenario.js does the same).
window.__clewSmokeInput = [
	{ click: { x: b.left + b.width / 2, y: b.top + b.height / 2 } },
	{ wait: 1500 },
	{ text: 'flask' },
	{ wait: 1500 },
];
(async () => {
	await sleep(2600);
	const picker = document.querySelector('.callout-icon-picker');
	const first = picker?.querySelector('.callout-icon-choice')?.dataset.icon;
	console.log(`smoke-cs: picker open=${Boolean(picker)} search=${JSON.stringify(picker?.querySelector('.callout-icon-search')?.value)}`
		+ ` status=${JSON.stringify(picker?.querySelector('.callout-icon-status')?.textContent)} first=${first} shown=${picker?.querySelectorAll('.callout-icon-choice').length}`);
})();
