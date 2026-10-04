// The viewer's status chip, for pdf-conflict-scenario.js's `later` case: the
// tab's (pdf-page.html #status) or an embed's (its title bar's
// .clew-pdf-status), its rect in this frame.
const chip = document.getElementById('status') ?? document.querySelector('.clew-pdf-status');
const r = chip?.getBoundingClientRect();
console.log(`smoke-pc-chip: text=${JSON.stringify(chip?.textContent ?? null)} rect=${r ? [r.left, r.top, r.right, r.bottom].map(Math.round).join(',') : 'none'}`);
