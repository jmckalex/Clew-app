// clew:// links (main/deep-link-host.js, renderer/deep-link.js), given on the
// command line as a dev build takes them: over `node
// smoke/make-deep-link-vault.mjs <dir>`, with CLEW_USER_DATA=<dir>/ud (Vault
// known) and CLEW_SMOKE_LINK_ANSWER=cancel, launched as
//   electron . 'clew://open?vault=Vault&note=Guide/Two.md#Second%20heading'
//              'clew://run?x=1' 'clew://new?vault=Vault&note=Ideas/Fresh'
//              'clew://new?vault=Vault&daily=1' 'clew://open?vault=<dir>/Elsewhere&note=x.md'
// Main logs `smoke-link: … → open|new|refused: …`, `smoke-link-ask: …`
// (the unknown vault: asked, cancelled), `smoke-link-done: …`; this logs
// what the window shows:
//   `dl: tabs=… active=… cursor-line=… heading-line=… fresh=… daily=… notices=…`
// Without CLEW_SMOKE_VAULT (a fresh profile: the welcome window) the links
// must land in THAT window — `smoke: 1 screenshot(s) written` (README).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, vaultStore } = window.__clew;
const log = (s) => console.log('smoke-dl: ' + s);
await sleep(9000);
const tabs = workspaceStore.allGroups().flatMap((g) => g.tabs).map((t) => t.path);
// The heading's tab, brought forward: a tab in the background keeps its jump
// until it is shown (actions.js#jumpToLine, pendingLine).
const twoTab = workspaceStore.allGroups().flatMap((g) => g.tabs).find((t) => t.path === 'Guide/Two.md');
if (twoTab) { workspaceStore.activateTab(twoTab.id); await sleep(1500); }
const view = twoTab ? editorPool.get(twoTab.id)?.view : null;
const head = view ? view.state.doc.lineAt(view.state.selection.main.head).number : null;
const headingLine = view ? view.state.doc.toString().split('\n').indexOf('## Second heading') + 1 : null;
const day = new Date();
const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
const daily = tabs.find((p) => p?.includes(key)) ?? null;
const notices = [...document.querySelectorAll('.clew-notice')].map((n) => n.textContent.slice(0, 70));
log(`tabs=${JSON.stringify(tabs)} active=${workspaceStore.activeTab()?.path}`);
log(`heading cursor-line=${head} heading-line=${headingLine} fresh=${vaultStore.pathExists('Ideas/Fresh.md')} daily=${daily}`);
log(`notices=${JSON.stringify(notices)}`);
