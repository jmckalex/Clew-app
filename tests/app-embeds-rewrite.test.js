import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteAppEmbeds } from '../src/main/app-embeds-rewrite.js';

const embed = (target) => `<clew-app-embed class="clew-app-embed" data-app="${target}" style="width: 100%; height: 320px"><span class="clew-app-label">App: ${target}</span></clew-app-embed>`;

test('a resolved app gets its key, name and entry URL on its own origin', () => {
	const { html, count } = rewriteAppEmbeds(`<p>x</p>${embed('Apps/Timer')}`, {
		restricted: false,
		resolve: (t) => ({ key: 'abc123', manifest: { name: 'Timer & Co', entry: 'ui/index.html' }, folder: t }),
	});
	assert.equal(count, 1);
	assert.match(html, /data-app-key="abc123"/);
	assert.match(html, /data-app-name="Timer &amp; Co"/);
	assert.match(html, /data-app-src="clew-frame:\/\/abc123\/ui\/index.html"/);
	assert.doesNotMatch(html, /data-app-restricted/);
});

test('a restricted vault marks the embed; a refusal replaces it by name', () => {
	const r = rewriteAppEmbeds(embed('Apps/Timer'), { restricted: true, resolve: () => ({ key: 'k', manifest: { name: 'T', entry: 'index.html' } }) });
	assert.match(r.html, /data-app-restricted="1"/);
	const refused = rewriteAppEmbeds(embed('https://x.example/app'), { restricted: false, resolve: () => ({ refusal: 'remote apps are not supported yet <b>' }) });
	assert.equal(refused.html, '<span class="clew-embed-refused">remote apps are not supported yet &lt;b&gt;</span>');
});

test('the target is decoded before it is resolved; other markup is untouched', () => {
	let asked = null;
	rewriteAppEmbeds(embed('Apps/A &amp; B'), { restricted: false, resolve: (t) => { asked = t; return { refusal: 'x' }; } });
	assert.equal(asked, 'Apps/A & B');
	assert.equal(rewriteAppEmbeds('<p>no apps</p>', { resolve: () => { throw new Error('never'); } }).html, '<p>no apps</p>');
});
