# Handover — 2026-09-26, `feat/live-edit` (live edit Phase 0 DONE — foundations, nothing visible; Phase 1 next)

Session-rollover state for the live-edit BRANCH, in the worktree
`../Clew-app-live-edit`. Durable architecture lives in **CLAUDE.md**; the
design is `docs/dev/live-edit-plan.md` (kept true to what was built — each
phase's deviations are recorded in it, marked "As built"); the brief for a
build session is `docs/dev/live-edit-kickoff.md`. What `main` was doing when
this branch left it (0.10.0, the website, DNS) is in `git show
ed2aabc:HANDOVER.md` and is summarised in §4 — this branch changed none of it.

## 0. Where things stand

721 tests green (644 at the branch point), `node scripts/build.js` passes,
every smoke scenario named below passes. Demo and study vaults untouched.

**Phase 0 of plan §12 is complete** — six commits after the docs commit:

| commit | what |
| --- | --- |
| `87cc541` | the scanner records structured `constructs` beside its captures; `jmd/scan-cache.js` — one memoised scan shared by overlay and folding |
| `0bc4d63` | `jmd/subsup-parser.js`: `_c` `_{…}` `^c` `^{…}` and `^block-id` in the lezer tree as the engine reads them; the markdown config is now `jmd/markdown-config.js#noteMarkdown`, installed in `editor.js#markdownCompartment` |
| `51f7858` | `state/vault-settings-store.js`; a `normalSyntax` flip reconfigures open editors in place |
| `2cc7cb6` | `editor/live/model.js` (the one construct list), `live/reveal.js` (the rule, a pure range test), `live/rich-fences.js` |
| `2e2cbab` | `__clew_block__` POST/GET (full engine documents), `wrapPreviewDocument`, `fragment-deps.js`, the client's block mode + size reporting, `CLEW_SMOKE_FRAME_MATCH` |

The one change a user could see: in the SOURCE pane `_x_` no longer paints
italic and `^x^` no longer as GFM superscript — correctly, the engine
renders neither. No manual page describes the old faces, so the manual
needs nothing yet; it becomes due at Phase 1 (plan §11).

## 1. STILL OPEN

- **Phase 1 — the mode** (plan §3.3 in full, §12): `tab.view.mode: 'live'`
  + `editMode`, `editorPool.setMode` with an empty live bundle, the
  commands (⌘⇧E), menu items, settings keys + rows, and
  `live-mode-persistence-scenario.js`. Start by reading §3.3's table
  against the files it names — it was written at `ed2aabc` and those files
  have not moved since.
- The engine change (plan Appendix D, `currentFile`) — Phase 5 only.
  `render-service` already PASSES `currentFile`; the engine ignores it.
- Everything in §4 (main's own open items) is unchanged.

## 2. What Phase 0 taught (measured)

- **`documentElement.scrollHeight` never drops below the frame's
  viewport.** The plan had the block client report it; an 84 px mermaid
  block in a 240 px frame reported 236, so frames could only ever grow. The
  client reports the BODY's box; `block-endpoint-scenario` pins
  `size == content` (79 == 79) in a frame first given 240.
- **A block document is a full engine build**, not fragment HTML in a
  copied head: the head then comes from `clew-template.html` exactly as a
  note's does, and cannot drift. The client's `render` morph already takes
  a whole document.
- **A block frame's mermaid does not run until the host answers `ready`
  with a `theme`** — the client starts mermaid from the theme message. The
  frame layer (Phase 5) must post it; a scenario standing in for a host
  must too (the first run reported `mermaid-svg=false` for exactly this).
- **An unknown callout type is a plain quote**, not `note` as the plan
  said: the engine's `calloutBlock` returns nothing and marked renders a
  blockquote.
- **Plugins declare no fence names** (the Charts manifest has only
  `surfaces`), so `liveModel` takes `richFences` as config; how a plugin
  supplies it is Phase 5's question.
- Model cost (node, cold): 6.7 ms for the demo vault's largest note
  including its parse; on 207 KB the model's own work is 4.2 ms over a
  23.6 ms parse and a 12.8 ms scan the editor has already paid for.
- The engine's block-id rule is end of PARAGRAPH (`$` without `m`), not end
  of line; the grammar mirrors it (end of the inline section).
- Scanner byte-identity was proven by diffing captures/regions/folds/
  injections over all 67 notes in demo-vault, study-vault and smoke/
  before and after — the snapshot script is trivial to recreate (walk,
  `scanJmarkdown`, `JSON.stringify` minus `constructs`, `cmp`).

## 3. Running things in THIS worktree

- `npm install` here did NOT fetch Electron's binary (`node_modules/
  electron/dist` absent; the harness then exits 0 with no output at all).
  `node node_modules/electron/install.js` fixes it.
- The smoke command that works, all env in one go (fixtures in the
  session scratchpad, never a real vault):

  ```sh
  CLEW_SMOKE_LOG=1 CLEW_USER_DATA=$S/ud CLEW_SMOKE=$S/out.png \
    CLEW_SMOKE_SCRIPT=smoke/math-highlight-scenario.js CLEW_SMOKE_VAULT=$S/math-vault \
    perl -e 'alarm shift; exec @ARGV' 120 \
    node_modules/electron/dist/Electron.app/Contents/MacOS/Electron . > $S/out.log 2>&1
  ```

- Scenarios re-run clean at the end of Phase 0: `math-highlight`,
  `footnote-highlight`, `fence-highlight`, `editor-hotkeys`,
  `reading-scroll`, `embed-refresh`, plus the two new ones
  (`normal-syntax`, `block-endpoint` + frame with
  `CLEW_SMOKE_FRAME_MATCH=__clew_block__`). `reading-scroll` wants a
  `Long.md` far taller than the window (60 `## Section N` headings).

## 4. Main's own open items (unchanged by this branch; full text in `git show ed2aabc:HANDOVER.md`)

- The GoDaddy DNS change — the website is NOT live until it lands.
- `main` is 20 commits ahead of `origin` and not tracking it; Clew-docs has
  no remote at all. The owner's to sort out; this branch never pushes.
- Offers awaiting a yes/no: the link face on plain `[text]`; a manual line
  on `\[ \begin{align*} … \]` in LaTeX export. `font=note` waits on
  mp-tikz-wasm 0.3.0 (re-pin the manifest). The graphicx driver line for
  mp-tikz-wasm. The three dev docs. Win/linux artefacts untested at
  runtime.

## 5. Owner's own actions / small residue

- The eight defaults in plan §13 still stand; none has been exercised yet
  (they bite from Phase 2 on).
- `fence-highlight-scenario.js`'s header lists `jmd-string` among the
  counts that should be > 0; it is 0 at `ed2aabc` too (the fixture's only
  quotes sit on a fence INFO line, which nothing paints). A stale
  expectation, not a regression — fix the header or the fixture.
- `renderFragment` now treats an embedding canvas card as dependent (keyed
  by the file epoch), so such a card re-renders after any file change
  instead of showing stale content. An improvement, but a behaviour change
  for canvas; the plan records it.

## 6. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths. (Broken repeatedly this
  session. The commits are clean because the tree happened to be, which is
  luck, not method.)
- **A SIGNED build must be boot-tested, not just verified.** `codesign
  --verify` proves the signature and says nothing about whether the app
  runs. The hardened runtime is exactly what breaks this one — the forked
  render worker needs `allow-dyld-environment-variables`, the wasm TeX
  needs `allow-jit` + `allow-unsigned-executable-memory`, the unpacked
  engine tree needs `disable-library-validation`. Run the PACKAGED binary
  under `CLEW_SMOKE` with an isolated `CLEW_USER_DATA` and assert a latex
  figure reaches `mpw-ok`.
- **…but do not run the figures check on a busy machine.** The mp-tikz-wasm
  watchdog fires after 20 s with no progress from a worker, so a run
  straight after a packaging round (load ~20) reports `mpw-error: … made no
  progress for 20000 ms` on figures that are fine. **A figures timeout is a
  claim about the machine until a quiet re-run agrees with it.**
- **`spctl -a -t exec` on a signed-but-unnotarized app says `rejected —
  source=Unnotarized Developer ID`, and that is fine.** A locally BUILT
  bundle carries no quarantine flag. Gatekeeper stops only a copy that was
  TRANSFERRED. After notarizing, both the image and the app inside report
  `accepted — source=Notarized Developer ID`.
- **`--notarize` requires `--dmg`** (the ticket staples to the image), and
  `scripts/package.js` blanks the Apple env for its child unless asked — so
  a plain `--sign` build never silently notarizes. Budget ~12 minutes for
  the signing alone: a `--timestamp` round-trip per nested binary plus
  hashing 13,619 files. A universal build roughly doubles it.
- **Files on a server are not a site being served.** `ls` on the droplet
  and `dig` on the domain answer different questions; `make dns-check`
  answers the one that matters. Checking the artefact instead of the path
  to it is this session's second measurement mistake of the same shape.
- **A vault is whatever folder the user points at**, and some of them
  contain libraries. It can SAY so (`vault-excludes.js`, two lists), and
  every walk must consult it. Anything that walks or watches a vault also
  needs a bound: the descriptor ceiling (~10,240 held, then `fork` fails
  with EBADF) turns "slow" into "cannot render", and the DOM has the same
  shape of problem. Both bounds exist — `WATCH_BUDGET`, explorer
  windowing — and anything new that enumerates a vault should ask which
  bound it lives inside. A resource cap must not become a CORRECTNESS cap:
  bound the bulk operation, not the session.
- **Check the baseline before believing a timing.** A `performance.now()`
  difference against a variable that was never set subtracts zero and
  reports the age of the page.
- **A smoke run's ENV is the whole safety net.** Launching `…/Electron .`
  without the `CLEW_SMOKE*` variables boots the REAL app against the real
  userData. Build the whole command, env and all, in ONE go.
- Always pass `CLEW_SMOKE_VAULT`; `git status` the demo and study vaults
  after every run. `CLEW_USER_DATA` isolates a run entirely — and is where
  a scenario's GLOBAL settings can be staged.
- **A scenario must not assume a fresh workspace.** Tab layout, reading
  mode AND the shell panel's open flag are per vault in
  `.clew/workspace.json`, so a second run over a reused fixture starts
  where the first left off — which reads exactly like a broken feature. Set
  the state you need, then drive.
- **A scenario's own listener is registered too late for boot events.** The
  renderer registers its handlers at module load, before the smoke script
  is injected, so an event like `EV_WATCH_CAPPED` is already handled and
  its notice already in the DOM. Assert on the DOM, not on a listener you
  added afterwards — and do not "fix" the event path on that evidence.
- **A path already open is FOCUSED, not duplicated** — `newTab: true` does
  not override it, and the restored tab keeps the mode the last run left.
  Over a big vault, wait for `vaultStore.vault` AND a beat for the
  workspace to restore before opening anything.
- **Observations must wait on conditions, not on a clock.** Input starts
  only after the scenario RETURNS, and how long the boot before it took is
  not yours to know.
- **The frame script runs against whatever preview is open when the
  scenario ENDS.** Phases that leave another tab focused go FIRST.
- **A typeset figure no longer holds its source in the DOM** — read what
  the engine emitted from `<vault>/.clew/cache/html/<hash>.html`;
  `data-preamble` is the one input that survives on the element.
- **The preview document has its OWN palette** (`--preview-bg`, …), not the
  app's `--clew-*` variables.
- After a smoke run over a reusable fixture, `rm -rf` its `.clew/`; a
  scenario that TYPES also rewrites its fixture — regenerate before every
  run.
- Long smoke runs go `run_in_background` with output to a file — and NOT
  inside a `( … ) &` subshell, which the harness kills on return.
- Reusable scenarios live in `smoke/` — extend it, don't rewrite them in
  scratchpads; the README table carries the per-scenario assertions.
- **A smoke timeout must wrap Electron itself**: `perl -e 'alarm shift;
  exec @ARGV' N …/Electron .` — one around `npx electron .` kills npx and
  ORPHANS Electron. `ps -axE | grep <vault>` finds a stray by its env.
- **A native menu is invisible to `capturePage`** — `CLEW_SMOKE_MENU=1`
  dumps the real `Menu.getApplicationMenu()` and proves the template BUILT.
- **A face cannot un-parse a node.** When the overlay and lang-markdown
  disagree about a construct, fix the GRAMMAR.
- **In a lezer inline parser, `before:` is the whole design.** `Escape` is
  FIRST in the default list and eats `\(`; `Link` builds a
  shortcut-reference node whether or not a definition exists; `InlineCode`
  runs before both.
- **The owner's bug reports have been consistently right** — and so have
  their rollbacks: a hidden tweak that "fixes" a document is a behaviour
  the user cannot see; teach it in the manual instead.
- **Write assertions that can fail — and eyeball the artefact anyway.**
  Computed style, not markup, when the bug is layout.
- **A measured symptom is not a cause.** Vary the CONSTRUCT, not just the
  document, before naming the fault.
- **Prefer measuring to guessing** — and when a disagreement is about what
  a standard does, run the standard.
- A feature change is not finished until the MANUAL in `../Clew-docs`
  matches it — nothing in this repo's git status reminds you. The demo
  vault is the other half: a guide note must EXERCISE what it documents.
- `npm run dev` / `npm run package` re-sync the engine AND the EmbedPDF
  viewer from their masters; packaging also stages mp-tikz-wasm. Run all
  three + `git status` BEFORE tagging.
- Screenshot-kit lore, still true: splitting re-parents the editor and
  RESETS its scroll; CDP keystrokes need the caret's viewport coords for
  the focusing click; `CLEW_SMOKE_LOG=1` prefixes scenario `console.log`
  with `[smoke:info]`.
