// A note's build warnings, said quietly (renderer/build-warnings.js): the
// LaTeX-export lint the engine runs on every build since jmarkdown 0631c42.
// Fixture (two notes):
//
//   mkdir -p <dir>
//   printf '# Lint\n\nCosts $5 and $10 here.\n\n$$\\begin{align*} a &= b \\end{align*}$$\n\nA brace } alone, and $\\bbox[red]{x}$.\n' > <dir>/Lint.md
//   printf -- '---\nSilence warnings: dollars\n---\n# Quiet\n\nCosts $5 and $10 here.\n' > <dir>/Quiet.md
//
// Expect:
//   reading: item="⚠ N" title="LaTeX export: dollars, display-math, braces, mathjax-only …" (codes as found)
//   list: rows=N codes=[…]  (the click opens every warning, its code beside it)
//   quiet: item=none        (Silence warnings: dollars — and nothing else wrong)
//   export: warnings=N notice="LaTeX export: …"   (what the export's notice says)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore } = window.__clew;
const log = (s) => console.log('smoke-bw: ' + s);
const item = () => document.querySelector('clew-status-bar .clew-build-warnings');
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};

const lint = workspaceStore.openNote('Lint.md', { defaultMode: 'reading' });
workspaceStore.setTabMode(lint.id, 'reading');
await until(() => item());
log(`reading: item=${JSON.stringify(item()?.textContent ?? 'none')} title=${JSON.stringify(item()?.title ?? '')}`);
item()?.click();
await until(() => document.querySelector('.clew-modal .modal-result'), 3000);
const rows = [...document.querySelectorAll('.clew-modal .modal-result')];
log(`list: rows=${rows.length} codes=${JSON.stringify(rows.map((r) => r.querySelector('.result-hint')?.textContent ?? ''))}`);
await sleep(600);   // for the screenshot below, the list open
document.querySelector('.clew-modal')?.remove();

const quiet = workspaceStore.openNote('Quiet.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(quiet.id, 'reading');
await sleep(4000);
log(`quiet: item=${JSON.stringify(item()?.textContent ?? 'none')}`);

workspaceStore.activateTab(lint.id);
await sleep(500);
// The export command asks for a destination, which the harness cannot
// answer; the IPC it calls is driven directly, and its notice's text is the
// same summary (commands/builtin.js#exportActiveNote).
const { warningSummary } = window.__clew.buildWarnings;
const result = await window.__clew.ipc.invoke('clew:export-note', { path: 'Lint.md', format: 'latex', outFile: 'out/Lint.tex' });
log(`export: warnings=${result?.warnings?.length ?? 'none'} notice=${JSON.stringify(warningSummary(result?.warnings ?? []))}`);
