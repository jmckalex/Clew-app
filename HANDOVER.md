# Handover — 2026-09-29 (0.11.1 built, notarized and boot-tested; the fix round, the login shell and the Esc fix in main; Clew-docs still has no remote)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it; it gained a "Live edit" subsection); the live
edit design AS BUILT is `docs/dev/live-edit.md` (§12 lists every decision in
force and the follow-ons left out). This file is rewritten each session —
keep it short, and prefer deleting a settled item to explaining it again.

## 0. Where things stand

`main` carries, after 0.11.0 (`c699565`), the owner-approved round of
2026-09-29 (relayed by the coordinating session in `~/Source/Clew`): smoke
runs made INVISIBLE, `smoke/boot-test.sh`, and the quick desktop fixes from
Clew-iOS's upstream candidates — one shared boot tail for a reload,
`dataviewJs` reconfiguring at once, a rejected office download repainting,
same-second history ordering, an engaged canvas node's affordances and
ring, floaters measuring the visual viewport, and the engine reached as
`#jmarkdown/*` — plus the owner's own report that day: the shell panel now
starts a LOGIN shell on macOS (a Dock-launched app has launchd's bare PATH,
so `ls` → `gls` was not found). Pushed to `fc2c79f` (owner's decision via
the coordinator). **843 tests green, `node scripts/build.js` green**; the
live sweep ran hidden and green, cross-reference parity included.

**0.11.1 is BUILT, notarized and boot-tested** (§3) — the rebuild of the
never-published 0.11.0 with this round; 0.11.1 rather than 0.11.0 so the
notarized 0.11.0 files in `out/` stay put (no tag or published page names
either — the newest tag is `v0.9.0`). Packaged in-session with the owner's
permission (an earlier attempt was refused by the auto-mode permission
check as a production deploy, until the owner permitted it).

**Esc leaves an engaged note card** (`7a0cb6f`, owner-approved, landed
after 0.11.1 was packaged — so NOT in 0.11.1): client.js forwards a bare Esc
nothing inside the preview used; `smoke/canvas-esc-scenario.js`.

**`main` pushed to `6c63132`** (owner's word via the coordinator).

Both live-edit worktrees
are REMOVED (2026-09-29; each was clean and its tip already in its repo's
`main`). The `feat/live-edit` branches survive — here locally and on origin,
in Clew-docs locally only — and are fully merged, so deleting them loses
nothing.

**Live edit is in `main`** — `254c198` merged the 40-commit branch
(`--no-ff`): the mode, the toolbar, tables edited in place, the `//` menu,
link hover previews, the live preview pane for maths and diagrams,
cross-references around `@label`/`@ref`/`@cref` with numbering asserted equal
to the engine's, multi-paragraph footnotes concealed, citations as objects
(library, cited-by, hover, graph), PDF annotations → note with
`[[x.pdf#page=N]]` anchors, sidenotes, headerless tables, engine-exact
italics, fence highlighting, text-style chords (⌘B/⌘I/⌘U/⌘⇧H/…; the sidebar
toggles moved to ⌘⌥B / ⌘⌥⇧B). Each landed with a scenario driven by real
input; `smoke/live-sweep.sh` reruns all of them (~8 min, 21 scenarios).

Since the merge, on `main`: `ccf8dca` (the demo-vault construct sweep test
read `.clew/history/…/Widgets.md/` — a DIRECTORY — as a note; it now reads
notes only), `368bfd7` (**mp-tikz-wasm 0.3.0 pinned** — the `opentype`
bundle, so `font=note` works from a fresh install; proven by staging from
the pinned archive with the master bypassed and the fonts scenario over
that tree), `c699565` (0.11.0).

**0.11.1 artefacts in `out/`** — all that is left there besides the unpacked
apps and electron-builder's yml files. On the owner's word (2026-09-29)
everything older went to the Trash, recoverable until it is emptied: the
0.11.0 files in `~/.Trash/Clew 0.11.0 artefacts/` (1.3 GB; rebuildable from
`c699565`), and the 0.10.0 and 0.9.0 artefacts, the unpacked 0.11.0
universal app and `out/old/` (0.7.0 and 0.8.0) in `~/.Trash/Clew older
builds/` (3.8 GB):

| artefact | size | state |
| --- | --- | --- |
| `Clew-0.11.1-arm64.dmg` / `Clew-0.11.1-x64.dmg` | 222 / 226 MB | signed · notarized · stapled; `spctl` accepts image AND the app inside (`Notarized Developer ID`); `arm64` / `x86_64`; `flags=0x10000(runtime)`, four entitlements; version 0.11.1; carry `mptikz/bundles/opentype` (pinned 0.3.0) |
| `Clew Setup 0.11.1.exe` | 191 MB | NSIS, unsigned, untested at runtime |
| `Clew-0.11.1.AppImage` / `clew_0.11.1_amd64.deb` | 224 / 177 MB | ELF x86-64 / well-formed; untested at runtime |

No universal image this time (owner's decision). **The boot test PASSED**
(`smoke/boot-test.sh` on `out/mac-arm64/…/Clew`, 17:00 on 2026-09-29):
all 13 figures `mpw-ok` with paths, `pending=0`, `cache-probe
first=engine second=cache`, and every live-edit line — invisibly. Its
first attempt ABORTED as designed (load still 11.6 after 20 minutes:
Spotlight, CrashPlan and Kaspersky working through the new gigabyte in
`out/`); the second waited 4 minutes for load 5.4 and ran. The 0.11.0
boot test was never finished; 0.11.1 supersedes it.

**Clew-docs**: `main` at `eff4e7f` merges the manual's 13 live-edit commits;
`make check-links` clean. The owner's uncommitted `HANDOVER.md`, `Makefile`,
`README.md` there are untouched. **It still has no remote** — creating a
public repository is an action the assistant's permissions refuse:
`cd ../Clew-docs && gh repo create jmckalex/Clew-docs --public --source=.
--remote=origin --push`. The docs still say 0.9.0 in their Makefile/README/
landing page, deliberately: nothing is published until DNS moves (§5 of the
0.10.0 handover, `git show ed2aabc:HANDOVER.md`).

**Clew-iOS** is synced through this repo's `e88aff6` as of 2026-09-29: its
vendor/ is `ccf8dca` (live edit included) plus the 0.3.0 pin, which it
mirrored as `faa3023`, and nothing in the synced dirs has changed here since.
`faa3023` IS pushed (its `origin/main`) — a push there is a TestFlight
release; per the coordinating session in `~/Source/Clew`, the Xcode Cloud
build succeeded and waits for the owner to add it to the Internal group.

## 1. STILL OPEN

- **The owner's QA pass of live edit** (not automatable): typing at speed in
  a long note; ⌘Z across a conceal/reveal; ⌘F over concealed text (matches
  inside widgets do not highlight — the selection moving reveals them);
  copy/paste of concealed ranges; IME in a concealed word and in a table
  cell; zoom; a live pane beside a reading pane; drag-drop an image; the
  properties panel and the properties widget on one note; fast typing in a
  wide table's cell.
- **Decisions in force, none yet exercised by the owner** (`docs/dev/
  live-edit.md` §12): plain click follows a concealed link (⌥-click edits,
  ⌘-click new tab); remote images not loaded in the editor; ⌘⇧E; new tabs
  still open in source; `|live` office embeds as thumbnails; MathJax macros
  shared across notes; tables in place; reading mode's slim mode bar; the
  `//` trigger; link previews on plain hover (500 ms); the preview pane
  below its block / above an inline formula, 150/400/700 ms; `@` forms
  written by the insert commands, no sigil setting; ref completion is this
  note only; `??` in red for unresolved/unnumbered refs; the References
  panel always present; citation search by substring; PDF annotations as
  one blockquote per entry, no colours; sidenotes `auto` = ≥ 960 px pane
  with ≥ 220 px margin.
- **PDF annotations can be lost — pre-existing.** The viewer autosaves 2.5 s
  after a change and a document that unloads drops the pending save, so a
  highlight made just before a tab switch is gone (measured 3 of 4 kept).
  The extraction command flushes first. Fix is the owner's choice: flush on
  `visibilitychange`/`pagehide`, keep PDF frames alive like the office
  dock, or shorten the debounce.
- **Engine bug, for the jmarkdown master.** A reference to an `@label`
  inside a footnote prints `??`: the post-processor's footnote branch looks
  for `[id^="footnote-"]` but endnotes carry `id="fn-…"`. Clew mirrors the
  behaviour and its crossref fixture asserts it, so an upstream fix shows
  up as that assertion failing. Also: under `Headings: numeric` the
  generated Endnotes `<h1>` is numbered, so with `@endnotes` mid-note every
  later heading is one higher in the export than Clew shows (recorded in
  §5.13, not mirrored).
- **Two offers awaiting a yes/no:** parallelise `live-sweep.sh` (per-run
  `CLEW_USER_DATA`; ~8 → ~3 min) and/or drop `live-perf` from the default
  sweep; a distinct theme colour for `jmd-function` in highlighted fences.
- **Older than the branch, not investigated:** `figures-edit-scenario`
  phase 3 fails identically at `c6f3169` — an edited ```tikz in READING
  mode keeps its old picture. Re-run at `ed2aabc` vs `main` on a quiet
  machine before believing either explanation (machine or code).
- **Follow-ons deliberately left out** (§12): table drag handles, multi-cell
  selection and grid paste, Meta Bind widgets in prose, frame heights
  persisted across reopenings, block drag handles, a focus mode, a
  per-note MathJax (macro isolation), multi-file cross-reference numbering
  for `jmarkdownProject` vaults (algorithm recorded in §5.13), and the
  **frame bridge** — a capability API letting an embedded document reach the
  host (find both ways, copy across the boundary, editor writes through the
  pool), the owner's stated preference over sanitised native embeds.
- Main's older items, unchanged: the GoDaddy DNS change; the `[text]` link
  face and the `\[ \begin{align*} … \]` manual line (offers); the graphicx
  driver line for mp-tikz-wasm; the three dev docs (`docs/dev/live-edit.md`
  is the pattern); win/linux artefacts untested at runtime; the Windows
  installer unsigned.

## 2. What the live-edit build taught (measured; the long form is in `docs/dev/live-edit.md`'s "As built" notes)

- CodeMirror DOES call `WidgetType.updateDOM` when a block widget's text
  changes (the cell editor is the same element across typing — the whole
  in-place table design rests on it); it does NOT let ArrowUp/Down enter a
  block widget — `live/keys.js` stops the cursor at a block's edge.
- `cm-widgetBuffer` images lift a concealed heading's line by 1 px unless
  put on the baseline; heading SIZE lives on the line, not the span.
- The note editor's theme rules are descendant selectors and reach a nested
  editor (a one-line table cell stood 40vh tall).
- A frame element's `color-scheme` must match its document's or Chromium
  paints an opaque backdrop; 16 block documents cost ~22 MB each over
  reading mode; the drawn margin can hold more small frames than the cap,
  so eviction ranks undrawn, then off-screen, and never creates past it.
- `render-service` keyed non-dependent fragments by text alone, so after
  `reconfigure()` the same text kept its hash and a morph was skipped;
  every fragment key now carries a configuration generation.
- Per keystroke, live edit adds ~0.4 ms on a 12 KB note and ~2.2 ms on a
  207 KB one (medians 3.5 / 14.4 → 3.1 / 14.7 ms after the night's work).
- `\|` inside a table cell, `Term:: definition`, `/*italics*/`, headerless
  tables, a footnote label's number: in every case the rule is **the editor
  follows the engine** (owner, 2026-09-27) — read the vendored source,
  assert parity, never the plan's contract.
- `figures-edit` phase 3 is the one sweep failure and predates the branch.

## 3. Release 0.11.1 — how it was cut

`npm version 0.11.1 --no-git-tag-version` + commit; the engine and EmbedPDF
re-syncs changed nothing; then, sequentially (they share `dist/` and the
staging dirs), with `MPTIKZ_SRC=/nonexistent` so the PINNED mp-tikz-wasm
archive is staged rather than the owner's master build:

    node scripts/package.js --dmg --sign --notarize          # arm64, 17 min
    node scripts/package.js --dmg --sign --notarize --x64    # 17 min
    node scripts/package.js --win                            # < 1 min
    node scripts/package.js --linux                          # < 1 min
    smoke/boot-test.sh out/mac-arm64/Clew.app/Contents/MacOS/Clew

35 minutes for the four. The x64 image comes out as `Clew-<v>.dmg` (its app
in `out/mac/`); it was renamed `Clew-0.11.1-x64.dmg` like 0.11.0's — a
rename does not touch a stapled ticket. `--universal` exists (~28 min) but
was not wanted this time. Verified: `stapler validate` + `spctl -a -t open`
on each image; `spctl -a -t exec`, `codesign -dv`, the entitlements,
`lipo -archs`, the version and the opentype bundle on each app.

## 4. Owner's own actions

- Empty the two Trash folders when sure (§0). 0.11.1 is what to publish when
  DNS moves.
- Live in live edit for a week (`newTabMode: 'live'`), run the QA list, and
  decide the §12 defaults — the next bug reports come from there.
- Create the Clew-docs remote and push; DNS; then `make sync` etc. per the
  0.10.0 handover's §5 order (`dns-check` → `nginx-install` → `sync` → `tls`).
- Answer the offers in §1; file the engine bug upstream (one line).

## 5. Small residue

- `fence-highlight-scenario.js`'s header expects `jmd-string > 0`; it is 0
  at `ed2aabc` too (stale expectation).
- A ⌘-click on the GAP between two paragraphs in reading mode does nothing
  (the client wants a stamped ancestor); pre-existing.
- An embedding canvas card is keyed by the file epoch now (re-renders after
  any file change) — an improvement, noted as a behaviour change.
- Source mode's overlay does not fully follow `normalSyntax` (the grammar
  does).
- `editor-hotkeys-scenario`'s reflow widths follow the REAL fill column
  unless `CLEW_USER_DATA` is set ([79,40] on this machine — not a
  regression).
- The owner works in this tree concurrently; `zeta-assets/`,
  `mptikz-assets/`, `build-engine/` are deliberate and gitignored. Live
  testing flips demo widgets — reset `status:`/`done:`/`^motto` baselines
  and the foldable embed in `Guide/Links and Embeds.md` before committing
  demo files.

## 6. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths. Across ~50 commits by two
  sessions this time, every one did; keep it that way.
- **A build order is the owner's to approve.** A question plus a statement
  of intent ("what should we build? I'd like to launch something") is not
  an instruction to launch; write the brief, show it, wait for the yes. An
  idle session cannot be woken by a message — only its owner's prompt or
  its own task notifications do — so a queued brief runs when they next
  type, which is why the sign-off matters.
- **Reviewing another session's commits:** extract each commit with
  `git archive <hash> | tar -x` into scratch, symlink `node_modules`, run
  the tests and the build THERE (the worktree's dirty state and its
  node_modules answer for nothing); read the scenario's own `[smoke:info]`
  lines out of its transcript rather than its summary; grep its transcript
  for `git push`, `git add -A`, `vendor/` and main-tree paths. Two real
  corrections came out of that this time (a missing restale trigger, a
  `<br>` drawn as text); every deviation it took by itself was better than
  the plan.
- **A SIGNED build must be boot-tested, not just verified.** `codesign
  --verify` proves the signature and says nothing about whether the app
  runs. The hardened runtime is exactly what breaks this one — the forked
  render worker needs `allow-dyld-environment-variables`, the wasm TeX
  needs `allow-jit` + `allow-unsigned-executable-memory`, the unpacked
  engine tree needs `disable-library-validation`. Run the PACKAGED binary
  under `CLEW_SMOKE` with an isolated `CLEW_USER_DATA` and assert a latex
  figure reaches `mpw-ok`.
- **A wait-for-quiet loop must ABORT on its timeout, never proceed** — the
  one that "gave up waiting" launched at load 14.71. `smoke/boot-test.sh`
  is the recipe; do not hand-roll another.
- **…but do not run the figures check on a busy machine.** The mp-tikz-wasm
  watchdog fires after 20 s with no progress from a worker; straight after
  a packaging round (load ~25 measured this time) it reports `mpw-error: …
  made no progress` on figures that are fine. A figures timeout is a claim
  about the machine until a quiet re-run agrees with it.
- **`spctl -a -t exec` on a signed-but-unnotarized app says `rejected —
  source=Unnotarized Developer ID`, and that is fine** (no quarantine flag on
  a locally built bundle). After notarizing, image and app both report
  `accepted — source=Notarized Developer ID`.
- **`--notarize` requires `--dmg`**; `scripts/package.js` blanks the Apple
  env for its child unless asked. Budget ~12 min of signing per
  architecture, double for universal, plus Apple's queue (~5 min).
- **Files on a server are not a site being served**; `make dns-check`
  answers the question that matters.
- **A vault is whatever folder the user points at**, and some contain
  libraries: every walk consults `vault-excludes.js`, and anything that
  enumerates a vault lives inside a bound (`WATCH_BUDGET`, explorer
  windowing, the frame cap). A resource cap must not become a CORRECTNESS
  cap: bound the bulk operation, not the session.
- **Check the baseline before believing a timing.**
- **Smoke runs are invisible** (no window, no focus, no Dock icon; focus is
  emulated over CDP) — `CLEW_SMOKE_VISIBLE=1` to watch one. A scenario
  that needs the OS's own focus or a visible window must say so; none did
  (2026-09-29, checked over the live sweep and the shell, toolbar-menu and
  canvas runs).
- **A smoke run's ENV is the whole safety net** — build the whole command,
  env and all, in ONE go; always pass `CLEW_SMOKE_VAULT`; `CLEW_USER_DATA`
  isolates a run and is where a scenario's GLOBAL settings are staged;
  `git status` the demo and study vaults after every run.
- **A scenario must not assume a fresh workspace** (tab layout, mode, the
  shell panel's open flag are per vault in `.clew/workspace.json`); set the
  state you need, then drive. **Fixed screen points drift** — reading
  mode's 36 px mode bar moved a ⌘-click into a paragraph gap; click on
  text, not on luck.
- **A scenario's own listener is registered too late for boot events** —
  assert on the DOM.
- **A path already open is FOCUSED, not duplicated**; over a big vault wait
  for `vaultStore.vault` AND a beat for the workspace to restore.
- **Observations must wait on conditions, not on a clock.** Input starts
  only after the scenario RETURNS. **The frame script runs against whatever
  preview is open when the scenario ENDS** — or, with
  `CLEW_SMOKE_FRAME_MATCH=<substring>`, in every `clew-preview://` frame
  whose URL contains it (block frames: `__clew_block__`).
- **A typeset figure no longer holds its source in the DOM** — read
  `<vault>/.clew/cache/html/<hash>.html`; `data-preamble` survives on the
  element. **The preview document has its OWN palette** (`--preview-bg`, …).
- After a smoke run over a reusable fixture, `rm -rf` its `.clew/`; a
  scenario that TYPES rewrites its fixture — regenerate before every run.
  Long runs go `run_in_background` to a file, never in a `( … ) &`
  subshell. **A smoke timeout must wrap Electron itself** (`perl -e 'alarm
  shift; exec @ARGV' N …/Electron .`); `ps -axE | grep <vault>` finds a
  stray by its env. Reusable scenarios live in `smoke/`; the README table
  carries each one's assertions; `smoke/live-sweep.sh` runs the live set.
- **A native menu is invisible to `capturePage`** — `CLEW_SMOKE_MENU=1`.
- **A face cannot un-parse a node** — fix the GRAMMAR. **In a lezer inline
  parser, `before:` is the whole design** (`Escape` is first and eats `\(`;
  `Link` builds a node whether or not a definition exists).
- **Block replacements and anything spanning a line break come from a
  StateField; a ViewPlugin's decorations stay on one line** — the rule
  every live-edit provider is built on, and the reason multi-paragraph
  footnotes were left as source until the field took them.
- **The owner's bug reports have been consistently right** — and so are
  their rollbacks and their rules ("the editor follows the engine").
- **Write assertions that can fail — and eyeball the artefact anyway.**
  Computed style, not markup, when the bug is layout. **A measured symptom
  is not a cause** — vary the construct. **Prefer measuring to guessing.**
- A feature change is not finished until the MANUAL in `../Clew-docs`
  matches it and the demo vault EXERCISES it — nothing in this repo's git
  status reminds you.
- `npm run dev` / `npm run package` re-sync the engine AND EmbedPDF from
  their masters (a dirty master is vendored AS IS — `git diff --stat
  vendor/` after the sync says what would ship); packaging stages
  mp-tikz-wasm, preferring the master unless `MPTIKZ_SRC` points elsewhere.
  Run the syncs + `git status` BEFORE tagging.
- Screenshot-kit lore: splitting re-parents the editor and RESETS its
  scroll; CDP keystrokes need the caret's viewport coords for the focusing
  click; `CLEW_SMOKE_LOG=1` prefixes scenario `console.log` with
  `[smoke:info]`; the harness input queue takes `click`, `tripleClick`,
  `text`, `combo`, `wait`, `wheel` and `move` (with modifiers).
