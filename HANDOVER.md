# Handover — 2026-09-08 (next session: THE `::` BUG, see §1 — still untouched)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. Where things stand

Trees clean; **469 unit tests green**. Eight commits here (`d417f9f` →
`40f1643`), six in ../Clew-docs (`f32c4a8` → `bbd7310`), each feature
matched by its manual section in the same pass. Everything below was
smoke-verified with the artefact eyeballed, not just the log line.

The launch list and the 09-02 packaging work are settled and no longer
repeated here — see the 09-05 revision of this file in git if you need it.

## 1. STILL OPEN — the bug this session never got to

The owner arrived with other work and it never came up. Carried forward
**unchanged**; both faults are measured, not theorised.

### 1a. `Key:: value` mangles prose (the real one)

`Key:: value` is Dataview's inline-field idiom AND jmarkdown's
description-list syntax. Both rules fire, on different layers:

- **Read**: `src/engine/query-fences.js` — `INLINE_LINE_RE` /
  `INLINE_BRACKET_RE` scan the file as text, so queries DO see the field.
- **Render**: `vendor/jmarkdown/src/description-lists.js` — `dt_rule`
  claims the same line and emits `<dl><dt>…</dt><dd>…</dd></dl>`.

| Source | Renders as |
| --- | --- |
| `mark:: 65` on its own line | `<dt>mark</dt><dd>65</dd>` |
| `the essay scored [grade:: 71] overall.` | `<dt>Also bracketed…scored [grade</dt><dd>71] overall.</dd>` |

The bracketed case is the bad one: **the whole sentence is eaten**. The
query still reads `grade = 71`; the prose is destroyed on screen. The
drawn compat line says a vault's contents either render or are refused BY
NAME. This does neither — it renders *wrongly*, silently.

**The manual is currently wrong about it.** `Clew-docs
site/manual/properties.html` (~line 269+) documents inline fields as
working, and its own example — `[chapter:: 5], which repays a slow
read.` — is exactly the shape that gets mangled. Whatever is decided,
that section needs to change.

Options (the choice is the OWNER'S — a dialect decision):

1. A Clew engine extension claiming `Key:: value` lines before the engine
   sees them. Extension tokenizers are UNSHIFTed, so a Clew rule can win.
   Hard part: telling a one-line inline field from a genuine description
   list, whose definition may continue on indented lines.
2. Upstream `dt_rule` change so a lone `word:: value` with no following
   indented block is not a description list. Engine changes go to the
   master at `~/Sites/jmckalex/software/jmarkdown` (branch
   `at-migration`), then `npm run sync-engine`. **Never edit vendor/.**
3. Refuse by name (a visible "inline fields collide with description
   lists here" marker) — honest, keeps the promise, costs the feature.
4. Document the conflict, point people at frontmatter. Cheapest; the
   manual change is required either way.

Repro: a note with the two lines above, in reading mode. `smoke/` still
has no scenario for this — worth adding one.

### 1b. `!= null` passes for an ABSENT field (small, well-defined)

`WHERE PartA != null` is TRUE for a note with no `PartA` at all, so the
obvious way to filter incomplete notes silently keeps them.
`typeof(PartA)` correctly reports `null` for the same field, so the two
disagree.

Cause: `src/engine/dv-expr.js:348`, in `valuesEqual` —
`if (ca === null || cb === null) return a === b;`. A missing field is
`undefined` (`vault-model.js#pageValue`), the literal is `null`, so `=`
is false and `!=` true. Dataview treats a missing field as null.

Likely fix: normalise before that comparison (`(a ?? null) === (b ?? null)`),
which also makes `WHERE x = null` find notes missing `x`. Wants tests in
`tests/dataview.test.js`: absent field vs `= null` / `!= null`, and a
present-but-zero field (which must keep behaving). Workaround, correct
today: `isnotempty(PartA)`.

## 2. What this session built

- **Reading→source keeps your place** `d417f9f`. ⌘E back used to jump to
  the top: the editor restored a cursor/scrollTop saved BEFORE reading
  mode opened. The preview now records its top visible line as
  `readingLine` on the tab's view state and the editor consumes it once
  on mount, landing it at the TOP of the viewport with the cursor on it.
  What counts as "the reader moved" is the scroll-sync suppressor — only
  an undriven scroll, plus a `from: 'nav'` jump.
- **Engine mirror synced** `748bd70` → `e823e76` (`e7487c0`): `\fullcite`
  emits spans classed `.fullcite` (divs used to tear the paragraph in
  two — an HTML parser closes an open `<p>` at a `<div>`), and Vancouver
  key extraction reads capture group 9. Nothing needed on Clew's side;
  the References panel reads `.csl-entry` out of the hidden
  `.clew-bib-panel-source`, which keeps its divs.
- **Explorer remembers closed folders** `a58a3cd`. `collapsedFolders` in
  the workspace state (per vault, `.clew/workspace.json`). Absence means
  open, so a first-seen vault still opens expanded. The explorer redraws
  on a new `workspace-restored` event because the workspace loads over
  IPC AFTER the tree is drawn. Dead paths are KEPT, not pruned — a folder
  restored from the Trash should come back closed.
- **Embeds refresh when their target changes** `b859f26`. A transclusion
  puts the child's content in the parent's HTML, so a changed child left
  every embedder stale. `indexer.embeddersOf` (transitive) + a
  `#restale` shared with the query-note path.
- **Foldable embeds** `5da6db2` + demo note `ce88b57`:
  `![[Note|collapsed]]` / `|open` render a real `<details>` and the
  toggle rewrites the keyword in the note. `|open` is deliberately not
  the same as omitting it — a bare `![[Note]]` has no disclosure, so
  unfolding would otherwise destroy the affordance.
- **Export as PDF (reading view)** `6f3be17`. `src/main/print-pdf.js`
  prints the note's own clew-preview:// document in a hidden window;
  no TeX needed, alongside the LaTeX PDF. Polls until MathJax, the fonts
  it asked for and every `.mermaid` are done. Prints LIGHT whatever the
  app wears; paper from the new `printPaperSize` setting.
- **Embed frame levels** `40f1643`: `|quiet` (accent stripe alone,
  title kept) and `|bare` (nothing — the blocks join the host's flow,
  measured identical to writing them inline). `bare` beats `collapsed`.

Vocabulary for both embed keywords lives in `src/engine/embed-state.js`,
imported by the engine extension AND the renderer action — the
block-refs.js/block-ids.js arrangement, so reader and writer cannot drift.

## 3. Small residue (none blocks anything)

New this session:

- **`demo-vault/Guide/Links and Embeds.md` is now a stateful demo** like
  the task checkboxes: folding its embed in a live session rewrites the
  file. `git status demo-vault` before committing.
- A **nested** embed's fold is not written back (its line belongs to
  another file) — deliberate, documented; it folds for the session only.
- `|collapsed` / `|quiet` / `|bare` are not offered by wikilink
  completion. Media embeds strip the keywords and ignore them.
- `EXPORT_NOTE` now takes `outFile` (smoke bypass, like EXPORT_SITE's
  `outDir`); a relative one is VAULT-relative.
- The reading-view PDF prints a folded embed folded — "as displayed".

Carried over, still true:

- Toggling a plugin checkbox does not reload app/preview surfaces —
  reopen the vault. PRE-EXISTING; the settings hint says so.
- Rename of an OPEN pdf/office/canvas tab leaves the tab on the old path
  (`remapPaths` handles note tabs only).
- Executable extensions refused by `src/main/open-file.js` are UNREVIEWED
  by the owner — widen or narrow on request.
- Toggling the history switch off/on writes a plain boolean, discarding a
  hand-edited tuning object (documented in the manual).
- Real-keyboard checks inside LibreOffice (⌘S, clipboard) and
  office-convert on a machine with desktop LibreOffice: unverifiable
  here. Restore-boot policy still deliberate and unreviewed.
- Kanban card drag (write path) — v2 of a shipped feature.
- Query-dashboard renders from a warm cache emit NO EV_RENDER_DONE; a
  scenario timing "first render" must delete the vault's `.clew/`.

## 4. Manual facts worth adding (still not done)

Verified, currently undocumented, cheap wins for the Queries chapter:
`FROM` takes a path **relative to the vault root**, so the vault's own
name never appears in a query (a root-level vault wants no `FROM`, or
`FROM ""`); and `WHERE field` is a TRUTHINESS test, so a legitimate `0`
is skipped — `isnotempty()` is the fix. Both cost the owner real time.

## 5. Owner's own actions

The GoDaddy DNS change (A records for clew-app.com/.net →
144.126.236.254), then in Clew-docs `make dns-check` → `provision` →
`sync` → `tls`. Plus the win/linux VM run if those artefacts are to ship,
and the Sifr/small-icons verdict (still untried; the two reverts are in
git history — size block in `zeta-thread.js#loadFile`, vendored zip in
`vendor/libreoffice-icons/`).

Done outside the repo this session: the `header` and `word-count` plugins
were copied into `~/Library/Application Support/Clew/plugins/` so they
are available to every vault. **Enabling stays per-vault** — tick them in
Settings → Plugins in each vault, and reopen the vault afterwards. A
vault's own copy still shadows the global one, so the demo vault keeps
using its bundled pair.

## 6. The owner works in this tree concurrently

Tree left CLEAN on 2026-09-08: main at the commit after this file,
Clew-docs at `bbd7310`. `zeta-assets/` here is deliberate and gitignored.
`out/` holds mac/win/linux artefacts from 09-02. Anything uncommitted you
find is NEW owner work — leave it unstaged and note it here. Never switch
THIS tree off main. Live testing flips demo widgets — reset
`status:`/`done:`/`^motto` baselines, and now the foldable embed in
`Guide/Links and Embeds.md`, before committing demo files.

## 7. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- Always pass `CLEW_SMOKE_VAULT`; `git status` demo and study vaults
  after every smoke run. `CLEW_USER_DATA` isolates a run entirely.
- Long smoke runs go `run_in_background` with output to a file.
- Reusable scenarios live in `smoke/` — extend it, don't rewrite them in
  scratchpads. Five new pairs landed there this session; the README table
  carries the per-scenario assertions.
- **The owner's bug reports have been consistently right.** Every bug
  fixed this session came from the owner reporting it, and each
  reproduced on the first honest attempt.
- **Write assertions that can fail — and eyeball the artefact anyway.**
  Twice this session that was the difference: a bare embed hugging the
  heading above it, and a stray PDF written to the repo root, were both
  caught by looking rather than by a green log line.
- **Prefer measuring to guessing — and re-measure before believing a
  diagnosis.** A PDF's maths looked like a font fallback beside a
  screenshot; measuring showed MathJax runs in SVG output (`faces: []`,
  glyphs are paths) and the two renderings were identical. The comment
  written on the strength of the first reading had to be corrected.
- A feature change is not finished until the MANUAL in `../Clew-docs`
  matches it — nothing in this repo's git status reminds you.
- `npm run dev` / `npm run package` re-sync the engine AND the EmbedPDF
  viewer from their masters; `sync-engine` + `sync-embedpdf` +
  `git status` BEFORE tagging.
