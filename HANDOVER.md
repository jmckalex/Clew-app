# Handover — 2026-09-01 (late night: punch list DONE + office EMBEDS)

## 0a. NEW since the punch list: office embeds (owner's decision, same evening)

The no-embeds rule is lifted: `![[x.docx]]` renders a STATIC THUMBNAIL
(default), `![[x.docx|live]]` a full editable LibreOffice; canvas file
nodes the same via a context-menu Office row (Thumb/Live, stored as
`clew.nodeStyles[id].office` — Obsidian-safe). Commit `34b8205` here,
`7f5a167` in ../Clew-docs. All smoke-verified: boot on both surfaces,
edit → note/canvas tab dirty dot, close guards claim the tab, save →
bytes on disk, thumbnail cache + mtime refresh, morph survival.

- **Thumbnails** (`main/office-thumbs.js`): offscreen BrowserWindow
  boots the chromeless zeta page (`&thumb=1`; thread hides LayoutManager
  chrome + sidebar + ruler), one capturePage →
  `.clew/cache/office-thumbs/<rel>.png` (mirrored path ON PURPOSE:
  read-only surfaces construct the URL). mtime-cached, jobs strictly
  serialized. `offscreen: true` works fine with the SAB pthreads wasm.
- **Live embeds**: hoisted out of morphed flow into an absolutely
  positioned data-clew-keep holder on the preview body, tracked to a
  placeholder slot (`preview-client/office-embed.js`). TWO measured
  traps forced this: any DOM move reloads an iframe, and a
  parser-created iframe detached before first-load-commit does NOT
  renavigate on reinsertion — the hoisted editor must be a FRESH
  iframe, src set after insertion. client.js strips src from incoming
  live iframes at morph (into data-live-src) so re-renders never boot
  throwaways.
- zeta-page posts to window.top (embeds sit one frame deeper); the dock
  tracks embed dirt per source window and its guards cover embeds on
  tab close + window close. Live embeds BYPASS the one-instance slot
  (the |live opt-in is consent — "allow users to make bad decisions").
  They die with their preview (tab switch, mode toggle): documented in
  the manual's warning callout, NOT guarded — the known sharp edge.



Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. ZetaOffice: all nine punch-list items landed (2026-09-01 evening)

Commits `2a2a4c4` (dock, guards, conflicts, download, menu prune) and
`68ccbe3` (converter rung, verification passes) here; `79ad47b` in
../Clew-docs (the manual chapter). The updated "Finishing ZetaOffice"
artifact carries per-item outcomes. The spike worktree and branch are
removed. What each item became:

- **The office dock** (`renderer/office-dock.js`) replaced the naive
  iframe-in-tab-body: the window's ONE LibreOffice iframe lives in a
  fixed overlay tracked to the office tab's host rect, because
  reparenting an iframe reloads it and the tab body is replaceChildren'd
  on every switch — previously ANY tab switch silently discarded a booted
  LibreOffice and its edits. Office tabs never navigate and are never
  navigated over (tree.js, like canvas tabs); splits MOVE them (a clone
  could only show the busy notice); cross-pane opens reuse the tab.
- **Save-on-close**: workspace-store close guards + main-side window-close
  interception (EV_CLOSE_REQUESTED handshake) → native Save/Discard/
  Cancel on tab/pane/window close and quit. `CLEW_SMOKE_CONFIRM` answers
  it headlessly; all three branches verified against bytes on disk.
- **External changes**: editorPool's model — clean reloads silently,
  dirty banners. Echo suppression stamps at the save REQUEST (the
  watcher outruns the save-result round-trip; stamping at the result
  rebooted LO out from under its own save — real bug found by smoke).
- **One instance per APP** (not per window): main-process slot
  (`main/office-slot.js`), acquired pre-boot, released on destroy and
  implicitly on webContents death/reload. Blocked tabs wake themselves
  on slot changes, cross-window included (EV_OFFICE_SLOT broadcast).
- **The engine download** (`main/zeta-assets.js` + `shared/
  zeta-manifest.json`): pdf-fonts pattern + SHA256 pins (CDN has no
  versioned URLs — mismatch REFUSES). The two big files stay brotli on
  disk (52 MB not 262); the protocol serves `<name>.br` through a
  zlib stream because **Chromium ignores Content-Encoding on
  protocol.handle responses** (measured). Boot from .br: 2.9 s vs 2.2.
  Settings → Office documents row + in-tab offer. `CLEW_ZETA_DIR`
  overrides the dir in dev (and marks it writable; the repo's pinned
  `zeta-assets/` never is) — the full CDN download + boot ran
  end-to-end in dev through it.
- **LO File menu pruned** via DisableCommands (screenshot-verified):
  `Open` needed the per-app `OpenFromWriter`/`OpenFromCalc` names.
- **Converter rung** (`main/office-convert.js`): desktop-LibreOffice
  PDF preview into `.clew/cache/office-pdf/` (private UserInstallation
  so a running LO can't lock it out) shown in EmbedPDF, plus Open in
  LibreOffice / default app. Offered from the no-engine panel and the
  busy notice.
- **The manual**: `site/manual/office-documents.html` in ../Clew-docs,
  cross-referenced; screenshot from a purpose-made scratch vault.

**Verified by real input** (smoke + CDP): typing lands in Writer and
round-trips to the .docx via the toolbar Save; Impress opens a real
.pptx; split resize tracks; wikilink → office tab without navigating
the note; a minimal from-scratch docx (python zipfile) opens fine.

## 0b. Also new: memory measured, and LibreOffice wears Sifr (`fc4b522`)

- **Memory, measured (app.getAppMetrics)**: one live office instance =
  1.16 GB in the shared clew-preview renderer; a SECOND instance in the
  same process adds only ~0.5 GB (compiled-wasm code is shared). The
  floor is baked into allotropia's prebuilt bundle (initial wasm heap +
  packed data + compiled code; wasm memory can never shrink or
  decommit) — real reduction means allotropia shipping a leaner build,
  not anything Clew-side. Clew-side levers if wanted later: click-to-
  boot facades for live embeds, idle reclaim, an instance cap.
- **Icon theme**: the bundle ships only Colibre and the wasm build
  offers NO runtime switch (SymbolStyle read once at startup — commits
  before load and after ui_ready are no-ops; overwriting the packed zip
  in the Emscripten FS mid-boot dies with a wasm exception; preRun runs
  before the packed FS is populated — ALL measured). The fix serves a
  SPLICED soffice.data: vendor/libreoffice-icons/images_sifr.zip
  (MPL-2.0, pinned, from the matching LO 24.2 line) replaces the packed
  Colibre entry and the offsets metadata shifts to match
  (main/zeta-icons.js; sync splice in dev, streaming Transform over the
  brotli path when packaged, shipped via extraResources →
  office-icons/). LibreOffice believes it loads Colibre and draws Sifr.
  Delete the vendored zip to restore Colibre. Manual screenshot retaken.

## 1. Open items

- **Needs a real packaged run**: the download flow is verified in dev
  via CLEW_ZETA_DIR; nobody has run `npm run package` and watched the
  packaged app download into userData and boot. One pass, some machine.
- **Needs a machine with desktop LibreOffice**: office-convert's actual
  conversion (refusal paths verified here; this Mac has no LO).
- **Needs a human keyboard**: (a) Ctrl+S/Cmd+S inside LibreOffice —
  synthesised accelerators arrive with ctrlKey=true but LO-wasm inserts
  the letter instead; the manual says "use the toolbar Save" pending a
  real-keyboard check. (b) Clipboard app↔LO — not bridged in either
  direction under synthetic input (LOWA internal-clipboard limitation);
  office iframes now carry allow="clipboard-read; clipboard-write" so
  it isn't fenced off by us if a build ever supports it.
- **Restore-boot policy**: a workspace restored with a visible office
  tab boots LibreOffice (1.6 GB) at launch. Deliberate (reopen what was
  open) but unreviewed — owner may prefer lazy boot on first focus.
- Win/Linux 0.9.0 artefacts have never run on real machines.
- The DNS change (owner's action) → then `make dns-check` + `make tls`
  in Clew-docs.
- Kanban-board card drag (write path) — v2 of a shipped feature.

## 2. Traps (newest first — all earned this session)

- **`webContents.send` during window teardown THROWS and wedges main**
  behind an error dialog if it happens inside a 'destroyed' hook —
  guard every broadcast (office-slot.js#broadcast is the exemplar).
- **`win.close()` from inside that window's own ipcMain.handle
  deadlocks Electron** — defer with setImmediate (main.js close flow).
- **`sendInputEvent` never reaches OOPIFs** (cross-origin iframes =
  every preview). Smoke input is CDP `Input.dispatch*` via
  webContents.debugger; combos need REAL modifier keydowns around the
  letter (a modifiers bitmask alone reads as plain typing in Qt).
- **Chromium does not decode Content-Encoding on protocol.handle
  responses** — serve compressed files through a zlib stream instead.
- **chokidar's change event outruns the office save round-trip** — any
  self-echo suppression must stamp when the write is REQUESTED.
- **A frame script that awaits after triggering tab activation strands
  the harness**: the preview frame detaches and executeJavaScript never
  resolves. Click-and-return-immediately.
- Smoke quits via app.exit (not app.quit) after flushing editors — the
  close guards would otherwise hang the harness on their own success
  (dirty office doc + CLEW_SMOKE_CONFIRM=cancel).
- Earlier traps (centered-text suffix, execCommand insertText, blanket
  dist/ gitignore, EmbedPDF shadow DOM, wa.css tokens, Meta Bind morph
  guard, canvas-card CSS, calloutBlock typing) are in this file's git
  history — all still true.

## 3. Smoke-harness capabilities (grown this session; all documented in
main.js)

`CLEW_SMOKE_CONFIRM=save|discard|cancel` answers the office close
dialog; `CLEW_SMOKE_CLOSE_WINDOW=1` drives a real window close and logs
`smoke-windows: N`; `window.__clewSmokeInput` = [{click:{x,y}} |
{tripleClick:{x,y}} | {text:'abc'} | {combo:{key,modifiers}} |
{wait:ms}] plays through CDP; `window.__clewSmokeClipboard` preloads
the clipboard, `CLEW_SMOKE_CLIPBOARD=1` dumps it after.

## 4. The owner works in this tree concurrently

The tree was left CLEAN on 2026-09-01 (night): main at `68ccbe3`,
408 unit tests green, regression smoke (preview/PDF/canvas) green.
Anything uncommitted you find is NEW owner work — leave it unstaged and
note it here. Never switch THIS tree off main. Live testing flips demo
widgets — reset `status:`/`done:`/`^motto` baselines before committing
demo files.

## 5. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- Always pass `CLEW_SMOKE_VAULT`; `git status` demo and study vaults
  after every smoke run. App settings (theme, autoFill, fillColumn)
  are GLOBAL and persist — smoke scenarios that flip them must restore
  them.
- **The owner's bug reports have been consistently right.**
- **Write assertions that can fail — and eyeball the artefact anyway.**
- **Verify artefacts by content**, never the log line.
- **Prefer measuring to guessing** — and re-measure.
- A feature change is not finished until the MANUAL in `../Clew-docs`
  matches it — nothing in this repo's git status reminds you.
- `npm run dev` / `npm run package` re-sync the engine AND the
  EmbedPDF viewer from their masters; `sync-engine` + `sync-embedpdf`
  + `git status` BEFORE tagging.
