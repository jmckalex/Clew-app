// Runs inside every __clew_block__ document at the end of
// preview-pane-scenario.js; the pane's own is the one the scenario named
// (`pane-frame=`): it must hold the LATEST text, morphed in.
const text = document.body.innerText;
console.log(`smoke-pp-frame ${SMOKE_FRAME.slice(0, 6)}: has-Added=${text.includes('Added')} has-Zed=${text.includes('Zed')} svg-has-Zed=${Boolean(document.querySelector('.mermaid svg')?.textContent.includes('Zed'))}`);
