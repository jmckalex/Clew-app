// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// A note's own PDF frames, rewritten to Clew's viewer page
// (src/main/pdf-frames-rewrite.js, docs/dev/pdf-unification.md §3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewritePdfFrames, vaultPathOf, viewerUrl } from '../src/main/pdf-frames-rewrite.js';

const SID = 'sabc';
const ctx = { sid: SID, noteDir: 'Notes/Week 1' };
const srcOf = (html) => decodeURIComponent(/src="\/__clew_assets__\/clewpdf\/pdf-page\.html\?src=([^"&]+)/.exec(html)?.[1] ?? '');

test('a relative, a vault-absolute and a session-path target all reach the same kind of viewer', () => {
	let r = rewritePdfFrames('<iframe src="paper.pdf"></iframe>', ctx);
	assert.equal(r.rewritten, 1);
	assert.equal(srcOf(r.html), `/${SID}/Notes/Week%201/paper.pdf`);
	r = rewritePdfFrames('<iframe src="/Papers/x.pdf"></iframe>', ctx);
	assert.equal(srcOf(r.html), `/${SID}/Papers/x.pdf`);
	r = rewritePdfFrames(`<iframe src="/${SID}/Papers/x.pdf"></iframe>`, ctx);
	assert.equal(srcOf(r.html), `/${SID}/Papers/x.pdf`);
	r = rewritePdfFrames('<iframe src="../Shared/Deep%20Dive.pdf"></iframe>', ctx);
	assert.equal(srcOf(r.html), `/${SID}/Notes/Shared/Deep%20Dive.pdf`);
});

test('#page=N becomes the viewer\'s page; sizes, style, class and id are kept', () => {
	const r = rewritePdfFrames('<iframe src="paper.pdf#page=12" width="600" height=400 style="border:0" class="wide" id="p1"></iframe>', ctx);
	assert.match(r.html, /&amp;page=12"|&page=12"/);
	assert.match(r.html, / width="600"/);
	assert.match(r.html, / height="400"/);
	assert.match(r.html, / style="border:0"/);
	assert.match(r.html, / class="wide"/);
	assert.match(r.html, / id="p1"/);
	assert.match(r.html, / allow="fullscreen"/);
});

test('<embed> and <object> become the viewer too; the object\'s fallback goes with it', () => {
	let r = rewritePdfFrames('<p>a</p><embed src="paper.pdf" type="application/pdf" width="500"><p>b</p>', ctx);
	assert.equal(r.rewritten, 1);
	assert.match(r.html, /^<p>a<\/p><iframe width="500" src="[^"]+" allow="fullscreen" data-clew-pdf="Notes\/Week 1\/paper.pdf"><\/iframe><p>b<\/p>$/);
	r = rewritePdfFrames('<object data="paper.pdf" type="application/pdf" height="300"><p>Your browser cannot show PDFs.</p></object>after', ctx);
	assert.equal(r.rewritten, 1);
	assert.doesNotMatch(r.html, /cannot show/);
	assert.match(r.html, /<\/iframe>after$/);
});

test('type="application/pdf" marks a target without .pdf; other files are left alone', () => {
	let r = rewritePdfFrames('<iframe src="files/report" type="application/pdf"></iframe>', ctx);
	assert.equal(r.rewritten, 1);
	r = rewritePdfFrames('<iframe src="notes.txt"></iframe><iframe src="deck/index.html"></iframe><img src="x.pdf.png">', ctx);
	assert.equal(r.rewritten, 0);
	assert.equal(r.html, '<iframe src="notes.txt"></iframe><iframe src="deck/index.html"></iframe><img src="x.pdf.png">');
});

test('left alone: ![[x.pdf]]\'s own placeholder, a frame already on the viewer, a climb out of the vault', () => {
	const own = `<div class="internal-embed pdf-embed-box"><embed class="pdf-embed" src="/${SID}/paper.pdf" type="application/pdf"></div>`;
	assert.equal(rewritePdfFrames(own, ctx).html, own);
	const viewer = `<iframe src="${viewerUrl(SID, 'paper.pdf')}"></iframe>`;
	assert.equal(rewritePdfFrames(viewer, ctx).rewritten, 0);
	assert.equal(rewritePdfFrames('<iframe src="../../../../etc/x.pdf"></iframe>', ctx).rewritten, 0);
});

test('web PDFs are reported for §4, not rewritten here; other schemes ignored', () => {
	const r = rewritePdfFrames('<iframe src="https://example.org/a.pdf"></iframe><embed src="//cdn.example.org/b.pdf"><iframe src="file:///etc/x.pdf"></iframe><iframe src="javascript:alert(1)"></iframe>', ctx);
	assert.equal(r.rewritten, 0);
	assert.deepEqual(r.remote, ['https://example.org/a.pdf', 'https://cdn.example.org/b.pdf']);
});

test('vaultPathOf: the rules on their own', () => {
	assert.equal(vaultPathOf('a.pdf', { sid: SID, noteDir: '' }), 'a.pdf');
	assert.equal(vaultPathOf('./x/../a.pdf', { sid: SID, noteDir: 'N' }), 'N/a.pdf');
	assert.equal(vaultPathOf('..', { sid: SID, noteDir: '' }), null);
	assert.equal(vaultPathOf('mailto:x', { sid: SID }), null);
	assert.equal(vaultPathOf(`clew-preview://vault/${SID}/P/a.pdf`, { sid: SID }), 'P/a.pdf');
});
