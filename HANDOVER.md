# Handover — 2026-09-17, end of the fourth session (everything committed on `main`, nothing pushed §0)

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

- Push both repos, and `make sync` in Clew-docs to deploy the manual —
  the site currently promises inline fields and a TeX installation.
- The GoDaddy DNS change (A records for clew-app.com/.net →
  144.126.236.254), then in Clew-docs `make dns-check` → `provision` →
  `sync` → `tls`. Plus the win/linux VM run if those artefacts are to ship.
- mp-tikz-wasm (owner's project): the graphicx driver line (§2d) when
  wanted; a `<latex-document>` element and a `bbox` attribute on
  `renderFigure` are the two things Clew would use next.
- Decide on the dev docs (§2d).
- Re-measure the DMG now that ~37 MB of engines ride along.

## 6. The owner works in this tree concurrently

Tree clean after §0's commits; Clew-docs clean. `zeta-assets/` and `mptikz-assets/` are
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
