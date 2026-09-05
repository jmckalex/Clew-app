# Handover — 2026-09-05 (next session: THE `::` BUG, see §1)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. Where things stand

Launch list 6/6 worked (2026-09-02) and a run of owner-asked features on
top. Trees clean; **439 unit tests green**. Everything below was
smoke-verified with the artefact eyeballed, not just the log line.

- Atomic vault writes `5b70193` · note history `22c59b4` · first-run +
  bundled demo vault `dd703e7` · packaged office-engine download (real
  CDN, LibreOffice booted) · win/linux artefacts BUILT NOT RUN ·
  big-vault stress, no cliff (`smoke/README.md` has the baseline).
- Smoke isolation `04def34`: settings never persist under CLEW_SMOKE.
  (A leak had been writing scratch vaults into the owner's real
  recentVaults for several sessions. Scrubbed; verified byte-identical.)
- Meta Bind widget polish `c579d11` · global plugins `376b626` ·
  open-in-default-app links `f3a4662` · wikilink completion matches
  paths + subsequence `418e87b` · Avenir Next is the reading face
  `7775cb0`.
- ../Clew-docs matched every one of those (latest `9eacfa0`).

## 1. THE BUG FIX — `Key:: value` mangles prose

Found 2026-09-03 while answering an owner question about Dataview; both
faults below are **measured, not theorised**.

### 1a. The collision (the real one)

`Key:: value` is Dataview's inline-field idiom AND jmarkdown's
description-list syntax. Both rules fire, on different layers:

- **Read**: `src/engine/query-fences.js` — `INLINE_LINE_RE` /
  `INLINE_BRACKET_RE` scan the file as text, so queries DO see the
  field. Verified: a query over `mark:: 65` returns 65.
- **Render**: `vendor/jmarkdown/src/description-lists.js` — `dt_rule`
  claims the same line and emits `<dl><dt>…</dt><dd>…</dd></dl>`.

Measured results (scratch vault, reading mode):

| Source | Renders as |
| --- | --- |
| `mark:: 65` on its own line | `<dt>mark</dt><dd>65</dd>` |
| `the essay scored [grade:: 71] overall.` | `<dt>Also bracketed…scored [grade</dt><dd>71] overall.</dd>` |

The bracketed case is the bad one: **the whole sentence is eaten** and
turned into a definition. The query still reads `grade = 71`; the prose
is destroyed on screen.

Why this matters beyond cosmetics: the drawn compat line says an
Obsidian vault's contents either render or are **refused BY NAME**. This
does neither — it renders *wrongly*, silently. An Obsidian vault that
uses inline fields opens here with mangled paragraphs and no
explanation.

**The manual is currently wrong about it.** `Clew-docs
site/manual/properties.html` (~line 269+) documents inline fields as
working, and its own example — `[chapter:: 5], which repays a slow
read.` — is precisely the sentence shape that gets mangled. Whatever is
decided, that section needs to change.

Options (the choice is the OWNER'S — it is a dialect decision):

1. A Clew engine extension that claims `Key:: value` lines before the
   engine sees them and renders them Obsidian-style. Extension
   tokenizers are UNSHIFTed (CLAUDE.md § block references), so a Clew
   rule can win. Hard part: telling a one-line inline field from a
   genuine description list, whose definition may continue on following
   indented lines.
2. Upstream `dt_rule` change so a lone `word:: value` with no following
   indented block is not a description list. Engine changes go to the
   master at `~/Sites/jmckalex/software/jmarkdown` (branch
   `at-migration`), then `npm run sync-engine`. **Never edit vendor/.**
3. Refuse by name (render a visible "inline fields collide with
   description lists here" marker) — honest, keeps the compat promise,
   costs the feature.
4. Document the conflict and tell people to use frontmatter. Cheapest;
   the manual change is required either way.

Repro: a note with the two lines in the table above, opened in reading
mode. `smoke/` has no scenario for this yet — worth adding one.

### 1b. `!= null` passes for an ABSENT field (small, well-defined)

`WHERE PartA != null` is TRUE for a note that has no `PartA` at all, so
the obvious way to filter incomplete notes silently keeps them (and
their arithmetic then produces nonsense). `typeof(PartA)` correctly
reports `null` for the same field, so the two disagree.

Cause: `src/engine/dv-expr.js:348`, in `valuesEqual` —
`if (ca === null || cb === null) return a === b;`. A missing field is
`undefined` (`vault-model.js#pageValue` returns `undefined`), the
literal is `null`, and `undefined === null` is false, so `=` is false
and `!=` is true. Dataview treats a missing field as null, so this is a
deviation from the format Clew claims to own.

Likely fix: normalise `undefined` to `null` before that comparison
(`(a ?? null) === (b ?? null)`), which also makes `WHERE x = null`
correctly find notes missing `x`. Wants unit tests in
`tests/dataview.test.js` for: absent field vs `= null` / `!= null`,
and a present-but-zero field (which must keep behaving).

Workaround meanwhile, and correct today: `isnotempty(PartA)` — verified
to include a recorded `0` and exclude an absent field.

## 2. Small residue (none blocks anything)

- Toggling a plugin checkbox does not reload app/preview surfaces —
  reopen the vault. PRE-EXISTING; the settings hint says so.
- Rename of an OPEN pdf/office/canvas tab leaves the tab on the old
  path (`remapPaths` handles note tabs only).
- Executable extensions refused by the new open-in-default-app links
  (`src/main/open-file.js` REFUSED) are UNREVIEWED by the owner —
  widen or narrow on request.
- Toggling the history switch off/on writes a plain boolean, discarding
  a hand-edited tuning object (documented in the manual).
- Real-keyboard checks inside LibreOffice (⌘S, clipboard) and
  office-convert on a machine with desktop LibreOffice: unverifiable
  here. Restore-boot policy (a restored office tab boots LibreOffice at
  launch) still deliberate and unreviewed.
- Kanban card drag (write path) — v2 of a shipped feature.
- Query-dashboard renders from a warm cache emit NO EV_RENDER_DONE; a
  scenario timing "first render" must delete the vault's `.clew/`.

## 3. Manual facts worth adding (found while answering questions)

Verified, currently undocumented, and cheap wins for the Queries
chapter: `FROM` takes a path **relative to the vault root**, so the
vault's own name never appears in a query (a root-level vault wants no
`FROM`, or `FROM ""`); and `WHERE field` is a TRUTHINESS test, so a
legitimate `0` is skipped — `isnotempty()` is the fix. Both cost the
owner real time this session.

## 4. Owner's own actions

The GoDaddy DNS change (A records for clew-app.com/.net →
144.126.236.254), then in Clew-docs `make dns-check` → `provision` →
`sync` → `tls`. Plus the win/linux VM run if those artefacts are to
ship, and the Sifr/small-icons verdict (still untried; the two reverts
are in git history — size block in `zeta-thread.js#loadFile`, vendored
zip in `vendor/libreoffice-icons/`).

## 5. The owner works in this tree concurrently

Tree left CLEAN on 2026-09-05: main at the commit after this file,
Clew-docs at `9eacfa0`. `zeta-assets/` here is deliberate and
gitignored. `out/` holds mac/win/linux artefacts from 09-02. Anything
uncommitted you find is NEW owner work — leave it unstaged and note it
here. Never switch THIS tree off main. Live testing flips demo widgets
— reset `status:`/`done:`/`^motto` baselines before committing demo
files.

## 6. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- Always pass `CLEW_SMOKE_VAULT`; `git status` demo and study vaults
  after every smoke run. Settings no longer persist under CLEW_SMOKE;
  `CLEW_USER_DATA` isolates a run entirely (fresh-install sim, and the
  only isolation a packaged run without CLEW_SMOKE gets).
- Long smoke runs go `run_in_background` with output to a file.
- Reusable scenarios live in `smoke/` — extend it, don't rewrite them
  in scratchpads.
- **The owner's bug reports have been consistently right.** Both bugs
  in §1 came from the owner pushing back on something I asserted.
- **Write assertions that can fail — and eyeball the artefact anyway.**
- **Verify artefacts by content**, never the log line. When a fixture
  looks broken, suspect the fixture before the app (a mis-split shell
  loop cost a wrong bug report this session).
- **Prefer measuring to guessing** — and re-measure.
- A feature change is not finished until the MANUAL in `../Clew-docs`
  matches it — nothing in this repo's git status reminds you.
- `npm run dev` / `npm run package` re-sync the engine AND the
  EmbedPDF viewer from their masters; `sync-engine` + `sync-embedpdf`
  + `git status` BEFORE tagging.
