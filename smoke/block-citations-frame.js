// Runs in the embed's block frame after block-citations-scenario.js.
const text = document.body.innerText.replace(/\s+/g, ' ').trim();
console.log(`smoke-bc-frame ${SMOKE_FRAME.slice(0, 6)}: resolved=${/Lewis \(1969\)/.test(text)} raw=${text.includes('\\cite{')} text=${JSON.stringify(text.slice(0, 100))}`);
