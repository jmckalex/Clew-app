// Reading view's half of live-title-scenario.js: the engine's title-page
// <div>s, sized against the note's text (preview.css). Logs (smoke-title-frame:):
//   title size=1.8 weight=700   author size=1.15   date size=1.15
//   subtitle size=1   institution size=1   today-in-date size=1.15
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => console.log('smoke-title-frame: ' + s);
for (let i = 0; i < 200 && !document.querySelector('div.title'); i++) await sleep(50);
const base = parseFloat(getComputedStyle(document.body).fontSize);
const size = (el) => (el ? Math.round(parseFloat(getComputedStyle(el).fontSize) / base * 100) / 100 : 'none');
const title = document.querySelector('div.title');
log(`title size=${size(title)} weight=${title ? getComputedStyle(title).fontWeight : 'none'}`);
for (const name of ['author', 'date', 'subtitle', 'institution']) log(`${name} size=${size(document.querySelector(`div.${name}`))}`);
log(`today-in-date size=${size(document.querySelector('div.date span.date'))}`);
