// Obsidian-compatibility fences for the render worker. Obsidian writes
// mermaid diagrams as ```mermaid code fences; jmarkdown's native forms are
// :::mermaid / @begin(mermaid). This extension makes the fence render as a
// client-side mermaid diagram in HTML previews. (For LaTeX export use the
// native forms — those rasterise via mmdc; a fence exports as nothing.)
//
// Loaded via the vault's generated .jmarkdown/config.json:
//     "Extensions": [..., "mermaidFence from <dist>/engine/obsidian-fences.js"]

const escapeHtml = (s) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const mermaidFence = {
	name: 'mermaidFence',
	level: 'block',
	start(src) { return src.match(/^```mermaid/m)?.index; },
	tokenizer(src) {
		const match = /^```mermaid[ \t]*\n([\s\S]*?)\n```[ \t]*(?:\n+|$)/.exec(src);
		if (!match) return;
		return { type: 'mermaidFence', raw: match[0], text: match[1] };
	},
	renderer(token) {
		if (global.isLatex) return '';
		// mermaid.js reads the element's textContent, so entity-escaping is safe
		// (and keeps diagram text from being parsed as HTML).
		return `<div class="mermaid">\n${escapeHtml(token.text)}\n</div>\n`;
	},
};

export default [mermaidFence];
