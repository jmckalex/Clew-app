// Inside the Grades.md preview, after all the input (meta-bind-lock-scenario.js):
// the grade widget is locked again and shows the committed value.
const w = document.querySelector('wa-number-input[data-edit-field="grade"]');
const b = document.querySelector('.clew-mb-lock');
console.log(`smoke-mbl-frame: relocked=${w?.inert === true} pressed=${b?.getAttribute('aria-pressed')} value=${w?.value}`);
