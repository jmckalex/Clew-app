// obsidian-comments-scenario.js's preview side: which markers each frame shows.
const text = document.body.textContent;
const markers = ['INLINE-SECRET', 'BLOCK-SECRET', 'MULTI-LINE-SECRET', 'kanban:settings', 'CODE-KEPT', 'FENCE-KEPT', 'DISPLAY-KEPT', 'UNCLOSED-KEPT', 'TRAIL-KEPT', 'EMBEDDER-KEPT', 'End.'];
const shown = markers.filter((m) => text.includes(m));
console.log(`smoke-oc-frame: ${typeof SMOKE_FRAME === 'string' ? SMOKE_FRAME : location.pathname.split('/').pop()} shown=${JSON.stringify(shown)}`);
