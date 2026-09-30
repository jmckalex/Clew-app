// Each viewer frame the leak note's elements ended up in (pdf-leak-scenario.js).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 50 && !window.__clewPdfHandle?.container; i++) await sleep(100);
const h = window.__clewPdfHandle;
let page = h?.currentPage?.() ?? null;
for (let i = 0; i < 30 && location.hash && page !== 3; i++) { await sleep(100); page = h?.currentPage?.() ?? null; }
const tag = window.frameElement?.tagName?.toLowerCase() ?? 'unknown';
console.log(`smoke-leak-frame: in=${tag} loaded=${Boolean(h?.container)} page=${page} hash=${location.hash || 'none'}`);
