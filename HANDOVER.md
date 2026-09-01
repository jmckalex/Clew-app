# Handover — 2026-08-26, late night

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. THE HEADLINE: compatibility is closed by owner decision

The owner drew the line: **formats owned, behaviors not chased.** The
policy, its rationale (open source is the extension story; refusals are
the demand sensor), and the DO-NOT-REOPEN rule are in CLAUDE.md; the
public statement is the demo vault's `Guide/Obsidian Compatibility.md`.
Do not add compat features on your own judgment — a real vault plus a
real user hitting a named refusal reopens a question; nothing else does.

The closing items (admonitions, core ```query search embeds, Meta Bind
widgets) are shipped and tested; the two ```query dialects are told
apart by the space after the colon (do not "normalize" one into the
other).

## 1. After the line: widgets grew up (all Clew-native work)

- **Widgets are Web Awesome components** (@awesome.me/webawesome v3,
  MIT, 16 cherry-picked, zero icon assets; wa.js/wa.css lazy-loaded
  from `__clew_preview__` only when a note carries one; wa-dark/wa-light
  track the theme; brand token = Clew accent). Full type set: Meta
  Bind's toggle/slider/text/textArea/number/inlineSelect/select/
  datePicker/time/progressBar plus Clew-native `rating` and `color`;
  VIEW formatter kinds relativeTime/formatDate/formatNumber/
  formatBytes/badge/qr. Everything else refused by name; disabled
  under CLEW_SITE_EXPORT.
- **Widgets edit PROSE**: `INPUT[text:^block-id]` binds to the block a
  marker names; writes go editNoteField source `'block'` →
  `rewriteBlockText` (shared/note-metadata: fence-aware, marker kept,
  values flatten to one block). Only text/textArea may bind to blocks.
- Demo: `Guide/Widgets.md` is the dedicated page, every control live
  (playing with it edits the file — reset to the committed baseline
  after smokes). The compat note is back to a pointer. Manual:
  properties.html covers all of it including block bindings.
- **MetaPost fonts fixed UPSTREAM** (jmarkdown `00b006f`): HTML path is
  now EPS + `dvisvgm --no-fonts` → glyphs as PATHS (the old SVG backend
  emitted unresolvable `<text>` and silently DROPPED superscripts).
  Clew detects ghostscript's stable homebrew symlink for `TiKZ libgs`
  (the versioned Cellar default had rotted). Demo cache regenerated:
  0 `<text>`, 78 paths; theme inversion still applies (it targets
  fills/strokes).
- **Two owner-reported widget bugs fixed** (commit `8317184`): the
  Widgets page's "black margins" (wa.css shipped webawesome.css's
  native layer, which paints html/body — now TOKENS ONLY, 52KB) and
  the badge that never followed its select (custom-element keep-guard
  froze its text child — WA- elements now take the normal morph).
- **Two vault artifacts traced to real holes, both closed**: a
  `https:/…/.md.md` note (openWikilink now opens scheme-shaped targets
  externally instead of create-on-miss) and `Tasks.md.md` (createNote
  collapses a trailing run of `.md`).

## 1a. 2026-08-27: the marking vault (the first REAL dashboard vault)

- `~/Documents/Teaching/Marking/2025-2026/PH456/Marking Vault/` — built
  from the owner's real PH456 cohorts (OUTSIDE this repo; personal
  data, never copy into it). One note per essay (47), frontmatter
  question/marked/grade/marked-on/submitted, widgets in every note,
  PDFs copied (never moved) into Attachments/, the WT feedback
  jmarkdown file split into per-essay notes (private
  `:::comment{include=false}` blocks became folded callouts), AT
  seeded from the Moodle grades CSV. Dashboard.md: dataviewjs +
  renderChart (progress, distribution, doughnut, pace), editable
  queue, kanban by question. Generator script preserved in the session
  scratchpad (`build-marking-vault.py`) — regenerate for new cohorts.
- `Guide/Dashboards.md` in the demo vault is the documented twin.
- Traps met: `cp -R src dest/` with dest's parent missing copies
  CONTENTS (the charts plugin landed flat in .clew/plugins/); a
  template note carrying the collection's tag pollutes every query —
  templates stay untagged, the how-to says to add the tag.
- **File explorer hierarchy** (owner request): folder rows were
  text-muted — dimmer than their own contents — now
  `--clew-text-normal` at weight 600; per-level indent 14→18px
  (panels.css + the paddingLeft in clew-file-explorer.js).
- **Phantom token trap:** `--clew-text-primary` was referenced in
  canvas.css but defined in NEITHER theme — an undefined `var()`
  silently inherits, so it half-worked. The themes define exactly
  faint / muted / normal / on-accent; check before inventing a name.

## 1b. 2026-08-30: the PDF viewer is now the owner's OCG build

- Clew's EmbedPDF is no longer the npm package: `vendor/embedpdf/dist`
  is a committed mirror of the BUILT snippet viewer from
  `~/Source/EmbedPDF/v2` (branch `ocg-v2` — EmbedPDF v2.15.0 + the
  pdfium-ocg layers series; wasm carries the FPDF*OCG* API). Synced by
  `npm run sync-embedpdf` (scripts/vendor-embedpdf.js), auto-run by dev
  and packaging; served via paths.js#embedpdfAssets → protocol.js.
  `@embedpdf/snippet` removed from deps (models/pdfium kept — unused in
  code but the owner's; ask before pruning). Verified by smoke:
  content-assert the served chunk hash + wasm OCG symbol, then open the
  sidebar's layers tab (icon-only, third) and assert its empty state.
- Manual updated (`../Clew-docs` attachments-and-files.html): a Layers
  section under the PDF embeds chapter.
- The layers UI lives in the sidebar (thumbnails/outline/layers tabs)
  and on a selected annotation's toolbar; sample.pdf has no layers, so
  the demo shows the authoring empty state.

## 1c. 2026-08-31/09-01: fill-paragraph + auto-fill-mode (Emacs for the editor)

- `editor:fill-paragraph` (⌥Q, `fillColumn` setting default 72):
  hard-wraps the paragraph at the cursor / paragraphs in the selection.
  Pure functions in `editor/fill.js` (tables.js pattern, 14 unit
  tests): structure never joined (fences/frontmatter/$$/tables/
  headings/HR/:::/@directives/callout headers/^block-id lines/indented
  code), adaptive prefixes (quote `> `, list hanging indent), atomic
  words (wikilinks, inline code/math, \cite — plus a no-break rule so
  a wrapped word like `-` can't become a list marker). Manual:
  editing.html#filling + settings page.
- **Auto-fill-mode shipped** (`autoFill` setting, default off — the
  owner uses it on): `fill.js#autoFillHandler`, an
  EditorView.inputHandler. Space typed with the cursor past the column
  → `autoBreakLine` breaks the text behind the cursor at whitespace
  (atoms + dangerous-word + minIndex guards; inner spacing preserved,
  unlike M-q's retokenize), cursor rides onto the new line. Reads
  settings per keystroke, so the toggle is live and the pool's cached
  EditorStates need no rebuild. Paste and Enter are untouched;
  `view.composing` guards IME.
- **Bare Alt chords now WORK on mac**: chordOf() recovers the base key
  from event.code (KeyX/DigitN) when Option is held, because Option
  transforms event.key (⌥Q types œ). QWERTY-positional, dispatch and
  the hotkey recorder both go through chordOf. An Option combination
  that is NOT bound still types its character.
- Smoke trick: `document.execCommand('insertText', …)` on a focused
  CM editor goes through the REAL input path, inputHandler included —
  synthetic KeyboardEvents don't insert text, execCommand does.

## 2. Open items (none are compat)

- **Win/Linux 0.9.0 artefacts have never run on real machines.**
- The DNS change (owner's action) → then `make dns-check` + `make tls`
  in Clew-docs.
- Kanban-board card drag (write path: move a list item between
  headings) — v2 of a shipped feature, not new compat.

## 3. Traps (newest first)

- **The blanket `dist/` gitignore eats vendored dist dirs** —
  `vendor/embedpdf/dist` needed an explicit `!vendor/embedpdf/dist/`
  exception. `git check-ignore` anything you vendor before assuming it
  will commit.
- **The EmbedPDF viewer is ALL shadow DOM** — in smoke frame scripts
  `document.body.textContent` is empty and `document.querySelector`
  finds nothing; walk `shadowRoot`s recursively. Its sidebar tabs are
  icon-only (no text, no aria-label). And Chromium's resource-timing
  buffer missed the viewer's module chunks entirely — assert which build
  is served by FETCHING a hashed filename, never by
  `performance.getEntriesByType`.
- **wa.css is TOKENS ONLY** (`themes/default.css`). Importing full
  webawesome.css repaints html/body on exactly the notes that carry
  widgets. Components style themselves in shadow DOM.
- **WA- elements take the NORMAL morph** (their light DOM is real
  content), BUT the host inline `style` is component-owned state
  (wa-progress-bar keeps `--percentage` there, set from JS only on
  value CHANGES) and must be carried onto the incoming element before
  the attr sync or the fill vanishes. See client.js `applyRender`.
- **Meta Bind toggles must not fall into the checkbox-toggle path**
  (`.clew-mb` guard in client.js); a FOCUSED `.clew-mb` element is
  morph-protected (mid-drag sliders). Any future checkbox-like widget
  needs the same guard.
- **Canvas cards are the app page, not a preview iframe** — engine
  markup rendered into cards needs its own compact rules in canvas.css
  (scoped `.canvas-text`). When an engine extension changes markup,
  check the card styles too: callouts.js taking over GFM alerts left
  cards styling classes that no longer arrive (the giant-pencil bug).
- **Admonition tokens are `calloutBlock`-typed on purpose** — one
  renderer serves both syntaxes; if callouts.js's token shape changes,
  admonitions.js must follow.
- The block-binding writer and reader both live in
  shared/note-metadata (`rewriteBlockText`) — keep read/write symmetric
  there, not in the engine.
- Earlier traps (list() dialect split, ordered DQL pipeline,
  whole-document extensions via start()→0, export-worker env, innerText
  vs textContent, `--universal`) are in this file's git history.

## 4. The owner is working in this tree concurrently

Uncommitted and DELIBERATELY untouched: `scripts/generate-icons.js`,
`src/renderer/lib/icons.js`, `src/renderer/styles/canvas.css`,
`src/renderer/components/views/clew-canvas-view.js` (their in-progress
icon/canvas work), plus demo-vault play state (`Guide/Note Headers.md`
height tweak, `Projects/Demo Canvas.canvas`, `clewdata.json`). Never
stage these. Their live testing also flips demo widgets — reset
`status:`/`done:`/`^motto` baselines before committing demo files.

## 5. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- Always pass `CLEW_SMOKE_VAULT`; `git status` demo and study vaults
  after every smoke run — tonight it surfaced two real bugs.
- **The owner's bug reports have been consistently right.**
- **Write assertions that can fail — and eyeball the artefact anyway**
  (the vanished progress fill was caught by the eyeball, not the
  assertion).
- **Verify artefacts by content**, never the log line.
- **Prefer measuring to guessing** — and re-measure.
- A feature change is not finished until the MANUAL in `../Clew-docs`
  matches it — nothing in this repo's git status reminds you.
- `npm run dev` / `npm run package` re-sync the engine from the golden
  master; `sync-engine` + `git status` BEFORE tagging.
