// Reading view's half of reading-note-lines-scenario.js: the line each block
// is stamped with (data-source-line) beside the line its text names — the
// `Line N` paragraphs, the heading, and each note's paragraphs, which carry
// their own source lines (smoke-note-lines-frame:). Every pair equal.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => console.log('smoke-note-lines-frame: ' + s);
for (let i = 0; i < 200 && !document.querySelector('[data-source-line]'); i++) await sleep(50);
const stampOf = (el) => el?.closest('[data-source-line]')?.dataset.sourceLine ?? 'none';
const blocks = [...document.querySelectorAll('p, li, h1')].filter((el) => /^Line \d+/.test(el.textContent.trim()));
log(`stamps ${blocks.map((el) => `${/^Line (\d+)/.exec(el.textContent.trim())[1]}@${stampOf(el)}`).join(' ')}`);
const notes = [...document.querySelectorAll('p')].filter((p) => /^(Its|Quote note|Item note)/.test(p.textContent.trim()));
log(`note-paragraphs ${notes.map((p) => `${p.textContent.trim().replace(/\W+$/, '').replace(/ /g, '-')}@${stampOf(p)}`).join(' ')}`);
