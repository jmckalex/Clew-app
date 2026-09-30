// The shell panel against a prompt shaped like the owner's (oh-my-zsh
// "amuse"): a Powerline branch glyph (U+E0A0, private use) in the left
// prompt and an emoji (⌚ U+231A) opening the right one. Never the owner's
// own dotfiles — a ZDOTDIR fixture:
//
//   mkdir -p <z> && cat > <z>/.zshrc <<'EOF'
//   PROMPT=$'%F{10}%1~/%f on %F{magenta}\uE0A0 main%f\n$ '
//   RPS1=$'\u231a %F{cyan}%*%f'
//   EOF
//   ZDOTDIR=<z> CLEW_SMOKE_SCRIPT=smoke/shell-prompt-scenario.js … electron .
//
// Two bugs the owner reported, one line each:
//   `prompt cursor-col=2 after-dollar=" "` — the cursor sits one column past
//   "$ ", so what is typed does not butt against the dollar. zsh measures ⌚
//   as TWO columns (Unicode 9+); an xterm on its default Unicode 6 tables
//   draws it in ONE, so zsh's move back from the right prompt landed one
//   column short, on top of the space: `cursor-col=1`, and `$abc`.
//   `typed line="$ echo x"` — the same, after real typing.
//   `glyph font=…` — the family list the grid draws with, which must name a
//   Nerd/Powerline face for U+E0A0 to be a branch symbol rather than a box
//   (the screenshot shows which).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore } = window.__clew;
const until = async (test, ms = 20000) => {
	for (let waited = 0; waited < ms; waited += 100) {
		if (test()) return true;
		await sleep(100);
	}
	return false;
};
await until(() => vaultStore.vault);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
workspaceStore.setShell({ open: false });
await sleep(300);

const term = () => window.__clew.shellTerminal;
const line = (y) => term()?.buffer.active.getLine(y)?.translateToString(true) ?? '';
const cursorLine = () => {
	const b = term()?.buffer.active;
	return b ? line(b.baseY + b.cursorY) : '';
};

window.__clewSmokeInput = [
	{ combo: { key: '`', modifiers: 2 } },
	{ wait: 4000 },   // the pty, a login zsh, its rc files, the first prompt
	{ text: 'echo x' },
	// Slack for the reports below (they run detached, while this waits).
	{ wait: 6000 },
];

(async () => {
	await until(() => (term()?.cols ?? 0) > 1);
	// The first prompt: its second line starts with "$".
	await until(() => /^\$/.test(cursorLine()), 15000);
	await sleep(500);
	const b = term().buffer.active;
	const text = cursorLine();
	console.log(`smoke-sp: prompt cursor-col=${b.cursorX} after-dollar=${JSON.stringify(text.slice(1, 2))} line=${JSON.stringify(text)}`);
	console.log(`smoke-sp: glyph font=${JSON.stringify(term().options.fontFamily)} unicode=${(() => { try { return term().unicode.activeVersion; } catch { return 'default (proposed API off)'; } })()}`);
	await until(() => /echo x/.test(cursorLine()), 10000);
	console.log(`smoke-sp: typed line=${JSON.stringify(cursorLine().replace(/\s+⌚.*$/, '').replace(/\s+$/, ''))}`);
	const above = line(b.baseY + b.cursorY - 1);
	console.log(`smoke-sp: first-line=${JSON.stringify(above.replace(/\s+$/, ''))} has-branch-glyph=${above.includes('')}`);
})();
