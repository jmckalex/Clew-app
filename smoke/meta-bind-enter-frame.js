// Inside Enter.md's preview, after all the input (meta-bind-enter-scenario.js).
const body = document.querySelector('wa-textarea[data-edit-field="body"]');
const grade = document.querySelector('wa-number-input[data-edit-field="grade"]');
console.log(`smoke-mbe-frame: body-has-newline=${/\n/.test(body?.value ?? '')} grade-relocked=${grade?.inert === true}`);
