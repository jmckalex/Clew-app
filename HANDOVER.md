# Handover — 2026-08-22 (second overnight stretch: v0.5.0 tagged, polish + 3 features)

Session-rollover state for the next session. Durable architecture,
conventions, and gotchas live in **CLAUDE.md**; the original design plan is
at `~/.claude/plans/groovy-forging-shell.md`. This file gets rewritten each
session; keep it short and current.

## 1. Where things stand

The first overnight block (menus, properties panel, unlinked mentions, the
full canvas environment) is committed as `c35fe27` and tagged **v0.5.0**.
The second block did everything else the owner asked for overnight:

1. **All six known rough edges fixed** (commit `06b1250`):
   canvas conflict banner (keep-mine / load-disk, load checkpoints first so
   ⌘Z restores local); text cards render markdown (jmarkdown inline forms +
   headings/lists/tasks/quotes/fences via `canvas/card-markdown.js`, a pure
   escaped-string renderer — never the engine; links clickable when the
   card is engaged); webview failure chrome with Retry; edges re-pick sides
   after moves when the stored sides face away (`model.repickEdgeSides`);
   sibling canvas views sync live over `canvasSyncBus`; unlinked-mention
   scans memoize per note (mtime-keyed, LRU per name set).
2. **Pinned tabs + tab context menu** (`aad6993`): pin via tab right-click,
   palette, or Window → Pin Tab (checkbox); pinned tabs sort first, keep
   the region through drags, hide ×, ignore ⌘W/middle-click, freeze
   history, and never navigate — links open a new tab. Close Others /
   Close to the Right skip pinned.
3. **Heading-targeted wikilinks** (`aad6993`): `[[Note#Heading]]` jumps to
   the heading (cursor in source mode; reading mode via cursorLine for
   loading previews and the scroll bus for live ones); `[[#Heading]]`
   jumps in-note. Heading completion after `#` already existed.
4. **"jmarkdown project" vaults** (`444ea49`) — the owner's stated win:
   Settings → *This vault* toggle (`.clew/vault-settings.json`,
   `jmarkdownProject: true`) re-enables the engine's own-line `[[file.md]]`
   inclusion in previews. `renderService.reconfigure()` rewrites the
   engine config, discards the warm standby (it imported the old config),
   drops cached renders, re-renders open previews. Verified end-to-end
   (transclusion rendered in reading mode). The book folder can now open
   as a vault and read like the CLI build.
5. Small polish: ISO-date property values get a native date picker;
   hotkey-table and guide-note updates.

126 unit tests green. All work smoke-verified (synthetic pointers,
AppleScript menu checks, preview frame scripts).

## 2. Git state

- **Clew** (`~/Source/Clew`, branch `main`, no remote): clean tree expected
  at session end; history `…37f40f5 → c35fe27 (v0.5.0) → 06b1250 →
  aad6993 → 444ea49 → <final docs commit> (v0.6.0)`. Tags: v0.1.0 (first
  session), v0.5.0, v0.6.0 — all annotated.
- **jmarkdown**: untouched again (still `at-migration`, nothing pushed).

## 2b. Post-overnight session (2026-08-22, owner awake)

Font Awesome icon conversion (generated inline SVGs, `d43d9ad`), symlink
support (`600f1ce`), web-node loading spinner (`b3fd44c`), and the **note
API** (see CLAUDE.md "Note API"): `window.clew` in rendered notes +
`clewdata.json` vault kv store, gated per vault (default off; demo vault
ships it ON via a gitignore-negated `.clew/vault-settings.json`). Demo
apps: `Features/API Playground.md`, `Habit Tracker.md`, and the
three-note `Adventure`. Engine quirk found while building it: code
spans/fences escape `&` but pass `<` raw — candidate upstream jmarkdown
fix to discuss with the owner.

## 3. Known rough edges (current, all minor)

1. ~~Canvas cards render a markdown subset~~ FIXED 2026-08-22: cards now
   upgrade to real engine fragment renders (render-service.renderFragment
   + POST __clew_fragment__ endpoint, origin-guarded; card-markdown.js
   remains the instant first paint and the failure fallback). Math
   typesets via lazy MathJax in the app window (CSP allows scripts from
   the __clew_assets__ root only). Canvas embeds' cards upgrade the same
   way. Gotcha found: .canvas-text is white-space:pre-wrap for the
   fallback — engine HTML must get .is-engine (white-space normal) or
   its formatting newlines render as huge gaps.
2. Webview nodes need network; the failure overlay covers that now, but
   there's no loading spinner.
3. The properties panel's list chips don't reorder by drag.
4. Vault settings has exactly one option; the section renders the vault
   name at open time and doesn't live-update on vault switch while the
   settings tab stays open (refresh by reopening the tab).

## 3a2. Canvas superpowers + Leaflet maps (2026-08-22, owner-requested)

Excalidraw/Advanced-Canvas parity: shape stroke styles + 3 sloppiness
levels + opacity + hachure fills; standalone text shapes (4 system font
stacks, foreignObject-rendered so PNG export works); flowchart node
shapes/borders/fills under clew.nodeStyles; edge fromEnd/toEnd (SPEC
fields), dash + path routing (bezier/straight/square) under
clew.edgeStyles; z-order via model.reorder (paint order = array order);
style bar under the toolbar; menu 'choices' rows; portals (canvas file
node → live miniature via canvas/portal.js, rebuilt on file change,
no recursion). Everything mirrored in read-only note embeds.

Leaflet maps: ```leaflet fences (obsidian-leaflet-compatible subset,
parseLeafletConfig in obsidian-fences.js, unit-tested) → interactive
maps in previews via preview-client/leaflet-maps.js; leaflet@1.9.4
served from /__clew_assets__/leaflet/ (protocol root + extraResources
for packaged builds — packaging NOT yet re-verified since). OSM tiles
need network; image: [[file]] maps are offline (CRS.Simple). Marker
wikilinks post link-click. Maps guide note: Features/Maps.md.
Photo maps: photos: [[folder]] scans for geotagged JPEGs (exif-gps.js —
hand-rolled GPS/DateTimeOriginal reader, fixture-tested via
scripts/geotag-jpeg.py), pins each with thumbnail popup + open-photo +
open-or-create-note links, auto-fits. HEIC auto-converts to JPEG via
macOS sips both in the folder scan (jpg written alongside, mtime-
guarded) and at attachment paste/drop (vault.js saveAttachment — vault
only ever receives .jpg); non-mac counts them as skipped.

## 3a3. PLUGIN SYSTEM (2026-08-22, owner-requested)

Vault plugins: .clew/plugins/<id>/manifest.json + up to three surfaces
(src/main/plugins.js discovery, unit-tested): engine (jmarkdown
extension into the worker config via engineExtensionEntries), preview
(script injected after client.js by protocol.js), app (renderer script
against a SMALL frozen API v1 — commands/vault/workspace/events/ui.notice
in src/renderer/plugins.js; loads via the __clew_plugin_app__ protocol
namespace + CSP entry because the app CSP has no unsafe-eval — the
protocol serves ONLY currently-enabled plugins, wrapped to receive the
API object). Per-vault opt-in: vault-settings.json "plugins": [ids]
(settings UI lists discovered plugins with toggles; toggling
reconfigures the engine). Everything a plugin registers is unwound on
vault change (registry gained unregisterCommand). Sample: demo-vault
.clew/plugins/header (gitignore-negated) — frontmatter header-image/
title/subtitle → banner; Welcome.md wears it. Docs: Guide/Plugins.md.
All three surfaces smoke-verified end-to-end.

## 3a4. Documentation website (2026-08-22)

docs/site/index.html — a self-contained, hostable introduction +
documentation page (hand-rolled CSS in Clew's own palette, no
dependencies) with 8 real screenshots in docs/site/images/ (captured
via the smoke harness from the demo vault, 1400px JPEG). Also published
as a Claude artifact (images inlined) for preview/sharing:
https://claude.ai/code/artifact/aadfcc91-acc1-4ddd-8b5b-a4cbc3710c50
Screenshot capture scripts pattern: see this session's scratchpad
cap-*.js (open note/canvas/graph, CLEW_SMOKE_VAULT=demo-vault).

## 3a5. Obsidian-universe batch (2026-08-22, evening)

Vault scripts (.clew/scripts/*.js → every preview; morphdom now
preserves custom elements + syncs attrs). ```query (Dataview-lite) +
```tasks fences in src/engine/query-fences.js — vault scans in the
worker, LIVE cross-note task checkboxes (task-toggle message → host
toggleTaskLine(msg.path…)); demo Features/Queries.md; pure helpers
tested. Second sample plugin: word-count (app surface, demo vault).
Triage of remaining Obsidian-plugin territory (not built, by choice or
later): kanban board view, spaced repetition, templater-grade
templates, breadcrumbs/hierarchy, natural-language dates, git UI.

## 3a6. Vault → website publishing (2026-08-22)

File → Export → Vault as Website (export:site command, EXPORT_SITE
channel, src/main/export-site.js): every note renders via one-shot
workers (CLEW_SITE_EXPORT=1 + CLEW_SESSION_ID=@@SITE@@; next worker
warms during each build) → <out>/<path>.html with wikilinks as REAL
relative hrefs (wikilinks.js SITE_EXPORT branch; canvas embeds → label
box), the /@@SITE@@/ marker (raw AND percent-encoded) + /__clew_assets__/
relativized per page depth, attachments copied, assets/ (mathjax
tex-svg, mermaid, leaflet+images, highlight, fontawesome, jquery,
preview.css, site-client.js — new esbuild bundle) + .clew/scripts as
vault-scripts. index.html = Welcome/Start Here/Home/index. Queries/
tasks/kanban bake to snapshots; write paths are app-only by design.
Verified: study-vault (19 pages) and demo-vault (37 pages, maps+photos)
export with zero failures, correct relative links at all depths.

## 3b. PACKAGING IS DONE (2026-08-22)

M1–M5 are now complete, full stop. `npm run package` →
`out/mac-arm64/Clew.app`; `npm run package:dmg` → `Clew-0.7.0-arm64.dmg`
(~137MB, unsigned — set a real identity before distributing). The owner
chose vendor-not-publish for jmarkdown: `vendor/jmarkdown` is a committed
dumb mirror of the golden master, auto-synced by dev/package runs
(see CLAUDE.md "Engine vendoring" + "Packaging" for the full mechanics:
paths.js, asar-free engine in Resources/, after-pack.cjs workaround,
generated icon). The packaged app was smoke-verified end to end:
MathJax/theorems rendered in reading mode through the unpacked engine.
Publishing jmarkdown to npm remains open for later (the sync script and
`file:vendor/jmarkdown` dep swap out trivially for a registry version).

**Windows + Linux builds (2026-08-22):** `npm run package:win` → NSIS
installer (x64, assisted mode); `npm run package:linux` → AppImage + deb
(x64). All cross-built from macOS and verified to produce artifacts with
the full resource layout (engine + 195 staged packages under resources/);
after-pack.cjs is platform-aware (Contents/Resources vs resources/).
make-icon.js now also packs build-resources/icon.ico (hand-rolled
PNG-entry ICO, committed); Linux uses icon.png. toolchainPath() was
Windows-hostile (':' PATH joins) — fixed with path.delimiter. The staged
engine is pure JS so one staging serves every platform. CAVEAT: neither
build has ever been *run* on a real Windows/Linux box — expect runtime
polish there (menu roles, titlebar, chords are CmdOrCtrl-based but
untested; TeX/mermaid toolchain discovery on Windows relies on PATH).

## 3c. MULTI-WINDOW IS DONE (2026-08-22)

One window = one vault (owner's chosen model). `VaultSession` per window
(session.js) owns all services; IPC routes by sender; preview URLs carry
the session id; the menu follows focus; every open vault restores at
launch (settings.openVaults); the same vault focuses rather than
duplicates; File → New Window (⌘⇧N). Verified: two windows with
independent vaults/screenshots, session-scoped rendering, no-duplicate
focus, API-playground + canvas + packaged-app regression smokes all
green. Two quit-hang bugs found and fixed (webContents access after
window destruction in dispose; menu rebuild during quit). A third fallout
found by the owner on 2026-08-22: engine-emitted media URLs (wikilinks.js
sitePath) were root-relative, which dropped the new <sid> URL segment —
images/PDF/audio/video embeds all broke. Fixed by passing CLEW_SESSION_ID
into the render worker (mirroring CLEW_VAULT_ROOT) and prefixing media
URLs with it; stale-sid caches can't be served because ensureRendered
only trusts disk HTML through per-launch in-memory bookkeeping.

## 3d. Post-multi-window batch (2026-08-22, owner awake)

Tab-close fix (bar rebuilt on activation, detaching the pressed x —
now reconciles by signature), new-tab default mode setting + per-call
override (clew.open opts; Adventure navigates in-place in reading
mode), public-domain media in the demo vault (Waterhouse's Ariadne,
Burne-Jones's labyrinth tile, Earthrise, the 1895 Lumiere train film —
Features/Media Gallery.md, ~6.5MB total), preview color-scheme fix,
code-masked mention scanning, and the **Standard Markdown syntax**
per-vault toggle (engine's normalSyntax build option — no engine
changes needed; renders + exports honor it). Caveats: the editor's
dialect overlay and the Format menu still assume the dialect when
normalSyntax is on; the canvas card renderer too. Follow-up if wanted.

## 3e. The Format menu (2026-08-22)

Top-level Format menu covering the whole dialect, generated from
src/shared/format-spec.js — ONE spec consumed by both the native menu
and the renderer command registrations (~45 commands, all in the
palette/hotkey editor, all gated on an editable note). Implementations
in commands/format.js: toggling wraps and line prefixes, heading
levels, jmarkdown alignment, alert wrapping, table builder + row
insertion, container wrapping, inline inserts (footnote/citation/
label/ref/:today/{{TOC}}). Edit menu slimmed to undo/clipboard/find.
Labels show dialect syntax — under normalSyntax vaults they're
slightly wrong (known caveat, same family as the editor overlay).

## 3f. Diary mode (2026-08-22)

Left-sidebar Diary tool: month calendar (entry dots, today highlight,
month nav), click-to-open/create any day. Two storage modes (Settings →
Diary): per-day files (the old daily notes) or a SINGLE LOG note with
'# date' sections kept newest-first (open-day upserts the section at
its chronological spot, through the live editor when open). Composed
read-only views (today/week/month/everything/custom interval) work in
BOTH modes: generated into .clew/Diary View.md (invisible to explorer/
index, dropped from workspace on restart) and rendered by the engine.
Core logic is pure + tested (shared/diary.js, 6 tests). ⌘⇧D is now
mode-aware; Go menu has Diary Calendar; nav:diary command.

## 4. Feature plan (designed, not yet built — next sessions)

Ordered by expected value; none started:

1. ~~Packaging~~ — done, see §3b. Follow-ups when going public: code
   signing + notarization, locale stripping (~50 lproj dirs ship today),
   pruning the engine's dependency tree (73MB staged), CI release builds.
2. ~~Multi-window~~ — done, see §3c. Possible polish: per-window vault in
   the Window menu's window list, drag a tab between windows.
3. **Properties: bulk/type UX**: type picker per property, drag-reorder,
   vault-wide property name completion (indexer knows all keys).
4. **Canvas next steps**: image paste/drop directly onto canvas (route
   through ATTACH_SAVE), edge midpoint dragging to re-anchor an existing
   edge, export canvas region to PNG (likely via an offscreen
   BrowserWindow print of a self-contained HTML snapshot), Obsidian
   `.canvas` interop test with a real Obsidian vault.
5. **Search upgrades**: search history, regex mode, and a "replace in
   note" panel action (CM search panel already supports replace locally).
6. **Folding** in the editor (heading + frontmatter folds via CM fold
   service) — parity item.
7. Deferred by design (unchanged): live-preview editing, plugins,
   sync/publish, block references.

## 5. Verification

`npm test` → 126 pass. Smokes this block: conflict banner (external write
while dirty → banner → load-disk adopts foreign doc), card markdown
(intense/highlight/tasks/wikilinks in a live card), webview error chrome
(dead host → overlay + retry), pinned-tab guards (nav opens new tab, ⌘W
no-op, pin glyph, close button hidden), heading jumps (cross-note +
same-file, cursor line asserted), jmarkdown-project inclusion (CHILDMARK
transcluded in reading mode, config reset after), plus full-suite runs
after every commit. The app auto-opens `demo-vault/`; `npm run dev`.
