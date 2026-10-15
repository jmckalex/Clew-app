// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// What a PDF via LaTeX runs (src/main/latex-engine.js#latexmkCommand, called
// by export.js#compilePdf): latexmk and biber take the user's own
// configuration, never a file in the folder the build runs in — a book's is
// the vault's build/, where a vault can leave a `latexmkrc` (Perl, run) or a
// `biber.conf` (its output_file writes anywhere); and a document's TeX can
// write one into any folder it runs in. The second half runs the real
// latexmk and biber over planted files, each of which would touch a sentinel.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { latexmkCommand } from '../src/main/latex-engine.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-latexmk-command-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const filesAt = (...paths) => (p) => paths.includes(p);
const rcArgs = (args) => args.slice(0, args.indexOf('-e'));

test('-norc, then latexmk\'s own system and user files with -r — the first of each, in its order', () => {
	const env = { HOME: '/h' };
	assert.deepEqual(rcArgs(latexmkCommand({ engine: 'pdflatex', texFile: 'x.tex', env, isFile: filesAt() }).args), ['-norc']);
	const both = latexmkCommand({ engine: 'pdflatex', texFile: 'x.tex', env,
		isFile: filesAt('/usr/local/share/latexmk/LatexMk', '/etc/latexmkrc', '/h/.config/latexmk/latexmkrc', '/h/.latexmkrc') });
	assert.deepEqual(rcArgs(both.args), ['-norc', '-r', '/usr/local/share/latexmk/LatexMk', '-r', '/h/.config/latexmk/latexmkrc']);
	assert.deepEqual(both.args.slice(-5), ['-pdf', '-g', '-interaction=nonstopmode', '-quiet', 'x.tex']);
	assert.deepEqual(rcArgs(latexmkCommand({ engine: 'lualatex', texFile: 'x.tex', env: { HOME: '/h', XDG_CONFIG_HOME: '/x' },
		isFile: filesAt('/h/.config/latexmk/latexmkrc', '/h/.latexmkrc') }).args), ['-norc', '-r', '/h/.latexmkrc'], 'XDG_CONFIG_HOME replaces ~/.config');
	assert.deepEqual(rcArgs(latexmkCommand({ engine: 'pdflatex', texFile: 'x.tex', env: { HOME: '/h', LATEXMKRCSYS: '/gone' },
		isFile: filesAt('/etc/LatexMk') }).args), ['-norc'], 'LATEXMKRCSYS naming no file: no system file, as latexmk reads none');
	assert.deepEqual(rcArgs(latexmkCommand({ engine: 'pdflatex', texFile: 'x.tex', env: {}, isFile: filesAt('/.latexmkrc') }).args), ['-norc'], 'no home: no user file');
});

test('biber gets the user\'s own config file, in biber\'s order, else --noconf', () => {
	const biber = (env, ...files) => {
		const c = latexmkCommand({ engine: 'pdflatex', texFile: 'x.tex', env, isFile: filesAt(...files), platform: 'darwin' });
		return [c.args[c.args.indexOf('-e') + 1], c.env];
	};
	const [none, noneEnv] = biber({ HOME: '/h' });
	assert.match(none, /q\( --noconf\)/);
	assert.deepEqual(noneEnv, {});
	const [home, homeEnv] = biber({ HOME: '/h' }, '/h/Library/biber/biber.conf', '/h/.biber.conf');
	assert.match(home, /--configfile="\$CLEW_BIBER_CONF"/);
	assert.deepEqual(homeEnv, { CLEW_BIBER_CONF: '/h/.biber.conf' });
	assert.deepEqual(biber({ HOME: '/h' }, '/h/Library/biber/biber.conf')[1], { CLEW_BIBER_CONF: '/h/Library/biber/biber.conf' });
});

// The real tools. Skipped on a machine without them.
const TEX_DIRS = ['/Library/TeX/texbin', '/usr/local/bin', '/opt/homebrew/bin'];
const tool = (name) => TEX_DIRS.map((d) => path.join(d, name)).find((p) => fs.existsSync(p)) ?? null;
const latexmk = tool('latexmk');
const haveTools = latexmk && tool('biber') && tool('pdflatex');
const skip = haveTools ? false : 'latexmk, biber and pdfLaTeX are not installed';
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

const run = (dir, home) => {
	const env = { ...process.env, HOME: home, PATH: `${TEX_DIRS.join(':')}:${process.env.PATH}` };
	delete env.XDG_CONFIG_HOME;
	delete env.LATEXMKRCSYS;
	const command = latexmkCommand({ engine: 'pdflatex', texFile: 'Book.tex', env, isFile });
	return new Promise((resolve) => execFile(latexmk, command.args, { cwd: dir, env: { ...env, ...command.env }, timeout: 50000 },
		(err, stdout, stderr) => resolve({ err, log: `${stdout}\n${stderr}` })));
};
const sentinel = (name) => path.join(root, name);
const rcTouching = (name) => `system("touch '${sentinel(name)}'");\n`;
const biberConfWriting = (name) => `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n  <output_file>${sentinel(name)}</output_file>\n</config>\n`;
const BIB = '@book{k, author = {A. Author}, title = {A Title}, year = {2000}}\n';
const book = (body = '') => `\\documentclass{article}\n\\usepackage[backend=biber]{biblatex}\n\\addbibresource{refs.bib}\n${body}\\begin{document}\nSee \\cite{k}.\n\\printbibliography\n\\end{document}\n`;

test('a build folder\'s latexmkrc, .latexmkrc and biber.conf are never read — the user\'s own are', { skip }, async () => {
	const home = path.join(root, 'home');
	const build = path.join(root, 'vault', 'Books', 'build');
	fs.mkdirSync(home, { recursive: true });
	fs.mkdirSync(build, { recursive: true });
	fs.writeFileSync(path.join(home, '.latexmkrc'), rcTouching('user-rc-read'));
	fs.writeFileSync(path.join(home, '.biber.conf'), '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n  <mincrossrefs>2</mincrossrefs>\n</config>\n');
	fs.writeFileSync(path.join(build, 'latexmkrc'), rcTouching('vault-latexmkrc-ran'));
	fs.writeFileSync(path.join(build, '.latexmkrc'), rcTouching('vault-dot-latexmkrc-ran'));
	fs.writeFileSync(path.join(build, 'biber.conf'), biberConfWriting('vault-biber-conf-wrote.bbl'));
	fs.writeFileSync(path.join(build, 'refs.bib'), BIB);
	fs.writeFileSync(path.join(build, 'Book.tex'), book());
	const { log } = await run(build, home);
	assert.equal(fs.existsSync(sentinel('vault-latexmkrc-ran')), false, 'the build folder\'s latexmkrc ran');
	assert.equal(fs.existsSync(sentinel('vault-dot-latexmkrc-ran')), false, 'the build folder\'s .latexmkrc ran');
	assert.equal(fs.existsSync(sentinel('vault-biber-conf-wrote.bbl')), false, 'biber obeyed the build folder\'s biber.conf');
	assert.ok(fs.existsSync(sentinel('user-rc-read')), `the user's ~/.latexmkrc was read\n${log}`);
	assert.ok(fs.existsSync(path.join(build, 'Book.pdf')), `a PDF\n${log}`);
	assert.ok(fs.existsSync(path.join(build, 'Book.bbl')), 'biber wrote its .bbl where latexmk asked');
	assert.match(fs.readFileSync(path.join(build, 'Book.blg'), 'utf8'), /Config file is '.*\/home\/\.biber\.conf'/, 'the user\'s own biber.conf');
});

test('a biber.conf the document\'s TeX writes during the run is not read either', { skip }, async () => {
	const home = path.join(root, 'bare-home');
	const dir = path.join(root, 'fresh');
	fs.mkdirSync(home, { recursive: true });
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, 'refs.bib'), BIB);
	const plant = biberConfWriting('tex-biber-conf-wrote.bbl').trim().split('\n').map((l) => `\\immediate\\write\\plant{${l.replace(/[#%]/g, '')}}`).join('\n');
	fs.writeFileSync(path.join(dir, 'Book.tex'), book(`\\newwrite\\plant\n\\immediate\\openout\\plant=biber.conf\n${plant}\n\\immediate\\closeout\\plant\n`));
	const { log } = await run(dir, home);
	assert.ok(fs.existsSync(path.join(dir, 'biber.conf')), `the document planted its biber.conf\n${log}`);
	assert.equal(fs.existsSync(sentinel('tex-biber-conf-wrote.bbl')), false, 'biber obeyed a biber.conf the document wrote');
	assert.ok(fs.existsSync(path.join(dir, 'Book.pdf')), `a PDF\n${log}`);
});
