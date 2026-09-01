# Handover — 2026-09-01 (evening: the spike RAN, and it is GOOD)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. THE ACTIVE ITEM: the ZetaOffice spike — MEASURED AND WIRED

The spike (FULL embed of ZetaOffice — LibreOffice wasm via zetajs —
office docs editing in file tabs, save-back into the vault) was built
and measured this session ON THIS BRANCH (`zetaoffice-spike`, worktree
`../Clew-app-zetaoffice`). **Verdict: viable, comfortably.** Numbers
(M-series Mac, real documents):

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

**What is wired (all spike-quality but real):** `zeta-assets/`
(gitignored download, PROVENANCE.md + SHA256SUMS pin it),
`zeta`/`clewzeta` asset roots + `.wasm` MIME in protocol.js,
`zetaAssets` in paths.js, `zeta-page.{html,js}` + `zeta-thread.js` in
src/preview-client (host page ↔ LOWA-worker script; measurement mode
without `&path`, tab mode with), `office` fileKind (six extensions,
NOT embeddable — tabs only), clew-file-view iframe branch + one-tab
guard, `zetaOfficeUrl` in preview-url.js, office-save bridge in
pdf-save.js, `OFFICE_WRITE` channel → `vault.writeOffice` (writePdf's
guards for office extensions). Saving is LibreOffice's OWN gesture
(toolbar/Ctrl+S — WarnAlienFormat disabled at boot) or a `zeta-save`
postMessage; the modified→false transition drives the push to disk.
Smoke hook gained `CLEW_SMOKE_LOG=1` (all console) and
`CLEW_SMOKE_METRICS=/path.json` (app.getAppMetrics dump).

**Not yet done (the honest gaps):** save-on-close prompt (needs
tab-close interception); external-change conflicts (an office file
changed on disk under an open tab is unhandled — the editorPool-style
banner is the model); the one-tab guard doesn't re-render when the
other tab closes (reopen by hand); LO's Open/SaveAs dialogs inside the
canvas are not suppressed (File menu still shows them; they operate on
the wasm FS, harmlessly weird); packaged-app download flow (userData +
pdf-fonts pattern) not built — paths.js has a placeholder; keyboard
smoke of real typing (only UNO-driven edits were exercised).

**Decisions still standing:** tabs only (no `![[x.docx]]` embeds); no
autosave; one office tab at a time. Boot-per-tab replaced "one shared
instance" (measured: boots are 2 s — change was taken out loud, here).

**The cheap rung is STILL untouched and still worth building**
regardless (days, not weeks): `soffice --headless --convert-to pdf`
into `.clew/cache` when ordinary LibreOffice is installed
(`toolchainPath()` pattern), shown in the EXISTING EmbedPDF viewer,
plus "Edit in LibreOffice" externally. It remains the fallback for
users without the download.

**To re-run the measurements:** scenarios in the session scratchpad
are gone after reboot; they were ~40-line CLEW_SMOKE scripts (cold+warm
iframe of zeta-page.html?src=…, listen for zeta-saved/zeta-error
postMessages). zeta-page.html without `&path` is self-measuring — the
overlay prints the timings; `&measure` needs nothing else.

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
