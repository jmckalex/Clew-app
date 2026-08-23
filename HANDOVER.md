# Handover — 2026-08-22/23 (the marathon session: maps → plugins → trilogy → QA)

Session-rollover state. Durable architecture, conventions, and gotchas live
in **CLAUDE.md** (updated this session — trust it); the original design plan
is at `~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session; keep it short and current.

## 1. Where things stand

Clew is feature-complete for this chapter and mid-QA. Everything below is
committed on `main` (58 commits, HEAD `dd5963b`, clean tree, no remote,
tags through v0.8.0 — a v0.9.0 tag would be reasonable next). 178 unit
tests green. Both mac packaging and the docs website are current.

Shipped this session, newest first (see git log for detail):

- **Splits fixed for real** (`2810c12`, `dd5963b`): split commands now
  CLONE the view (they used to MOVE the tab — ⌘\ on a single-tab pane was
  a silent no-op that pruned itself); ⌘⇧W = Close Split Pane (command,
  Window menu, tab context menu); tab-drag listeners moved to window so
  mid-drag rebuilds can't orphan ghosts/markers.
- **Explorer opens files in a new tab by default** (`d110bc2`):
  explorerOpenMode setting ('new-tab' | 'replace'), ⌘-click inverts,
  file context menu gained open in new tab / current tab / to the right.
- **Query-note cache invalidation** (`cdc1257`): any note change stales
  every query-holding note's cached render (their results depend on the
  whole vault, not their own mtime).
- **The trilogy** (`1c8c938`, `7ae420b`, `0867744`): writable vault
  database (```query editable cells, inline Key:: fields, date arithmetic,
  group:, live refresh; ```tasks cross-note toggles; the `vault` global
  for script blocks), ```kanban (drag rewrites frontmatter, works on
  canvas), and File → Export → Vault as Website (static site, real
  relative links, baked queries; export-site.js). Plus **study-vault/** —
  the second demo vault (academic term) that is both tutorial and QA rig.
- **Plugin system** (`cffac5d`): .clew/plugins/<id>/ with engine/preview/
  app surfaces, per-vault opt-in, samples: header (banner + MathJax
  titles), word-count. **Vault scripts** (`ff23798`): .clew/scripts/*.js
  into every preview; morphdom preserves custom elements.
- **Maps** (`fc2eaac`…`a4a6b48`): ```leaflet fences, obsidian-leaflet
  parity (overlays, GeoJSON, GPX, markerFile/Folder/Tag, distance tool,
  named tile styles — CARTO Voyager default), photo maps with EXIF GPS +
  automatic HEIC→JPEG (sips), Features/Maps.md.
- **Canvas superpowers** (`95705a5`, `d2824a0`, earlier): Excalidraw
  style system (stroke styles, sloppiness, opacity, hachure, text shapes),
  flowchart node/edge styles, z-order, portals, PNG export, engine-rendered
  cards, live canvas embeds in notes with pan/zoom + web pages.
- Earlier in-session: win/linux packaging config (untested at runtime),
  Range-request media seeking, session-id media URL fix, Ctrl-vs-Mod
  hotkey fix, image size syntax, docs website (docs/site/ + artifact at
  https://claude.ai/code/artifact/aadfcc91-acc1-4ddd-8b5b-a4cbc3710c50).

## 2. THE OWNER IS MID-WALKTHROUGH (read this first)

The owner is QA-ing the study-vault walkthrough (kanban drag → dashboard
follows → open-to-the-right split → editable rating → task tick). Four
rounds so far; each found a real bug (stale query cache; explorer
replacing tabs; splits never actually splitting; drag-artifact orphans —
all fixed above). Round 4 was pending an app restart when the session
ended. Expect them to resume mid-tour; the vault is at its canonical
baseline (Signals and Society status: drafting, Craft due 2026-09-05, no
ratings, boxes unticked). Reset command they know: `git checkout --
study-vault/`.

**Hard-learned session rules:**
- NEVER `git add -A` while the owner is live-testing — their walkthrough
  edits to study-vault got swept into commits three times. Stage
  explicit paths.
- Always pass `CLEW_SMOKE_VAULT=<path>` to smokes (otherwise the app
  opens the owner's restored vaults and pollutes their session).
- The owner's bug reports have been consistently RIGHT even when my
  smokes were green — smokes modeled the flow wrong (store-level opens
  vs explorer clicks; synthetic vs real drags). Reproduce THEIR gesture
  path before concluding anything.

## 3. Known open items

1. Windows/Linux builds cross-compile but have never run on real
   machines. mac .app is unsigned (signing/notarization pending).
2. Kanban/query polish backlog: computed columns/functions, inline
   `= expressions`, FLATTEN/GROUP BY richness, markerTag filterTag.
3. Obsidian-universe candidates not built (by triage): spaced repetition,
   Templater-grade templates, breadcrumbs, NL dates, git UI.
4. Editor: folding, block references (^block), vim mode still absent.
5. Old minor edges: properties list chips don't drag-reorder; vault
   settings section doesn't live-update on vault switch; editor dialect
   overlay + Format menu assume the dialect under normalSyntax vaults.
6. docs/site screenshots predate the split/tab fixes (cosmetic only).
7. jmarkdown upstream candidates (discuss with owner): code spans pass
   `<` raw; engine untouched all session (golden master clean).

## 4. Verification kit (works, use it)

Smoke pattern: `CLEW_SMOKE=$S/x.png CLEW_SMOKE_VAULT="$PWD/study-vault"
CLEW_SMOKE_SCRIPT=scenario.js [CLEW_SMOKE_FRAME_SCRIPT=frame.js] npx
electron .` — scenario runs in the app (window.__clew = stores, registry,
ipc, actions, editorPool), frame script runs inside the preview iframe
(throw an Error to report data; a thrown frame script skips the
screenshot). Renderer console.log is NOT captured; only thrown errors
surface. `git status` demo/study vaults after every smoke.
