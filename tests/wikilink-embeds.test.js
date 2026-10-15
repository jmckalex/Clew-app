// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Embeds in reading view (src/engine/wikilinks.js) through marked, over a
// vault of its own: an embed alone on its line is a block (wikiembed); an
// IMAGE within a line is drawn in place (wikiembedImage), as an export draws
// it — until 2026-10-15 the block extension's start() cut the paragraph at any
// `![[`, so of two on a line the first was "!" and a link; anything but an
// image mid-line is still a link.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Marked } from 'marked';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-embeds-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const vault = path.join(root, 'vault');
fs.mkdirSync(path.join(vault, 'Attachments'), { recursive: true });
for (const f of ['Attachments/a.png', 'Attachments/b.png', 'Doc.pdf']) fs.writeFileSync(path.join(vault, f), 'x');
fs.writeFileSync(path.join(vault, 'Note.md'), '# Note\n\nIts text.\n');
fs.writeFileSync(path.join(root, 'secret.png'), 'x');   // outside the vault
fs.symlinkSync(path.join(root, 'secret.png'), path.join(vault, 'Attachments', 'linked.png'));
process.env.CLEW_VAULT_ROOT = vault;
delete process.env.CLEW_SESSION_ID;

const { default: extensions } = await import('../src/engine/wikilinks.js');
const render = (md) => new Marked().use({ extensions }).parse(md);
const imgs = (html) => [...html.matchAll(/<img class="internal-media" src="([^"]+)" alt="([^"]*)"([^>]*)>/g)].map((m) => `${m[1]}|${m[2]}|${m[3].trim()}`);

test('two images on one line: both drawn in place, in one paragraph — as the export draws them', () => {
	const html = render('![[a.png]] ![[b.png]]\n');
	assert.match(html, /^<p><img [^>]+> <img [^>]+><\/p>/);
	assert.deepEqual(imgs(html), ['/Attachments/a.png|a.png|', '/Attachments/b.png|b.png|']);
	assert.ok(!html.includes('!<a'), 'no "!" and a link');
});

test('an image after text stays in its sentence', () => {
	const html = render('Alone: ![[a.png]]\n');
	assert.match(html, /^<p>Alone: <img class="internal-media" src="\/Attachments\/a\.png" alt="a\.png"><\/p>/);
});

test('an embed alone on its line is still a block — after a paragraph line too', () => {
	assert.equal(render('![[a.png]]\n'), '<img class="internal-media" src="/Attachments/a.png" alt="a.png">\n');
	const html = render('Some text\n![[a.png]]\n');
	assert.match(html, /^<p>Some text<\/p>\n<img class="internal-media"/, 'the paragraph cut where the embed\'s line begins');
});

test('sizes and captions as a block image reads them; a note keyword is no caption', () => {
	assert.deepEqual(imgs(render('x ![[a.png|200]] y\n')), ['/Attachments/a.png|a.png|width="200"']);
	assert.deepEqual(imgs(render('x ![[a.png|A caption|300x200]] y\n')), ['/Attachments/a.png|A caption|width="300" height="200"']);
	assert.deepEqual(imgs(render('x ![[a.png|collapsed]] y\n')), ['/Attachments/a.png|a.png|']);
});

test('a PDF, a note, a missing image within a line: links, as before; alone on a line, blocks', () => {
	for (const [md, href] of [['See ![[Doc.pdf]] here\n', 'Doc.pdf'], ['See ![[Note]] here\n', 'Note'], ['See ![[nothere.png]] here\n', 'nothere.png']]) {
		const html = render(md);
		assert.ok(html.includes(`!<a class="internal-link`) || html.includes('!<span class="internal-link unresolved'), `${md.trim()} → ${html}`);
		assert.ok(html.includes(href));
		assert.equal(imgs(html).length, 0);
	}
	assert.match(render('![[Doc.pdf]]\n'), /<div class="internal-embed pdf-embed-box">/);
	assert.match(render('![[Note]]\n'), /<div class="internal-embed[^"]*"[^>]*>[\s\S]*Its text\./);
});

test('in a vault this device does not trust, an image linked out of it is refused in place, never drawn', () => {
	process.env.CLEW_VAULT_RESTRICTED = '1';
	try {
		const html = render('See ![[linked.png]] here\n');
		assert.equal(imgs(html).length, 0);
		assert.match(html, /<span class="internal-embed unresolved"[^>]*>linked\.png \(this link leaves the vault/);
		assert.deepEqual(imgs(render('See ![[a.png]] here\n')), ['/Attachments/a.png|a.png|'], 'its own images still drawn');
	} finally {
		delete process.env.CLEW_VAULT_RESTRICTED;
	}
});
