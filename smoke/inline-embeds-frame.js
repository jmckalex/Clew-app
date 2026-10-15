// Inside Inline.md's reading view: each line's paragraph — see inline-embeds-scenario.js.
const ps = [...document.querySelectorAll('p[data-source-line]')];
const at = (line) => ps.find((p) => p.dataset.sourceLine === String(line));
const imgsIn = (el) => (el ? el.querySelectorAll('img.internal-media').length : -1);
const two = at(3);
console.log(`smoke-ie-frame: two imgs=${imgsIn(two)} bang=${(two?.textContent ?? '').includes('!')}`);
const alone = at(5);
console.log(`smoke-ie-frame: alone imgs=${imgsIn(alone)} text=${JSON.stringify(alone?.textContent.trim())}`);
// Line 7, alone on its line: a block image, no paragraph of its own.
const block = [...document.querySelectorAll('body > img.internal-media, article > img.internal-media, .markdown-body > img.internal-media, img.internal-media')].find((img) => img.parentElement?.tagName !== 'P');
console.log(`smoke-ie-frame: own-line block=${Boolean(block)}`);
const sized = at(9);
console.log(`smoke-ie-frame: sized imgs=${imgsIn(sized)} width=${sized?.querySelector('img')?.getAttribute('width')}`);
const pdf = at(11);
console.log(`smoke-ie-frame: pdf imgs=${imgsIn(pdf)} link=${Boolean(pdf?.querySelector('a.internal-link[data-href="sample.pdf"]'))}`);
