# Handover — 2026-09-17 (four sessions, UNCOMMITTED here: `!= null` fixed §1; TikZ/MetaPost in wasm §2; the arrowhead crop fixed upstream and packaged as 0.2.1, unpublished §2b/§5; the `::` collision DECIDED — inline fields dropped §2c; fence highlighting + ```latex/```tex + `show=` §2d)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. Where things stand

**Nothing in THIS tree or Clew-docs is committed.** Both were clean at
`e4959d1` / `bbd7310` when the 09-16 work began; three sessions' worth
sits in the working trees, staged nowhere except the two `git rm`s
noted in §2. Review and commit as you see fit — the natural split is
(1) the engine + preview path for figures, (2) the export bake, (3)
staging/packaging + the 0.2.1 pin, (4) demo + study vaults, (5) the
`::` decision (§2c: engine, renderer, tests, vault notes, smoke), (6)
the fence languages, the ```latex/```tex fences and `show=` (§2d:
engine, editor langs, tests, smoke, vault notes), and (7) the
../Clew-docs manual.

**513 unit tests green** (469 + 36 for figures + 9 for the editor's
fence languages, −1: the inline-field test §2c removed). Every claim in
§2 was smoke-verified with the artefact eyeballed, not just the log line.

Four strands, in the order they happened:

- **Figures** (09-16, §2): TikZ/MetaPost typeset in wasm in the preview.
- **The arrowhead crop** (09-16 evening, §2b): the owner's "figure
  won't update" report was a bounding-box crop in the library. Fixed
  there, COMMITTED there (a2a9795 spath3, adbd53b crop, aac75ff
  Release 0.2.1, 424ed87 its handover) — untagged, unpushed,
  unreleased — rebuilt into its `dist/`, packaged into its `release/`,
  re-staged here, and `src/shared/mptikz-manifest.json` is pinned to
  that archive (§5).
- **The `::` collision** (09-17, §2c): DECIDED by the owner —
  description lists win, Dataview inline fields are dropped, fields are
  frontmatter only. Implemented, tested, documented.
- **Fence languages, ```latex / ```tex, `show=`** (09-17 evening, §2d):
  the editor highlights the typeset fences with TeX and MetaPost
  grammars; two new fences typeset whole LaTeX snippets and plain TeX;
  every block can show its source instead of (or before) its figure.
  Found and worked around a library bug: plain LuaTeX traps on math
  (§2d, §5).

## 1. STILL OPEN

Nothing in this file. The `::` collision (the old §1a) is decided and
done — §2c. The figure that "would not update" (the old §1c) was the
arrowhead crop — §2b. The `!= null` bug (the old §1b) is FIXED (09-17,
fourth session): `dv-expr.js#valuesEqual` normalises `undefined` and
`null` before the null-side comparison, so `WHERE x != null` drops notes
with no `x`, `WHERE x = null` finds them, and `typeof(x)` agrees; three
tests in `tests/dataview.test.js` (absent vs present, present-but-falsy
values, and the whole-vault split). The manual's Dataview section got
that fact plus the two from the old §4 (`FROM` is vault-relative; bare
`WHERE field` is truthiness). No demo/study vault query used `null`.

The open items are the owner's own (§5) and the residue (§3).

## 2. What these sessions built: TikZ and MetaPost without a TeX install

`~/Source/mp-tikz-wasm` (the owner's own project: MetaPost 2.11, pdfTeX,
LuaTeX and dvisvgm compiled to wasm, v0.2.0) now typesets figures in
Clew's preview. Three decisions were the owner's, taken up front:

1. **Rendering runs in the preview document**, client-side — the role
   the library's `auto.js` was written for, and where every comparable
   Clew feature already lives.
2. **The wasm path claims all four syntaxes**, the existing directives
   included, so a figure renders identically on any machine.
3. **The engines ship with the app**, staged from the pinned release.

### The pieces

- `src/engine/figures.js` — the engine extension. Emits
  `<tikz-diagram>` / `<metapost-diagram>` carrying the source as TEXT,
  for four syntaxes: ```` ```tikz ```` (TikZJax-shaped bodies included —
  a `\begin{document}` body's preamble becomes `data-preamble`),
  ```` ```metapost ````, `:::TiKZ`, and `@begin(TiKZ)` /
  `@begin(metapost)`.
- **How it wins the syntax, and why LaTeX export is untouched.** The
  fences and `:::TiKZ` are marked extensions in the generated preview
  config's `Extensions`; `@begin(TiKZ)`/`@begin(metapost)` are block
  ENVIRONMENTS, overridden through the config's `Environments` key
  (`defineEnvironment` → the same registry, so all of @begin's machinery
  — nesting, dedent, attribute parsing — is inherited). Both keys load
  AFTER the engine's own registrations (index.js 479/481). Clew's
  generated config is preview/site-export only: an export runs with the
  user's own config cascade (`export.js`), where the native handlers
  still stand and still emit a real `tikzpicture`. So the wasm path
  needed no `isLatex` sniffing and no LaTeX renderer of its own.
- `src/preview-client/figures.js` + the `client.js` morph guard.
  Importing `auto.js` DEFINES the two elements as custom elements that
  typeset themselves on connect and cache by content hash in IndexedDB,
  so Clew only has to (a) add the loader `<script>`, and only when a
  document actually holds an unrendered figure, and (b) survive a morph.
- `src/main/figure-bake.js` + `export-site.js` — a site export typesets
  every figure in Node and writes the SVG into the page, so a published
  site carries no wasm. Identical figures across pages render once.
- `print-pdf.js` waits for figures (`window.__clewFiguresPending`,
  beside its MathJax/mermaid/font polls) — verified by printing with a
  COLD cache: page 1 came out byte-identical to the warm print.
- `scripts/stage-mptikz.js` + `src/shared/mptikz-manifest.json` +
  `paths.js#mptikzAssets` + the `mptikz` asset root in `protocol.js`
  (served `immutable`, the one exception to the app's `no-store`).
  Dev prefers the master's own `dist/`; staging copies it, or unpacks
  the SHA256-pinned 0.2.0 release (the pin was checked against the
  published asset's own digest, not assumed); `npm run package` runs it
  with `--require` so it fails rather than shipping figure-less.
  `CLEW_MPTIKZ_DIR` overrides. 3,667 files, 84 MB staged, ~37 MB
  archived; `mptikz-assets/` is gitignored. After staging it verifies the
  directive library list against the staged bundles (see the gotcha
  below) — a warning normally, a refusal under `--require`.
- Demo vault: `Features/Diagrams.md` rewritten (both fences added as
  live examples), plus the compat and reading-mode guides. The two
  COMMITTED native caches (`Features/TiKZ/*.svg`,
  `Features/MetaPost/*.svg`, 144 KB) are `git rm`'d — dead now, and they
  contradicted the note's own "nothing is written into the vault".
- `../Clew-docs`: `diagrams.html` substantially rewritten (it claimed a
  TeX installation throughout), plus `publishing.html` (figures bake),
  `export.html` (the PATH paragraph's diagram claim), `reading-mode.html`
  and `manual/index.html`. `make check-links` clean.

### 2a. spath3 upstream (`~/Source/mp-tikz-wasm` a2a9795)

`calligraphy` is not a package — it ships inside **spath3**
(`texmf-dist/tex/latex/spath3/`, four files, 284 KB, and
`\RequirePackage{spath3}` is its only dependency, in the same folder),
which is why `texdoc calligraphy` finds nothing. So:

- `scripts/build-texmf.sh`: `spath3` added to the `tex/latex` copy list,
  with a comment saying it is there for the TikZ libraries rather than
  for its own sake. `build-bundles.mjs` needed nothing — its
  `latex-extra` recipe already claims everything under `tex/latex/`.
- `README.md`: the bundle row names spath3 now.
- Rebuilt there with `npm run build:texmf && npm run build:bundles &&
  npm run build:hot` (the formats survive a texmf rebuild — the script
  keeps `*.fmt` across it), then `npm run sync-mptikz` here.
  `latex-extra` 921 → 925 files, +284 KB.
- **Verified**: its own 241 unit/e2e tests pass, and all 8 TikZ goldens
  are still byte-identical to native `latex`+`dvisvgm` (snapshot format
  included). A plain directive figure renders with `calligraphy` back in
  the preloaded list, and a real `\calligraphy[copperplate]` stroke
  renders as a tapered pen stroke (eyeballed, not just `ok=true`).
- Committed there in the second session as a2a9795 (`dist/` and
  `build/` are gitignored in that repo). The release state is in §5.

### 2b. The arrowhead crop (`~/Source/mp-tikz-wasm` adbd53b, second session)

The owner's report, with screenshots: `\draw[very thick] (0,0) -- (1,0);`
in a `[scale=2,>=latex]` picture renders; adding `->` changes nothing on
screen; nudging the end to `(1,0.1)` makes a head appear. Every part of
that is explained by two facts, both measured natively as well as in
wasm:

1. **TikZ leaves its classic arrow tips out of the bounding box.** The
   old `arrows` set (`latex`, `stealth`, the primed forms) is declared
   through the pre-3.0 interface, which has no convex hull, so
   `\pgf@arrows@rigid@hull` finds nothing to add. pdflatex on the same
   standalone document gives the SAME page size (61.873 × 5.181 bp) with
   and without the `->`; `\pgf@picmaxy` printed from inside the picture
   is the half line width either way. The `arrows.meta` tips (`Latex`,
   `Stealth`) and the default `to` tip DO declare hulls and grow the box
   (±10pt for a 20pt `Latex`). pgf 3.1.11, TeX Live 2025, same in the
   bundle. Natively the standalone `border=2pt` is what keeps a classic
   head on the page: the very-thick `latex` head reaches 1.8pt beyond
   the picture box.
2. **The wasm path threw the border away.** dvisvgm ran with its default
   `--bbox=min`, whose box is the `dvisvgm:bbox` special PGF emits for
   the picture (pgfsys-dvisvgm.def `\pgfsys@typesetpicturebox`, then
   `bbox lock`) — the picture box, no border. So the SVG's viewBox was
   the line's own 1.2pt band and the head, drawn (paths=2), was clipped
   to a sliver on top of the line. `border=` moved the viewBox ORIGIN
   and never its size: the attribute the manual documents was a no-op.
   Nudging to `(1,0.1)` grew the picture box by 0.2cm, enough for most
   of the head — their fourth screenshot shows it truncated.

**The fix** (`src/ts/figures.ts#renderFigure`): a body the library wraps
in `standalone` asks dvisvgm for `--bbox=papersize` — the page the class
lays out, so the SVG is the PDF page, border included (a complete
document keeps the default; an article is not a page). Measured equal to
pdflatex's page to three decimals, on the pdfTeX path, the LuaTeX
graph-drawing path, and a five-picture document (one page each, own
size each). `--bbox=2pt` (dvisvgm enlarges the tight box by a length)
gives the same numbers for a symmetric border; `papersize` also honours
standalone's four-value borders and lands the origin at exactly
`-72 -72`. Also: `auto.ts` `DB_VERSION` 2 → 3, so the IndexedDB result
cache (keyed by source hash, which the fix does not change) drops every
old crop on first open; `isCompleteDocument()` exported and shared with
`wrapTikz`; README paragraph; two unit tests (the faked engine sees
`bbox: 'papersize'` for a body, nothing for a document) and one e2e
test (the real render is 61.873 × 5.181 with two paths). 244 tests
green there (241 + 3), all 8 TikZ goldens still byte-identical to
native (they are complete documents — untouched by design). Rebuilt
(`npm run build:ts`), re-staged here (`npm run sync-mptikz`).

**Verified in Clew** with `smoke/figures-scenario.js` cold over a fresh
`CLEW_USER_DATA`: the fixture (`make-figures-vault.mjs`) gained the
owner's figure, the frame script now reports each SVG's `viewBox`, and
the arrow figure came out `-72 -72 61.873445 5.180553` with two paths —
every other TikZ figure grew by the border too, `cache-probe
first=engine second=cache`. Clew's 494 tests green; nothing in Clew's
own source changed. The manual (`diagrams.html`) explains the
classic-tip fact in the TikZ section and says the border is kept in the
SVG.

**v0.2.1 is now PUBLISHED** (later on 09-17, with the LuaTeX rule fix
folded in — §2d); the manifest is pinned to the published asset.

**Unverified**: the upgrade from a version-2 IndexedDB in a real,
already-used profile (the code path is `onupgradeneeded` → delete store
→ recreate; read, not exercised — the smoke profiles were fresh). If
the owner's vault still shows the old crop after the rebuild, that is
where to look.

### 2c. The `::` decision: description lists win, inline fields dropped (09-17)

`Key:: value` was both Dataview's inline field (read by Clew's queries)
and jmarkdown's description list (`Term:: definition`, rendered by the
engine's `dt_rule`, which claims everything before a `::` as the term —
so `the essay scored [grade:: 71] overall.` rendered as a definition
whose term was the half-sentence). A line cannot be both. **The owner
chose description lists**, dropping inline fields outright: "we have
another syntax for variable setting" — frontmatter, shown and edited in
prose by Meta Bind's `INPUT[…]` / `VIEW[…]` widgets where wanted.

What changed (all in this tree, uncommitted):

- `engine/query-fences.js`: `readInlineFields` and its regexes deleted;
  the scan reads frontmatter only, every edit source is `fm`. Header
  comment records the decision and the why.
- `engine/vault-model.js` (Dataview, dataviewjs, Bases share it): same.
- `renderer/commands/actions.js#editNoteField`: the `line:N` branch
  (rewrite a `Key:: value` line in place — the most fragile write path
  in the app, with its "stale line" failures) is gone; `fm` and `block`
  remain.
- Guard: `tests/dataview.test.js` "a Key:: line is a description list,
  not a field" — the fixture keeps `Effort:: 12` bodies and asserts no
  field is read while frontmatter still answers. The old inline-field
  unit test is deleted (hence 493).
- Vaults: the demo `Features/Queries.md` explains it and SHOWS a
  `Rating::` line rendering as a description list; the study vault's
  `Reading/Signals.md` moved `chapter` into frontmatter (nothing there
  queried it); `Guide/Obsidian Compatibility.md` refuses inline fields
  by name. CLAUDE.md: "do not reintroduce".
- Smoke: `smoke/dl-scenario.js` + `dl-frame.js` — verified `dt="mark"
  dd="65"`, the bracketed sentence becomes a term (`prose-intact=false`,
  the documented cost), and a query table over the vault shows an EMPTY
  `mark` cell. Screenshot eyeballed.
- Manual: `properties.html` §"Why there are no inline fields" (with the
  exact mangled rendering so nobody files it as a bug), `queries.html`,
  `dialect.html` (its description-list entry now describes the engine's
  real `Term:: definition` syntax — it had described a `: definition`
  form the engine does not have), `index.html`, `introduction.html`;
  og tags regenerated (`node apply-og.js site`); links clean.

**A body-resident field under some other syntax? Asked, answered: not
worth it.** The gap left is only "the canonical text of a value lives
inside a sentence"; `VIEW[{chapter}]` / `INPUT[number:chapter]` already
put the value in the prose. The costs are a second source of truth
(merge rules, the line-rewrite path just deleted) and another sigil,
and it would not help migrating Dataview vaults, whose data is written
as `::` and needs converting either way. If real demand appears, the
better answer is a one-shot "move inline fields into frontmatter"
command — and only when a real vault asks (the owner's own rule). If a
value ever truly must live in a sentence, the dialect's inline
directive form (`@field[chapter=5]`) is the shape that cannot collide.

### 2d. Fence highlighting, ```latex / ```tex, and `show=` (09-17 evening)

The owner asked for three things: syntax highlighting for the ```tikz and
```metapost fences in the editor; ```latex and ```tex fences typeset by
LuaTeX and shown as SVG, highlighted too; and an opening-line option that
says whether a fence is typeset or displayed as code. The design:

- **`show=figure|code|both`** on every block (the four fences, `:::TiKZ`,
  both environments), the bare words `code` / `both` / `figure` meaning
  the same. `code` displays a highlighted code block and typesets
  nothing; `both` is the code THEN the figure (source above result).
  Implementation is the point: the code block is marked's OWN `code`
  token — a fence tokenizer returns one outright for `code`, and attaches
  one as a child (`token.tokens`) for `both`; the environments switched
  from mode `'verbatim'` to `'custom'`, whose `tokenize` hook runs in
  the lexer and attaches the same child. So marked-highlight's walkTokens
  pass highlights it like any fence and the engine's source-position pass
  stamps it (`line=97/103/109` in the smoke). The one thing added to that
  pass is a **MetaPost grammar for highlight.js** (it has none), built
  from `src/engine/metapost-words.js` and registered on the ENGINE's
  highlight.js by `createRequire(process.argv[1])` — the worker script,
  whose node_modules hold the engine's deps in dev and packaged alike;
  measured that ESM and CJS loads of highlight.js share one instance.
  Unreachable (some other host) → plain-text MetaPost, never a failed
  render.
- **```latex**: a snippet is wrapped by Clew (not the library, whose
  wrapper makes a tikzpicture) in `\documentclass[varwidth,border=2pt]
  {standalone}` + `amsmath,amssymb`, engine `lualatex`; a body with
  `\documentclass` is a complete document, typeset as written, one SVG
  per page (`.clew-doc` stacks them). `packages=`/`preamble=`/`border=`
  are consumed into the document and NOT emitted as data-* (the library
  ignores them on a complete document anyway; emitting them would only
  change the hash). Measured: the snippet's viewBox is 343pt wide — the
  varwidth line — and paragraphs wrap there; LuaLaTeX 270 ms vs pdfTeX
  131 ms per short snippet in Node.
- **```tex**: plain TeX, `\bye` appended if absent, `\nopagenumbers`
  prepended ALWAYS (without it a one-line snippet was 663pt tall: text at
  the top, folio at the bottom, the crop spanning the page — first smoke
  run, screenshot). A ```tex body saying `\documentclass` is treated as
  LaTeX (engine lualatex) rather than dying on an undefined command.
  On plain LuaTeX, as asked — after a detour: see the library bug below.
- **Editor**: `renderer/editor/langs/` — `tex-mode.js` and
  `metapost-mode.js` are pure StreamLanguage specs (tested under node
  with CodeMirror's own StringStream), `fence-languages.js` is
  lang-markdown's `codeLanguages` hook (`tikz`/`latex`/`tex` → TeX,
  `metapost` → MetaPost, anything else → plain as before). theme.js maps
  the lezer tags onto the overlay's `jmd-*` classes so mermaid bodies and
  these fences share one palette. The MetaPost mode imports the SAME word
  lists the engine grammar uses (the block-refs/block-ids arrangement),
  and hands `btex … etex` to the TeX tokenizer.
- Vaults: `Features/Diagrams.md` gained "Showing the source instead"
  (a `both` example) and "LaTeX and plain TeX, too" (Maxwell in an
  align; a plain `\centerline`); Reading Mode + Editing guides mention
  it. Manual: `diagrams.html` §LaTeX and plain TeX, §Showing the source
  instead, both tables, the export/Obsidian notes; `editing.html`
  highlighting list; `reading-mode.html`, `index.html`; og regenerated,
  links clean.
- Smoke: `make-figures-vault.mjs` grew the new fences + all three
  `show=` shapes in Figures.md and a one-viewport `Highlight.md`;
  `figures-frame.js` reports `doc engine=…` and every `pre > code`
  (lang, hljs span count, source line, next sibling); NEW
  `fence-highlight-scenario.js` counts the faces in `.cm-content` and
  prints the spans of five lines. Both runs green, both screenshots
  eyeballed (README rows carry the assertions).

**The library bug — FIXED upstream and re-pinned (09-17, later).** What
Clew saw as "plain LuaTeX traps on any math" was, on the library side
(commit 5e514df), EVERY DVI rule trapping under BOTH LuaTeX formats: a
call-arity mismatch in LuaTeX's back-end dispatch table (the DVI rule
slot takes three arguments, its caller passes four) that native C
tolerates and wasm's call_indirect does not. `\sqrt` and `\hrule` under
luatex, `\frac` and `\underline` under lualatex — so the demo's Maxwell
`\frac` would have failed too. The owner fixed it with the library's
first luatex patch and published v0.2.1 from it; Clew's manifest is
re-pinned to the published asset (sha256 5ddff636…, 37,205,263 bytes,
both confirmed with `gh release view`), ```tex is back on `luatex`, and
the smoke fixture's LaTeX snippet gained a `\frac` so the rule case is
guarded here as well as there. Lesson filed under §7: my diagnosis
("math") was the symptom I happened to test, not the cause — the
construct matrix upstream found it.

**Page numbers (09-17, later still) — a feature, by the owner's decision.**
The owner's complete `article` rendered, and the paragraph after it
"wasn't shown": the SVG was 572pt tall — text at the top, the folio at
the page foot, dvisvgm's tight crop spanning the two — so the next
paragraph sat below the fold. I injected `\pagestyle{empty}` at
\begin{document}; the owner rolled it back: someone wanting pages as
pages must get them, "this is a feature, not a bug, and the user has to
learn about it". So a complete document is typeset EXACTLY as written,
and the manual's LaTeX section teaches the consequence and the
`\pagestyle{empty}` / `\thispagestyle{empty}` remedy. Measured while it
was in: 572.8pt → 110pt with the hook; the same with an explicit
`\pagestyle{empty}`. (Plain TeX's `\nopagenumbers` in wrapTex is the
analogous tweak and is still in — flagged to the owner.) The smoke
fixture's article says `\pagestyle{empty}` itself, and the frame script
reports each document's `next=` and `gap=`.

Gotchas earned here:

- **A tall empty SVG hides the next paragraph below the fold**, and the
  report reads "text after the block is not shown". An article's folio
  was this. The frame script now reports the gap to the next element for
  documents; the behaviour itself is documented, not prevented.
- **A restored per-vault workspace tab is NAVIGATED in place, mode and
  all** (`tree.js#openPath`): the editor smoke opened `Highlight.md` in
  reading mode because figures-scenario had left a reading tab in the
  fixture's `.clew/`. `newTab: true` (and `rm -rf <vault>/.clew` between
  runs) — the first screenshot was a fine reading-mode eyeball of the
  note, and a wrong test.
- The bake needs nothing for the new fences: `renderFigure` reads
  `engine` off the element, and the site export's worker cwd is the
  vault's `.clew/engine/`, so the render service's config (with the new
  `latexFence, texFence` entry) is what it loads too.

### Measured, on this machine

- Cold, fresh userData: engines + 259 TeX files fetched, then TikZ
  figures 195 / 144 / 242 ms, MetaPost 34 ms (one batched TeX label
  run) and 2 ms. The demo vault's real figures: the 3D BJPS scene
  364 ms / 220 paths, the `boxes` flowchart 46 ms / 50 paths.
- The result cache survives an app restart (`cache-probe first=cache` on
  a second run over the same `CLEW_USER_DATA`).
- **No measurable memory cost**: 715 MB total across processes with five
  figures rendered vs 745 MB on a note with none (same vault, same
  window) — the difference is noise at this scale.
- Graph drawing works: LuaTeX is fetched on demand (12 MB more) over
  `clew-preview://` and lays out a `\graph[layered layout]` (20 paths).

### Gotchas earned here (they generalise)

- **MathJax will eat a figure's source.** Until the library typesets it,
  the source sits in the document as text, full of `$…$`. MathJax
  typesets the whole document and claimed it first, leaving `mpw-ok`
  with zero paths and a 0×0 SVG. The elements now carry MathJax's own
  default opt-out class, `mathjax_ignore`.
- **`String.matchAll` COPIES `lastIndex`** from the `/g/` regex it is
  given, so a shared regex constant plus a `test()` made the bake skip
  the FIRST figure on every page (it shipped its own source as text —
  caught by eyeballing the exported HTML, not by the green log line).
  Fresh regex per scan; `figureMatches` is exported so a unit test holds
  the line.
- **marked offers a block tokenizer the current position whatever
  `start()` said**, so a fence pattern must bound its language name:
  the first version claimed ```` ```tikzcd ```` and read "cd" as an info
  string.
- **Both halves of the morph guard are needed.** `auto.js` typesets an
  element once (a WeakSet), and client.js keeps custom elements across a
  re-render: the naive arrangement freezes an edited figure at its old
  picture, and the naive fix throws a rendered SVG away on every
  keystroke. A stale element is swapped for a fresh CLONE *after* the
  morph walk (mutating the tree mid-walk strands morphdom's sibling
  pointers).
- **One missing `\usetikzlibrary` takes the WHOLE figure down**, so a
  library the directives preload but the bundle lacks breaks every
  `:::TiKZ` figure in every vault, not just the ones using it. That was
  `calligraphy` — which turned out not to be a package at all but part of
  **spath3** (Stacey's soft-paths bundle, 284 KB, four files, its own only
  dependency). **Fixed upstream in the same session** (see §2a);
  `UNBUNDLED_TIKZ_LIBRARIES` is now empty, and there are two guards so it
  cannot regress silently: `tests/figures.test.js` compares the staged
  bundle against that set, and `stage-mptikz.js` re-checks after staging —
  a warning normally, a REFUSAL under `--require` (packaging), which is
  what catches the nasty case of a master that has the library and a
  pinned release that does not.
- The Emscripten glue **throws** on a fatal rather than exiting (good:
  in-process baking cannot kill main) but sets `process.exitCode` on the
  way, which the bake saves and puts back.
- `figure-bake.js` stays **importable without electron** (its scan is
  unit-tested under plain node), so the assets dir is passed in by the
  caller — the plugins.js arrangement.
- **Resource Timing records nothing for a custom scheme** (measured), so
  asset-load instrumentation in a preview document is not available that
  way.

## 3. Small residue (none blocks anything)

New this session:

- `data-source-line` is NOT stamped on the fence figures (the
  `@begin(metapost)` one gets it). Engine-side stamping, pre-existing for
  fences — a demo-vault mermaid fence shows the same asymmetry — so
  scroll sync lands on the nearest stamped element above. Not chased.
- A hand-written `<script type="text/tikz">` in a note's raw HTML
  renders in the app (the library accepts that form) but is NOT baked by
  the site export, which scans only the two elements Clew emits.
- A single-note **HTML** export still takes the native path (own config,
  own TeX, the `TiKZ/` folders) — documented in the manual as the one
  place those folders still matter.
- `site/index.html`'s Clew-iOS paragraph said TikZ/MetaPost "shell out
  to external toolchains"; I narrowed it to Mathematica + LaTeX export
  and added that the desktop now typesets in wasm, so they are "a port
  away". **A roadmap-ish sentence about another repo — reword or drop it
  if you'd rather not imply it.**
- `libraries`/`packages`/`border`/`gdlibraries`/… are not offered by any
  completion; the manual's attribute table is the reference.
- **The engine's HTML pretty-printer REWRITES a figure's source** on
  its way into the element: every line re-indented to the element's
  depth (six spaces in the owner's note) and right-trimmed, so `… {$\alpha$} -- `
  arrived as `… {$\alpha$} --`. Harmless for TeX today, and consistent
  between the browser and the site-export bake (both read the same
  HTML) — but the bytes the engines typeset are NOT the bytes in the
  note, and every figure hash is a function of the pretty-printer. A
  figure language that cares about trailing whitespace would bite.
  Verified in the owner's vault and a local repro; found while chasing
  §2b. An engine-side question for the jmarkdown master.

- `:::TiKZ` / `@begin(TiKZ)` / `@begin(metapost)` BODIES are still the
  overlay's uniform `jmd-embedded` face in the editor: only FENCES got
  grammars (the ask). The stream tokenizers take a StringStream, so
  running them over directive bodies from the overlay is a small follow-up
  if wanted.
- A wrapped ```latex snippet's line width is standalone's `\linewidth`
  (345pt) — no knob; a complete document sets its own.
- `show=` is the preview's only: a LaTeX export of `@begin(TiKZ){show=code}`
  still draws the picture (the native handler ignores the attribute).
- The library's element for a LaTeX document is still `<tikz-diagram>`
  (it has only two elements) — the "rendering TikZ…" status text shows
  while a ```latex snippet typesets. Cosmetic; an upstream
  `<latex-document>` element would fix the name.

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

## 4. Manual facts — done

The two Queries-chapter facts (`FROM` relative to the vault root; `WHERE
field` is truthiness, `isnotempty()` is the guard) are in
`queries.html`'s Dataview section as of 09-17, with the `= null` fact.

## 5. Owner's own actions

The GoDaddy DNS change (A records for clew-app.com/.net →
144.126.236.254), then in Clew-docs `make dns-check` → `provision` →
`sync` → `tls`. Plus the win/linux VM run if those artefacts are to ship,
and the Sifr/small-icons verdict (still untried; the two reverts are in
git history). New: **publish mp-tikz-wasm 0.2.1.** The library has three
local commits (a2a9795 spath3, adbd53b the crop fix, aac75ff Release
0.2.1), untagged and unpushed, its archives built in `release/` and the
notes in `release/notes-0.2.1.md`; its HANDOVER has the exact commands.
`src/shared/mptikz-manifest.json` is ALREADY pinned to that tarball
(sha256 2c3035…, 37,203,244 bytes) and the pinned path was exercised
offline: with the master hidden, `stage-mptikz.js --require` verified the
digest, unpacked it and passed the library check. So upload exactly that
file, then confirm with `gh release view v0.2.1 --json assets`; a
rebuilt archive means a re-pin (the manifest comment says so). Until
published, a machine without the master cannot stage at all (download
404) — before, it staged a build that cropped arrowheads. Also the
library's website wants a restage (its tags page still serves the old
crops), and a re-measure of the DMG now that ~37 MB of engines ride
along. Then **commit this tree and Clew-docs** (the split in §0) and
deploy the manual (`make sync` there): the properties and queries
chapters currently on the site still promise inline fields.

## 6. The owner works in this tree concurrently

Tree left DIRTY on 2026-09-17 (see §0) at `e4959d1`; Clew-docs dirty at
`bbd7310` (index, introduction, dialect, diagrams, export, properties,
publishing, queries, reading-mode, plus the site's index). `zeta-assets/`
and `mptikz-assets/` here are deliberate and gitignored; the library's
`release/` too. `out/` holds mac/win/linux artefacts from 09-02. Never
switch THIS tree off main. Live testing flips demo widgets — reset
`status:`/`done:`/`^motto` baselines, and the foldable embed in
`Guide/Links and Embeds.md`, before committing demo files.

## 7. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- Always pass `CLEW_SMOKE_VAULT`; `git status` demo and study vaults
  after every smoke run. `CLEW_USER_DATA` isolates a run entirely.
- Long smoke runs go `run_in_background` with output to a file — and
  NOT inside a `( … ) &` subshell, which the harness kills on return.
- Reusable scenarios live in `smoke/` — extend it, don't rewrite them in
  scratchpads. Three new pairs plus `make-figures-vault.mjs` landed
  there across these sessions; the README table carries the
  per-scenario assertions.
- **The owner's bug reports have been consistently right.**
- **Write assertions that can fail — and eyeball the artefact anyway.**
  Twice more this session: the unbaked first figure on an exported page,
  and a figure that reported `mpw-ok` with nothing in it, were both
  caught by looking.
- **A measured symptom is not a cause.** "Plain LuaTeX traps on math"
  was true of every document tried and wrong as a diagnosis: the trap was
  every DVI rule, under both formats (§2d). Vary the construct, not just
  the document, before naming the fault.
- **Prefer measuring to guessing — and re-measure before believing a
  diagnosis.** A graph-drawing figure "failing" this session was a
  missing entity-decode in the throwaway test script, not in the
  pipeline.
- **Read what a measurement MEANS before filing it.** The arrowhead crop
  (§2b) was measured in the first session — "viewBox identical, 0.797pt
  tall" — and recorded as evidence the pipeline worked. A 0.8pt-tall
  box cannot hold a 4pt arrowhead; the number was the diagnosis. And
  when the owner says a picture is wrong, render it and LOOK first.
- A feature change is not finished until the MANUAL in `../Clew-docs`
  matches it — nothing in this repo's git status reminds you.
- After a smoke run over a reusable fixture, `rm -rf` its `.clew/`: the
  restored workspace otherwise shapes the next scenario (§2d).
- `npm run dev` / `npm run package` re-sync the engine AND the EmbedPDF
  viewer from their masters; packaging also stages mp-tikz-wasm
  (`npm run sync-mptikz`). Run all three + `git status` BEFORE tagging.
