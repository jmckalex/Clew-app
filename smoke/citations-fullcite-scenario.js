// A citation's hover when the vault NAMES a bibliography (§5.14): the engine
// formats `\fullcite{key}` in the vault's style inside the popover.
// Fixture: `node smoke/make-citations-vault.mjs <dir>`, then
//   echo '{"bibliography":"refs.bib"}' > <dir>/.clew/vault-settings.json
// Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/citations-fullcite-frame.js
// CLEW_SMOKE_FRAME_MATCH=__clew_block__. Expect `visible=true kind=block
// ready=true label="Alexander 2023"` and from the frame
// `text="Alexander, J. McKenzie. 2023. The Structural Evolution of Morality."`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, settingsStore } = window.__clew;
settingsStore.set('linkPreview', 'hover');
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('A.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await sleep(3000);
const r = document.querySelector('.cm-content .le-cite').getBoundingClientRect();
window.__clewSmokeInput = [{ move: { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } }, { wait: 3000 }];
setTimeout(() => { const p = window.__clew.linkPreview().describe(); console.log(`smoke-fc: visible=${p.visible} kind=${p.kind} ready=${p.ready} label=${JSON.stringify(p.label)}`); }, 2800);
