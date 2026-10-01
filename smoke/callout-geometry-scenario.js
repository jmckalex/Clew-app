// Live edit's callouts against reading view's (live-edit.css follows
// preview.css's .callout), the owner's report 2026-10-01: chevron, list
// markers, corners, padding, rhythm. Fixture: `smoke/make-callout-vault.sh
// <dir>`; run with CLEW_SMOKE_FRAME_SCRIPT=smoke/callout-geometry-frame.js
// CLEW_SMOKE_FRAME_MATCH=Callouts. Every number is relative to its own
// mode's prose column (the first paragraph's text left) and the callout box,
// so the two modes are compared shape for shape: `smoke-cg live …` here,
// `smoke-cg-frame reading …` from the frame — the same keys, to diff.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, editorPool, settingsStore } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const theme = window.__clewTheme ?? 'dark';
const tab = workspaceStore.openNote('Callouts.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
for (let i = 0; i < 100 && !editorPool.get(tab.id)?.view; i++) await sleep(20);
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.length } });
await sleep(1500);
const src = view.state.doc.toString();
const at = (needle, k = 0) => view.coordsAtPos(src.indexOf(needle) + k);
const colLeft = at('Before the callouts').left;
const head = document.querySelector('.cm-editor .le-callout-head');
const lines = [];
for (let l = head; l && l.classList.contains('le-callout'); l = l.nextElementSibling) lines.push(l);
const r0 = lines[0].getBoundingClientRect();
const rN = lines[lines.length - 1].getBoundingClientRect();
const box = { left: r0.left, right: r0.right, top: r0.top, bottom: rN.bottom };
const icon = head.querySelector('.callout-icon').getBoundingClientRect();
const chev = head.querySelector('.le-callout-fold')?.getBoundingClientRect();
const title = at('Argument');
const n1 = at('1. Identity');
const t1 = at('Identity research');
// Item 2's second visual line: the rects of a range over the whole item.
const item2 = view.state.doc.lineAt(src.indexOf('Akerlof and Kranton take'));
const r2 = document.createRange();
const a2 = view.domAtPos(src.indexOf('Akerlof and Kranton take'));
const b2 = view.domAtPos(item2.to);
r2.setStart(a2.node, a2.offset); r2.setEnd(b2.node, b2.offset);
const wrap = [...r2.getClientRects()].filter((r) => r.width > 0).sort((p, q) => p.top - q.top || p.left - q.left)
	.find((r, i, all) => r.top > all[0].top + 4) ?? { left: NaN };
const last = at('that framework.', 15);
const concl = at('Conclusion:');
const lastText = at('personal identity.', 18);
const cs = getComputedStyle(lines[0]);
const f = (v) => Math.round(v);
console.log(`smoke-cg: live ${theme} box-left=${f(box.left - colLeft)} box-width=${f(box.right - box.left)} radius=${cs.borderTopLeftRadius} border=${cs.borderLeftWidth}`
	+ ` pad-top=${f(title.top - box.top)} pad-bottom=${f(box.bottom - lastText.bottom)}`
	+ ` icon-left=${f(icon.left - box.left)} icon=${f(icon.width)} title-left=${f(title.left - box.left)}`
	+ ` chevron-centre=${chev ? f(box.right - (chev.left + chev.right) / 2) : 'none'}`
	+ ` num-left=${f(n1.left - box.left)} item-left=${f(t1.left - box.left)} wrap-left=${f(wrap.left - box.left)}`
	+ ` gap=${f(concl.top - last.bottom)} body-left=${f(concl.left - box.left)}`);
workspaceStore.setTabMode(tab.id, 'reading');
await sleep(3500);
