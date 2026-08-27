# Handover — 2026-08-26 night (the compat line is drawn)

## 0a. LATER THE SAME NIGHT (post-line work — all Clew-native)

- **Widgets are Web Awesome components** (@awesome.me/webawesome, MIT,
  16 cherry-picked, zero icon assets, lazily loaded wa.js/wa.css from
  __clew_preview__; wa-dark/wa-light track the theme; brand token =
  Clew accent). New types: textArea/datePicker/time/progressBar (Meta
  Bind's own, previously refused) + Clew-native `rating` and `color`;
  VIEW formatter kinds relativeTime/formatDate/formatNumber/
  formatBytes/badge/qr. v3 emits standard `change` — no new wiring.
- **Widgets edit PROSE**: `INPUT[text:^block-id]` binds to the block a
  marker names; writes go through editNoteField source 'block' →
  rewriteBlockText (shared/note-metadata: fence-aware, marker kept,
  values flatten to one block). Demo + docs: `Guide/Widgets.md` (its
  own page now; the compat note is back to a pointer).
- **MetaPost fonts fixed UPSTREAM** (jmarkdown 00b006f): HTML path is
  EPS + dvisvgm --no-fonts → glyphs as PATHS (the old backend's <text>
  garbled kerning and DROPPED superscripts). Clew detects ghostscript's
  stable homebrew symlink and writes 'TiKZ libgs' (the versioned Cellar
  default had rotted). Demo cache regenerated: 0 <text>, 78 paths.
- **openWikilink refuses URLs** — an `https:/…/.md.md` artifact was
  found in the demo vault (create-on-miss took a URL literally);
  scheme-shaped targets now open externally.
- **wa.css is TOKENS ONLY** (themes/default.css) — the full
  webawesome.css repaints html/body (that was the "black margins on the
  Widgets page" bug). Components style themselves in shadow DOM.
- **WA- elements take the NORMAL morph** (their light DOM is real
  content — a badge's text was frozen by the keep-guard), BUT their
  host inline style is component-owned state (wa-progress-bar keeps
  --percentage there) and must be carried onto the incoming element
  before the attr sync, or the fill vanishes. See client.js.
- **createNote collapses trailing ".md.md"** — typing "Tasks.md" into a
  create box used to make Tasks.md.md (found as a vault artifact).
- The OWNER is working in the tree concurrently (icons/canvas files +
  Note Headers tweak left uncommitted, deliberately untouched). Their
  live testing also toggles demo widgets — reset `done:`/`^motto`
  baselines before committing demo files.


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

The closing move (this evening) added the last three format items:

- **Admonitions** — ```ad-* fences (pre-callout vaults) map onto
  calloutBlock TOKENS, so callouts.js renders them: one look, no drift.
  title/collapse honoured, icon/color cosmetic, unknown ad-types become
  titled notes (the plugin's own behavior for user types).
- **Core ```query search embeds** — same fence, two dialects, told apart
  by the colon: `key: value` (space) is Clew's language, `op:value` is
  core Obsidian's search. The search subset (terms/phrases/tag/path/
  file/[property]/-/OR) runs in the worker over scanNotes; regex,
  parens, line:/section:/task: refused by name. Empty body stays Clew's
  all-notes list.
- **Meta Bind widgets** — `INPUT[toggle:done]` etc. render live controls
  two-way bound to properties, INCLUDING other notes' via
  `[[Note]]#prop`. The whole thing is a new front end on the EXISTING
  field-edit → editNoteField path (safety valve, retype coercion, key
  creation all free). Five types (toggle/slider/text/number/
  inlineSelect); other types, VIEW expressions, and buttons refused by
  name; widgets render disabled under CLEW_SITE_EXPORT. Client wiring in
  preview-client/meta-bind.js; two guards in client.js (mb toggles are
  NOT task toggles; a focused widget survives morphs).

Verified end to end: the demo compat note's toggle was clicked in a
smoke run and the FILE's frontmatter changed on disk (then reset).
`npm test` → **380 green**. Both repos clean and committed.

## 1. Earlier this same day (see git log for detail)

0.9.0 released (universal dmg notarized; site + binaries byte-verified
on the droplet; DNS still the one blocker). Charts plugin + dataviewjs
renderChart. Excalidraw embedded images. CJK fonts verified. Showpiece
TikZ/MetaPost figures rendered as theme-aware ink. Bases map views
(+ OSM default tiles — CARTO watermarks keyless use now). FLATTEN +
real GROUP BY + lambdas (fifth vault demanded it; teaching vault
43→66%). Kanban boards + Tasks dialect (they WERE in the corpus).
Anchor TOCs resolve toc-<slug> ids AND are Back-able (browser-style
same-note history); every registered chord now forwards from reading
mode; nav is ⌘[ / ⌘]; obsidian:// links get Clew equivalents.

## 2. Open items (none are compat)

- **Win/Linux 0.9.0 artefacts have never run on real machines.**
- The DNS change → then `make dns-check` + `make tls` in Clew-docs.
- Kanban-board card drag (write path: move a list item between
  headings) — v2 of a shipped feature, not new compat.
- The demo vault's compat note leaves `done: false` on purpose; playing
  with its widgets dirties the file (like the Habit Tracker's
  clewdata.json). `git status` after smoke runs, as ever.

## 3. New traps (this evening's)

- **The two ```query dialects are told apart by the space after the
  colon.** Documented in the manual; do not "normalize" one into the
  other.
- **Meta Bind toggles must not fall into the checkbox-toggle path** —
  client.js guards on `.clew-mb`. Any future checkbox-like widget needs
  the same guard.
- **A focused .clew-mb element is morph-protected**; without that, a
  re-render mid-drag yanks the slider back to the on-disk value.
- **Admonition tokens are `calloutBlock`-typed on purpose** — marked
  dispatches renderers by token type, so one renderer serves both
  syntaxes. If callouts.js's token shape changes, admonitions.js must
  follow.
- Earlier-today traps (list() dialect split, ordered DQL pipeline,
  whole-document extensions via start()→0, export-worker env, innerText
  vs textContent, `--universal`) are in this file's git history.

## 4. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- Always pass `CLEW_SMOKE_VAULT`; `git status` demo and study vaults
  after every smoke run.
- **The owner's bug reports have been consistently right.**
- **Write assertions that can fail — and eyeball the artefact anyway.**
- **Verify artefacts by content**, never the log line.
- **Prefer measuring to guessing** — and re-measure.
- `npm run dev` / `npm run package` re-sync the engine from the golden
  master; `sync-engine` + `git status` BEFORE tagging.
