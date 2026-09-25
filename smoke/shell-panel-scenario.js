// The shell panel (renderer/components/workspace/clew-shell-panel.js plus
// main/shell-core.js): a real shell, under a real pty, pinned under the
// workspace. The pty itself is unit-tested (tests/shell-core.test.js), but
// "a keystroke reaches the shell and its output reaches the grid" is only
// true end to end.
//
// Three phases, all driven by REAL input:
//   1. ⌃` opens the panel and focuses the grid. The chord is dispatched on
//      the window in the CAPTURE phase, so it must win against xterm's own
//      keyboard once the terminal has focus.
//   2. `echo clew-smoke-shell-ok`, then Enter. A pty ECHOES what is typed,
//      so the string must appear TWICE — that is the difference between a
//      pty and a pipe, and the whole reason for the python helper.
//   3. ⌃` again, from INSIDE the terminal: the panel closes, and the
//      backtick must not have been typed into the shell.
//
// Every observation WAITS for its condition instead of firing on a clock:
// the harness starts dispatching input only after this script has finished,
// and how long the boot before that takes is not ours to know (a run whose
// vault opened three seconds later reported an empty panel and a shell that
// had never been typed into — the scenario was wrong, not the panel).
//
// Expect: `open=true focused=true`, `cols`/`rows` well above 1 (a fit
// against a real box — 1×1 is a panel measured while display:none),
// `pty=true`, `echoes=2`, `closed=true stray-backtick=false`, and
// `alive=true` — the session survives the panel closing, which is the point
// of keeping it.
//
// Run: CLEW_SMOKE=/tmp/shell.png CLEW_SMOKE_SCRIPT=smoke/shell-panel-scenario.js
//      CLEW_SMOKE_VAULT=<any vault> CLEW_SMOKE_LOG=1 electron .
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;

/** Poll until `test()` is true, or give up. Returns whether it came true. */
const until = async (test, ms = 20000) => {
	for (let waited = 0; waited < ms; waited += 100) {
		if (test()) return true;
		await sleep(100);
	}
	return false;
};

// The vault is opened asynchronously at boot; nothing here works without it.
await until(() => vaultStore.vault);
console.log('smoke-shell: vault=' + (vaultStore.vault?.path ?? 'NONE'));

// The panel's open/closed state is remembered PER VAULT, in the vault's own
// .clew/workspace.json — so a second run over a fixture the first one left
// open would begin with the panel already showing, and the opening chord
// would CLOSE it. (That is exactly what happened on 2026-09-25, and it looks
// for all the world like a broken chord.) Start from a known state.
workspaceStore.setShell({ open: false });
await sleep(300);

const panel = () => document.querySelector('clew-shell-panel');
const grid = () => panel()?.querySelector('.shell-grid');
/** Everything xterm currently holds, as one string. */
const bufferText = () => {
	const term = window.__clew.shellTerminal;
	if (!term) return '';
	const lines = [];
	for (let y = 0; y < term.buffer.active.length; y++) {
		lines.push(term.buffer.active.getLine(y)?.translateToString(true) ?? '');
	}
	return lines.join('\n');
};
const MARK = 'clew-smoke-shell-ok';
const echoes = () => bufferText().split(MARK).length - 1;

window.__clewSmokeInput = [
	{ combo: { key: '`', modifiers: 2 } },
	// The pty, the shell and its rc files: a prompt is not instant.
	{ wait: 3000 },
	{ text: `echo ${MARK}` },
	{ wait: 500 },
	{ combo: { key: 'Enter' } },
	{ wait: 3000 },
	// From inside the terminal: the window dispatcher must claim it first.
	{ combo: { key: '`', modifiers: 2 } },
	// Slack for the reports below, which are the point of the run.
	{ wait: 4000 },
];

(async () => {
	// ---- phase 1: the chord opens it and takes the caret ----------------
	await until(() => workspaceStore.shell.open);
	const term = () => window.__clew.shellTerminal;
	await until(() => (term()?.cols ?? 0) > 1);
	console.log('smoke-shell: open=' + !!workspaceStore.shell.open
		+ ' focused=' + (grid()?.contains(document.activeElement) ?? false)
		+ ' cols=' + (term()?.cols ?? 0) + ' rows=' + (term()?.rows ?? 0)
		+ ' height=' + Math.round(panel()?.getBoundingClientRect().height ?? 0)
		+ ' font=' + JSON.stringify(term()?.options.fontFamily ?? ''));

	// ---- phase 2: a command runs and its output comes back --------------
	// Twice: the pty's echo of the typed line, then the line echo printed.
	await until(() => echoes() >= 2);
	console.log('smoke-shell: echoes=' + echoes()
		+ ' pty=' + (window.__clew.shellPty ?? 'unknown'));
	console.log('smoke-shell: buffer-tail=' + JSON.stringify(
		bufferText().split('\n').filter((l) => l.trim()).slice(-4).join(' | ')));

	// ---- phase 3: the chord closes it, and the shell keeps running ------
	await until(() => !workspaceStore.shell.open);
	console.log('smoke-shell: closed=' + !workspaceStore.shell.open
		+ ' stray-backtick=' + /`/.test(bufferText()));
	const again = await ipc.invoke('clew:shell-open', {});
	console.log('smoke-shell: alive=' + (again?.running === true));
	// Leave it showing: a screenshot of a hidden panel proves nothing.
	workspaceStore.setShell({ open: true });
})();
