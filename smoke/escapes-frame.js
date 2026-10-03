// escapes-scenario.js's reading-view half: the paragraph's text as shown,
// and how many formulas MathJax typeset in it (only $x^2$ should be one).
for (let i = 0; i < 50 && !document.querySelector('p mjx-container'); i++) await new Promise((r) => setTimeout(r, 100));
const p = [...document.querySelectorAll('p')].find((el) => el.textContent.includes('Costs'));
const mathjax = p ? p.querySelectorAll('mjx-container').length : -1;
const clone = p?.cloneNode(true);
clone?.querySelectorAll('mjx-container').forEach((m) => m.replaceWith('…'));
console.log(`smoke-esc-frame: reading text=${JSON.stringify(clone?.textContent?.replace(/\s+/g, ' ').trim() ?? '')} mathjax=${mathjax} escaped-spans=${p?.querySelectorAll('span.escaped').length ?? 0}`);
