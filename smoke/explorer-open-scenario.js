// The file explorer's "Open in Default App" (clew-file-explorer.js, the
// owner's ask 2026-10-01): a FILE's menu offers it, a folder's does not; it
// hands the file to the OS through the `|external` alias's guard
// (actions.openFileExternally → SHELL_OPEN_PATH → main/open-file.js#planOpen).
// Under CLEW_SMOKE main logs `smoke-open-path: <absolute path>` instead of
// launching anything. Fixture:
//
//   mkdir -p <dir>/Notes <dir>/Tools && cp demo-vault/Attachments/sample.pdf <dir>/Notes/Paper.pdf
//   printf 'echo hi\n' > <dir>/Tools/run.sh && printf '# Home\n' > <dir>/Home.md
//
// Expect `file Notes/Paper.pdf offers=true`, `folder Notes offers=false`,
// main's `smoke-open-path: <dir>/Notes/Paper.pdf`, and for the script
// `refused notice="Clew does not open .sh files in another app — …"` with no smoke-open-path
// line for it.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: true, activeTool: 'files' });
const row = (path) => document.querySelector(`clew-file-explorer .tree-item[data-path="${CSS.escape(path)}"]`);
for (let i = 0; i < 100 && !(row('Notes/Paper.pdf') && row('Tools/run.sh')); i++) await sleep(100);

/** Right-click a row; the menu's labels; the menu left open. */
async function menuFor(path) {
	document.querySelector('.clew-menu')?.remove();
	const r = row(path).getBoundingClientRect();
	row(path).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 5 }));
	await sleep(150);
	return [...document.querySelectorAll('.clew-menu .menu-item')];
}
const OPEN = 'Open in Default App';

let items = await menuFor('Notes/Paper.pdf');
console.log(`smoke-eo: file Notes/Paper.pdf offers=${items.some((b) => b.textContent === OPEN)}`);
items = await menuFor('Notes');
console.log(`smoke-eo: folder Notes offers=${items.some((b) => b.textContent === OPEN)}`);
document.querySelector('.clew-menu')?.remove();

items = await menuFor('Notes/Paper.pdf');
items.find((b) => b.textContent === OPEN).click();
await sleep(800);
console.log('smoke-eo: clicked Paper.pdf');

items = await menuFor('Tools/run.sh');
items.find((b) => b.textContent === OPEN).click();
let notice = '';
for (let i = 0; i < 40 && !notice; i++) {
	await sleep(100);
	notice = [...document.querySelectorAll('.clew-notice')].map((n) => n.textContent).find((t) => /does not open/.test(t)) ?? '';
}
console.log(`smoke-eo: refused notice=${JSON.stringify(notice.trim())}`);
