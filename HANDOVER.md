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

## 2. Open items (none are compat)

- **Win/Linux 0.9.0 artefacts have never run on real machines.**
- The DNS change (owner's action) → then `make dns-check` + `make tls`
  in Clew-docs.
- Kanban-board card drag (write path: move a list item between
  headings) — v2 of a shipped feature, not new compat.

## 3. Traps (newest first)

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
