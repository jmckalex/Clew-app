// Inside the PDF viewer page at the end of pdf-annotations-scenario.js: the
// page it shows after the page-3 link was clicked.
// …and still holds every annotation, the one made just before the command
// included: the command flushes a pending autosave (pdf-core.js).
const list = await window.__clewPdfHandle?.listAnnotations?.();
console.log(`smoke-pa-frame: page=${window.__clewPdfHandle?.currentPage?.()} annotations=${list?.length}`);
