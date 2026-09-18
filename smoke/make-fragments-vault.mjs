// The fixture for tex-fragments-scenario.js: a vault whose figures ask for
// named preamble text, plus the two scopes that define it.
//
//   node smoke/make-fragments-vault.mjs /tmp/frag-vault /tmp/frag-userdata
//
// The GLOBAL fragments go in <userdata>/clew-settings.json, which
// settings.js reads at start (under CLEW_SMOKE it never WRITES, so a
// scenario cannot leak into the real app — but it still loads). THIS
// VAULT's go in .clew/vault-settings.json, which render-service.js reads
// when it opens the vault. `math macros` is deliberately defined in both:
// the vault's must win, and the figure's own source is where that shows.
//
// Run with a fresh userdata every time — mp-tikz-wasm's IndexedDB result
// cache would otherwise answer for the engine and prove nothing.
import fs from 'node:fs';
import path from 'node:path';

const [dir, userData] = process.argv.slice(2);
if (!dir || !userData) {
	console.error('usage: node smoke/make-fragments-vault.mjs <vault-dir> <userdata-dir>');
	process.exit(1);
}

const globalFragments = [
	{ name: 'math macros', text: '\\newcommand{\\R}{\\mathbb{R}}' },
	{ name: 'page setup', text: '\\usepackage{mathtools}\n\\newcommand{\\glob}{GLOBALFRAG}' },
	{ name: 'plain macros', text: '\\def\\hi{PLAINFRAG}' },
];
const vaultFragments = [
	{ name: 'Math  Macros', text: '\\newcommand{\\R}{\\mathbf{R}}' }, // shadows, and by a name spelt differently
	{ name: 'colours', text: '\\usepackage{xcolor}\n\\definecolor{accent}{HTML}{4C8BF5}\n\\newcommand{\\vault}{VAULTFRAG}' },
];

const note = `# TeX fragments

## Global fragment

\`\`\`latex clew-fragments='page setup'
Hello \\glob.
\`\`\`

## Vault fragment

\`\`\`latex clew-fragments='colours'
\\textcolor{accent}{Hello \\vault.}
\`\`\`

## Shadowed name

\`\`\`latex clew-fragments='math macros'
$\\R$
\`\`\`

## Without the fragment

\`\`\`latex
$\\R$
\`\`\`

## Two fragments in order

\`\`\`latex clew-fragments='page setup, colours'
\\textcolor{accent}{\\glob\\ and \\vault.}
\`\`\`

## A tikz picture

\`\`\`tikz clew-fragments='colours'
\\fill[accent] (0,0) circle (0.5);
\`\`\`

## A complete document

\`\`\`latex clew-fragments='page setup'
\\documentclass{standalone}
\\begin{document}
\\glob
\\end{document}
\`\`\`

## Plain TeX

\`\`\`tex clew-fragments='plain macros'
\\nopagenumbers
\\hi
\\bye
\`\`\`

## A name nothing defines

\`\`\`latex clew-fragments='typo'
$x$
\`\`\`

## MetaPost has no preamble

\`\`\`metapost clew-fragments='colours'
beginfig(1); draw (0,0)--(20,20); endfig;
\`\`\`

## Control

\`\`\`latex
$1 + 1 = 2$
\`\`\`
`;

fs.mkdirSync(path.join(dir, '.clew'), { recursive: true });
fs.mkdirSync(userData, { recursive: true });
fs.writeFileSync(path.join(dir, 'Fragments.md'), note);
fs.writeFileSync(path.join(dir, '.clew', 'vault-settings.json'),
	JSON.stringify({ texFragments: vaultFragments }, null, 2));
fs.writeFileSync(path.join(userData, 'clew-settings.json'),
	JSON.stringify({ texFragments: globalFragments, theme: 'dark' }, null, 2));
console.log(`vault: ${dir}\nuserdata: ${userData}`);
