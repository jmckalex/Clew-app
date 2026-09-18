// Named TeX fragments (`clew-fragments='math macros, colours'`): preamble
// text written once in Settings → TeX fragments and inserted into a figure's
// preamble by the render worker (src/engine/figures.js#applyTexFragments,
// src/engine/tex-fragments.js). Pair with tex-fragments-frame.js.
//
// Fixture and BOTH scopes:
//   node smoke/make-fragments-vault.mjs /tmp/frag-vault /tmp/frag-userdata
// then run with CLEW_USER_DATA=/tmp/frag-userdata (the global fragments live
// there) and CLEW_SMOKE_VAULT=/tmp/frag-vault (this vault's live in its
// .clew/). A fresh userdata each run, or the library's IndexedDB result
// cache answers instead of the engine. Regenerate the fixture too: phase
// three rewrites the vault's fragments.
//
// Three phases, in this order because the frame script runs against
// whatever preview is open when the scenario ENDS — settings first, the
// note last.
//   1  the settings section: both scopes' rows, a real CodeMirror over each
//      fragment (highlighted with the fence grammar — jmd-* faces, the same
//      palette a ```latex fence gets), the shadow note on the vault row that
//      repeats a global name, and Add fragment.
//   2  the note: nine figures and two refusals (the frame script reports
//      what each one became, and which fragment text reached it).
//   3  a fragment EDITED through the real IPC path, which must reconfigure
//      the worker and re-typeset every figure using it: the frame script
//      then finds VAULTFRAG2 where VAULTFRAG was.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, ipc } = window.__clew;

// ---- 1. the settings section ----------------------------------------------
window.__clew.actions.openSettings();
await sleep(1200);
const view = document.querySelector('clew-settings-view');
const section = [...(view?.querySelectorAll('.settings-section') ?? [])]
	.find((s) => s.querySelector('h2')?.textContent === 'TeX fragments');
console.log('smoke-frag-settings: section=' + !!section
	+ ' groups=' + (section?.querySelectorAll('.tex-fragment-group').length ?? 0)
	+ ' rows=' + (section?.querySelectorAll('.tex-fragment-row').length ?? 0)
	+ ' editors=' + (section?.querySelectorAll('.tex-fragment-editor .cm-editor').length ?? 0));

for (const group of section?.querySelectorAll('.tex-fragment-group') ?? []) {
	const scope = group.querySelector('.settings-subhead')?.textContent ?? '?';
	for (const row of group.querySelectorAll('.tex-fragment-row')) {
		const content = row.querySelector('.cm-content');
		// The fence grammars paint jmd-* faces (theme.js), not the markdown
		// cmt-* ones: a fragment is TeX, and is coloured as TeX.
		const faces = [...(content?.querySelectorAll('[class*="jmd-"]') ?? [])]
			.map((el) => el.className).slice(0, 4);
		console.log('smoke-frag-settings: row scope=' + JSON.stringify(scope.split('—')[0].trim())
			+ ' name=' + JSON.stringify(row.querySelector('input[type=text]')?.value ?? null)
			+ ' chars=' + (content?.textContent.length ?? 0)
			+ ' faces=' + JSON.stringify(faces)
			+ ' note=' + JSON.stringify(row.querySelector('.tex-fragment-note')?.textContent ?? ''));
	}
}

const globalGroup = section?.querySelector('.tex-fragment-group');
const before = globalGroup?.querySelectorAll('.tex-fragment-row').length ?? 0;
globalGroup?.querySelector('button.hotkey-button')?.click();
await sleep(300);
const rows = globalGroup?.querySelectorAll('.tex-fragment-row') ?? [];
console.log('smoke-frag-settings: added rows=' + before + '→' + rows.length
	+ ' focused=' + (document.activeElement === rows[rows.length - 1]?.querySelector('input[type=text]'))
	+ ' newEditor=' + !!rows[rows.length - 1]?.querySelector('.cm-editor'));

// ---- 2. the figures --------------------------------------------------------
workspaceStore.openNote('Fragments.md', { defaultMode: 'reading' });
await sleep(4000);
console.log('smoke-frag: frame=' + !!document.querySelector('clew-preview-view iframe'));
await sleep(50000);

// ---- 3. editing a fragment re-typesets what uses it ------------------------
// Through the same channel the settings rows use (CH.VAULT_SETTINGS_SET),
// so this is the real path: ipc → vault-settings.json → reconfigure() →
// standby discarded → open previews re-rendered.
await ipc.invoke('clew:vault-settings-set', {
	key: 'texFragments',
	value: [
		{ name: 'Math  Macros', text: '\\newcommand{\\R}{\\mathbf{R}}' },
		{ name: 'colours', text: '\\usepackage{xcolor}\n\\definecolor{accent}{HTML}{4C8BF5}\n\\newcommand{\\vault}{VAULTFRAG2}' },
	],
});
console.log('smoke-frag: edited the vault fragment "colours" (VAULTFRAG → VAULTFRAG2)');
await sleep(40000);
