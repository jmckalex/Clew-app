// live-vars-scenario.js's reading-view half: what the engine printed.
const heading = document.querySelector('h1')?.textContent ?? null;
const line = [...document.querySelectorAll('p')].map((p) => p.textContent.replace(/\s+/g, ' ').trim()).find((t) => t.startsWith('Written by')) ?? null;
console.log(`smoke-vars-frame: heading=${JSON.stringify(heading)} line=${JSON.stringify(line)}`);
