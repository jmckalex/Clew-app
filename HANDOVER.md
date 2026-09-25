# Handover — 2026-09-25 (tree CLEAN; the 0.9.0 mac artefact is signed, notarized and stapled; the day's code work is the ph341 watcher bug, `5330e1a`…`81c3e0b`)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it; it gained the TeX-fragments paragraph and the
editor-ownership amendment on 09-18); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. Where things stand

**The sixth session's four blocks landed**, one commit each, exactly as
its handover listed them: `90a4d95` inline footnotes keep their face
across a paragraph break, `4d49580` Fill Paragraph in the Edit menu + ⌥D
+ `CLEW_SMOKE_MENU`, `a2721cb` description lists as a grid, `b9de21c`
math sealed against the markdown grammar. The two files carrying more
than one block (`editor/editor.js`, `smoke/README.md`) were committed
through intermediate states, so each commit stands alone. The manual
hunks went in as one commit in Clew-docs (`1c8d3bc`).

**This session built one feature: TeX fragments** (`3a180c2` here,
`57a61ea` in Clew-docs) — §2 — and fixed one bug it turned up on the way
(`f806d43`: the site export never handed its workers the note's
typeface). Nothing is pushed in either repo.

**09-25, part two: the ph341 bug — one cause, two symptoms.** The owner
opened `~/Sites/jmckalex/prez/teaching/ph341` as a vault: the app was
"amazingly slow" at the start, and reading mode failed with `spawn
EBADF`. Five presentation folders there symlink one 309 MB reveal.js
library; chokidar has no cycle guard, so it watched that tree five times
and held **100,169 descriptors** — and past **10,240** held descriptors
libuv cannot fork, which is how a watcher killed the RENDER worker
(measured: 10,000 → fork OK, 10,240 → EBADF; it is not the 256 launchd
limit, and not EMFILE exhaustion — both tested and excluded).

`5330e1a` gives the watcher a process-wide budget (8,000 paths,
`fs-utils.js#watchFilter`), hands it the duplicate symlinks the vault
walk already skips, applies the ignore rules to the vault-RELATIVE path
(the old absolute test ignored every file in a vault under a
dot-directory), and says so when the budget bites — `console.warn`,
`EV_WATCH_CAPPED`, a notice in the window. `81c3e0b` windows the file
explorer (`lib/tree-window.js`): 45 DOM rows instead of 20,503. The
manual has it in `vaults-and-files.html#watching` (`04226e0`).

**And then the feature the bug earned** (`1747269`, manual `e5ff600`): a
vault can now say which parts of itself Clew should leave alone, in two
forms the owner distinguished — `unindexed` (listed in the explorer and
openable, but not indexed and not watched) and `hidden` (not there at
all). Vault-relative globs in `vault-settings.json`, editable by hand or
at Settings → This vault, applied by EVERY vault walk through
`src/main/vault-excludes.js` — which also ends the built-in ignore list
being copied into three files that had already drifted apart. Changing
either list reloads the vault in place. `unindexed` is only offerable
because the explorer is windowed: listing 20,000 files now costs nothing.

Documentation for all three changes is in: the manual's
`vaults-and-files.html` gained two sections (`#watching` for the budget,
`#excluding` for the lists) with the settings chapter, the search
chapter and the `.clew/` table following (`04226e0`, `e5ff600`,
`72a4549`); the demo vault's Guide notes carry them too (`abd09ef` —
"Leaving folders alone", and a This-vault list that had drifted to
naming two options when there are a dozen); CLAUDE.md has the durable
parts.

**Then two more asks, both landed**: the print CSS keeps a full-width
table's right border off the page clip (`d00f642` — it rendered at mean
grey 240 against 213 for every other rule, which is what "the border is
missing" looked like when measured), and **`@reveal[…]`** embeds a
presentation in a note (`a48b0ce`, manual `72a4549`'s sibling in
links-and-embeds). The reveal work turned up a dialect fact worth
carrying: **the engine's attribute grammar severs unquoted units** —
`height=300px` arrives as two attributes, `aspect=16/9` throws and costs
the whole set — so any new directive taking CSS-ish attributes needs the
same gluing `reveal-embed.js#attrsOf` does.

**And a regression of my own, found by the owner and fixed** (`a86936b`):
the watch budget was applied for the life of the session, so a vault that
spent it on its initial scan went blind to every NEW file — a note
created with the explorer's button landed on disk and never appeared.
The budget now bounds the SCAN only (the gate reopens to `WATCH_CEILING`
once chokidar is ready), and Clew's own create/rename/trash call
`vaults.refreshTree()` rather than waiting for a watcher echo that may
never come. The lesson generalises: **a resource cap must not become a
correctness cap** — bound the expensive bulk operation, not the whole
session, and never make the app's own actions depend on hearing about
themselves from the outside.

**A measurement error worth remembering**: the explorer was first
reported at 23.5 s, and that was an instrument reading page lifetime —
the listener had attached after `ev-vault-opened` fired, so `opened`
stayed null and the arithmetic subtracted zero. The true figure is
4.19 s with the library against 4.14 s without it. The windowing is
still right, but the SLOWNESS was the watcher, not the DOM. Check what a
zero baseline means before believing a number that large.

**Then 09-25 part one was a packaging round, no code:** the mac build was made,
signed with the Developer ID identity, and (by the owner) notarized and
stapled. `out/Clew-0.9.0-arm64.dmg`, 212 MB, verified both ways —
`xcrun stapler validate` and `spctl -a -t open` on the IMAGE, and the
same two plus `codesign -dv` on the `Clew.app` INSIDE it, which carries
its own ticket and so launches on a machine that has never seen it.
Nothing in the repo changed: packaging re-synced the jmarkdown and
EmbedPDF mirrors from their masters and produced no diff.

**613 tests green**; `node scripts/build.js` passes; `make check-links`
clean in Clew-docs.

## 1. STILL OPEN

Nothing blocked. What waits on the owner is in §5 — the same three
long-standing items (dev docs, the graphicx driver line, the `font=note`
re-pin) and last session's two offers.

## 2. TeX fragments: preamble text a figure asks for by name

The owner's ask, in their words: a way to save fragments of code to be
inserted into a ```latex or ```tex fence, named in Settings, pulled in
with an attribute on the fence's first line, so the same block does not
have to be copied into every figure.

`clew-fragments='math macros, colours'` on any TeX block inserts the
named fragments' text into that figure's preamble. Two owner decisions
shaped it, both asked before any code was written:

- **Both scopes, vault shadows global** — the plugins arrangement.
  GLOBAL fragments live in `clew-settings.json` and are offered in every
  vault on this machine; THIS VAULT's live in `.clew/vault-settings.json`
  and travel with the vault. A vault fragment of the same name wins.
- **Named only** — no "always applied" flag. The syntax leaves room for
  one later.

**The shape.** `src/engine/tex-fragments.js` owns what a name means
(matching ignores case and inner spacing) and which scope wins; main
hands the worker both lists exactly as stored (`CLEW_TEX_FRAGMENTS`, the
`CLEW_NOTE_FONTS` pattern, `globalThis` fallback included) and resolution
happens in the WORKER, so the rule has one implementation. The renderer
imports the same module for the settings rows' hints — metapost-words.js
again. `figures.js#applyTexFragments` places the text exactly where
`font=note` places its block (after a complete document's own
`\documentclass`; into the `preamble` attribute for a snippet or a tikz
body, whichever wrapper runs writing it out; at the top of a plain-TeX
source) but LAST, after the font block and Clew's own packages, because
a fragment is the author's code and TeX's rule is that the last
definition wins. A `preamble=` on the fence still beats it. The
attribute is consumed and never reaches the element, so a figure's
identity is the TEXT it got: edit a fragment and everything using it is
typeset again, rename one and nothing is typeset at all — though a
figure still asking for the old name then shows its refusal.

**Refusals BY NAME**, in place of the figure: a name nothing defines
(naming it, and where fragments are written), and the attribute on a
```metapost block (no preamble — its TeX goes in `verbatimtex … etex`).
Refusing beats typesetting without, because the alternative failure is
an undefined control sequence deep in a TeX console.

**The UI** is Settings → TeX fragments: two lists, a row each, the name
in a narrow column and the fragment in a CodeMirror that grows with it,
highlighted by the fence grammars (`langs/fence-languages.js`) so a
fragment is coloured where it is written exactly as where it lands.
`renderer/editor/mini-editor.js` is that field — a standalone
EditorView, because editorPool is about a path, dirty state, auto-save,
the state cache and the conflict banner, none of which a settings row
has. Its caller destroys it and flushes a pending save when the tab goes
away (a 900 ms debounce, long because every save reconfigures the render
service).

**What was measured**, with `smoke/tex-fragments-scenario.js` over its
generated fixture (both scopes: the global list in a fresh
`CLEW_USER_DATA`, the vault's in `.clew/`):

- nine figures, two refusals; every figure `mpw-ok` EXCEPT the deliberate
  control — the same body minus the attribute, which fails with an
  undefined control sequence. That contrast is the whole proof.
- the vault's `Math  Macros` (capitals, two spaces) beat the global
  `math macros`: normalization and shadowing, in the app.
- the settings section: both scopes' rows, five CodeMirrors painting
  `jmd-*` faces, the shadow note on the vault row, Add fragment focusing
  a new empty row.
- the live edit: phase three rewrote a fragment over the real
  `clew:vault-settings-set` channel and all three figures using it came
  back carrying the new text — "Hello VAULTFRAG2." in the fragment's own
  accent colour, eyeballed in the screenshot.
- the ENGINE's own output is read from `<vault>/.clew/cache/html/
  <hash>.html`: the documents come out as designed (fragments after
  Clew's packages, before `\begin{document}`; `data-preamble` for a tikz
  body; nothing named `clew-fragments` anywhere but the refusal text).

The demo vault now ships two fragments (`math macros`, `diagram
colours`) and its Diagrams note has a Sharing-a-preamble section that
uses both — verified typeset in the demo vault itself. Writing it found
the sharp edge worth knowing, and it cost two runs to see: **Clew wraps a
```latex snippet (amsmath + amssymb loaded), the LIBRARY wraps a ```tikz
picture (neither)**, so a fragment shared by both must carry its own
`\usepackage` line. The symptom reads oddly from the far end — a macro
expanding to `\mathbb{R}` works in the snippet and is an undefined
control sequence in the picture, reported at the line that USES it. The
demo fragment and the manual both say so now.

## 3. Small residue (none blocks anything)

New this session:

- The site export's missing `CLEW_NOTE_FONTS` — found while adding
  `CLEW_TEX_FRAGMENTS` to the same env block — is FIXED and measured
  (`f806d43`), not residue any more. It had been baking every
  `font=note` figure in fontspec's own Latin Modern while
  `figure-bake.js` staged face files nothing referenced.
- A fragment name containing a comma can never be asked for (the
  attribute is a comma list). The settings row says so; nothing stops
  the name being typed.
- `show=code` never builds a figure, so a bad fragment name in a
  `show=code` block is not refused — by construction, and harmless.

Carried over, still true: `:::TiKZ` / `@begin(…)` BODIES keep the
overlay's uniform `jmd-embedded` face (only fences got grammars);
`show=` is the preview's only, a LaTeX export of `show=code` still draws
the picture; a plain `[text]` in prose still wears the link face in the
source pane (§2a's parser would take one more arm); the library's
element for a LaTeX document is still `<tikz-diagram>`; a wrapped
```latex snippet's line width is standalone's 345pt; the engine's HTML
pretty-printer re-indents a figure's source; plugin checkbox toggles
need a vault reopen; rename of an OPEN pdf/office/canvas tab leaves it
on the old path; executable extensions refused by `open-file.js`
unreviewed; the history switch discards a hand-edited tuning object;
LibreOffice keyboard/clipboard and office-convert unverifiable here;
kanban card drag write path; warm-cache query renders emit no
EV_RENDER_DONE.

## 4. The manual (`../Clew-docs`) — committed, not pushed

`1c8d3bc` carried the sixth session's four chapters (footnotes,
description lists, ⌥Q/⌥D, the money case). `57a61ea` carries TeX
fragments: a new `diagrams.html#fragments` section (syntax, where the
text lands per kind, the two lists and the shadowing, a warn callout for
the two refusals, and the export line — a website export uses fragments,
a LaTeX export never sees them) plus its reference row, and in
`settings-and-hotkeys.html` the section itself, a sentence in
"App-global versus per-vault" (this is the one section with a list in
each scope) and `texFragments` in both reference rows. `make check-links`
clean. Still not written: the preview-lenient / export-strict line from
the sixth session's §2e, offered and not yet answered.

## 5. Owner's own actions

- **Neither repo has a git REMOTE** (checked 2026-09-19: `git remote -v`
  is empty in both; `../Clew-iOS` has one, on GitHub). "Nothing pushed"
  in earlier handovers meant there is nowhere to push — the whole of
  Clew and ~50k words of manual exist on this machine, in git only.
  Clew-docs' own HANDOVER §3 carries this as its item 4. Deciding where
  they live is the one item here that protects everything else.
- `make sync` in Clew-docs to deploy the manual once the site is live —
  what is served now still promises inline fields and a TeX
  installation.
- Two offers waiting on a yes or no: the stray link face on plain
  `[text]` brackets, and the manual line about `\[ \begin{align*} … \]`
  rendering in the preview but failing a LaTeX export.
- The GoDaddy DNS change (A records for clew-app.com/.net →
  144.126.236.254), then in Clew-docs `make dns-check` → `provision` →
  `sync` → `tls`. Plus the win/linux VM run if those artefacts are to
  ship.
- **`font=note` waits on a release.** The manifest is pinned to
  mp-tikz-wasm 0.2.1; when 0.3.0 exists re-pin
  `src/shared/mptikz-manifest.json` — that is the whole job.
- mp-tikz-wasm (owner's project), still parked: the **graphicx driver
  line**. `\rotatebox` does nothing because `graphics.cfg` picks
  `dvips.def` for any DVI engine, whose PostScript specials need
  Ghostscript. Verified fix, for the library to prepend beside its
  `\def\pgfsysdriver` line:
  `\ifx\PassOptionsToPackage\undefined\else\PassOptionsToPackage{dvisvgm}{graphics}\PassOptionsToPackage{dvisvgm}{color}\PassOptionsToPackage{dvisvgm}{xcolor}\fi`
  — rotate/scale/colour on both LaTeX engines, plain TeX untouched, an
  explicit `[dvips]` overridden. `\PassOptionsToPackage` takes ONE
  package name; a comma list silently passes nothing.
- **Decide on the dev docs** (asked, answered yes, never written): three
  on-demand topic docs — `docs/dev/rendering-pipeline.md`,
  `docs/dev/editor.md` (it would now carry the three grammar corrections
  in editor.js), `docs/dev/figures.md` (the mp-tikz-wasm contract,
  bundles, engines, staging, timings — and now fragments) — indexed from
  CLAUDE.md, under the same "not finished until it matches" rule as the
  manual.
- ~~Re-measure the DMG~~ — done 09-25: **212 MB** for arm64, against
  159 MB on 08-26, so the staged TeX engines and EmbedPDF cost about
  53 MB compressed (109 MB `mptikz` + 81 MB `engine` + 73 MB
  `preview-assets` uncompressed in `Resources/`; the .app is 561 MB on
  disk). A universal image would be roughly double; the 253 MB
  `Clew-0.9.0-universal.dmg` still in `out/` is the STALE 08-26 one,
  before the engines — do not reach for it.
- **If 0.9.0 is to be released, it is ready to go out.** What is not
  done: the win/linux VM run, and the site (below) that would host it.

## 6. The owner works in this tree concurrently

Tree CLEAN. `zeta-assets/` and `mptikz-assets/` are deliberate and
gitignored. `out/` now holds: the 09-25 signed+stapled
`Clew-0.9.0-arm64.dmg` and the signed `mac-arm64/Clew.app` it was cut
from, the 09-02 win/linux artefacts, and the 08-26 universal dmg (stale
— see §5). Never switch THIS tree off main. Live testing flips demo widgets
— reset `status:`/`done:`/`^motto` baselines, and the foldable embed in
`Guide/Links and Embeds.md`, before committing demo files. This
session's demo runs left `demo-vault/.clew/workspace.json` with the
Diagrams tab in reading mode (gitignored; harmless).

## 7. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- **A SIGNED build must be boot-tested, not just verified.** `codesign
  --verify` proves the signature; it says nothing about whether the app
  runs. The hardened runtime is exactly what breaks this one — the
  forked render worker needs `allow-dyld-environment-variables`, the
  wasm TeX needs `allow-jit` + `allow-unsigned-executable-memory`, the
  unpacked engine tree needs `disable-library-validation`. Run the
  PACKAGED binary (`out/mac-arm64/Clew.app/Contents/MacOS/Clew`) under
  `CLEW_SMOKE` with an isolated `CLEW_USER_DATA` and assert a ```latex
  figure reaches `mpw-ok` — done 09-25, all four entitlements hold.
- **`spctl -a -t exec` on a signed-but-unnotarized app says `rejected —
  source=Unnotarized Developer ID`, and that is fine.** A locally BUILT
  bundle carries no quarantine flag, so it launches here; Gatekeeper
  stops only a copy that was TRANSFERRED. Do not chase that "rejected"
  as a signing fault. After notarizing, both the image and the app
  inside report `accepted — source=Notarized Developer ID`.
- **`--notarize` requires `--dmg`** (the ticket staples to the image),
  and `scripts/package.js` blanks the Apple env for its child unless you
  ask for it — so a plain `--sign` build never silently notarizes, and a
  vanished `~/.zshrc` export can never silently stop stapling. Budget
  ~12 minutes for the signing alone on this bundle: a `--timestamp`
  round-trip per nested binary, plus hashing 13,819 files.
- **A vault is whatever folder the user points at**, and some of them
  contain libraries. It can now SAY so (`vault-excludes.js`, two lists),
  and every walk must consult it — a new walk that forgets is a walk that
  indexes a font pack. Anything that walks or watches a vault also needs a
  bound: the descriptor ceiling (~10,240 held, then `fork` fails with
  EBADF) turns "slow" into "cannot render", and the DOM has the same
  shape of problem. Both bounds now exist — `WATCH_BUDGET` in
  fs-utils.js, windowing in the explorer — and anything new that
  enumerates a vault should ask which bound it lives inside.
- **Check the baseline before believing a timing.** A `performance.now()`
  difference against a variable that was never set subtracts zero and
  reports the age of the page. The ph341 explorer "took 23.5 s"; it took
  neither that nor anything like it.
- **A smoke run's ENV is the whole safety net.** Launching
  `…/Electron .` without the `CLEW_SMOKE*` variables boots the REAL app
  against the real userData — it restores the owner's vaults and rewrites
  `clew-settings.json`. Build the whole command, env and all, in ONE go;
  a bare launch "just to check the harness" is not a test of anything.
- Always pass `CLEW_SMOKE_VAULT`; `git status` demo and study vaults
  after every smoke run. `CLEW_USER_DATA` isolates a run entirely — and
  is where a scenario's GLOBAL settings can be staged (a prepared
  `clew-settings.json` is read at start; under CLEW_SMOKE nothing is
  written back).
- **A path already open is FOCUSED, not duplicated** — `newTab: true`
  does not override it, and the restored tab keeps the mode the last run
  left. A scenario that needs reading mode must CHECK first
  (`document.querySelector('clew-preview-view iframe')`) and only then
  `actions.toggleReadingMode()`, or every second run tests source mode.
  Over a big vault, wait for `vaultStore.vault` AND a beat for the
  workspace to restore before opening anything.
- **The frame script runs against whatever preview is open when the
  scenario ENDS.** Phases that leave another tab focused (settings, say)
  go FIRST.
- **A typeset figure no longer holds its source in the DOM** — the
  library replaces the element's content with the SVG. Read what the
  engine emitted from `<vault>/.clew/cache/html/<hash>.html` instead;
  `data-preamble` is the one input that survives on the element.
- **The preview document has its OWN palette** (`--preview-bg`,
  `--preview-border`, `--preview-danger`, …), not the app's `--clew-*`
  variables: a rule in `src/engine/preview.css` that reaches for a
  `--clew-` token silently falls back.
- After a smoke run over a reusable fixture, `rm -rf` its `.clew/`; a
  scenario that TYPES also rewrites its fixture — regenerate before
  every run.
- Long smoke runs go `run_in_background` with output to a file — and
  NOT inside a `( … ) &` subshell, which the harness kills on return.
- Reusable scenarios live in `smoke/` — extend it, don't rewrite them in
  scratchpads; the README table carries the per-scenario assertions.
- **A face cannot un-parse a node.** When the overlay and lang-markdown
  disagree about a construct, fix the GRAMMAR; a CSS or decoration patch
  leaves the wrong node in the tree.
- **In a lezer inline parser, `before:` is the whole design.** `Escape`
  is FIRST in the default list and eats `\(`; `Link` builds a
  shortcut-reference node whether or not a definition exists;
  `InlineCode` runs before both.
- **A native menu is invisible to `capturePage`** — `CLEW_SMOKE_MENU=1`
  dumps the real `Menu.getApplicationMenu()` instead, and proves the
  template BUILT.
- **The owner's bug reports have been consistently right** — and so have
  the owner's rollbacks: a hidden tweak that "fixes" a document is a
  behaviour the user cannot see; teach it in the manual instead.
- **Write assertions that can fail — and eyeball the artefact anyway.**
  Computed style, not markup, when the bug is layout.
- **A measured symptom is not a cause.** Vary the CONSTRUCT, not just
  the document, before naming the fault.
- **Prefer measuring to guessing** — and when a disagreement is about
  what a standard does, run the standard.
- A feature change is not finished until the MANUAL in `../Clew-docs`
  matches it — nothing in this repo's git status reminds you. The demo
  vault is the other half: a guide note must EXERCISE what it documents.
- `npm run dev` / `npm run package` re-sync the engine AND the EmbedPDF
  viewer from their masters; packaging also stages mp-tikz-wasm. Run all
  three + `git status` BEFORE tagging.
- **A smoke timeout must wrap Electron itself**: `perl -e 'alarm shift;
  exec @ARGV' N node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .`
  — one around `npx electron .` kills npx and ORPHANS Electron.
  `ps -axE | grep <vault>` finds a stray by its env, which is also how
  to kill exactly the run you started.
- Screenshot-kit lore, still true: splitting re-parents the editor and
  RESETS its scroll; CDP keystrokes need the caret's viewport coords for
  the focusing click; `CLEW_SMOKE_LOG=1` prefixes scenario `console.log`
  with `[smoke:info]`.
