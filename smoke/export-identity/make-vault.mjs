// The export-identity vault: `node smoke/export-identity/make-vault.mjs <dir>`.
// The demo vault (its .clew/ settings kept, its caches and workspace not),
// given a vault bibliography and style, plus a note for each construct an
// export has had to get right since 0.12.0 — a title block, a header's Lang
// and engine, citations resolved and not, an embed from a subfolder, a first
// line that looks like a header key, HTML entities, `%` in prose, a header
// and a URL, images LaTeX cannot include, code showing `\end{minted}`,
// multi-paragraph inline notes, Obsidian `%%` comments, header Titles with
// entities. `export-identity.json` lists every note, for scenario.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node smoke/export-identity/make-vault.mjs <dir>');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
fs.rmSync(dir, { recursive: true, force: true });
const skip = new Set(['workspace.json', 'cache.json', 'cache', 'engine']);
fs.cpSync(path.join(repo, 'demo-vault'), dir, {
	recursive: true,
	filter: (src) => !(path.basename(path.dirname(src)) === '.clew' && skip.has(path.basename(src))),
});
const settingsFile = path.join(dir, '.clew', 'vault-settings.json');
const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
fs.writeFileSync(settingsFile, JSON.stringify({ ...settings, bibliography: 'Features/refs.bib', bibliographyStyle: 'apa' }, null, 2));
const key = /@[a-z]+\{([^,]+),/i.exec(fs.readFileSync(path.join(dir, 'Features', 'refs.bib'), 'utf8'))[1];
const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
const F = '```';

put('Ident/Styled.md', '@title[Notes on a Topic]\n@author[A. Writer]\n@date[1 March 2026]\n\n# Overview\n\n* A first point, with a quotation:\n    > "How do $a_1, \\dots, a_k$ combine as $k$ grows?"\n\n    A second paragraph of the point. 🙂\n');
put('Ident/First.md', 'Note: remember this.\n\nA second paragraph.\n');
put('Ident/German.md', '---\nLang: de\n---\n@title[Ein Titel]\n@author[A. Autor]\n\n# Einleitung\n\n"Organisation" und Text.\n');
put('Ident/Pdflatex.md', '---\nLaTeX engine: pdflatex\n---\n# Plain\n\nText with "quotes".\n');
put('Ident/Title.md', '@title[Two Authors]\n@subtitle[A test]\n@author[A. Reader]\n@institution[Somewhere]\n@author[B. Writer]\n@date[20 October 2026]\n\n# One\n\nText.\n');
put('Ident/Cite.md', `See \\citep{${key}} and \\cite{${key}}.\n\n@bibliography\n`);
put('Ident/CiteOff.md', `---\nResolve citations: false\n---\nSee \\citep{${key}}.\n`);
put('Ident/Sub/Embed.md', '# Embed\n\n![[clew-gradient.png]]\n\nText.\n');
put('Ident/Entities.md', '@title[Caf&eacute; &amp; Co&mdash;a test]\n@author[A. Na&iuml;ve]\n\nAn em dash&mdash;here&hellip; caf&eacute;, Q&A; and R&D; and &hearts; and &amp;mdash;.\n\n# Caf&eacute; heading\n\nText.[fn: A note&mdash;with an entity.]\n');
put('Ident/Percent.md', '@title[100% Sure]\n@author[A. 50% Author]\n@date[20% of October]\n\nA [link](https://example.com/a%20b_c~d) and https://example.com/x_y~z%20w and [another](https://example.com/p%2Fq).\n');
put('Ident/PercentHeader.md', '---\nTitle: 100% Header\nAuthor: B. 10% Writer\n---\n# Body\n\nText.\n');
fs.writeFileSync(path.join(dir, 'Ident', 'anim.gif'), Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'));
fs.writeFileSync(path.join(dir, 'Ident', 'pic.webp'), Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64'));
put('Ident/Images.md', '# Images\n\n![A GIF](anim.gif)\n\n![A WebP](pic.webp)\n\nText.\n');
put('Ident/Minted.md', `# Minted\n\nCode that shows the end:\n\n${F}latex\n\\begin{minted}{js}\nconst x = 1;\n\\end{minted}\n${F}\n\nNo language: \`see \\end{minted} here\`.\n\n${F}\nsee \\end{minted} here\n${F}\n\nEnd.\n`);
put('Ident/Notes.md', 'A claim.[fn: The note\'s first paragraph.\n\n    Its second paragraph.\n] More of the claim.\n\nLine 6: the paragraph after the note.\n\n> Line 8: a quoted claim[fn: The quote\'s note.\n\n    Its second paragraph.\n] in a quote.\n\nLine 13: after the quote.\n\n- Line 15: an item[fn: The item\'s note.\n\n    Its second paragraph.\n]\n- Line 19: the next item.\n\nLine 21: after the list.\n\n# Line 23: a heading\n');
put('Ident/Comments.md', `# Comments\n\nBefore %%a hidden remark%% after.\n\n%%\nA hidden block.\n%%\n\nCode \`x %%kept%% y\` stays.\n\nA stray %% stays too.\n`);
put('Ident/TitleEntity.md', '---\nTitle: Caf&eacute; &mdash; Q&amp;A\n---\n# Body\n\nText.\n');
put('Ident/TitleNumeric.md', '---\nTitle: Caf&#233; &#x2014; numeric\n---\nText.\n');
put('Ident/TitleMarkup.md', '---\nTitle: &lt;b&gt;not bold&lt;/b&gt; &amp; plain\n---\nText.\n');

const notes = [];
const walk = (rel) => {
	for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
		const r = rel ? `${rel}/${e.name}` : e.name;
		if (e.name.startsWith('.') || r === 'out') continue;
		if (e.isDirectory()) walk(r);
		else if (/\.(md|jmd)$/.test(e.name)) notes.push(r);
	}
};
walk('');
notes.sort();
fs.writeFileSync(path.join(dir, 'export-identity.json'), JSON.stringify(notes, null, '\t') + '\n');
console.log(`export-identity: ${notes.length} notes in ${dir}`);
