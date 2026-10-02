# CLAUDE.md

Guidance for Claude Code working in the **Clew** repository.

## Project at a glance

Clew is an open-source Obsidian-style note app: Electron shell, plain-JS web
components, CodeMirror 6 editor, and the **jmarkdown** engine for
rendering. GPL-3.0-or-later.

**Engine vendoring:** the golden master lives at
`~/Sites/jmckalex/software/jmarkdown` (branch `at-migration`) and is the
ONLY place the engine is edited. `vendor/jmarkdown/` is a committed dumb
mirror (src + package.json + lockfile), overwritten wholesale by
`npm run sync-engine` (scripts/vendor-jmarkdown.js) — `npm run dev` and
packaging re-sync automatically when the master exists; other machines
build from the committed mirror. NEVER edit vendor/ by hand; engine
changes go upstream to the master, then re-sync.

**Session state, recent work, and open items live in `HANDOVER.md`** —
read it first. The full design plan (architecture rationale, milestones,
engine embedding facts, risks) lives at
`~/.claude/plans/groovy-forging-shell.md`. `demo-vault/` is both the
documentation (a Welcome hub + `Guide/` notes) and the test corpus — every
guide note exercises the features it documents. `study-vault/` is a second
demo vault staged as an academic term: the worked example of the writable
database (queries/kanban/tasks) — keep it working.

**The website and the manual are NOT in this repo.** They live in the
sibling `../Clew-docs` (its own git repo, deployed to a DigitalOcean
droplet by its Makefile) because they document Clew rather than this
particular implementation — `../Clew-iOS` has equal claim on them. Two
consequences: `scripts/make-icon.js` writes the site's icon files across
that boundary, guarded by `existsSync` so a lone Clew-app clone still
builds; and **a feature change here is not finished until the manual
there matches it** — nothing in this repo's `git status` will remind you
any more. The manual documents split behaviour, citations, panels, the
note API, plugins, and every settings key.

- **House style:** plain JavaScript ES modules + web components. No
  frameworks, no TypeScript. Tabs for indentation. Small hand-rolled
  utilities over dependencies.
- **Build:** esbuild via `scripts/build.js` — five bundles (main ESM,
  preload CJS, renderer, preview-client, preview api) plus verbatim copies
  of `styles/`, `index.html`, and `src/engine/`. `npm run dev` = engine
  sync + esbuild watch + Electron; renderer rebuilds hot-reload the window,
  main/preload rebuilds respawn Electron.
- **Packaging:** `npm run package` (mac dir) / `npm run package:dmg` /
  `npm run package:win` (NSIS x64) / `npm run package:linux` (AppImage +
  deb x64) — scripts/package.js → electron-builder, config in package.json
  `build`; win/linux cross-build from macOS but are untested at runtime.
  Key facts: the asar carries ONLY dist/ + package.json (everything is
  esbuild-bundled); the engine worker is a plain-node fork that cannot read
  asar, so the vendored engine + its staged production node_modules
  (build-engine/, installed with --legacy-peer-deps), the engine assets,
  and the preview assets (mathjax etc.) ship unpacked under Resources/ via
  extraResources — except the engine's node_modules, which electron-builder
  refuses to copy and scripts/after-pack.cjs copies instead. The demo vault
  ships the same way (Resources/demo-vault, `.clew/` stripped to
  vault-settings + plugins); `main.js#openDemoVault` copies it to
  `~/Documents/Clew Demo Vault` on first use (bundle is read-only payload)
  and the welcome screen / Help menu route through it. Dev-vs-packaged
  locations are decided ONCE in `src/main/paths.js`; new main-process file
  dependencies must go through it. `CLEW_USER_DATA` (honored at the top of
  paths.js, the only import-time userData reader) points the app at an
  alternate userData dir — how a fresh install is simulated. Icon: scripts/make-icon.js renders
  build-resources/icon.svg → icns (committed). `--sign` uses the Developer
  ID identity; `--notarize` implies it and REQUIRES `--dmg` (the ticket
  staples to the image, and the .app inside is stapled first, so a dragged
  copy launches offline). A signed build is not proved by `codesign
  --verify` — boot the PACKAGED binary under CLEW_SMOKE and check a
  ```latex figure typesets (`smoke/boot-test.sh`, which refuses a busy
  machine rather than run on one), because the hardened runtime is what breaks the
  forked worker or the wasm (entitlements.mac.plist says which entitlement
  carries which).
- **Tests:** `npm test` (`node --test`, files in `tests/`): workspace tree,
  note-metadata extractor, BibTeX parser, the ported jmarkdown-scan suite,
  canvas model, diary, frontmatter, plugins discovery, query/leaflet/exif
  parsers, Excalidraw round-trip, markdown tables, callouts, block
  references, Dataview/Bases/dataviewjs, office-tab layout rules, the
  embed graph and the embed keyword syntax, the shell sessions, the watch order, the
  dialect scanner's constructs and grammar, live edit's model, reveal rule,
  inline renderer and toolbar state/layout, format toggling, the `//` menu, link hover previews, the preview pane's targets, cross-reference numbering and completion, citations, PDF annotation notes, headerless tables (with parity against the engine's tokenizer), the caller token, the message guard, tabbing (parser, layout, LaTeX), PDF frame rewriting, the vault-trust store — 903 tests. DOM/UI work is
  verified with the smoke harness.
- **Smoke harness:** `CLEW_SMOKE=/path/out.png CLEW_SMOKE_SCRIPT=scenario.js
  [CLEW_SMOKE_FRAME_SCRIPT=frame.js [CLEW_SMOKE_FRAME_MATCH=substr]]
  [CLEW_SMOKE_VAULT=/path/vault] electron .` — SMOKE_VAULT opens exactly that vault, never touching the
  user's restored vault set (always pass it). Boots the app — WAITING for
  the first window and its page (`smoke-boot: window after … ms, page
  loaded after … ms`; at least the old 3 s, at most 120 s with an error
  naming the step), because a fixed 3 s failed on a loaded machine — runs the
  scenario in the renderer (dev hook `window.__clew` exposes the stores,
  registry, ipc), optionally drives the preview iframe's document via
  webFrameMain (with FRAME_MATCH: EVERY clew-preview frame whose URL
  contains the substring, in turn — live edit's `__clew_block__` frames —
  the script seeing `SMOKE_FRAME`, the URL's last segment, to tag its
  lines), screenshots, and exits HARD (`app.exit` after flushing
  editors — the office close guards would otherwise hang the harness on
  their own success). Runs are INVISIBLE (2026-09-29): no window shown, no
  focus taken, no Dock icon; CDP focus emulation tells the page it has
  focus, and the harness's keys never reach the native menu (every ⌘ chord
  used to open "About Electron"). More knobs, all documented in main.js:
  `CLEW_SMOKE_VISIBLE=1` (show the window, to watch a run),
  `CLEW_SMOKE_LOG=1` (every console line), `CLEW_SMOKE_ALLOW_STALE=1` (run
  on a `dist/` built from other sources — by default the harness REFUSES,
  naming the changed files: `src/main/build-stamp.js`, `dist/
  build-stamp.json`, `scripts/stale-check.mjs`, which the sweeps and
  boot-test.sh call first), `CLEW_SMOKE_METRICS=/p.json`
  (app.getAppMetrics), `CLEW_SMOKE_CONFIRM=save|discard|cancel` (answers
  the office Save/Discard/Cancel dialog without UI),
  `CLEW_SMOKE_CLOSE_WINDOW=1` (drives a real window close; logs
  `smoke-windows: N`), `CLEW_SMOKE_CLIPBOARD=1` (+`__clewSmokeClipboard`
  preload), `CLEW_SMOKE_MENU=1` (the application menu as the OS holds it,
  one `smoke-menu:` line per item with its accelerator and enablement,
  a checked item ending ` ✓` —
  a native menu is an OS-level window that capturePage cannot see, so
  this is the only assertion a menu change can carry;
  `CLEW_SMOKE_MENU_CLICK='Window > Alpha'` then clicks that real item and
  dumps its menu again as `smoke-menu-after:`, and with
  `CLEW_SMOKE_CLOSE_WINDOW` the Window menu is dumped once more after the
  close as `smoke-menu-closed:`), and REAL input:
  a scenario queues `window.__clewSmokeInput =
  [{click:{x,y}} | {tripleClick:{x,y}} | {move:{x,y}} | {text:'abc'} |
  {combo:{key,modifiers,text?}} | {wait:ms} | {frameClick:{match,selector}}
  | {click:{selector}} | {move:{selector}}]` (the last two resolve an
  app-page element when their turn comes — a popover's button, a pill after
  a re-layout; resolved points are never written back into the queued
  event, which a scenario may queue more than once)
  (`move` is a bare pointer move — hover; `modifiers` on it makes a
  ⌘-hover; a combo's `text` makes the key TYPE, as a real one does — a real
  Enter carries `"\r"`, which is what puts a newline in a textarea, and the
  default, text-less key inserts nothing; `frameClick` clicks the centre of an element INSIDE a preview
  frame whose URL contains `match` — cross-origin, so the scenario cannot
  measure it — resolved at dispatch time), dispatched over CDP
  `Input.dispatch*` — `webContents.sendInputEvent` NEVER reaches OOPIFs
  (i.e. every preview iframe), and combos need real modifier keydowns
  around the letter. Each key carries a REAL `keyCode`, because xterm —
  like anything reading the legacy field rather than `key` — sees nothing
  otherwise: named keys from a table (Enter 13, arrows, …) and punctuation
  from its US-layout key, NOT its charCode (`-` is 189; 45 is Insert, which
  is what the terminal read it as, silently dropping every hyphen typed —
  measured 2026-09-25). Anything unlisted gets 0, so a library falls
  through to `key`. Use it for every UI change. Reusable scenarios and
  the big-vault generator live in `smoke/` (its README has the recipes
  and the 5k-note baseline numbers) — extend that folder instead of
  rewriting scenarios in session scratchpads.

## Architecture (three processes + render workers)

**Multi-window: one window = one vault = one `VaultSession`**
(`src/main/session.js`): each session owns its own VaultManager, Indexer,
RenderService, KvStore, and SearchService and sends events only to its
window. IPC handlers resolve the sender's session (`sessionFor`); never
reintroduce vault singletons. Opening a vault (`main.js#openVaultAnywhere`)
focuses the window that already has it, fills a vaultless window, else
creates a new one — the same vault is never open twice. `settings.
openVaults` restores every window at launch. The one macOS menu tracks the
FOCUSED window (per-session state in menu.js; rebuilt on
browser-window-focus) — or, with none focused, the one focused LAST
(`session.lastFocusedAt`), not the newest. The **Window menu lists every
open window** by vault name plus its active tab (`menu.js#windowItems`; the
owner's ask 2026-10-01), the focused one checked, choosing one bringing it
forward (`main.js#focusWindow`). It is the same list on every platform and
deliberately NOT role `windowMenu`: every native window title is "Clew" (the
title bar is drawn by the page), so macOS's automatic list said nothing.

- `src/main/` — `main.js` (windows + vault orchestration, guards, smoke
  hook — captures every window), `session.js` (per-window services),
  `vault.js` (vault manager, chokidar watcher, file ops, attachment saving,
  `.clew/` state) — **the watcher lives inside a descriptor BUDGET**
  (`fs-utils.js#watchFilter`, `WATCH_BUDGET`, process-wide because every
  window has a watcher and the ceiling is per process): it holds one open
  descriptor per watched FILE, and past ~10,240 held descriptors libuv
  cannot fork at all, which kills the render worker with `spawn EBADF`
  (measured 2026-09-25 on the owner's ph341 vault: five folders symlinking
  one 309 MB reveal.js tree, 100,169 descriptors, reading mode dead).
  chokidar has no cycle guard, so the duplicate symlinked dirs the vault
  walk already skips (`shouldRecurse`) are handed to the filter as well;
  past the budget it stops and says so — `console.warn` plus
  `EV_WATCH_CAPPED` → a notice in the window (and `vaults.info.watchCap`,
  for the window that reloads after the scan settled). **WHAT the budget
  buys is decided before chokidar walks** (`watchOrder`/`watchPlan`, owner's
  policy 2026-09-25), because the budget alone was not enough: chokidar
  takes what it meets, so ph226-426 watched SIX of its 81 notes and spent
  the rest inside a font icon set. Three tiers — notes (`.md`/`.jmd`), then
  the documents Clew EDITS (canvas/base/bib/pdf/office/excalidraw, via
  `shared/file-types.js`, which moved out of `renderer/lib/` so main and the
  renderer share one idea of what a file is), then everything else
  breadth-first. Images are deliberately NOT a tier: 20,000 icon `.svg`s are
  20,000 images, and depth already tells a vault's own attachments
  (`Attachments/x.png`) from a vendored library (`x/libs/…/svgs/…`). The
  plan claims each file WITH its ancestor dirs (chokidar cannot descend into
  an ignored dir), and `watchFilter` honours it during the scan only —
  after `ready` the budget alone applies, or a file created in the session
  would be in no plan and never watched. The budget bounds the INITIAL
  SCAN only: after chokidar's `ready` the gate reopens to `WATCH_CEILING`,
  because a spent budget otherwise makes the watcher blind to every NEW
  file for the life of the session — which is how a capped vault stopped
  showing notes the user had just created (2026-09-25). And Clew's own file
  operations never wait for the watcher at all: createNote/createFolder/
  rename/trash call `vaults.refreshTree()`, which is both immediate and
  immune to a spent budget — and so does EVERY Clew write of a new file
  (2026-09-30, the owner's PDF exported into ph341 and invisible for 6+
  minutes): `writeNote` when the file is new, `saveAttachment`, the
  kv-store's first clewdata.json, and `vaults.refreshIfInside(abs)` after a
  note export, a site export or a canvas PNG lands wherever the user chose.
  A new writer of vault files does the same. **Across windows**
  (2026-09-30, measured by `smoke/watch-repro.mjs`): a window's SCAN takes
  only its share of what is left (`fs-utils.js#scanShare`: all but 2,000,
  never more than half past that — 6,000 for the first window of a process,
  then 1,000, 500, …), because first-come took everything and a second
  window's vault went unwatched; and after `ready` a path the scan KNEW
  (`knownPaths`: its files and their folders) is refused free, because
  chokidar re-asks about every entry of a folder on each event — buying the
  old ones emitted ~1,000 spurious `add`s and spent the ceiling's headroom,
  after which no window saw a new file. Only genuinely new paths spend it.
  `CLEW_WATCH_BUDGET=<n>`
  (scenarios only) forces both numbers low, i.e. a blind watcher
  (`smoke/export-refresh-scenario.js`). The rules are applied to the
  vault-RELATIVE path: testing the absolute one ignored every file in a
  vault that merely lived under a dot-directory, `indexer.js` (the metadata cache: extractor over every
  note, link resolution, incremental patches, `embeddersOf()` — who
  transcludes a path, transitively), `render-service.js` (one-shot
  warm jmarkdown workers — see below — plus `toolchainPath()`, which extends
  PATH with TeX/homebrew dirs), `protocol.js` (`clew-preview://`),
  `search.js`, `export.js` (HTML/LaTeX/PDF via the engine, plus the
  reading-view PDF), `print-pdf.js` (that PDF: the note's own
  clew-preview:// document printed from a hidden window — no TeX, and
  what the screen shows; polls MathJax/fonts/mermaid before printing),
  `rename-links.js`
  (vault-wide wikilink rewriting), `settings.js` (app-global), `ipc.js`
  (every handler; channel names in `src/shared/channels.js`).
- `src/preload/preload.cjs` — the entire bridge: `window.clew.{invoke,on}`,
  restricted to `clew:*` channels.
- `src/shared/` — `channels.js`, `note-metadata.js` (regex-level extraction;
  NEVER the engine), `bib.js` (BibTeX fields for citation completion),
  `frontmatter.js` (properties parse/serialize — a deliberate YAML subset;
  blocks it can't fully parse are flagged `clean: false` and MUST be
  treated read-only; a value holding a newline or tab is written
  double-quoted with `\n`/`\t` escapes, decoded on read — here and in the
  engine's `query-fences.js#clean` — because written bare its second line
  made the block unclean and every later edit of the note was refused, which
  is what a Meta Bind textArea did until 2026-09-30).
- `src/engine/` — assets the render worker loads: `wikilinks.js` (Obsidian
  links/embeds incl. media + image sizes; SITE_EXPORT branch emits real
  hrefs; the `|external` alias emits `data-open-external` — the OS default
  app instead of a Clew tab, guarded in `main/open-file.js#planOpen`,
  which is electron-free so its refusals are unit-tested (the file
  explorer's "Open in Default App" takes the same route,
  `actions.openFileExternally`; `SHELL_OPEN_PATH` awaits `shell.openPath`
  and returns the OS's own failure — "no app for the type" — as a notice,
  and under CLEW_SMOKE logs `smoke-open-path: <abs>` instead of launching); `file://` links
  route to the same guard, executables refused BY NAME; note embeds carry
  two independent mode keywords on the alias tail — `|collapsed`/`|open`
  for the fold, `|quiet`/`|bare` for how much frame is drawn — parsed and
  written by `embed-state.js`, which the RENDERER imports too so the
  reader and the writer of the syntax cannot drift, the same arrangement
  as block-refs.js/block-ids.js), `obsidian-fences.js` (```mermaid + ```leaflet maps incl. photo
  maps w/ HEIC conversion), `query-fences.js` (```query/```tasks/```kanban
  + the `vault` global for script blocks), `callouts.js` (every Obsidian
  `> [!type]`, case-insensitively, incl. foldables — registered LAST so it
  is offered before the engine's own GFM-alert rule), `block-refs.js`
  (`^block-id` markers), `exif-gps.js`, `clew-template.html` (local
  assets, no CDN), `preview.css`. These may import each other but never
  src/shared (dist/engine is a verbatim copy).
- **Block references** (`[[Note#^id]]`, `![[Note#^id]]`): the marker rule
  claims the WHITESPACE before the caret, because `^` is TeX superscript
  in this dialect (`x^2`) and both rules would otherwise be offered the
  same offset. Tables are the one block that swallows a marker line
  anyway — `start()` clips paragraphs only — so `tableBeforeAnchor` takes
  the rows first and re-lexes them, which works because marked UNSHIFTS
  extension tokenizers and a host's load after the engine's. Ids are
  indexed by `shared/note-metadata.js` (the line to scroll to is the top
  of the block, not the marker) and written by the "Copy Link to Block"
  command (`renderer/editor/block-ids.js`), which imports its idea of a
  legal id from block-refs.js so writer and reader cannot drift.
- **Figures without a TeX install** (`src/engine/figures.js`): TikZ,
  MetaPost, LaTeX and plain TeX typeset IN the preview by the owner's
  mp-tikz-wasm (staged by `scripts/stage-mptikz.js` from the pin in
  `shared/mptikz-manifest.json`; `paths.js#mptikzAssets`). Six syntaxes —
  ```tikz / ```metapost (Obsidian's TikZJax shape), ```latex / ```tex
  (Clew's), `:::TiKZ`, `@begin(TiKZ)` / `@begin(metapost)` — emit
  `<tikz-diagram>` / `<metapost-diagram>` holding the source as TEXT
  (`mathjax_ignore`, or MathJax eats it); `preview-client/figures.js`
  loads the library's `auto.js` and owns the morph guard;
  `main/figure-bake.js` typesets for site export. The fences and the
  directive are marked extensions loaded after the engine's own, the
  environments are `Environments` config entries in 'custom' mode, so a
  LaTeX export (user's own config) never sees this file. A ```latex
  snippet is wrapped in `standalone` + `varwidth` and runs on LuaLaTeX; a
  complete document (`\documentclass`) is typeset as written, one SVG per
  page; ```tex runs on plain LuaTeX (needs 0.2.1 or later as PUBLISHED —
  before 0.2.1's LuaTeX rule fix every DVI rule trapped the wasm module under both
  LuaTeX formats). Every block takes
  `show=figure|code|both` (bare `code`/`both` too): code is marked's OWN
  `code` token (returned outright, or attached as a child token), so it
  goes through the same highlight.js pass as any fence; the one addition
  is a MetaPost grammar, registered on the ENGINE's highlight.js by
  resolving from the worker script (`process.argv[1]`), with the word
  lists in `engine/metapost-words.js` — which the editor's
  `renderer/editor/langs/metapost-mode.js` imports too, so the preview
  and the source pane cannot drift (`langs/tex-mode.js` is the TeX
  side; `langs/fence-languages.js` is lang-markdown's `codeLanguages`
  hook; theme.js maps the lezer tags onto the overlay's jmd-* classes).
  **`font=note`** typesets a figure in the note's own face: the wrapper
  emits fontspec (luaotfload's `\font` for plain TeX) naming files with
  `Path=./`, forces a Lua engine and `fonts=woff2` (real `<text>` in an
  embedded subset), and marks the element `data-opentype` — also set on any
  complete document loading fontspec/unicode-math itself. That mark is
  what `preview-client/figures.js#ensureLoader` keys on: it asks auto.js
  for `+opentype` ONLY when a marked figure is on the page AND the staged
  build's `bundles/index.json` lists the bundle (a findable luaotfload
  costs every LuaTeX run ~180 ms; asking for a bundle that is not there
  fails the whole engine — 0.2.1 had none, so a build staged from it
  refuses marked figures BY NAME; the pinned 0.3.0 has it). The list is read once by auto.js, so a marked
  figure arriving later reloads the preview once. The faces come from
  `main/note-fonts.js`: extracted at app start from the machine's own font
  folder (`Avenir Next.ttc` is a COLLECTION, and a collection is garbled
  under woff2 — dvisvgm keys faces by path, not index — so the four faces
  are split into one file each; Segoe UI on Windows, static Cantarell on
  Linux; nothing is ever shipped) into `<userData>/note-fonts/`, served at
  `__clew_assets__/notefonts/`, handed to the engine by `mpTikzWasm.
  addFiles` BEFORE the loader is injected, and named to the render worker
  through `CLEW_NOTE_FONTS`. A site export bakes such figures as OUTLINES
  (`figure-bake.js`), never embedding Apple's or Microsoft's face in a
  published page. The manifest pins mp-tikz-wasm 0.3.0 (2026-09-28), the
  first release carrying the `opentype` bundle, so the feature is live on
  every machine that stages from the pin, not only where the master is
  built. The
  mptikz root is served IMMUTABLE for a year (protocol.js) and its URLs
  carry no version, so a restaged or upgraded build would be served
  stale: `main/asset-stamp.js` stamps the engines + bundle indexes + app
  version and main.js clears the default session's HTTP cache on a
  change, before any window — measured 2026-09-17, a profile kept a
  day-old luaotfload.sty.
  **`clew-fragments='math macros, colours'`** on any TeX block inserts
  NAMED preamble text, so a note's figures share one copy of the macros:
  `src/engine/tex-fragments.js` owns the names (matching ignores case and
  spacing) and the rule that a VAULT fragment shadows a GLOBAL one — the
  plugins arrangement, global in `clew-settings.json`, per-vault in
  `vault-settings.json`, both handed to the worker as CLEW_TEX_FRAGMENTS
  and resolved THERE so main never keeps a second copy of the rule. The
  renderer imports the same module for the settings rows' shadow hints
  (the metapost-words.js arrangement). `figures.js#applyTexFragments`
  places the text exactly where `font=note` places its block — after a
  complete document's own `\documentclass`, into the `preamble` attribute
  for a snippet or a tikz body, at the top of a plain-TeX source — but
  LAST, after the font block and Clew's own packages, because a fragment
  is the author's code and TeX's rule is that the last definition wins
  (a `preamble=` on the fence itself still beats it). A name nothing
  defines, or the attribute on a ```metapost block, is refused BY NAME in
  place of the figure. Editing a fragment reconfigures (a global edit
  reconfigures EVERY session); renaming one typesets nothing — identity is
  the TEXT, not the name — but leaves every figure still asking for the old
  name showing its refusal.
- **Tabbing** (`src/engine/tabbing.js`, owner's ask 2026-09-30): all of
  LaTeX's `tabbing` — ```` ```tabbing ```` fence or `@begin(tabbing)`, one
  source line a row, `|=` `|>` `|<` `|+` `|-` `|'` `` |` `` `|[` `|]` and a
  `|kill` ruler row, LaTeX's own commands accepted alongside (`\a=` etc. for
  the accents they displace). The layout is latex.ltx's (`\@settab`,
  `\@rtab`, `\@tablab`, …) as a PURE function, `layoutTabbing`, which
  `preview-client/tabbing.js` runs over measured widths (a stop depends on
  the rendered width before it; a ResizeObserver re-lays on fonts, maths,
  resize; morph keeps a block whose source key is unchanged). Pieces are
  `white-space: pre` — a trailing space is part of a width, as in TeX.
  Self-contained so the jmarkdown backport is a MOVE; the LaTeX renderer
  exists but a Clew export never loads Clew's engine extensions (export.js
  runs the user's own config), so tabbing reaches LaTeX export only once
  backported. Checked additive by `render-dump-scenario.js` (demo and study
  vaults byte-identical before and after).
- **`@reveal[…]`** (`src/engine/reveal-embed.js`, owner's ask 2026-09-25):
  a presentation as a live iframe. Registered as a named ENVIRONMENT in the
  config, which is why one entry serves `@reveal[…]`, `@reveal+[…]` and
  `@begin(reveal)` (begin-end-core.js). Two target kinds: an http(s) URL —
  the only thing that works for a deck a server GENERATES (the owner's are
  index.php behind a local Apache; a .php served from the vault would be its
  source) — and a vault path to an HTML file or a folder holding index.html,
  which goes through wikilinks.js#sitePath so it carries the session id and
  survives a site export. Anything else is refused BY NAME. Deliberately
  unsandboxed, for the reason the preview is. **The engine's attribute
  grammar severs unquoted units** — `height=300px` arrives as `{height: 300,
  px: 'px'}`, `aspect=16/9` THROWS and the engine then loses every attribute
  (measured) — so `attrsOf` glues orphaned units back and a bare number means
  px; anything with a slash must be quoted, which the manual says.
- **Custom callout types** (owner's ask 2026-10-01; Settings → Callouts):
  `callouts` lists in `clew-settings.json` (global, this Mac) and
  `vault-settings.json` (travels with the vault), `{ name, title?, icon?,
  color?, aliases? }`, merged built-in < global < vault FIELD BY FIELD.
  `shared/custom-callouts.js` owns the rules (name grammar, colours by
  grammar only — hex, rgb(), hsl(), CSS names — icons by name, a bad entry
  SKIPPED with its reason, never half-applied); `main/callout-types.js`
  resolves with the Font Awesome table (`dist/main/fa-icons.json`, written
  by scripts/build.js, 1.85 MB, read only once a definition exists — never
  on a render path) and hands the worker `CLEW_CALLOUTS` (finished entries:
  label, colour, icon PATH) and the renderer `CALLOUTS_RESOLVED`; both feed
  `engine/callouts.js#applyCustomCallouts`, whose `CALLOUT_TYPES` is a LIVE
  binding (read it when used). The colour rides on the element as
  `--clew-callout-color` (never Obsidian's `--callout-color`, an `r, g, b`
  triple in vault snippets), and preview.css / live-edit.css clamp its OKLCH
  lightness per theme — keep those two rules identical. A hand edit of the
  vault file applies live (`watchVaultCallouts`, a watch on `.clew/`).
  Editing either list reconfigures and sends `EV_CALLOUTS_CHANGED`; live
  edit rebuilds its model (`liveRebuild`, the model's cache key carries
  `calloutGeneration()`). HTML/LaTeX note exports run the user's own config
  and never see Clew's callouts, built-in or custom.
- **Obsidian's own query formats** — for opening other people's vaults,
  alongside (not replacing) Clew's `query`/`tasks`/`kanban` fences:
  `vault-model.js` (the vault as pages: `file.*`, the link graph,
  attachments as rows, cached per build), `dv-expr.js` (lexer + Pratt
  parser + evaluator — NOT eval; a method call desugars to a function
  call so ONE parser serves Dataview's `contains(a,b)` and Bases'
  `a.contains(b)`), `dv-functions.js`, `dataview.js` (```dataview DQL),
  `dataview-js.js` (```dataviewjs behind the per-vault `dataviewJs`
  flag, passed to the worker as CLEW_DATAVIEW_JS), `bases.js` (`.base`
  YAML + views; the `![[X.base#View]]` embed is dispatched from
  wikilinks.js, which is why vault-model.js must never import it).
  **What is unsupported is refused BY NAME** rather than partly run.
  `global.current_file` (set by the engine, like `global.isLatex`) is
  what makes `this` free.
- `src/preview-client/client.js` — injected into every rendered note:
  morphdom patching (guards: scripts, canvas-embed scenes, initialized
  leaflet divs, custom elements — kept, attrs synced), postMessage bridge,
  checkbox enabling, mermaid theming. Chrome a plugin or vault script adds
  to the document is discarded by every morph unless it carries
  **`data-clew-keep`** — the opt-out that lets a banner, an overlay or a
  PDF viewer survive a re-render instead of restarting. The reading view
  rebuilds a frame that LOADED but never said `ready` (once per element and
  note; `clew-preview-view.js#watchReady`) — WebKit drops postMessage both
  ways for a custom-scheme iframe moved in the DOM — and the client says
  `ready` again on a later `pageshow`; a new frame is never `ready` until it
  says so. A bare **Esc**
  nothing in the document used goes UP to the host as `{type: 'escape'}`
  (an engaged canvas card leaves on it); code inside a preview that
  consumes Esc must say so with `preventDefault` — text fields, an open
  `<dialog>` and the PDF viewer are exempt by rule.
  Siblings: `canvas-embed.js` (live read-only canvas scenes w/ pan/zoom),
  `leaflet-maps.js` (maps; asset base parameterized for site export),
  `pdf-core.js`/`pdf-embed.js`/`pdf-page.js` (the PDF viewer, below),
  `query-interact.js` (editable
  cells + kanban drag → field-edit messages; payload key is fieldSource —
  'source' would collide with the postMessage envelope), `api.js`,
  `site-client.js` (static-site runtime bundle).
- **Vault databases:** ```query/```tasks/```kanban scan the vault in the
  worker at render time; notes holding them re-render on ANY file change
  (render-service tracks hasQueries). The same `#restale` path serves
  EMBEDS: a transclusion puts the target's content in the embedder's
  HTML, so a changed note restales everything that embeds it —
  transitively, via the indexer's embeddersOf. Writes flow field-edit →
  `actions.editNoteField` (frontmatter via shared/frontmatter — respects
  the clean flag). Both preview-view and canvas-view route
  field-edit/task-toggle. **Fields are frontmatter only**: Dataview's
  inline `Key:: value` is NOT read, because `Term:: definition` is the
  dialect's description list and the engine claims such a line as a term
  (a bracketed `[key:: value]` mid-sentence ate the sentence) — owner's
  decision 2026-09-17, description lists win. Do not reintroduce inline
  fields.
- **What a vault asks Clew to leave alone** (`src/main/vault-excludes.js`,
  owner's decision 2026-09-25 — "we can't anticipate all the use-cases"):
  two lists in `vault-settings.json`, vault-relative globs (`*/libs`,
  `**/node_modules`, `Archive/2019`; `*` inside a segment, `**` across any
  number INCLUDING none). `unindexed` stays LISTED and openable but is not
  indexed and not watched; `hidden` is not there at all — no tree, no
  index, no watch, no site export, no rename rewrite. Hidden implies
  unindexed, so a walk that only cares about that asks one question.
  `unindexed` is only reasonable because the explorer is windowed: 20,000
  files can be listed for nothing. EVERY vault walk consults this — tree
  and watcher (vault.js), indexer, rename-links, the `.bib` scan in ipc.js,
  export-site — and the built-ins (`.clew`, `.git`, `.obsidian`,
  `node_modules`, `.trash`, dotfiles) live here too, where they used to be
  copied into three files that could drift. Changing either list reloads
  the vault in place (`vaults.reloadExcludes()` + a fresh index).
- **Plugins** (`src/main/plugins.js`, `src/renderer/plugins.js`):
  engine/preview/app surfaces, discovered in TWO roots — the vault's
  `.clew/plugins/<id>/` and the GLOBAL `<userData>/plugins/<id>/`
  (`paths.globalPlugins`, installed by the user, never by a vault). A
  vault plugin SHADOWS a global one of the same id. Installing is
  global; **enabling stays per-vault** (`vault-settings.json` plugins
  array) — the trust boundary does not move. Every plugin carries
  `scope` + `dir` (its own folder), and surfaces resolve against `dir`,
  never against the vault root. plugins.js must stay importable WITHOUT
  electron (its unit tests run under plain node), so the global dir is
  passed in by callers rather than read from paths.js. App surfaces load
  via the `__clew_plugin_app__` protocol namespace (CSP has no
  unsafe-eval); a global plugin's preview surface and its siblings are
  served from `__clew_plugin_file__/<sid>/<id>/<path>`, gated on being
  enabled and clamped inside the plugin folder. A surface loads a
  sibling with `new URL('x.js', document.currentScript.src)` (a bare
  relative fetch resolves against the NOTE's URL, in both scopes).
  Everything registered unwinds on vault change. Vault scripts:
  `.clew/scripts/*.js` inject into every preview, no manifest.
- **Site export** (`src/main/export-site.js`, File → Export → Vault as
  Website): one-shot workers with CLEW_SITE_EXPORT=1, marker-URL
  relativization per page depth, assets/ copy, queries baked static.
- `src/renderer/` — `state/` (Emitter stores: vault/workspace/settings/ui/
  bookmarks; the workspace state also carries `collapsedFolders`, the file
  explorer's closed folders — per vault, absence meaning open; the explorer
  itself is WINDOWED, `lib/tree-window.js` + `clew-file-explorer.js`: the
  tree is drawn FLAT, depth being padding rather than nesting, so a uniform
  row height gives an index for any scroll position and only the rows on
  screen exist — 45 elements instead of 20,503 in the vault that earned it.
  A live inline rename holds the repaint (`#renaming`), and anything that
  names a row not currently drawn goes through `#revealRow`),
  `workspace/tree.js` (pure layout model: n-ary splits,
  kind-aware tabs — 'note' | 'file' | 'canvas' | 'graph' | 'settings' |
  'empty' — and per-tab history), `editor/` (`pool.js` owns every
  EditorView; `jmd/` is the dialect overlay ported from jmacs; `complete/`
  has wikilink/tag/citation sources; `attachments.js` paste/drop),
  `commands/` (`registry.js` chord dispatch + `builtin.js` every command),
  `canvas/` (`canvas-model.js` pure doc+geometry, `rough.js` seeded sketchy
  paths, `node-content.js`, `canvas-menu.js`), `preview/scroll-sync.js`,
  `components/` (light-DOM web components), `styles/` (all colors are custom
  properties in `styles/themes/{dark,light}.css` on `body[data-theme]`).

### Canvas (.canvas tabs)

- Format is JSON Canvas 1.0 (Obsidian-compatible: `nodes` + `edges` at top
  level); Clew's ink strokes and shapes live under a top-level `clew` key
  other apps ignore. Never move Clew data into spec fields or invent node
  types — Obsidian must keep opening these files.
- `clew-canvas-view.js` renders by targeted sync, reconciling node elements
  by id so iframes/webviews never reload on unrelated changes. Content is
  inert (pointer-events: none) until a node is "engaged" (double-click);
  all affordances (handles, anchors, marquee) are drawn into an overlay SVG
  and hit-tested in world space — never DOM event targets. Connection
  anchor dots sit OUTSIDE the border (`anchorHandlePoint`) because the
  midpoint resize handles own the border itself.
- Note embeds are live previews: same clew-preview:// iframes, same
  postMessage protocol as reading mode (subscribe/EV_RENDER_DONE/morph).
- Web nodes use `<webview>` (webviewTag is on for this): guests get popups
  denied and navigation pinned to http(s) in main.js — keep it that way.
- Canvas file IO reuses NOTE_READ/NOTE_WRITE (they are extension-agnostic);
  renames propagate into canvas `file` refs via rename-links.js.

### Office documents (ZetaOffice — LibreOffice-in-wasm)

- Six formats (`.docx/.xlsx/.pptx/.odt/.ods/.odp`) EDIT in tabs and
  embeds: allotropia's LOWA build + zetajs, in clew-preview iframes
  (`preview-client/zeta-page.{html,js}` host ↔ `zeta-thread.js` in the
  LOWA worker). Needs the SAB switch in main.js (rationale there).
  Saving is EXPLICIT — LibreOffice's own toolbar Save (⌘S/Ctrl+S do NOT
  reach the wasm accelerators; synthetic input proved ctrlKey arrives
  and is ignored) → office-save bridge (pdf-save.js) → `OFFICE_WRITE` →
  `vault.writeOffice` (existing office file in-vault only). The system
  clipboard is NOT bridged in this LOWA build, either direction.
- **The engine is downloaded, never shipped** (`main/zeta-assets.js`):
  SHA256 pins in `shared/zeta-manifest.json` — the CDN has no versioned
  URLs, so a hash mismatch REFUSES, not "probably works". The two big
  files stay brotli on disk (~52 MB); `protocol.handle` does NOT decode
  a Content-Encoding header (measured), so protocol.js decompresses
  `<name>.br` twins through a zlib stream. Dev serves the repo's
  gitignored `zeta-assets/` (its PROVENANCE.md is the pin);
  `CLEW_ZETA_DIR` overrides the dir AND marks it writable — the repo
  copy never is. Settings → Office documents = download/remove; the
  first-open tab panel offers the same.
- **The office dock** (`renderer/office-dock.js`) owns the window's ONE
  office iframe in a fixed OVERLAY tracked to the office tab's host
  rect: reparenting an iframe reloads it, and the tab body is
  replaceChildren'd on every switch — an in-body frame would discard a
  booted LibreOffice per glance at a note. Office tabs never navigate
  and are never navigated over (tree.js#openPath, like canvas tabs);
  splits MOVE them; cross-pane opens reuse the tab. One instance per
  APP via the main-process slot (`main/office-slot.js`), released
  implicitly on webContents death/reload; blocked tabs re-render on
  slot broadcasts and wake themselves. Dirty state drives the tab dot,
  a close guard (workspace-store `registerCloseGuard`) and a main-side
  window-close handshake (`EV_CLOSE_REQUESTED`/`WINDOW_CLOSE_RESOLVED`,
  with `'pending'` stopping the fail-open timer) — native
  Save/Discard/Cancel on every close path. External changes reuse
  editorPool's model with the echo window stamped at the save REQUEST:
  chokidar outruns the save-result round-trip, and stamping at the
  result reboots LibreOffice out from under its own save.
- **Embeds** (owner's decision 2026-09-01): `![[x.docx]]` renders a
  static thumbnail; `![[x.docx|live]]` a full editor that BYPASSES the
  one-instance slot (the alias is the consent; ~1.2 GB first instance,
  ~0.5 GB each thereafter in the shared preview process — measured).
  Thumbnails: an offscreen BrowserWindow boots the chromeless page
  (`&thumb=1`; the thread hides LayoutManager chrome, sidebar, ruler)
  and one capturePage lands in `.clew/cache/office-thumbs/<rel>.png` —
  mtime-cached, strictly serialized, MIRRORED path so read-only
  surfaces (canvas embed scenes) construct URLs without asking
  (`main/office-thumbs.js`; preview hydration over a window.top bridge).
  Live embeds are HOISTED out of morphed flow into an absolutely
  positioned `data-clew-keep` holder on the preview body
  (`preview-client/office-embed.js`): any DOM move reloads an iframe,
  and a parser-created iframe detached before first-load-commit never
  renavigates — the holder's iframe is built FRESH with src set after
  insertion, and client.js strips src from incoming live iframes at
  morph so re-renders never boot throwaways. Canvas nodes pick
  thumbnail/live via `nodeStyles[id].office` (the node menu's Office
  row; stored under the clew key). A live embed DIES WITH ITS VIEW (tab
  switch, mode toggle) — guarded on close only; the manual says so.
- **Icons**: the bundle ships ONLY Colibre, at LibreOffice's default
  size, and that is what Clew shows (owner's decision 2026-09-17: the
  Sifr theme spliced into soffice.data and the 16px toolbar icons —
  commits fc4b522 and 3bc44bf — were reverted). Facts that survive, for
  whoever revisits it: the wasm build has no runtime theme switch
  (SymbolStyle is read once at startup; commits before load and after
  ui_ready are both no-ops; overwriting the packed zip in the Emscripten
  FS mid-boot dies with a wasm exception — all measured), so a theme
  can only be served spliced into the bytes; icon SIZE is consulted per
  toolbar build, so a plain config commit pre-load works — but the keys
  are UNO shorts and need `zetajs.Any(zetajs.type.short, …)`.
- **No engine / instance busy**: the file view offers the download and
  the desktop-LibreOffice rung (`main/office-convert.js`): headless
  PDF conversion into `.clew/cache/office-pdf/` (private
  UserInstallation so a running desktop LO can't wedge it) shown in the
  EmbedPDF viewer, plus Open in LibreOffice / default app.
- **Main-process teardown gotchas earned here** (they generalize):
  `webContents.send` into a window mid-teardown THROWS, and a throw
  inside a `'destroyed'` hook wedges main behind an error dialog —
  guard every broadcast (office-slot.js#broadcast is the exemplar). And
  `win.close()` from inside that window's own `ipcMain.handle` callback
  deadlocks Electron — defer with setImmediate (main.js close flow).

### The shell panel

- `⌃\`` (View → Shell Panel) opens a terminal under the workspace:
  `renderer/components/workspace/clew-shell-panel.js` (xterm.js + the fit
  addon) over `main/shell-core.js`. One shell per WINDOW, keyed by session
  id, started at the vault root, kept alive while the panel is hidden —
  closing the panel is not closing the shell, because the reason to have
  one is a build that runs while you go back to writing — and reaped by
  `session.js#dispose`. Owner's decisions 2026-09-25: one per window at
  the vault root, and NO restrictions on what it runs; it is their shell.
- **A pty with no native addon**, the mechanism lifted from the owner's
  jmacs/Godot editor (`apps/desktop/src/shell.js`) at their request:
  the child is `python3 -c <script>`, and the script calls stdlib
  `pty.fork()`, execs `$SHELL -i` in the slave and proxies a select loop.
  On macOS that shell is a LOGIN shell (argv[0] `-zsh`, as Terminal and
  iTerm start theirs): an app opened from the Dock inherits launchd's bare
  PATH, and path_helper and `brew shellenv` run only in a login shell — the
  owner's `ls` → `gls: command not found`, 2026-09-29.
  node-pty would be a compiled module rebuilt for every Electron version
  on every platform Clew ships to; this is stdlib everywhere but Windows,
  which falls back to plain pipes (commands run, no prompt, no colour, and
  the panel says so). Two load-bearing details, both learned upstream and
  both silent when they regress: the script resets SIGTERM to `SIG_DFL`
  BEFORE the fork (a child spawned by Electron can inherit an ignored
  disposition across exec, which makes `kill()` a no-op and leaks the pty),
  and resizing rides a SIDECHANNEL on fd 3 — lines of `<cols>:<rows>` →
  `TIOCSWINSZ` → SIGWINCH — never down the pty, where it would be typed
  input.
- The grid must be MONOSPACE (`--clew-mono-font`, not `--clew-editor-font`,
  which is Avenir Next): xterm sizes one cell from the font and puts every
  character in its own cell, so a proportional face leaves a gap around
  each letter — the owner's report the day it was built. xterm's own
  stylesheet is copied out of node_modules by scripts/build.js to
  `dist/renderer/vendor/xterm.css` and `<link>`ed from index.html; CSS
  here is never compiled. The family list is `lib/shell-font.js#
  gridFontFamily`: the `shellFont` setting first (blank by default), then
  the mono token, then Nerd/Powerline faces for prompt symbols (U+E0A0 &
  the private-use area no system font has — per-glyph fallback, so the
  cell is still measured from the monospace face), then `monospace`.
- **Widths are Unicode 11** (`@xterm/addon-unicode11`, which needs
  `allowProposedApi: true` for `term.unicode.activeVersion`): zsh counts an
  emoji like ⌚ as two columns and xterm's default Unicode 6 tables as one,
  so a right prompt holding one put zsh's cursor a column ahead of the
  grid's and the typed text landed on the space after `$` — "$echo", the
  owner's report 2026-09-30 (`smoke/shell-prompt-scenario.js`).
- The panel's open state and height live in the WORKSPACE (per vault, in
  `.clew/workspace.json`), so a scenario over a reused fixture must set a
  known state before driving the chord — the second run otherwise opens
  with the panel already showing and the chord closes it.

### Live edit (`src/renderer/editor/live/`, `editor/toolbar/`)

Obsidian's Live Preview: markup concealed and the result drawn in place
except where the selection touches a construct. The durable design is
`docs/dev/live-edit.md`; the rules that bite:

- **One EditorView.** A tab's `view.mode` is `source | live | reading`,
  `view.editMode` the editing mode ⌘E returns to. Live is `liveEdit(config)`
  swapped into the pooled state's `liveCompartment` by
  `editorPool.setMode` — no second editor, no second state; the tab group
  treats source and live as ONE view (no remount). The markdown grammar
  sits in `markdownCompartment` (`jmd/markdown-config.js#noteMarkdown`,
  also what the grammar tests parse with), reconfigured on a
  `normalSyntax` flip via `state/vault-settings-store.js`.
- **One model.** `live/model.js#liveModel(state, config)` merges the lezer
  tree (incl. `jmd/subsup-parser.js` — `_x`/`^x`/`^id` as the engine reads
  them) with the scanner's `constructs` (`jmd/scan-cache.js`, one memoised
  scan shared with the overlay and folding) into records carrying their
  delimiters (`hidden`) and REVEAL EXTENTS; `live/reveal.js` is then a pure
  range test. `reveal-field.js` holds model + revealed set, replaced only
  when either changes — providers compare by identity.
- **Two providers, by CodeMirror's rule.** Anything that changes vertical
  structure (block widgets, replacements across lines) comes from the
  StateField `block-field.js`; inline marks/widgets and LINE decorations
  from the ViewPlugin `inline-layer.js` over visibleRanges, which must
  never replace across a line break. Line classes (heading size, list
  indent, callout tint) apply in BOTH states — entering a line never
  changes its height (CodeMirror's `cm-widgetBuffer` images lifted a
  heading 1px until live-edit.css tamed them).
- **Tier C frames are hoisted.** Engine-only blocks render through
  `POST/GET __clew_block__` (protocol.js; a FULL engine document through
  `wrapPreviewDocument`, the same injection notes get) into iframes that
  live in ONE layer inside the scroller (`frame-layer.js`), positioned over
  placeholders the block field reserves — never inside widgets (CodeMirror
  recycles widget DOM; a moved iframe reloads). Created for drawn
  placeholders only, capped at `liveFrameCap`, pinned kinds kept within
  three screens (height-map distance); sizes come back as `size` messages
  (the client in `data-clew-block` mode reports the BODY's height —
  documentElement.scrollHeight never shrinks below the frame). The frame
  element's `color-scheme` must match its document's or Chromium paints an
  opaque slab. Messages go through `live/frame-host.js`, the switch
  clew-preview-view shares. A fragment's note travels in a `<key>.source`
  sidecar read by `engine/vault-model.js#currentFilePath` (no engine
  change); every fragment key carries the render-service configuration
  generation, and the layer re-renders all frames on the vault/app settings
  that reconfigure the engine. A block renders under its NOTE's citation
  keys (`Bibliography`, `Resolve citations`, … — `shared/citation-keys.js`,
  carried by `main/citation-header.js`, the bibliography path made
  absolute): a `\cite` in an embed stayed raw in live edit until
  2026-09-29. The layer ignores the note's own saves except when those keys
  change, which re-renders every frame.
- **The toolbar** is `toolbar-spec.js` (items are COMMAND ids),
  `toolbar-state.js` / `toolbar-layout.js` (pure, tested), the
  `<clew-editor-toolbar>` element, `popover.js`/`popovers.js` (Insert and
  Block reuse `shared/format-spec.js`), and `<clew-selection-bubble>`.
  `editor/toggle-wrap.js` unwraps from a bare cursor inside a construct.
  Plugin API 2: `clew.toolbar.addButton`. Too narrow for one row, the bar
  WRAPS onto two (`layoutRows`, natural order); `…` only past two rows. The row count comes from the always-there
  groups — a context group (the table tools) never changes the bar's
  height — and a row change moves the editor's scroll by the same delta
  (`toolbar-resize`), so text never jumps; heights are `--toolbar-row`
  (a port sets that, never a fixed height). **The mode switch is in each
  pane's TAB STRIP** (`clew-tab-bar.js`, owner's choice 2026-10-01 — a row
  for three buttons was not worth it): pinned left of "+", acting on that
  pane's active tab, hidden in place for a tab with no modes; there is no
  bar above a note but the formatting toolbar where `editorToolbar` shows
  it, and its coming or going moves the scroll by its height (except at the
  very top). `.editor-host .cm-editor` needs `min-height: 0` — without it
  the editor stayed the host's height under the bar and a scroll into view
  scrolled the host, bar and all.
- **Callouts are one box drawn across lines** (2026-10-01, the owner's
  report): each line of a callout is a `.cm-line` with `le-callout`; the
  live model marks every quote line `calloutFirst`/`calloutLast` (on the
  line's own record, so a line in view knows without its head in view), and
  live-edit.css gives the first the top padding and corners, the last the
  bottom, a bare `>` the paragraph gap, a list its 2.5em indent from the
  callout's text — all after preview.css's `.callout` (12px 16px, radius 5,
  the chevron at the right), measured equal by `callout-geometry-scenario.js`.
  Line classes, so revealing the source never moves a line. A list inside
  any quote counts its indent from the end of the `>`s.
- **Tables are edited in place** (live edit §5.5a): the active cell is note
  state (`live/active-cell.js`, pinned concealed by the reveal rule), and a
  nested cell editor (`live/table-cell-editor.js`) mounted in its `<td>`
  forwards every keystroke to the note — one document, one undo history; the
  widget's `updateDOM` never touches that cell, and leaving reflows once. The
  note editor's theme rules reach nested editors (descendant selectors) —
  override them for anything mounted inside it.
- **The `//` menu** (`editor/complete/slash-spec.js` pure +
  `slash-commands.js`, a completion source in the note AND cell editors,
  so source mode too): Obsidian's slash commands, triggered by `//` at a
  line start or after whitespace because `/` is the dialect's italic
  (`//` never is — the engine's italic needs a non-slash between). It
  offers the Format menu (`shared/format-spec.js`) and nothing else, so
  menu, palette and this cannot drift; accepting deletes what was typed
  and runs the command. `CELL_SAFE_COMMANDS` lives in format-spec.js.
- **Link hover previews** (live edit §5.11; source, live AND reading
  mode): `editor/link-at.js` is the ONE reader of links (pure; ⌘-click in
  source mode uses it too) and decides what a link previews;
  `<clew-link-preview>` (`editor/link-preview.js`) is the window's one
  popover and owns all timing; `editor/link-hover.js` reports the link
  under the pointer from the editor, `preview-client/client.js` from
  reading mode (`link-hover`/`link-unhover`). A note previews as
  `![[path#heading|bare]]` through the block endpoint, in ONE iframe kept
  across hovers and blanked 30 s after closing. The plugin has no
  `update` — keep it that way; a keystroke must not pay for hovering.
- **The live preview pane** (§5.12; source mode AND live edit): while the
  cursor is in a formula or a diagram block, `<clew-preview-pane>` shows
  the current source rendered — maths via `typesetTex` (the widget's own
  cached call), diagrams via the block endpoint morphed into ONE iframe.
  Targets are `editor/preview-target.js` (pure); the plugin
  (`preview-pane-plugin.js`) runs only on selection/doc/focus changes. The
  pane and the link preview share `components/chrome/floating-pane.js` —
  extend that base, never copy it. `live/keys.js` makes ArrowUp/Down stop
  at a block widget's edge (CodeMirror's vertical motion jumps over it).
  The pane is fixed, OUTSIDE the editor's scroller, so it passes a wheel it
  cannot use to the note (its own overflow first; a gesture begun on it
  stays latched until it pauses) — it ate every wheel from 818cf32 until
  2026-09-29.
- **Cross-references** (§5.13): `editor/live/numbering.js` MIRRORS the
  engine's post-processor numbering over the note's text (per note, keyed
  by line; `typedRefText` imported from the vendored crossref.js); chips,
  env heads, equation tags, heading prefixes, completion, jump and hover all
  read it. Parity with the engine is ASSERTED by crossref-scenario.js
  (`numbers-match=true`), never assumed — change a rule only with the
  engine's source open. Plugins declare `fences`/`numbered` in their
  engine surface for the editor to see.
- **Citations as objects** (§5.14): the index holds `citations` (pandoc
  forms flagged — `citedBy` honours pandocCitations); the Refs panel's
  Library lists every .bib entry with who cites it and Insert/Copy/PDF/DOI;
  a cite chip opens it; hovering previews `\fullcite` (engine-formatted when
  the vault names a bibliography). BIB_ENTRIES entries carry `bib` (their
  .bib) and `pdf` (the resolved `file` field) — `file` is BibTeX's own.
  **A pill reads the ENGINE's text for the citation as written**
  (`live/cite-text.js`, the owner's report 2026-10-01: `\cite{Akerlof/
  Kranton:2000}` read "Kranton 2000"): ONE block render per note of every
  citation in order (a numeric style numbers by first citation), each a
  paragraph behind a plain-word marker — `⟦n⟧` is Mathematica to the
  dialect, refused or, trusted, RUN — read back from the element carrying
  `data-bibtex` (its class is the style's). Cached per note under its
  citation header plus an epoch a .bib edit or an engine-reconfiguring vault
  setting bumps; re-asked only when the list of citations changes, so typing
  asks for nothing. Until then, or where the engine has none (no
  bibliography, an unknown key), `live/cite-label.js` (pure) shapes the local
  label by command; an unknown key is the key in the danger colour.
  **`\fullcite` is not a pill**: `widgets/fullcite.js` draws the engine's
  whole entry INLINE (`span.fullcite`, jmarkdown e823e76), italics kept —
  the HTML rebuilt by `cite-text.js#inlineHtml` from allowlisted inline tags
  with NO attributes before it enters the editor's DOM; a faint dotted
  underline marks it, it wraps like prose (its line a whole number of prose
  lines), a click reveals its source, no hover. Fallback: the .bib's author,
  year and title, plain.
  `shared/fragment-deps.js` counts a citation dependent (it reads the .bib),
  so a .bib edit retires the server's cached block. The hover's button on a
  citation is "Show in Library" (the spec carries `cite: [keys]`; the first
  key, as a pill's click; ⌘ opens the entry's PDF through `bib-pdf.js`, the
  Library's own opener). Reading mode re-renders a note when the .bib its
  citations come from changes (`citation-header.js#noteBibFiles`: the
  header's `Bibliography`, else the vault's when the note cites; open
  previews rebuilt, others marked stale).
- **PDF annotations → note** (§5.15): the viewer (pdf-core.js) lists its
  annotations with the text under them (engine glyph geometry +
  getTextSlices) when pdf-page.js is asked by its PARENT;
  `renderer/pdf-annotations.js` + the pure `shared/pdf-annotations-note.js`
  write or MERGE `<pdf> — Annotations.md` (never deleting); it flushes the
  viewer's pending autosave first. `[[x.pdf#page=N]]` opens a PDF tab there.
- **Sidenotes** (§5.16): footnotes in the margin when the pane is wide —
  reading mode clones the engine's endnotes into a `data-clew-keep` layer
  (the end list hidden by a body class; print/export untouched), live edit
  draws concealed notes' first paragraphs in a scroller layer
  (`live/sidenotes.js`). Setting `sidenotes`.
- Settings: `defaultEditMode`, `liveReveal`, `liveRender{Math,Fences,Embeds}`,
  `liveFrameCap`, `editorToolbar(+Prev)`, `editorToolbarGroups`,
  `selectionBubble`, `slashCommands`, `linkPreview`, `previewPane`, `graphReferences`, `sidenotes`; `newTabMode` accepts `live`. Documents over 500 KB
  fall back to source with a banner. Scenarios: `live-*` in smoke/ (README).

### Note API (scripts in rendered notes)

- `window.clew` in previews comes from `src/preview-client/api.js`
  (injected into `<head>` by protocol.js): promise RPC over postMessage.
  `src/renderer/note-api.js` is the ONLY dispatcher — an explicit method
  whitelist, gated per vault (`vault-settings.json` `noteApi`, default
  off; every request carries its sourcePath). Both clew-preview-view and
  the canvas embed handler route `api-request` through it. Never give
  previews a direct IPC path around this gate.
- Shared state is `clewdata.json` in the VAULT ROOT (visible on purpose —
  it travels with a shared vault). `src/main/kv-store.js` owns it: sorted
  keys, debounced writes, watcher-driven external reloads,
  `EV_KV_CHANGED` broadcast to every preview and canvas embed.
- Morphdom never re-executes scripts: note scripts run once per load and
  re-bind on the `clew:render` DOM event / `clew.on('render')`.
- Engine quirk: code spans and fences pass `<` through unescaped (while
  `&` is escaped) — a literal `<script>` inside code swallows the note.
  Demo notes avoid markup inside code; possible upstream fix, ask owner.

### Rendering (the part that is easy to get wrong)

- The engine must NEVER run in Clew's process: a build mutates the marked
  singleton, `global`, `String.prototype`, and the import cache, and some
  error paths call `process.exit`. Renders fork the engine's own
  `watch-worker.js` (one-shot; a pre-warmed standby is consumed per build
  while its replacement warms; generation counter drops stale results).
- Worker cwd is `<vault>/.clew/engine/` — the engine reads
  `./.jmarkdown/config.json` relative to cwd at import time. Clew generates
  that config (`render-service.js#writeEngineConfig`): `File inclusion:
  false`, `Header style: fenced`, absolute `Template`, `Extensions` loading
  wikilinks + mermaid fences by absolute path, local MathJax/mermaid/
  highlight/FontAwesome via `/__clew_assets__/`.
- Renders are file-mode full documents (`options.output` → `.clew/cache/`) —
  the ONLY mode that stamps `data-source-line` (1-based; engine commit
  `aaa0dab`). Auto-save makes disk the source of truth.
- Preview URLs carry the window's session id
  (`clew-preview://vault/<sid>/<path>`) because protocol handlers cannot
  see which window asked; the renderer builds them via
  `lib/preview-url.js` (`setPreviewSession` from the vault-opened event).
- The preview iframe is **deliberately unsandboxed**, and the reason is no
  longer PDFs (see below) — it is `fetch`. `sandbox="allow-scripts"` gives
  the frame an opaque origin, and preview documents fetch `clew-preview://`
  URLs constantly: canvas embeds read canvas JSON and POST fragments,
  leaflet maps load GeoJSON/GPX, plugins read their own note. All of that
  fails from a null origin, and `allow-same-origin` would buy back only
  top-navigation/form/download blocking on a frame that is ALREADY
  cross-origin from the app. Isolation instead: previews live on the
  `clew-preview://` origin (app is `file://`), `setWindowOpenHandler`
  denies all popups, and a `will-navigate` guard pins the app frame.
  Iframes carry `allow="fullscreen"` (EmbedPDF's control needs it).
  Protocol hardening (2026-09-29): session ids are random (not s1, s2 …),
  and a response may be READ across origins only by `clew-preview://vault`
  and `null` — the app page, being file:// — every response leaving through
  `main/preview-cors.js#narrowCors`; any other origin gets no
  Access-Control-Allow-Origin. `null` cannot be refused while the app page
  IS null (HANDOVER §1 has the options). **The render POSTs
  (`__clew_fragment__`, `__clew_block__`) run nothing without the caller
  token** (`docs/dev/frame-bridge.md` §1, agreed with Clew-iOS): 32 random
  bytes per session (`main/caller-token.js`), handed to the window only on
  its own-window paths (`vaults.ownInfo` — never `info`, which the open
  handlers return to OTHER windows) and carried in the JSON body by
  `renderer/lib/caller-token.js#renderPost`, with NO Content-Type (a JSON
  type is preflighted on iOS, which answers no OPTIONS). Preview documents
  are never SERVED it: `preview-client/caller-token.js` asks its parent on
  first use (retry 1 s × 5, then fail), and a parent answers only its own
  child frame on the preview origin (`shared/caller-token.js`). The
  top-level print view is handed it by `print-pdf.js`'s self-post. Every new
  render POST goes through renderPost/callerToken, or it gets a 403. **A
  window listens only to senders it can name** (`shared/message-guard.js`,
  2026-09-29): any frame can post to `window.top` or its parent — a remote
  page a note embeds, a canvas web card — so the app page's bridges
  (`pdf-save.js`: PDF/Excalidraw/office saves, the Excalidraw library, file
  resolution, office thumbnails; `pdf-frames.js`; the office dock's embed
  branch) act only for `fromPreviewOrigin(event)` and answer `event.origin`,
  never `'*'`; and a document's host listeners (`client.js`, `api.js`, the
  viewer pages' reply listeners) accept only the window they expect — the
  parent, or the window a request went to. Not "a frame the app created":
  office live embeds and the Excalidraw/PDF viewers inside notes post to
  window.top from two frames deep. A new listener follows the same rule
  (`smoke/bridges-scenario.js`, `office-bridges-scenario.js`).
- **PDFs are EmbedPDF, not Chromium's plugin** (MIT, Pdfium-in-wasm, ~9.5
  MB staged) — and not the npm build: the viewer is the owner's OCG/layers
  fork (EmbedPDF v2.15.0 + the ~/Source/pdfium-ocg patch series; the wasm
  carries the FPDF*OCG* API, the UI a layers panel and per-annotation layer
  assignment). Vendored like the engine: `vendor/embedpdf/dist` is a
  committed dumb mirror of the BUILT snippet viewer, overwritten wholesale
  by `npm run sync-embedpdf` from the master at `~/Source/EmbedPDF/v2`
  (branch `ocg-v2`; `pnpm build` there first — the unrelated example apps
  may fail after the snippet builds). Dev and packaging re-sync when that
  worktree exists; other machines use the committed mirror; NEVER edit
  vendor/ by hand. Served at `/__clew_assets__/embedpdf`
  (paths.js#embedpdfAssets → protocol.js); note the `!vendor/embedpdf/dist/`
  gitignore exception outranking the blanket `dist/` rule.
  One implementation, `preview-client/pdf-core.js`, serves all
  three surfaces: note embeds upgrade `<embed class="pdf-embed">` in place
  (`pdf-embed.js`), while the file tab, canvas nodes and a canvas SCENE's
  PDF nodes (`canvas-embed.js`, 2026-09-30 — until then Chromium's plugin,
  which could not annotate) — which point an iframe at a raw PDF and so have
  no document to upgrade — load `pdf-page.html` from
  `__clew_assets__/clewpdf/`. The save bridge is on the app page, which is
  always `window.top`, so pdf-core posts saves and dirty reports THERE (a
  scene's viewer is a grandchild), and `pdf-frames.js` finds a dirty viewer
  however deep under a view (`holds`) and asks IT to flush; pdf-page answers
  the app page as well as its parent. A note's OWN `<iframe|embed|object>`
  pointing at a vault PDF is rewritten to that viewer as the document is
  served (`main/pdf-frames-rewrite.js`, called from protocol.js's
  `wrapPreviewDocument` and the fragment route: `#page=N` and the author's
  sizes kept, the note's folder resolving relative paths — a live-edit block
  finds it through `renderService.blockSourcePath`); a site export keeps the
  author's iframe. **A WEB PDF** a note's frame names (§4 of
  `docs/dev/pdf-unification.md`, 2026-09-30) is fetched by CLEW, not the
  page — REGISTRATION, not a proxy: the rewrite registers the URL for the
  render's session (`main/remote-pdfs.js`, `session.remotePdfs`) and the
  frame becomes `pdf-page.html?…&readonly=1` on
  `/<sid>/__clew_remote_pdf__/<sha256(url)>`, a route that serves only
  hashes this session registered (404 otherwise; 502 JSON naming a
  failure). The fetcher (`main/remote-fetch.js`, Node http(s) — Electron's
  `net` shares cookies and cannot pin) resolves first and vets EVERY answer
  (`main/remote-guard.js`: loopback, private, link-local/metadata, CGNAT,
  multicast, reserved, documentation, and every IPv6 form carrying one),
  PINS the connection to a vetted address, re-vets each of ≤5 redirects,
  sends no cookies/auth/referer, and wants a 200 PDF (`%PDF-` in 1024
  bytes, 100 MB counted while streaming, 10/20/120 s) — resolver and
  transport injected, so tests/remote-*.test.js need no network. The copy
  lives ON THE DEVICE (`main/remote-pdf-cache.js`, `paths.remotePdfs`,
  sha256(url) → .pdf + .json, daily conditional revalidation, 1 GB LRU),
  never in a vault, whose `.clew/` travels and could carry a planted one.
  The viewer is read-only (`pdf-core` `readonly`: EmbedPDF's own
  `disabledCategories`, no autosave) under a strip — Save a copy to the
  vault (the cached bytes via `saveAttachment`), Open in browser, Reload —
  and names each failure (`preview-client/remote-failures.js`, iOS's
  `insecure-url` included; a headline never states a size limit, since the
  cap is per platform and the host's own message names it); both actions name the HASH, and main looks the
  URL up in the sender's registrations (under CLEW_SMOKE, Open logs
  `smoke-open-external:` instead). A site export keeps the author's iframe.
  **`plugins: true` is gone** (phase 4, 2026-09-30), and dropping it does
  NOT retire Chromium's viewer in Electron 43 (measured). So a vault PDF
  that is asked for as a DOCUMENT — a frame, `<embed>` or `<object>` a
  script adds after render — is 302'd by protocol.js to `pdf-page.html`,
  keeping its `#page=N`. A navigation is told from EmbedPDF's own fetch by
  `Accept` (`text/html,…` vs `*/*`; this scheme sends no Sec-Fetch-Dest).
  Dev and smoke log `smoke-pdf-leak:` for each catch, and no scenario but
  `smoke/pdf-leak-scenario.js` may produce one (`smoke/pdf-sweep.sh`). A
  web PDF §4 cannot recognise (no `.pdf`, no type) still gets Chromium's
  viewer. Never guard `will-download` for PDFs: EmbedPDF's own Download is
  a blob `<a download>`, and a guard cancelled it (measured). The engine's
  `![[x.pdf]]` placeholder carries `data-src`, never `src`, in the preview
  (wikilinks.js; a site export keeps `src`). A real `src` started its own
  load before pdf-embed.js replaced it, on first render and on every morph.
  A PORTAL's PDF node is a
  first-page picture (`main/pdf-thumbs.js`: an offscreen `pdf-page.html?
  thumb=1` renders page 1 with EmbedPDF's `renderPage`; cached at the
  mirrored `.clew/cache/pdf-thumbs/<rel>.png`, mtime-keyed, one job at a
  time — the office-thumbs arrangement; iOS answers `PDF_THUMBNAIL`
  natively with QuickLook at the same path). Heavy wasm belongs in a
  clew-preview document, never the app page (a lesson Clew-iOS paid for on
  a real iPad); on desktop that falls out for free, and those documents
  carry no CSP. Feed it an ArrayBuffer via `openDocumentBuffer` — URL
  loaders read a `clew-preview://` path as base64. Annotations autosave
  into the vault's own PDF (2.5s debounce → `renderer/pdf-save.js` →
  `CH.PDF_WRITE` → `vault.writePdf`, which refuses anything that is not an
  existing `.pdf` inside the vault). **A frame being removed cannot save**
  — its async export never completes and not even a synchronous
  postMessage leaves it (measured 2026-09-29) — so nothing holding an
  unsaved annotation is removed until it lands: each viewer document
  reports `pdf-dirty`; `renderer/pdf-frames.js#retire` keeps an outgoing
  tab view, live frame or canvas card hidden (display:none keeps it
  loaded) and asks it to `pdf-flush`; a close guard and the window's close
  handshake wait for it; inside a preview the morph HOLDS an embed a
  re-render would discard (`pdf-embed.js#holdIfUnsaved` — EmbedPDF stops
  working once detached). visibilitychange flushes a document that lives
  on hidden. Every live viewer is in `preview-client/pdf-handles.js`
  (`viewerHandles`, also `window.__clewPdfHandles`); `pdf-pen.js`, imported
  by pdf-core, is the pen convention — after a pen has been seen, a finger
  pans a viewer whose free-drag tool is armed, a mouse never affected (the
  iOS port's module, upstreamed). Anything that removes a view must go through retire() and
  anything that finds "the view for a path" must skip
  `[data-clew-retiring]`. CJK fallback fonts are an app setting
  (`pdfCjkFonts`), downloaded on demand into userData by
  `main/pdf-fonts.js` — 139 MB, so never shipped; `src/shared/pdf-fonts.json`
  (2.6 KB, regenerate with `scripts/gen-pdf-fonts.js`) names the files.
- Exports (`export.js`) use the note's own directory as cwd — the user's
  normal jmarkdown config cascade, NOT the Clew preview config — except
  for a vault this device does not trust (below), whose exports run from
  `paths.restrictedExport` (userData), a folder whose one config key turns
  `Run note code` off: the user's global ~/.jmarkdown still applies, a
  vault's own `.jmarkdown/config.json` never does (it can load engine
  extensions). The engine resolves relative paths from the note's folder,
  not the cwd (measured: HTML and LaTeX byte-identical from either).
- **The interim vault-trust guard** (owner's approval 2026-09-30;
  `docs/dev/frame-bridge.md` §4 is the full design it grows into). A note
  can make the engine run code — script blocks, `Math.…`/`calc(…)` in
  prose, `math.…(`, `function(…)` blocks, Mathematica, the `Load …` and
  `Extension …` header keys — so the generated config carries the engine's
  `Run note code` switch (jmarkdown `note-code.js`), set from the DEVICE's
  answer: `main/vault-trust.js` (electron-free, tested) keeps
  `<userData>/vault-trust.json`, keyed by the root's realpath with a
  {dev, ino, birth} fingerprint checked on every open (a different vault
  unpacked at a trusted path asks again), never anything the vault carries.
  The first launch with it records every vault in openVaults/recentVaults
  as trusted (`trust.migrate`, before any window); the demo vault and a
  vault created from the welcome screen are trusted by construction;
  anything else starts restricted. `session.trusted` is decided in
  `hooks.onOpen` BEFORE the render service writes its first config
  (`renderService.setNoteCode`, default CLOSED). Off, the engine refuses
  each construct by name in place (`[data-jmd-refused]`, styled in
  preview.css); `render-service#noteRefusals` reads those names from each
  rendered document and sends `EV_NOTE_CODE_REFUSED`, and only then does
  `renderer/trust-banner.js` show "This vault's notes asked to run code
  … [Trust this vault]" — a persistent item in the notices column, drawn by
  the app page, never by a preview. `VAULT_TRUST_GET/SET` (Settings → This
  vault has the toggle) flip it through `setNoteCode` → reconfigure;
  frame-layer restales on `EV_VAULT_TRUST_CHANGED`. It covers the engine's
  note-code paths ONLY — vault scripts, vault plugins, dataviewJs, the Note
  API and a preview CSP keep their current switches until full §4, which
  extends this store and identity rather than replacing them. Under
  CLEW_SMOKE the store writes nothing, so a fresh CLEW_USER_DATA opens every
  fixture restricted (a scenario that needs a KNOWN vault lists it under
  `recentVaults` in that userData's clew-settings.json — `smoke/README.md`).
- Per-vault render options live in `<vault>/.clew/vault-settings.json`
  (`jmarkdownProject: true` re-enables the engine's own-line `[[file.md]]`
  inclusion; `pandocCitations: true` turns on `[@key]`/`@key` — off by
  default because `@` is the directive sigil, so a bare `@word` in prose
  becomes a citation key). Changing them goes through `renderService.reconfigure()`,
  which rewrites the engine config, discards the warm standby worker (it
  imported the old config), and re-renders open previews.

## Conventions and gotchas

- **Editor ownership:** only `editorPool` creates/destroys the NOTE
  EditorViews; components adopt `entry.view.dom`. A code field that is not
  a note — the TeX fragment rows in settings — is
  `renderer/editor/mini-editor.js`, which owns its own view and whose
  CALLER must destroy it (the settings view does, on re-render and on
  disconnect); it borrows theme.js's highlighting and fence-languages.js'
  grammars, so a fragment is coloured exactly as the fence it lands in. The pool also owns dirty state,
  auto-save (1s debounce), a per-path EditorState cache (undo survives
  navigation; discarded when disk content diverges), and conflict state
  (external change + unsaved edits → banner, auto-save paused; the pool
  ignores echoes of its own saves via `lastWrittenText`). **Opening is
  serialised** (2026-10-02, Clew-docs' repro): `open()` of a note already
  being opened WAITS for that open (`entry.opening`) — handing the entry
  back early left a host with no view (an empty pane) or with the old view
  and mode about to be replaced (live edit undrawn under a pressed live
  button); `setMode` compares against the state's OWN compartment
  (`liveStateField` present or not), not only `entry.mode`; and the pool
  emits `state-replaced` whenever it puts a new state in a view, on which
  the host showing it re-applies the tab's mode. Anything DEFERRED that
  reads a live-only field — a `requestMeasure` read/write, a listener, a DOM
  handler — reads it with `state.field(f, false)` and does nothing without
  it: CodeMirror runs a plugin's pending measures after the plugin's
  compartment has gone (`Sidenotes.read`'s "Field is not present").
- **A directive's bracket is prose unless the engine says otherwise**:
  the engine lexes `@name[…]` as inline markdown except where the
  environment's mode is `verbatim`, or `custom` with a handler that takes
  the raw text. Those names are `jmarkdown-scan.js#LITERAL_DIRECTIVES`, where
  the scanner claims the bracket (no /italic/, nothing concealed — the
  owner's `@reveal[http://…/]` read `http:/localhost:8888prez…` in italics);
  a test holds the verbatim half to the vendored engine. In PROSE, since
  jmarkdown 3134543, /italic/ has flanking rules — no letter, digit, `:`
  `/` `.` `~` before the opening slash, no letter, digit or `/` after the
  closing one — so `and/or`, `1/2/3`, paths and URLs stay literal, and a
  bare http(s)/ftp/www/email URL is a link; the scanner mirrors the rule
  (a parity test runs it against the engine's tokenizer) and live edit
  draws bare URLs as links (`jmd/ftp-autolink.js` adds the scheme lezer
  lacks). One limit, in both: `see /tmp/ here` still italicises.
- **jmarkdown dialect facts:** sub/superscripts are TeX-style (`H_2O`,
  `x^2`, `x^{10}`) — `~x~` is strikethrough, `^x^` is not a thing. `*x*` is
  strong, `**x**` intense, `/x/` italic. Mermaid's native forms are
  `:::mermaid`/`@begin(mermaid)`; the ```mermaid fence works only because
  Clew's `obsidian-fences.js` adds it.
- **Engine embedding gotchas:** never emit `data-target` attributes in
  extension output — the engine's sources-and-targets post-pass deletes such
  elements (Clew uses `data-href`). The engine's bib indexer splits `.bib`
  entries on blank lines. The engine's inline CSS assumes a light page;
  `src/engine/preview.css` carries the dark-theme overrides (alerts,
  highlights, TikZ/MetaPost plates).
- **Markdown tables are editable** (`editor/tables.js`): Tab/Shift-Tab walk
  the cells, Enter walks the rows, both adding a row at the end, and the
  table reflows so the pipes line up. Registered with `Prec.high` so Tab
  reaches a table before `indentWithTab` — every handler returns false
  outside a table, which hands the key back. Parsing/formatting are pure
  functions (unit-tested); only the keymap touches CodeMirror.
- **Commands + keybindings** live in `commands/registry.js` + `builtin.js`
  (CM chord notation). Add shortcuts as commands — never ad-hoc keydown
  listeners — so the palette, the settings hotkey editor, and the native
  menu see them. The menu (`src/main/menu.js`) dispatches command ids over
  `EV_MENU_COMMAND`; `commands/menu-bridge.js` pushes context + the
  effective keymap back over `MENU_STATE` (accelerators are display-only —
  `registerAccelerator: false` — the renderer dispatcher owns every chord).
  The dispatcher listens in the capture phase on window, so an app chord
  beats CodeMirror, canvas and a focused terminal alike; anything that
  RECORDS keys (the Settings hotkey editor) goes through
  `registry.js#recordKeys`, which hands it every key while the dispatcher
  stands aside — a listener of its own came second, after the command the
  chord was bound to. ⌘1–⌘8 go to that tab of the current pane, ⌘9 to its
  last (owner's choice 2026-10-01; Go > Tab).
- **Cmd+W is the renderer's** (close tab): no `role: 'close'` in the menu.
- **Panes are moved, never re-appended** (`clew-workspace.js#place`,
  2026-10-02): a layout change touches only the panes whose place changed,
  and those go by `moveBefore` (Chromium's state-preserving move: frames do
  not reload, focus and scroll stay; components get
  `connectedMoveCallback`, defined on ClewElement and the editor toolbar, in
  place of a disconnect). Placement is top-down and leftovers are removed
  only after the pass, so a pane going into a new split is never detached
  on the way. Until then clew-split rebuilt its resizers on every sync, so
  EVERY layout change re-appended EVERY pane: a mode switch in one pane
  reloaded the others' frames, dropped toolbars and jumped a pane's scroll
  (`smoke/split-stability-scenario.js` has the numbers). A custom element
  that can live in a pane and has connect/disconnect work defines
  `connectedMoveCallback`.
- Editor↔preview scroll sync runs over `preview/scroll-sync.js` (bus +
  per-side suppressors). Emit only on user scroll; `suppress()` before any
  programmatic scroll.
- **Obsidian's Excalidraw PLUGIN is AGPL-3.0** (its LICENSE file; its
  package.json says MIT, which is stale — the file governs). Its code must
  never enter this GPL-3.0 tree. Compatibility is achieved by implementing
  the on-disk FORMAT, which is not copyrightable, and verifying behaviour
  against real files — never by lifting source. `@excalidraw/excalidraw`
  itself is MIT and is embedded normally.
- Obsidian compatibility is a hard constraint: never write into
  `.obsidian/`, keep `[[wikilink]]` semantics Obsidian-shaped, `.md` files
  stay `.md`. Clew state lives in `.clew/` (gitignored).
- **The compat line is DRAWN (owner's decision, 2026-08-26): formats are
  owned, behaviors are not chased.** Everything an Obsidian vault puts in
  files renders or refuses BY NAME (Dataview/dataviewjs, Bases incl. maps,
  Kanban boards, the Tasks dialect, Excalidraw incl. images, Charts,
  admonitions, core `query` search embeds, Meta Bind widgets,
  `obsidian://` links). Do NOT add compat features beyond this on your own
  judgment — a real vault plus a real user hitting a named refusal is what
  reopens the question, and nothing else does. The extension story for the
  rest is the code itself: vault plugins, vault scripts, patches
  (`Guide/Obsidian Compatibility.md` in the demo vault is the public
  statement of this).
- **Symlinks are supported** (unlike Obsidian): every vault walk (tree,
  indexer, canvas-rename, bib scan) goes through `src/main/fs-utils.js` —
  `direntKind` follows links, `walkGuard`/`shouldRecurse` realpath-dedupe
  against cycles. New walks MUST use these helpers, not bare
  `entry.isFile()/isDirectory()` (dirents answer false for symlinks).
  In-vault links may point outside the vault by design; chokidar follows
  links by default, so watching just works.
- Engine changes belong upstream in the jmarkdown repo, additive and
  config-gated, coordinated with its own conventions (read its CLAUDE.md +
  HANDOVER.md first; stage by explicit path — its working tree deliberately
  carries uncommitted files).
