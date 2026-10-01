// A callout's fold chevron in live edit, clicked for REAL (it moved to the
// right of the title row and is drawn as reading view's, 2026-10-01).
// Fixture: `smoke/make-callout-vault.sh <dir>`. Expect `before folded=1
// hidden-text=false`, after the first click `opened … hidden-text=true`,
// after the second `closed … hidden-text=false`; the head line's height the
// same each time it is folded (`head-h` equal).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, editorPool } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Callouts.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
for (let i = 0; i < 100 && !editorPool.get(tab.id)?.view; i++) await sleep(20);
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: 0 } });
await sleep(1500);
const shown = () => [...document.querySelectorAll('.cm-editor .cm-line')].some((l) => l.textContent.includes('Hidden until opened'));
const head = () => [...document.querySelectorAll('.cm-editor .le-callout-head')].find((l) => l.textContent.includes('Folded at first'));
const log = (what) => console.log(`smoke-cf: ${what} folded=${document.querySelectorAll('.cm-editor .le-callout-folded').length} hidden-text=${shown()} head-h=${Math.round(head()?.getBoundingClientRect().height ?? 0)}`);
log('before');
// The warning callout's chevron, by its type's line class — twice.
const CHEV = { click: { selector: '.cm-editor .le-callout-head.le-callout-warning .le-callout-fold' } };
window.__clewSmokeInput = [{ wait: 300 }, CHEV, { wait: 800 }, CHEV, { wait: 800 }];
(async () => {
	await sleep(900);
	log('opened');
	await sleep(1000);
	log('closed');
})();
