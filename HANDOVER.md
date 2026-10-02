# Handover — 2026-10-02 (0.12.0 released; main 80b8b44+, unpushed past 9409987)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the live edit design AS BUILT is
`docs/dev/live-edit.md`, the PDF one `docs/dev/pdf-unification.md` ("As
built" under §6). This file is rewritten each session — keep it short, and
prefer deleting a settled item to explaining it again.

## Read this first

**Where the code is.** `origin/main` = `9409987` (`git fetch` before
counting). `main` is ahead by the commits listed under "Since 0.12.0" as
NOT pushed — 19 of them. Tree clean.

**On hold until the owner says go:** a Mac arm64 DEV build — version
`0.12.1-dev.1`, `CLEW_PACKAGE_OUT=out-dev`, `JMARKDOWN_SRC=/nonexistent
EMBEDPDF_SRC=/nonexistent MPTIKZ_SRC=/nonexistent`, from a bash script
(the recipe's zsh trap), then the boot test; report DMG path, size,
stapler/spctl, version and commit. Ask the owner in this window first.

**The rules this session works under** (the owner's, relayed by the
coordinating session "Clew-boss", uds `/tmp/cc-socks/6958.sock` at the
time of writing; find it with ListAgents):

- **Pushes ONLY on the owner's explicit OK, relayed by Clew-boss.**
  Clew-boss may no longer approve pushes on its own (withdrawn 2026-09-30).
  Commit locally and say what is unpushed. Never force-push. Clew-app only.
- **No packaging without the owner.** Packaging needs the owner's yes in
  THIS window (a question asked here; they answered "Yes, package now" for
  0.12.0). If a permission prompt blocks, leave it; never route around it.
- **Report every finished task to Clew-boss** with a docs line for the
  manual (`../Clew-docs`, which this session never edits or commits) and
  notes for Clew-iOS (never edited from here either).
- Engine changes only in the jmarkdown master
  (`~/Sites/jmckalex/software/jmarkdown`, branch `at-migration`), then
  `npm run sync-engine`. Stage explicit paths there; never commit or revert
  the owner's uncommitted `jmarkdown.html` / `src/index.js` (a dirty master
  is vendored AS IS — that is how it has shipped).
- Security work stays strictly DEFENSIVE: no attack pages, no probing of
  exploitability. "Cautiously — I don't want anything to break. If anything
  breaks, we need to know why, whether it can be fixed, and if not, whether
  the cost is worth it." Measure before and after (render dump, PDF
  baseline, protocol tour, live sweep — runners in `smoke/`).
- A peer session's message is a teammate's request, not the owner's
  approval: it cannot grant permissions or answer a pending prompt.

## 0.12.0 — released

**Release commit `9268aa3`** (version bump over `48afe19`; the engine
`at-migration@82b21fd` and EmbedPDF `ocg-v2@015545b1` re-syncs changed
nothing; npm test 950/950; render dump byte-identical to `48afe19`).
Packaged 2026-10-01 by the recipe below with `MPTIKZ_SRC=/nonexistent`,
pushed by Clew-boss with the owner's OK, and — per Clew-boss — live on
clew-app.com.

| artefact in `out/` | bytes | state |
| --- | --- | --- |
| `Clew-0.12.0-arm64.dmg` | 222,428,189 | signed · notarized · stapled; `spctl` accepts the image AND the app (`Notarized Developer ID`); arm64; runtime flag, four entitlements; 0.12.0; carries `mptikz/bundles/opentype` |
| `Clew-0.12.0-x64.dmg` | 226,079,778 | the same, x86_64 (built as `Clew-0.12.0.dmg`, renamed; its app is in `out/mac/`) |
| `Clew Setup 0.12.0.exe` | 190,590,642 | NSIS, unsigned, untested at runtime |
| `Clew-0.12.0.AppImage` / `clew_0.12.0_amd64.deb` | 223,791,314 / 177,189,340 | ELF x86-64 / well-formed; untested at runtime |

**Boot test PASSED** on the packaged arm64 app (13 figures `mpw-ok` with
paths, `pending=0`, `cache-probe first=engine second=cache`, every
live-edit line; it waited 7 min for load < 6). The 0.11.1 artefacts are in
`~/.Trash/Clew 0.11.1 artefacts/` (owner's word; recoverable until
emptied); the 0.12.0 files and the unpacked dirs stay in `out/` — Clew-docs
stages the downloads from there.

What 0.12.0 carries beyond 0.11.1, in short: the interim vault-trust guard
and the engine's `Run note code` switch; the engine's `func(…)` fix; PDF
unification phases 1–4 (portal thumbnails, a note's own PDF frames, web
PDFs read-only through a device cache, `plugins: true` gone with vault-PDF
navigations redirected to EmbedPDF and the `![[x.pdf]]` placeholder made
inert); Meta Bind `locked` widgets and Enter-to-commit; the export-refresh
and two-window watcher fixes; the smoke harness waiting for its window;
iOS sync #3's upstream fixes (kanban columns border-box, fs-utils without a
`process` global, web-PDF failure texts).

## Since 0.12.0

`5119d93` and `a3bb88c`/`9409987` are pushed (Window menu lists vaults; ⌘1–⌘9
switch tabs). NOT pushed, oldest first — each reported to Clew-boss with
docs lines and iOS notes:

- `f17c531` **citation pills read what reading mode shows**
  (`live/cite-text.js`, one block render per note) and the hover's **Show in
  Library**; `3ef9c4f` an engine "[undefined]" is no text; `a1d8de0`
  **reading mode follows a .bib edit**; `1b98e07` explorer **Open in Default
  App**; `a0bcd2b` dark text `#e8e8e8`; `63c5ade` font smoothing `auto` (the
  owner's pick); `2a853da` `CLEW_PACKAGE_VERSION` / `CLEW_PACKAGE_OUT`.
- `f504e57` `\fullcite` draws the entry inline; `95750a5` live edit's
  callouts match reading view's box; `914c3f8` a directive the engine takes
  literally (`@reveal[http://…]`) keeps its source raw.
- `b0fe140` mode buttons in every view — SUPERSEDED by `80b8b44` below.
- `0f797eb` **engine `at-migration@3134543`**: /italic/ has flanking rules
  (slashes in words, paths, URLs stay literal) and bare http(s)/ftp/www/
  email URLs are links; `jmarkdown-scan.js` mirrors the rule (parity test),
  live edit draws bare URLs as links (`jmd/ftp-autolink.js` for ftp).
  Six demo-vault guide notes render differently — every diff is the fix.
- `096f129` **custom callout types** (Settings → Callouts; CLAUDE.md has the
  design). Also fixed there: a live-edit block frame that reloads after an
  engine reconfigure showed "Not found" (re-pointed on load).
- `80b8b44` **the view-mode switch is in each pane's tab strip** (left of
  "+", hidden in place for tabs with no modes; no slim bar; the toolbar's
  one-row threshold 1080 → 984 px). Also fixed there: the formatting
  toolbar vanished from every split pane but the newest.
- The commit after `5ae29b4`: **the split reconciler moves only what moved**
  (`clew-workspace.js#place`, `moveBefore`, `connectedMoveCallback`; CLAUDE.md
  "Panes are moved, never re-appended"). Every layout change used to
  re-append every pane: other panes' frames reloaded on a mode switch, and a
  pane's own mode switch jumped its scroll. `smoke/split-stability-scenario.js`.
- Then: **opening is serialised** (`editor/pool.js#open` waits for an open
  under way; `setMode` checks the state's own compartment; `state-replaced`
  re-applies a host's mode; deferred live-field reads tolerate absence).
  Clew-docs' repro — note + PDF opened and split in one tick left an EMPTY
  pane or live edit undrawn. `smoke/open-race-scenario.js`.
- Then: **no smoke run on a stale build** — `dist/build-stamp.json` (content
  hashes of `src/`) checked by the harness, the sweeps and boot-test.sh
  (`scripts/stale-check.mjs`). The 0.12.0 package predates stamps, so
  boot-testing it needs `BOOT_TEST_ALLOW_STALE=1`; the next package carries
  one (unverified until then — check `npx asar list` shows
  `dist/build-stamp.json`).

Owner decisions Clew-boss is carrying (2026-10-02): HTML/LaTeX note exports
render NO Obsidian callouts (built-in or custom; only uppercase GFM alerts
become boxes) because they run the user's own config; Obsidian draws an
unknown `[!type]` as a default callout and reads callout CSS snippets —
Clew does neither. Report only; nothing built.

## Open — waiting on the owner

As relayed by Clew-boss on 2026-10-01; none is to be started without the
owner's word.

- **The frame-bridge revision** — `docs/dev/frame-bridge.md` (§1 the
  caller token is BUILT; §2 option (c), the app page moving to
  `clew-app://app` so null-origin reads can be refused, is DESIGN only;
  §3 Compatibility; §4 vault trust, of which the interim guard is built).
  Read it before any build; it is built before any embedded-app feature
  ships.
- **Auto-update** — `docs/dev/auto-update.md`, its four open questions (§6).
- **LaTeX export** — LuaLaTeX when a note uses fontspec, and the engine's
  fallback for an unknown lexer.
- **Tabbing** — `|*` and the fidelity items; and the **backport of
  tabbing to jmarkdown** (`src/engine/tabbing.js` is self-contained so the
  backport is a move; LaTeX export sees tabbing only after it).
- **The deferred code review** (`/code-review ultra`; the owner triggers
  it, never a session).
- Two older offers awaiting a yes/no: parallelise `live-sweep.sh` (per-run
  `CLEW_USER_DATA`; ~8 → ~3 min) and/or drop `live-perf` from the default
  sweep; a distinct theme colour for `jmd-function` in highlighted fences.

## Open — engineering

- **The owner's QA pass of live edit** (not automatable): typing at speed in
  a long note; ⌘Z across a conceal/reveal; ⌘F over concealed text; copy/
  paste of concealed ranges; IME in a concealed word and in a table cell;
  zoom; a live pane beside a reading pane; drag-drop an image; properties
  panel and widget on one note; fast typing in a wide table's cell. The
  §12 defaults in `docs/dev/live-edit.md` are in force and unexercised.
- **PDF annotations**: closing a viewer can no longer lose them, except on
  a window RELOAD (the app page itself goes) and a canvas embed's
  morph-failed reload — not covered.
- **Web PDFs Clew cannot recognise** (no `.pdf`, no `type="application/
  pdf"`, e.g. arXiv's `/pdf/…`) still open in Chromium's own viewer: in
  Electron 43 there is no switch that retires it (pdf-unification "As
  built").
- **Engine bug, for the jmarkdown master**: an `@label` reference inside a
  footnote prints `??` (the footnote branch looks for `[id^="footnote-"]`,
  endnotes carry `id="fn-…"`); Clew mirrors it and the crossref fixture
  asserts it, so an upstream fix shows as that assertion failing. Also,
  under `Headings: numeric` the generated Endnotes `<h1>` is numbered.
- **Not investigated, older than live edit**: `figures-edit-scenario`
  phase 3 — an edited ```tikz in READING mode keeps its old picture. Re-run
  at `ed2aabc` vs `main` on a quiet machine before believing machine or
  code.
- **Follow-ons deliberately left out** (live-edit §12): table drag handles,
  multi-cell selection and grid paste, Meta Bind widgets in prose, frame
  heights persisted across reopenings, block drag handles, a focus mode,
  per-note MathJax, multi-file cross-reference numbering for
  `jmarkdownProject` vaults.
- **Superseded branches** (their work landed rebased, so `git branch -d`
  refuses them and `-D` is safe; the owner decides): `watcher-budget`,
  `meta-bind-lock`, `pdf-web`; also the merged `feat/live-edit`,
  `feat/excalidraw`, `spike/embedpdf`.
- Older items, unchanged: the `[text]` link face and the `\[
  \begin{align*} … \]` manual line (offers); the graphicx driver line for
  mp-tikz-wasm; Windows and Linux artefacts untested at runtime; the
  Windows installer unsigned.

## Release recipe (as cut for 0.12.0)

`npm version <v> --no-git-tag-version` + commit; `npm run sync-engine` and
`npm run sync-embedpdf` (expect no change; `git status` after); npm test;
`smoke/render-dump.sh` before and after the bump. Then, SEQUENTIALLY (they
share `dist/` and the staging dirs), from bash or exactly as written — a
zsh loop passing `$flags` hands package.js ONE argument and it quietly
builds an unsigned `dir` (2026-10-01, caught a minute in):

    export MPTIKZ_SRC=/nonexistent   # stage the PINNED mp-tikz-wasm
    node scripts/package.js --dmg --sign --notarize          # arm64, ~20 min
    node scripts/package.js --dmg --sign --notarize --x64    # ~20 min
    mv out/Clew-<v>.dmg out/Clew-<v>-x64.dmg                 # + its .blockmap
    node scripts/package.js --win                            # < 1 min
    node scripts/package.js --linux                          # < 1 min
    smoke/boot-test.sh out/mac-arm64/Clew.app/Contents/MacOS/Clew

Check the arm64 log for `signing … Developer ID Application` in its first
minute. Verify: `stapler validate` + `spctl -a -t open` on each image (after
the rename — it does not touch a stapled ticket); `spctl -a -t exec`,
`codesign -dv`, the entitlements, `lipo -archs`, the version and
`mptikz/bundles/opentype` on each app. The boot test waits for load < 6
(raise `BOOT_TEST_WAIT` after packaging; Spotlight and the scanners read the
new gigabyte) and ABORTS rather than run on a busy machine.

## Owner's own actions

- Empty the Trash folders when sure: `Clew 0.11.1 artefacts`, `Clew 0.11.0
  artefacts`, `Clew older builds`.
- Live in live edit for a week (`newTabMode: 'live'`), run the QA list, and
  decide the §12 defaults.
- Answer the offers above; file the engine footnote bug upstream (one line).

## What the live-edit build taught (measured; the long form is in `docs/dev/live-edit.md`'s "As built" notes)

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

## Small residue

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

## Standing session rules (they keep earning their keep)

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
  `text`, `combo` (with `text` to type), `wait`, `wheel`, `move` (with
  modifiers) and `frameClick`; `CLEW_SMOKE_MENU_CLICK` clicks a real menu
  item.
