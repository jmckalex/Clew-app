// Recording a shortcut in Settings → Hotkeys with a chord the app already
// binds: the recorder must get it, and the bound command must NOT run (with
// ⌘1–⌘9 switching tabs, recording ⌘1 used to leave the Settings tab before
// the recorder heard it). Fixture: three notes, N1–N3 (goto-tab-scenario's
// recipe does). Expect `active=settings` and `recorded=["Mod-1"]` for the
// Diary calendar command, and `count=` the same before and after.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const META = 4;
const { workspaceStore, vaultStore, registry, settingsStore } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
for (const n of [1, 2, 3]) workspaceStore.openNote(`N${n}.md`, { newTab: true });
await sleep(300);
registry.runCommand('app:settings');
await sleep(800);
const kind = () => workspaceStore.activeTab()?.kind;
const row = [...document.querySelectorAll('.hotkey-row')].find((r) => r.querySelector('.hotkey-name')?.textContent === 'Open diary calendar');
console.log(`smoke-hr: before active=${kind()} tabs=${workspaceStore.activeGroup().tabs.length} row=${Boolean(row)}`);
row?.querySelector('.hotkey-button').click();
await sleep(200);
console.log(`smoke-hr: recording=${Boolean(document.querySelector('.hotkey-chords.is-recording'))}`);
window.__clewSmokeInput = [{ wait: 300 }, { combo: { key: '1', modifiers: META } }, { wait: 1200 }];
(async () => {
	await sleep(1500);
	console.log(`smoke-hr: after active=${kind()} tabs=${workspaceStore.activeGroup().tabs.length} recorded=${JSON.stringify(settingsStore.get('hotkeys')?.['nav:diary'] ?? null)}`);
})();
