// Inside the reading-mode document of Inserts.md at the end of
// insert-forms-scenario.js: what each Insert rendered, in the order written.
//   mermaid TiKZ refused(Mathematica) game markdown-demo — drawn (`=1` each)
//   tex-only=false html-only=true comment=false — the output rules of
//     @begin(TeX), @begin(HTML), @begin(comment)
//   abstract title-box element(<name>)=1 — the generic container the element
//     `<name>` (@begin(<name>)), as `:::name` printed it
//   theorem="Theorem 1." — "Insert environment…" numbered (the one output
//     change of phase 1: `:::theorem` was an unnumbered <theorem>)
//   today=<a date>
const q = (s) => document.querySelectorAll(s).length;
const text = document.body.textContent;
const checks = {
	mermaid: q('.mermaid'),
	tikz: q('tikz-diagram'),
	'refused(Mathematica)': q('.jmd-refused'),
	game: q('table.game'),
	'markdown-demo': q('.markdown-demo-container'),
	'tex-only': text.includes('LaTeX-only content'),
	'html-only': text.includes('Web-only content'),
	comment: text.includes('Editorial note'),
	abstract: q('.abstract'),
	'title-box': q('.title-box'),
	'element(<name>)': q('name'),
	theorem: JSON.stringify(document.querySelector('.theorem-label')?.textContent ?? null),
	today: JSON.stringify(document.querySelector('span.date')?.textContent ?? null),
};
console.log(`smoke-if-frame: ${Object.entries(checks).map(([k, v]) => `${k}=${v}`).join(' ')}`);
