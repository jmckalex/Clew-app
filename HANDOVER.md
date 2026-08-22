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

1. Canvas cards render a markdown subset, not the engine — `$math$` is
   styled, not typeset (documented in [[Canvas]] guide).
2. Webview nodes need network; the failure overlay covers that now, but
   there's no loading spinner.
3. The properties panel's list chips don't reorder by drag.
4. Vault settings has exactly one option; the section renders the vault
   name at open time and doesn't live-update on vault switch while the
   settings tab stays open (refresh by reopening the tab).

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

## 4. Feature plan (designed, not yet built — next sessions)

Ordered by expected value; none started:

1. ~~Packaging~~ — done, see §3b. Follow-ups when going public: code
   signing + notarization, locale stripping (~50 lproj dirs ship today),
   pruning the engine's dependency tree (73MB staged), CI release builds.
2. **Multi-window**: main.js assumes one `win` (menu send, vault events,
   smoke hook). Needs a window registry + per-focused-window send; the
   single-vault-per-process model can stay.
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
