# Handover — 2026-09-01

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. THE ACTIVE ITEM: the ZetaOffice spike (start here)

The owner wants a viability spike: a FULL embed of ZetaOffice
(LibreOffice compiled to wasm, allotropia's build, scripted via its
zetajs API) — office documents (.odt/.ods/.odp/.docx/.xlsx/.pptx)
opening in file tabs with real editing and save-back into the vault.
Explicitly droppable: if it proves unviable, delete the branch and
worktree, no harm to main.

**Where:** branch `zetaoffice-spike`, checked out in its own worktree
at `../Clew-app-zetaoffice` (dependencies installed, builds) so the
owner's concurrent work in THIS tree is never disturbed. Do the spike
work THERE.

**Scoping facts (2026-09-01 session — verified reasoning, not yet
measured):**

- Payload is ~300 MB of wasm. NEVER ship it in the app: on-demand
  download into userData following `main/pdf-fonts.js` (the 139 MB
  precedent), served via the `__clew_assets__` protocol. Self-host a
  pinned build — allotropia's CDN has its own usage terms.
- LibreOffice wasm is pthreads-built → needs SharedArrayBuffer. True
  cross-origin isolation fights the architecture (app page is file://,
  previews are DELIBERATELY cross-origin clew-preview://), so the
  Electron escape is enabling SAB via Chromium switch in main.js. That
  is a conscious security decision — canvas web nodes host arbitrary
  sites in `<webview>` guests (separate processes, contained) — record
  it in the commit message.
- Licensing is fine: LibreOffice MPL-2.0 + zetajs MIT beside GPL-3.0,
  aggregation exactly like EmbedPDF.
- iOS is OUT of scope permanently (WKWebView's jetsam memory cap vs a
  300 MB module). The iOS story, if ever, is QuickLook viewing +
  open-in-Collabora, and it lives in Clew-iOS.

**The template is the PDF viewer** (CLAUDE.md's PDF bullet): a
`zeta-page.html` beside `pdf-page.html`, loaded by the file tab's
iframe on the clew-preview origin; document bytes fetched from
clew-preview:// as a buffer (pdf-core's lesson — URL loaders mangle
the scheme); saves flow out over the postMessage save bridge to a
main-process writer with `vault.writePdf`'s guards generalized to
office extensions. `lib/file-types.js` fileKind/isViewablePath gain
the office extensions; clew-file-view gains the iframe branch.

**Decisions already taken in scoping — change them out loud, not
silently:**

- ONE LibreOffice instance (each is ~0.5–1 GB and seconds to start):
  v1 is a single shared instance, or one office tab at a time.
- Explicit save + save-on-close prompt, NOT debounced autosave (a
  half-edited spreadsheet is not a PDF annotation).
- Vault-watcher conflicts: suppress self-echoes the way editorPool
  does (`lastWrittenText`).
- Note embeds (`![[x.docx]]` live in previews) are ruled out — one
  wasm instance per embed is not survivable. Tabs only.

**Spike order — measure before wiring:**

1. Obtain a ZetaOffice build + zetajs. Stand up a BARE zeta-page in a
   clew-preview iframe with the SAB switch on; load a real .docx from
   a buffer. Measure: cold/warm startup, instance memory, and whether
   the switch disturbs anything else (canvas webviews, preview
   fetches, the PDF viewer).
2. Only if the numbers are acceptable: wire the tab + the save path.
3. Either way, a viability report to the owner WITH the numbers.

**The cheap rung is untouched by this spike** and worth building
regardless (days, not weeks): `soffice --headless --convert-to pdf`
into `.clew/cache` when ordinary LibreOffice is installed
(`toolchainPath()` pattern), shown in the EXISTING EmbedPDF viewer,
plus "Edit in LibreOffice" externally. It remains the fallback for
users without the 300 MB download.

## 1. Recently shipped (all verified; manual in ../Clew-docs matches)

- **Fill + auto-fill (2026-08-31/09-01):** `editor:fill-paragraph`
  (⌥Q, `fillColumn` default 72) and auto-fill-mode (`autoFill`
  setting, default off; EditorView.inputHandler reading settings per
  keystroke). Pure core in `editor/fill.js`, 22 unit tests. Bare Alt
  chords now WORK on mac — chordOf() recovers the base key from
  event.code under Option (⌥Q types œ otherwise); dispatch and the
  hotkey recorder share the fix.
- **PDF viewer = the owner's EmbedPDF OCG build (2026-08-30):**
  vendored mirror at `vendor/embedpdf`, `npm run sync-embedpdf` from
  `~/Source/EmbedPDF/v2` branch `ocg-v2`; layers panel, layer
  authoring, per-annotation assignment. Durable facts in CLAUDE.md.
- Earlier and settled (Web Awesome widgets; the PH456 marking vault at
  `~/Documents/Teaching/Marking/2025-2026/PH456/Marking Vault/`, its
  documented twin `Guide/Dashboards.md`): see CLAUDE.md and this
  file's git history.

## 2. Open items (none are compat)

- **The ZetaOffice spike (§0).**
- The soffice converter rung (§0, last paragraph) — independent and
  cheap; do it whether or not the spike survives.
- Win/Linux 0.9.0 artefacts have never run on real machines.
- The DNS change (owner's action) → then `make dns-check` + `make tls`
  in Clew-docs.
- Kanban-board card drag (write path) — v2 of a shipped feature.

## 3. Traps (newest first)

- **Centered text (`>> … <<`) is a paragraph type with a SUFFIX** in
  fill.js: it opens with the quote sigil, and the engine's per-line
  centerAlign rule rejects any line missing its closer — one dropped
  `<<` un-centers the whole block. Extend the suffix mechanism; don't
  special-case downstream.
- **Smoke trick:** `document.execCommand('insertText', …)` on a
  focused CM editor goes through the REAL input path (inputHandler
  included); synthetic KeyboardEvents don't insert text.
- **The blanket `dist/` gitignore eats vendored dist dirs** —
  `git check-ignore` anything you vendor before assuming it commits
  (`!vendor/embedpdf/dist/` is the existing exception).
- **The EmbedPDF viewer is ALL shadow DOM** — in frame scripts
  `document.body.textContent` is empty; walk shadowRoots. Sidebar tabs
  are icon-only. Assert which build is served by FETCHING a hashed
  filename, never by resource timing (it missed the module chunks).
- **wa.css is TOKENS ONLY** (`themes/default.css`); full webawesome.css
  repaints html/body on widget notes.
- **WA- elements take the NORMAL morph**, but the host inline `style`
  is component-owned state — carry it onto the incoming element before
  the attr sync (client.js `applyRender`).
- **Meta Bind toggles must not fall into the checkbox-toggle path**
  (`.clew-mb` guard in client.js); a FOCUSED `.clew-mb` element is
  morph-protected.
- **Canvas cards are the app page, not a preview iframe** — engine
  markup rendered into cards needs its own compact rules in canvas.css.
- **Admonition tokens are `calloutBlock`-typed on purpose** — one
  renderer serves both syntaxes.
- The block-binding writer and reader both live in
  shared/note-metadata (`rewriteBlockText`) — keep read/write
  symmetric there.
- Earlier traps (list() dialect split, ordered DQL pipeline,
  whole-document extensions via start()→0, export-worker env,
  innerText vs textContent, `--universal`) are in this file's git
  history.

## 4. The owner works in this tree concurrently

The tree was left COMPLETELY CLEAN on 2026-09-01: the long-uncommitted
canvas delete button was smoke-verified and committed (`bff8410`), and
the demo-vault play state reset to baseline. Anything uncommitted you
find is NEW owner work — leave it unstaged and note it here. **The
ZetaOffice spike lives in a separate worktree for this reason** —
never switch THIS tree off main. Live testing flips demo widgets —
reset `status:`/`done:`/`^motto` baselines before committing demo
files.

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
