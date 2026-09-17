# Handover — 2026-09-17, end of the fifth session (UNCOMMITTED here: `font=note` — figures in the note's own typeface §2f — and the manual-screenshot kit §2e; everything else committed on `main`, nothing pushed §0)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it; it gained the figures bullet and the icons
bullet this session); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. Where things stand

**Committed today**, in order, on `main` (nothing pushed):

| Clew-app | |
|---|---|
| `ae4a8ca` | Stage the wasm TeX engines for dev and packaging, pinned to mp-tikz-wasm 0.2.1 |
| `689bb9c` | TikZ and MetaPost typeset in the preview by mp-tikz-wasm, baked into site exports |
| `0c4f56a` | Description lists win the `::` line: Dataview inline fields dropped |
| `06fd7c4` | Fence languages in the editor, ```latex and ```tex fences, and show= on every figure block |
| `aa16340` | Dataview: an absent field is null |
| `a7d786e` | HANDOVER (superseded by this file) |
| `438e694` | Re-pin to mp-tikz-wasm 0.2.1 as published: plain TeX back on LuaTeX |
| `da5f68a` | Complete LaTeX documents keep their page numbers: documented, not tweaked |
| `9ef4375` | LibreOffice back to Colibre at its default icon size |
| `f92c7ea` | Plain TeX keeps its page number: `\nopagenumbers` is the author's to write |

| ../Clew-docs | |
|---|---|
| `92320d9` `bb875b1` `ea02cb7` `b5a65a9` | Manual: figures in wasm; no inline fields; fence highlighting + LaTeX/TeX fences + show=; three Dataview facts |
| `dc79747` `80dad8b` `47634d7` | Manual: plain TeX on LuaTeX; a complete document keeps its page numbers; a plain snippet wants `\nopagenumbers` |

Files that carried more than one session's hunks were staged at
intermediate states, so each commit holds only its own feature (the
script that did it is gone with the scratchpad; the recipe is "write the
intermediate content, `git add` explicit paths, commit, restore").

**The last two** (`9ef4375`, `f92c7ea`) went in at the start of the
fifth session, after a 515-green run: the LibreOffice icon-theme revert
(commits `3bc44bf` and `fc4b522` undone by hand — not booted; the build
passes and the diff against the pre-Sifr versions shows only later
unrelated additions) and the `\nopagenumbers` removal from wrapTex
(the ```tex fence adds `\bye` and nothing else; tests, fixture, demo
note and manual updated). A flipped `Guide/Widgets.md` (live-testing
residue) was restored, not committed.

**UNCOMMITTED here, ready for review, two blocks:** (1) `font=note`
(§2f): `src/main/note-fonts.js` + `tests/note-fonts.test.js` (new),
`src/main/asset-stamp.js` + `tests/asset-stamp.test.js` (new),
`src/engine/figures.js`, `src/preview-client/figures.js`,
`src/main/{paths,main,protocol,render-service,figure-bake,export-site}.js`,
`tests/figures.test.js`, `smoke/{fonts-scenario,fonts-frame}.js` +
`make-figures-vault.mjs` (Fonts.md), `demo-vault/Features/Diagrams.md`,
CLAUDE.md's figures bullet, the README row. (2) The manual-screenshot
kit `smoke/manual/` and its README section (§2e). In Clew-docs both
passes are uncommitted too — the illustration pass and the `font=note`
section; its HANDOVER has the tables. **524 tests green.**

**515 unit tests green**; `npm run build` passes; `make check-links`
clean in Clew-docs. Every claim in §2 was smoke-verified with the
artefact eyeballed, not just the log line, except where a line says so.

## 1. STILL OPEN

Nothing in this file. The `!= null` bug (the old §1b) is fixed and
committed (`aa16340`). The open items are the owner's own (§5) and the
residue (§3).

## 2. What this session decided and built

### 2a. Fence languages, ```latex / ```tex, `show=` (`06fd7c4`)

The owner asked for three things. The source pane highlights the typeset
fences with hand-rolled CodeMirror stream modes (`renderer/editor/langs/`:
TeX for ```tikz/```latex/```tex, MetaPost for ```metapost, `btex … etex`
handed to the TeX tokenizer) through lang-markdown's `codeLanguages`
hook, lezer tags mapped onto the overlay's `jmd-*` classes. Two fences
typeset whole documents: a ```latex snippet is wrapped in
`\documentclass[varwidth,border=2pt]{standalone}` + amsmath/amssymb on
LuaLaTeX; a body with `\documentclass` is typeset AS WRITTEN, one SVG per
page (`.clew-doc` stacks them); ```tex is plain TeX with `\bye` added,
on plain LuaTeX. Every block takes `show=figure|code|both` (bare words
too): the code block is marked's OWN `code` token — returned outright for
`code`, attached as a child for `both`; the environments moved from
`verbatim` to `custom` mode for the lexer hook — so highlight.js and the
source-line pass treat it like any fence; the one addition is a MetaPost
grammar registered on the engine's highlight.js via
`createRequire(process.argv[1])` (the worker script's node_modules, dev
and packaged alike; ESM and CJS loads share one instance — measured),
built from `engine/metapost-words.js`, which the editor mode imports too.

### 2b. The library bug, wrongly diagnosed here, fixed upstream (`438e694`)

Plain LuaTeX "trapped on any math" in Node — every document I tried.
Upstream (mp-tikz-wasm `5e514df`) the construct matrix showed EVERY DVI
rule trapping under BOTH LuaTeX formats: LuaTeX's back-end dispatch
table is typed as an unprototyped function pointer, the DVI rule slot
takes three arguments where its caller passes four, and wasm's
`call_indirect` enforces the arity native C ignores. `\sqrt`, `\frac`,
`\hrule` — so the demo's Maxwell `\frac` would have failed under
lualatex too. Fixed with the library's first luatex patch, v0.2.1
published from it; Clew's manifest is pinned to the published asset
(sha256 `5ddff636…3ad7`, 37,205,263 bytes, both confirmed with `gh
release view v0.2.1 --json assets`), ```tex is on `luatex`, the fixture
guards a `\frac` and a `\sqrt`. Lesson filed under §7.

### 2c. Page numbers are the document's (`da5f68a`, `f92c7ea`)

The owner's complete `article` rendered and "the paragraph after it was
not shown": the SVG was 572.8pt tall — text at the top, folio at the page
foot, dvisvgm's tight crop spanning the two — with the next paragraph
below the fold. I injected `\pagestyle{empty}` at `\begin{document}`
(572.8 → 110pt); the owner rolled it back: someone wanting pages as
pages must get them, "this is a feature, not a bug, and the user has to
learn about it". Then `\nopagenumbers` for plain TeX went the same way.
The manual's LaTeX section teaches both consequences and remedies
(`\pagestyle{empty}`, `\thispagestyle{empty}` after `\maketitle`,
`\nopagenumbers`); the smoke fixture's documents write them
themselves; the frame script reports each document's `next=` and `gap=`
so a page-tall empty SVG is visible in a run.

### 2d. Smaller decisions

- **`WHERE x != null`** (`aa16340`): `dv-expr.js#valuesEqual` normalises
  `undefined`/`null` on the null-side branch; `= null` finds absent
  fields, `!= null` drops them, `typeof` agrees. No vault query used null.
- **The `::` decision** (`0c4f56a`) and **figures in wasm** (`689bb9c`,
  `ae4a8ca`) are the earlier sessions' work, now committed with their
  reasoning in the messages; CLAUDE.md carries the durable parts.
- **graphicx under dvisvgm** (asked, measured, NOT done — owner said not
  now): `\rotatebox` did nothing because `graphics.cfg` picks `dvips.def`
  for any DVI engine, whose PostScript specials dvisvgm needs Ghostscript
  for. `\usepackage[dvisvgm]{graphicx}` or `\documentclass[dvisvgm]{…}`
  (which also switches the expl3 backend) fixes a document; the library
  could prepend, beside its `\def\pgfsysdriver` line,
  `\ifx\PassOptionsToPackage\undefined\else\PassOptionsToPackage{dvisvgm}{graphics}\PassOptionsToPackage{dvisvgm}{color}\PassOptionsToPackage{dvisvgm}{xcolor}\fi`
  — verified: rotate/scale/colour on both LaTeX engines, plain TeX
  untouched, an explicit `[dvips]` overridden (dvisvgm's option is
  declared later). `\PassOptionsToPackage` takes ONE package name; a
  comma list silently passes nothing.
- **Dev docs** (asked "would it be a good idea", answered yes, not
  written): three on-demand topic docs — `docs/dev/rendering-pipeline.md`
  (marked mechanics as Clew uses them, environment modes, highlight +
  source lines, where highlight.js resolves), `docs/dev/editor.md`
  (overlay vs nested grammars, adding a fence language, testing a stream
  mode), `docs/dev/figures.md` (the mp-tikz-wasm contract, bundle
  contents, engines/formats, staging, timings) — indexed from CLAUDE.md
  with one line each, dated, under the same "not finished until it
  matches" rule as the manual. The owner did not say yes or no.

### 2e. The manual illustrated for the 0.11 features (fifth session, uncommitted)

The owner asked for the docs to "discuss and document all the new
features, complete with screenshots". The text was already there for
everything but the typeface (`theming.html` gained the Avenir Next
paragraph; the reading-mode return trip had been written in
`reading-mode.html#toggling` all along, so Clew-docs' open item 2 was
half stale). What was missing was pictures: ten desktop screenshots,
each from a committed scenario in `smoke/manual/` (README table there)
over a **scratch rsync of the demo vault** (never the real one — the
completion scenario's keystrokes auto-save into the note), fresh
`CLEW_USER_DATA`, 2560×1700 dark, every one eyeballed. Retaken:
`office-tab.png` (the 09-01 shot showed the Sifr icons that `9ef4375`
reverted) and `welcome.jpg` (both copies). New: welcome screen,
embed frames, the ```latex/```tex fences, the split with the
TeX-highlighted fence, path-matched wikilink completion, the export
commands in the palette, the plugin list with a `global` row, and a
.docx thumbnail embed. Landing page: the Diagrams bullet, the plugins
card and the "everything else" card mention the wasm TeX, global
plugins, office documents and note history; the iPad status paragraph
is the owner's and was left alone.

Facts the kit earned: **splitting re-parents the editor and resets its
scroll** — scroll the source pane after the split settles, and drive
the reading pane from its frame script; **CDP keystrokes need the
caret's viewport coords** (`view.coordsAtPos`) for the click that
focuses the editor, and the completion popup opens at the caret, so the
prompt line must be short enough for it to fit before the sidebar;
**`textutil -convert docx` needs `<meta charset="utf-8">`** in its HTML
or an em dash arrives as `â€”`; the office thumbnail for a fresh vault
took 12 s once a LibreOffice had booted in the same app run's
lifetime — plan on the tab's minute and a half otherwise; and
`CLEW_SMOKE_LOG=1` prefixes scenario `console.log` lines with
`[smoke:info]`, so a log filter that drops `smoke:info` drops the
assertions.

### 2f. `font=note`: figures in the note's own typeface (fifth session, uncommitted)

The owner pointed at `~/Source/mp-tikz-wasm/docs/16-clew-integration.md`
(the library's brief for Clew: fontspec under the wasm LuaTeX, an
`opentype` bundle, `mpTikzWasm.addFiles`, `fonts="woff2"` for real
`<text>`). CLAUDE.md's figures bullet has the mechanism; what matters
for whoever picks this up:

- **Gated on a release that does not exist.** The library work is on its
  `opentype-fonts` branch, UNCOMMITTED there as of tonight (session 10
  added the plain-TeX fix), not merged, not released. The manifest stays
  pinned to 0.2.1 as the brief asked. Clew's code degrades correctly
  without the bundle — `preview-client/figures.js` checks
  `bundles/index.json` and refuses marked figures BY NAME, the site baker
  likewise — so it is safe to commit and ship; the feature simply lights
  up where a build carrying the bundle is staged (dev reads
  `~/Source/mp-tikz-wasm/dist` directly; packaging stages it with
  `sync-mptikz`, which means a DMG built on this machine today WOULD carry
  the branch build — the owner's call). When 0.3.0 exists: re-pin
  `src/shared/mptikz-manifest.json`, done.
- **Decisions taken** (the brief left them open): opt-in per block
  (`font=note`), never the default — a sans in a maths figure is not
  always wanted and a findable luaotfload costs every LuaTeX run ~180 ms;
  the bundle is requested only when a marked figure is on the page at
  loader time, with a one-shot preview reload (sessionStorage-guarded) if
  one arrives later; faces come from main, not `queryLocalFonts` (no
  permission prompt, and the TTC has to be split anyway); site exports
  bake such figures as outlines (no subset of Apple's face in a
  published page). Maths stays in Computer Modern on both routes.
- **Verified** (`smoke/fonts-scenario.js`, fresh profile, eyeballed): the
  ```latex, ```tikz and ```tex forms all `text>0`, three Avenir Next
  faces embedded each, the hand-written fontspec document renders, the
  control keeps outlines, `marked=4`, `pending=0`. The demo vault's
  Diagrams note gained two `font=note` examples and still renders every
  figure. The TTC extractor was checked byte for byte against fontTools.
- **Two mistakes worth remembering.** The first `ensureLoader` set its
  "added" flag before its awaits and the reload branch read that flag —
  the preview reloaded in a loop and NOTHING rendered, not even the
  control, with an empty console (the tell: no library log lines at all).
  A state machine (`null | deciding | plain | opentype`) fixed it. And
  the TikZ form carries its block in the PREAMBLE attribute, not the
  source, so a mark computed from the source alone missed it: it rendered
  in the smoke only because the other figures had fetched the bundle —
  `marked=3` where 4 were expected was the only sign. Assert the count.
- **Plain TeX** first failed with `Module luatexbase Error: Unable to
  register callback` (ltluatex.lua:109) then `not loadable: metric data
  not found`; I had written a by-name refusal when the mp-tikz-wasm
  session reported the cause (luaotfload's DVI module wants
  `pre_shipout_filter`, which only the LaTeX kernel creates) and a patch
  to the bundled luaotfload.sty. The refusal is gone; the idiom is the
  library's verified one (`\input luaotfload.sty`, bracket-file `\font`s
  with `+liga;+kern;+tlig`, `\let` over `\tenrm/\tenbf/\tenit`). A
  build without the patch shows exactly those two lines.
- **Stale engines, found and fixed.** Asked the library session whether
  bundle files are cached persistently: they are not (in-memory per
  engine instance; the result cache stores successes only), so the only
  place a stale file survives is the HTTP cache — and protocol.js serves
  the mptikz root `immutable, max-age=31536000` with no version in the
  URLs. So a restaged master (and an app upgrade, same URLs) is served
  stale for a year; the owner's profile kept the session-9
  luaotfload.sty while a fresh profile passed. `main/asset-stamp.js`
  now stamps the engines + bundle indexes (mtimes, sizes) + app version,
  records it in userData, and main.js awaits
  `session.defaultSession.clearCache()` on a change before any window
  opens (verified: cleared on first boot, silent on the second). The
  library-side alternative, `?v=<sha>` in the file URLs, is the
  library owner's call and is noted in their handover.
- **For the iPad** (briefed the Clew-iOS session in full): the engine
  build needs the bundle and the patch; faces should come from CoreText
  tables (no reading the system .ttc from the sandbox), written as an
  sfnt the way `note-fonts.js#extractFace` does; the faces map goes in
  `globalThis.CLEW_NOTE_FONTS` (added tonight for exactly that); the
  same cache-staleness applies to any long max-age on their scheme
  handler; and an HTML export that snapshots the preview would carry an
  Avenir Next subset. The manual has no "On iPad" sentence for this yet.

### Measured, on this machine

- LuaLaTeX ≈ 270 ms per short snippet vs pdfTeX ≈ 130 ms (Node); the
  first ```latex on a machine fetches LuaTeX (12 MB) once.
- A varwidth standalone snippet's viewBox is 343pt wide (the line width).
- The "bounding box not quite right" remark on the plain TeX SVG: the
  luatex and etex renderings are identical to five decimals, the box is
  the tight ink box (radical bar on the top edge, comma on the bottom),
  nothing clipped at 4× zoom. The owner let it go; if it returns, a
  margin needs the library (`renderFigure` ignores `bbox` on the element;
  `--bbox=2pt` is the dvisvgm option).

## 3. Small residue (none blocks anything)

New:

- `:::TiKZ` / `@begin(…)` BODIES keep the overlay's uniform `jmd-embedded`
  face in the editor; only fences got grammars (the ask). The stream
  tokenizers take a StringStream, so painting directive bodies from the
  overlay is a small follow-up.
- `show=` is the preview's only: a LaTeX export of `@begin(TiKZ){show=code}`
  still draws the picture.
- The library's element for a LaTeX document is still `<tikz-diagram>`
  (status text says "rendering TikZ…" while a snippet typesets); an
  upstream `<latex-document>` would fix the name.
- A wrapped ```latex snippet's line width is standalone's `\linewidth`
  (345pt) — no knob; a complete document sets its own.
- The engine's HTML pretty-printer re-indents and right-trims a figure's
  source on its way into the element (found last session, still true).

Carried over, still true: plugin checkbox toggles need a vault reopen;
rename of an OPEN pdf/office/canvas tab leaves it on the old path;
executable extensions refused by `open-file.js` unreviewed; the history
switch discards a hand-edited tuning object; LibreOffice keyboard/clipboard
and office-convert unverifiable here; kanban card drag write path;
warm-cache query renders emit no EV_RENDER_DONE.

## 4. Manual facts — done

The Queries chapter's three Dataview facts are in (`b5a65a9`).

## 5. Owner's own actions

- Say "commit" for §2f and §2e (two commits here, two in Clew-docs),
  then push both repos, and `make sync` in Clew-docs to deploy the
  manual — the site currently promises inline fields and a TeX
  installation. Decide whether a DMG built now may carry the
  `opentype-fonts` library build (§2f), or wait for 0.3.0 and re-pin.
- The GoDaddy DNS change (A records for clew-app.com/.net →
  144.126.236.254), then in Clew-docs `make dns-check` → `provision` →
  `sync` → `tls`. Plus the win/linux VM run if those artefacts are to ship.
- mp-tikz-wasm (owner's project): the graphicx driver line (§2d) when
  wanted; a `<latex-document>` element and a `bbox` attribute on
  `renderFigure` are the two things Clew would use next.
- Decide on the dev docs (§2d).
- Re-measure the DMG now that ~37 MB of engines ride along.

## 6. The owner works in this tree concurrently

Tree DIRTY with §2f and §2e; Clew-docs dirty with the illustration pass
and the `font=note` section. `zeta-assets/` and `mptikz-assets/` are
deliberate and gitignored. `out/` holds mac/win/linux artefacts from
09-02. Never switch THIS tree off main. Live testing flips demo widgets —
reset `status:`/`done:`/`^motto` baselines, and the foldable embed in
`Guide/Links and Embeds.md`, before committing demo files.

## 7. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- Always pass `CLEW_SMOKE_VAULT`; `git status` demo and study vaults
  after every smoke run. `CLEW_USER_DATA` isolates a run entirely.
- **After a smoke run over a reusable fixture, `rm -rf` its `.clew/`**: a
  restored per-vault workspace tab is NAVIGATED in place, mode and all,
  and shapes the next scenario (`newTab: true` for a scenario that needs a
  mode).
- Long smoke runs go `run_in_background` with output to a file — and
  NOT inside a `( … ) &` subshell, which the harness kills on return.
- Reusable scenarios live in `smoke/` — extend it, don't rewrite them in
  scratchpads; the README table carries the per-scenario assertions.
- **The owner's bug reports have been consistently right** — and so have
  the owner's rollbacks: a hidden tweak that "fixes" a document is a
  behaviour the user cannot see; teach it in the manual instead.
- **Write assertions that can fail — and eyeball the artefact anyway.**
- **A measured symptom is not a cause.** "Plain LuaTeX traps on math" was
  true of every document tried and wrong as a diagnosis (§2b). Vary the
  CONSTRUCT, not just the document, before naming the fault.
- **A tall empty SVG hides the next paragraph below the fold**, and the
  report reads "text after the block is not shown". Both folio cases
  were this; the frame script's `gap=` makes it visible.
- **Prefer measuring to guessing — and re-measure before believing a
  diagnosis.**
- A feature change is not finished until the MANUAL in `../Clew-docs`
  matches it — nothing in this repo's git status reminds you.
- `npm run dev` / `npm run package` re-sync the engine AND the EmbedPDF
  viewer from their masters; packaging also stages mp-tikz-wasm
  (`npm run sync-mptikz`). Run all three + `git status` BEFORE tagging.
- **A smoke timeout must wrap Electron itself**: `perl -e 'alarm shift;
  exec @ARGV' N npx electron .` kills npx and ORPHANS Electron (five
  processes kept the fixture open for ten minutes tonight). Exec
  `node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .`
  instead, and `ps -axE | grep <vault>` finds a stray by its env.
