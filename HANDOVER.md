# Handover — 2026-08-22 (overnight session: menus, properties, mentions, canvas)

Session-rollover state for the next session. Durable architecture,
conventions, and gotchas live in **CLAUDE.md**; the original design plan is
at `~/.claude/plans/groovy-forging-shell.md`. This file gets rewritten each
session; keep it short and current.

## 1. Where things stand

Two sessions in. M1–M5 remain complete except packaging. This session
(evening + overnight, owner asleep) added, in order:

1. **Native application menu** — full File/Edit/View/Go/Window/Help menus.
   Items dispatch renderer command ids over `EV_MENU_COMMAND`; the renderer
   pushes context + its effective keymap back over `MENU_STATE`, so menu
   accelerators display the user's real (re)bindings but stay display-only
   (`registerAccelerator: false`) — the renderer dispatcher owns every
   chord. New commands to fill the menu: Save (⌘S), New Folder, Find in
   Note (⌘F), Insert Wikilink (⌘K), jmarkdown Format wraps (strong/intense/
   italic/highlight/strike/code/math), explicit theme commands. CM search
   panel got themed.
2. **Properties panel** — right-sidebar “Props” tool: frontmatter as typed
   rows (text/number/checkbox/list-chips), add/rename/delete, edits go
   through the live editor (undoable) or disk. `src/shared/frontmatter.js`
   is the parser/serializer; anything beyond its YAML subset renders
   read-only (`clean: false`) — never rewrite such blocks.
3. **Unlinked mentions** — in the backlinks panel under the linked section:
   word-bounded, alias-aware, wikilink-span-excluded scan
   (`search.js#scanMentions` + `unlinkedMentions`, IPC
   `UNLINKED_MENTIONS`); per-row **Link** button converts a mention into a
   wikilink in place (`actions.linkMention`, live-editor first).
4. **Canvas** — full .canvas environment (see CLAUDE.md “Canvas” section
   for invariants): JSON Canvas format, Obsidian-compatible; cards, live
   note embeds (real jmarkdown previews with working checkboxes/links),
   images, PDFs, media, web pages (`<webview>`); labeled/colored edges
   dragged from anchor dots; groups that carry members; marquee/multi-
   select/resize/nudge; per-tab snapshot undo (⌘Z); pan/zoom camera saved
   per tab; freehand ink + eraser; Excalidraw-style shapes (rect/ellipse/
   diamond/arrow/line) with labels, fill, six colors, and deterministic
   seeded “sketchy” rendering (`rough.js`) — per-shape Clean/Sketchy
   toggle; ⌘D duplicates (with internal edges); paste a URL → web node,
   paste text → card. Entry points: File → New Canvas, palette, explorer
   context menus, quick switcher (canvases listed), `[[x.canvas]]`
   wikilinks. Renames rewrite canvas file refs vault-wide.

`demo-vault/` gained `Guide/Properties.md`, `Guide/Canvas.md`,
`Projects/Demo Canvas.canvas` (exercises every node type incl. a live
jsoncanvas.org webview), unlinked-mention examples in `Guide/Panels.md`,
and Welcome links. 116 unit tests green (frontmatter, mentions scanner,
canvas model, rough paths added). Everything smoke-verified with
screenshots, dark + light themes, including synthetic-pointer drags for
move/connect/resize/draw/marquee and AppleScript-driven native menu checks.

## 2. Git state

- **Clew** (`~/Source/Clew`, branch `main`, no remote): working tree holds
  this whole session UNCOMMITTED (owner commits on request). Last commit
  is the CLAUDE.md/HANDOVER.md split. New files: `src/main/menu.js`,
  `src/renderer/commands/menu-bridge.js`, `src/shared/frontmatter.js`,
  `src/renderer/components/panels/clew-properties.js`,
  `src/renderer/canvas/{canvas-model,rough,node-content,canvas-menu}.js`,
  `src/renderer/components/views/clew-canvas-view.js`,
  `src/renderer/styles/canvas.css`, 4 test files, demo-vault additions.
- **jmarkdown**: untouched this session (still `at-migration`, two Clew
  commits from session 1, nothing pushed).

## 3. Known rough edges / notes for next session

1. Canvas conflict policy is last-writer-wins with a console warn when the
   file changes on disk while local edits are pending (editors get a real
   conflict banner; canvases don't yet).
2. Canvas text cards are plain text (no markdown rendering) — documented in
   the guide. Rendering them through the engine would need per-card file
   backing; skipped deliberately.
3. Webview nodes need network; offline they show a blank guest (no error
   chrome). Partition is `persist:clew-canvas`.
4. Edge endpoints don't re-pick sides automatically when nodes move (the
   stored side is kept, like Obsidian).
5. A second canvas view of the same file (split) syncs via the file
   watcher, not live morphing.
6. The unlinked-mention scan runs on every backlinks-panel refresh
   (active-note change / index change), full-vault; fine at current scale,
   candidate for indexer-side caching on big vaults.

## 4. Open items / decisions for the owner

1. **Packaging** (unchanged, still the recommended “make it an app” task):
   electron-builder, icon, preview assets out of `node_modules`, and the
   jmarkdown publish-vs-vendor decision. Remember `webviewTag: true` and
   the webview guards in main.js when hardening for release.
2. **GitHub + CI** when wanted: push, one Actions workflow running
   `npm test`.
3. **“jmarkdown project” vaults** — per-vault toggle re-enabling the
   engine's `[[file.md]]` inclusion for the book manuscript.
4. Parity odds and ends: pinned tabs, multi-window. (Properties and
   unlinked mentions are done as of this session.)
5. Deferred by design: live-preview editing, plugins, sync/publish, block
   references.

## 5. Verification

`npm test` → 116 pass. Smoke scenarios (CLEW_SMOKE) for: properties panel
(read/edit/write-back/undo-safety), unlinked mentions (counts + Link
conversion on scratch notes + organic examples), canvas structure (8 nodes
/3 edges/2 strokes/3 shapes, live Welcome embed, PDF viewer, image,
jsoncanvas.org webview), canvas interactions (drag-move, anchor-drag
connect with correct sides, SE-handle resize, rect tool, marquee, card
dblclick-create/edit, pen stroke, undo round-trips, disk state verified
after each), sketchy shapes + ⌘D + engage/disengage, light theme. Native
menus (incl. New Canvas, Properties Panel, dynamic checkmarks and
accelerators) verified via System Events. The app auto-opens `demo-vault/`;
`npm run dev` to launch.
