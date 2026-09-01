# Handover — 2026-09-01 (evening: ZetaOffice GRADUATED to main)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. THE ACTIVE ITEM: finish the ZetaOffice office tabs (now ON MAIN)

The spike — FULL embed of ZetaOffice (LibreOffice wasm via zetajs),
office docs editing in file tabs with save-back into the vault — was
built, measured, judged **viable**, and merged to main (fast-forward,
commit `5387cc1`) on the owner's instruction. The viability report
with screenshots is a Claude artifact ("The ZetaOffice Spike"); the
finishing punch list is its own artifact and §0b below. Housekeeping
left from graduation: the worktree `../Clew-app-zetaoffice` and branch
`zetaoffice-spike` are now redundant — remove when no session lives
there (`git worktree remove ../Clew-app-zetaoffice`,
`git branch -d zetaoffice-spike`). `zeta-assets/` (the 262 MB
gitignored wasm bundle) was COPIED into THIS tree, so office tabs work
here in dev; PROVENANCE.md + SHA256SUMS inside it pin the build.

**Measured facts (M-series Mac, real documents):**

- Cold boot → editable document: **2.2 s** (40 KB docx), **2.5 s**
  (1.8 MB, 29-page docx). Warm: ~1.8–2.0 s. Boot is so cheap that
  instance REUSE is unnecessary: boot per tab open, discard on close.
- Memory: **~1.6 GB working set** for the office renderer process
  (whole app ~2.1 GB with one office tab). This is why one-office-tab-
  at-a-time stands (enforced crudely in clew-file-view: a second
  office tab renders a notice, not a second LibreOffice).
- Save round-trip verified end-to-end: UNO edit → LibreOffice store →
  bytes out of the Emscripten FS → office-save bridge → OFFICE_WRITE →
  vault file on disk (marker string found inside the saved docx).
  Writer AND Calc both proven (real .docx/.xlsx from ~/Downloads).
- Payload correction: ~300 MB was the DISK size; over the wire it is
  **~53 MB** (the CDN brotli-compresses soffice.wasm/soffice.data
  unconditionally — content-length lies; a plain curl saves raw
  brotli, `cf ff ff 7f` not `\0asm` — see zeta-assets/PROVENANCE.md).
  On disk decompressed: 162 MB wasm + 99.5 MB data. Design option for
  shipping: store the .br files and serve them with
  `Content-Encoding: br` from the protocol — 53 MB on disk too.
- The SAB switch (`enable-features=SharedArrayBuffer` in main.js — the
  conscious security decision, rationale in the code comment) disturbs
  nothing: note preview, EmbedPDF viewer and the unit suite (405 pass)
  are all clean with it on.

**What is wired (working, guarded, verified from THIS tree):**
`zeta`/`clewzeta` asset roots + `.wasm` MIME in protocol.js,
`zetaAssets` in paths.js, `zeta-page.{html,js}` + `zeta-thread.js` in
src/preview-client (host page ↔ LOWA-worker script; measurement mode
without `&path` — the page times itself and wears the numbers — tab
mode with), `office` fileKind (six extensions, NOT embeddable — tabs
only), clew-file-view iframe branch + one-tab guard, `zetaOfficeUrl`
in preview-url.js, office-save bridge in pdf-save.js, `OFFICE_WRITE`
channel → `vault.writeOffice` (writePdf's guards for office
extensions). Saving is LibreOffice's OWN gesture (toolbar/Ctrl+S —
WarnAlienFormat disabled at boot) or a `zeta-save` postMessage; the
modified→false transition drives the push to disk. Smoke hook gained
`CLEW_SMOKE_LOG=1` (all console) and `CLEW_SMOKE_METRICS=/path.json`
(app.getAppMetrics dump).

**Decisions standing:** tabs only (no `![[x.docx]]` embeds); no
autosave; one office tab at a time. Boot-per-tab replaced "one shared
instance" (measured: boots are 2 s — change was taken out loud, here).

## 0b. The finishing punch list (product work, no feasibility risk)

Ordered roughly by user pain; details in the "Finishing ZetaOffice"
artifact:

1. **Save-on-close prompt** — a dirty office tab currently discards
   silently on close. The page already posts `zeta-modified`; the app
   side needs to track it per tab and intercept tab close.
2. **External-change conflicts** — an office file changed on disk
   under an open tab is unhandled; editorPool's banner is the model.
   (Self-echo suppression matters here too: a save triggers the
   watcher.)
3. **Packaged download flow** — userData + the pdf-fonts pattern,
   verified against the SHA256 pins; paths.js already points there
   when packaged. Option: keep the .br files and serve them with
   `Content-Encoding: br` (53 MB on disk instead of 262 MB).
4. **One-tab guard refresh** — after closing the office tab, the
   blocked tab needs a reopen by hand; re-render it on tab-close.
5. **Prune LO's own File menu** — Open/SaveAs/Recent operate on the
   wasm FS: harmless but weird. Hide via UNO config like the
   standalone example hides toolbars.
6. **Verification passes** — real keyboard typing (only UNO edits were
   harness-tested), clipboard app↔LO, .pptx (Impress — untested),
   split-pane resize behaviour, note-link → office-tab routing.
7. **Multi-window policy** — the one-tab guard is per-window (DOM
   query); two windows can still boot two 1.6 GB instances. Decide.
8. **The MANUAL** (../Clew-docs) — office tabs, formats, one-tab rule,
   save semantics, the download. Nothing here will remind you.
9. **The cheap rung, still worth building** — `soffice --headless
   --convert-to pdf` into `.clew/cache` (`toolchainPath()` pattern),
   shown in the EXISTING EmbedPDF viewer, plus "Edit in LibreOffice"
   externally: the fallback for users without the download.

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

- **The ZetaOffice finishing punch list (§0b)** — incl. the manual.
- The soffice converter rung (§0b item 9) — independent and cheap.
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

The tree was left CLEAN on 2026-09-01 (evening): main fast-forwarded
to the ZetaOffice graduation (`5387cc1`), HANDOVER updated, nothing
else touched. The gitignored `zeta-assets/` here is deliberate (see
§0). Anything uncommitted you find is NEW owner work — leave it
unstaged and note it here. Never switch THIS tree off main; big
experiments get their own worktree (the spike's, now merged, awaits
removal). Live testing flips demo widgets —
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
