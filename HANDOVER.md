# Handover — 2026-09-26, `feat/live-edit` (live edit BUILT — phases 0–7 done, unmerged; the manual on a matching docs branch)

Session-rollover state for the live-edit branch, in the worktree
`../Clew-app-live-edit`. The durable design is `docs/dev/live-edit.md`
(the plan, turned into the design as built; its §12 lists the decisions in
force); the short form is CLAUDE.md's "Live edit" subsection. What `main`
was doing when the branch left it is in `git show ed2aabc:HANDOVER.md`
(summarised in §5) — this branch changed none of it.

## 0. Where things stand

**The feature is complete** against the plan's phases 0–7: 756 tests green
(644 at the branch point), `node scripts/build.js` passes, and every
scenario in §3's sweep passes at `647de91`. Demo and study vaults: only the
intended guide-note changes, committed (runs used scratch copies).

- **Clew-app `feat/live-edit`** — 19 commits over `main` (`bf5c853` …
  `647de91`), not merged, not pushed. `git log --oneline main..feat/live-edit`
  reads as the build history, one phase per commit or two, plus fixes the
  review and the docs turned up.
- **Clew-docs `feat/live-edit`** — in a SECOND worktree,
  `../Clew-docs-live-edit` (the owner's own `../Clew-docs` checkout, with
  its uncommitted HANDOVER/Makefile/README edits, was left on main and
  untouched): `e8065a5` adds the chapter *Live edit and the toolbar*
  (`site/manual/live-edit.html`, two screenshots) and updates the editor,
  reading-mode, settings-and-hotkeys and plugins chapters. `make og-tags`
  run; `make check-links` clean except the four `downloads/` binaries that
  are never staged in a fresh tree.
- The planning session reviewed phase 5 and found one real gap (frames
  never re-rendered after an engine reconfigure); fixed in `e0a5f44`, with
  a second bug it hid (§2).

## 1. STILL OPEN

- **Merging** is the owner's call: `feat/live-edit` → `main` in Clew-app,
  and the docs branch → `main` in Clew-docs, together (the manual must not
  describe an unmerged feature, nor the app ship one the manual does not
  describe). Then `git worktree remove` both worktrees.
- **The owner's QA pass** (not automatable; the plan's list): typing feel at
  speed in a long note; ⌘Z across a conceal/reveal; ⌘F over concealed text
  (matches inside widgets do not highlight — moving the selection reveals
  them); copy/paste of concealed ranges yields source; IME composition in a
  concealed word; zoom levels; a live pane beside a reading pane in sync;
  drag-and-drop of an image into a live note; the properties panel and the
  properties widget editing the same note.
- **Decisions in force** (`docs/dev/live-edit.md` §12) — none has been
  exercised by the owner yet: plain click follows a concealed link (⌥-click
  edits, ⌘-click new tab); remote images not loaded in the editor; ⌘⇧E;
  new tabs still source; `|live` office embeds as thumbnails; MathJax macros
  shared across notes; tables edit as source; reading mode's slim bar.
- **Follow-ons deliberately left out** (same §12): slash commands, in-place
  table cells, multi-line footnote concealment, Meta Bind widgets in prose,
  plugin-declared rich fence names (the Charts plugin's ```chart stays a
  code fence in live edit — plugins declare no fence names; a manifest
  `fences` key is the obvious shape), persisting frame heights across
  reopenings, block drag handles, a focus mode.

## 2. What the build taught (measured)

- `documentElement.scrollHeight` never drops below an iframe's viewport: a
  block frame must report its BODY's height (84px block in a 240px frame
  said 236).
- A block document's MathJax/mermaid config comes free by building it as a
  FULL engine document; a client only starts mermaid once the host answers
  `ready` with a `theme`.
- An iframe element's `color-scheme` must match its document's, or Chromium
  paints an opaque slab behind a transparent page.
- CodeMirror's `cm-widgetBuffer` images (1em, `text-top`) lifted a concealed
  heading 1px; tamed in live-edit.css.
- MathJax's `tex2svg` does not install its stylesheet — without it the
  assistive MathML shows and every formula reads twice.
- CodeMirror's drawn margin can hold more small frames than the cap (17 at
  80px); eviction must include drawn-but-off-screen frames, and "pinned
  within three screens" needs the height map (`lineBlockAt`), not the DOM.
- After `renderService.reconfigure()` the same text kept the same fragment
  hash; every fragment key now carries a configuration generation.
- Every reader of `global.current_file` is Clew's own code, so a fragment's
  note travels in a `<key>.source` sidecar — no engine change, which also
  kept clear of the owner's uncommitted edits in the master's `index.js`.
- A plain `|` inside a wikilink in a GFM table splits the cell (Obsidian too;
  write `[[Note\|alias]]`); the table keymap then reformats around the split.
- Cost per keystroke: live adds ~0.4 ms (12 KB note) and ~2.2 ms (207 KB)
  over source's 3.1 / 12.2 ms; 16 block frames ≈ 22 MB each over reading
  mode. Numbers and methods in `smoke/README.md`.
- An unknown callout type is a plain quote, not `note`; source mode's
  ⌘-click handler outranked live edit's until given `Prec.high`.

## 3. Running things in THIS worktree

- `npm install` here did not fetch Electron's binary; `node
  node_modules/electron/install.js` fixed it.
- The smoke command, all env in one go (fixtures in a scratchpad):

  ```sh
  CLEW_SMOKE_LOG=1 CLEW_USER_DATA=$S/ud CLEW_SMOKE=$S/out.png \
    CLEW_SMOKE_SCRIPT=smoke/live-edit-scenario.js CLEW_SMOKE_VAULT=$S/vault \
    perl -e 'alarm shift; exec @ARGV' 120 \
    node_modules/electron/dist/Electron.app/Contents/MacOS/Electron . > $S/out.log 2>&1
  ```

- The sweep that passed at `647de91`: `live-edit`, `live-lines`,
  `live-tables`, `live-blocks` (+frame, `CLEW_SMOKE_FRAME_MATCH=__clew_block__`),
  `live-toolbar` (`CLEW_SMOKE_MENU=1`), `live-mode-persistence` ×2,
  `normal-syntax`, `block-endpoint` (+frame), `math-highlight`,
  `footnote-highlight`, `fence-highlight`, `editor-hotkeys`,
  `reading-scroll`, `embed-refresh`; `embed-collapse` and `live-perf` ran
  clean earlier in the session. Every recipe is in `smoke/README.md` or the
  scenario's header (`make-live-vault.mjs` builds the live fixtures).
- A scenario can only queue input ONCE (read after it returns): take every
  point in the layout the clicks will meet, and order clicks so no earlier
  one moves a later target.

## 4. Small residue

- `fence-highlight-scenario.js`'s header expects `jmd-string` > 0; it is 0
  at `ed2aabc` too (the fixture's only quotes are on a fence INFO line).
  Stale expectation.
- A ⌘-click (inverse search) on the GAP between two paragraphs in reading
  mode does nothing — the client wants a stamped ancestor. Pre-existing; the
  persistence scenario tripped on it (§3's last bullet).
- An embedding canvas card is now keyed by the file epoch (re-renders after
  any file change) — a behaviour change for canvas, an improvement.
- Source mode's dialect colouring still does not fully follow the vault's
  normalSyntax (the grammar does; the overlay does not).
- `smoke/live-lines-scenario.js`'s header claims `height-stable` in prose
  only; the README row carries the 1px story.

## 5. Main's own open items (unchanged by this branch; full text in `git show ed2aabc:HANDOVER.md`)

- The GoDaddy DNS change — the website is NOT live until it lands.
- `main` is 20 commits ahead of `origin` and not tracking it; Clew-docs has
  no remote at all. The owner's to sort out; this branch never pushed.
- Offers awaiting a yes/no: the link face on plain `[text]`; a manual line
  on `\[ \begin{align*} … \]` in LaTeX export. `font=note` waits on
  mp-tikz-wasm 0.3.0. The graphicx driver line for mp-tikz-wasm. The three
  dev docs (`docs/dev/live-edit.md` is now a fourth). Win/linux artefacts
  untested at runtime.

## 6. Owner's own actions

- Try live edit on a real vault (⌘⇧E; the demo's `Guide/Live Edit`), run
  the QA list in §1, and decide the §12 defaults.
- Merge both branches together, then remove the two worktrees.

## 7. Standing session rules (they keep earning their keep)

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
