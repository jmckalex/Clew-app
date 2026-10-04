// code-lt-scenario.js's preview side: each frame's code, as text.
const codes = [...document.querySelectorAll('code, pre')].map((c) => c.textContent.trim()).filter(Boolean);
console.log(`smoke-cl-frame: ${typeof SMOKE_FRAME === 'string' ? SMOKE_FRAME : location.pathname.split('/').pop()} codes=${JSON.stringify(codes)} title=${JSON.stringify(document.title)} after=${document.body.textContent.includes('After the code')}`);
