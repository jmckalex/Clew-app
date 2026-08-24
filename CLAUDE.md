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
  refuses to copy and scripts/after-pack.cjs copies instead. Dev-vs-packaged
  locations are decided ONCE in `src/main/paths.js`; new main-process file
  dependencies must go through it. Icon: scripts/make-icon.js renders
  build-resources/icon.svg → icns (committed).
- **Tests:** `npm test` (`node --test`, files in `tests/`): workspace tree,
  note-metadata extractor, BibTeX parser, the ported jmarkdown-scan suite,
  canvas model, diary, frontmatter, plugins discovery, query/leaflet/exif
  parsers — 178 tests. DOM/UI work is verified with the smoke harness.
- **Smoke harness:** `CLEW_SMOKE=/path/out.png CLEW_SMOKE_SCRIPT=scenario.js
  [CLEW_SMOKE_FRAME_SCRIPT=frame.js] [CLEW_SMOKE_VAULT=/path/vault]
  electron .` — SMOKE_VAULT opens exactly that vault, never touching the
  user's restored vault set (always pass it). Boots the app, runs the
  scenario in the renderer (dev hook `window.__clew` exposes the stores,
  registry, ipc), optionally drives the preview iframe's document via
  webFrameMain, screenshots, and quits. Use it for every UI change.

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
browser-window-focus).

- `src/main/` — `main.js` (windows + vault orchestration, guards, smoke
  hook — captures every window), `session.js` (per-window services),
  `vault.js` (vault manager, chokidar watcher, file ops, attachment saving,
  `.clew/` state), `indexer.js` (the metadata cache: extractor over every
  note, link resolution, incremental patches), `render-service.js` (one-shot
  warm jmarkdown workers — see below — plus `toolchainPath()`, which extends
  PATH with TeX/homebrew dirs), `protocol.js` (`clew-preview://`),
  `search.js`, `export.js` (HTML/LaTeX/PDF via the engine), `rename-links.js`
  (vault-wide wikilink rewriting), `settings.js` (app-global), `ipc.js`
  (every handler; channel names in `src/shared/channels.js`).
- `src/preload/preload.cjs` — the entire bridge: `window.clew.{invoke,on}`,
  restricted to `clew:*` channels.
- `src/shared/` — `channels.js`, `note-metadata.js` (regex-level extraction;
  NEVER the engine), `bib.js` (BibTeX fields for citation completion),
  `frontmatter.js` (properties parse/serialize — a deliberate YAML subset;
  blocks it can't fully parse are flagged `clean: false` and MUST be
  treated read-only).
- `src/engine/` — assets the render worker loads: `wikilinks.js` (Obsidian
  links/embeds incl. media + image sizes; SITE_EXPORT branch emits real
  hrefs), `obsidian-fences.js` (```mermaid + ```leaflet maps incl. photo
  maps w/ HEIC conversion), `query-fences.js` (```query/```tasks/```kanban
  + the `vault` global for script blocks), `exif-gps.js`,
  `clew-template.html` (local assets, no CDN), `preview.css`. These may
  import each other but never src/shared (dist/engine is a verbatim copy).
- `src/preview-client/client.js` — injected into every rendered note:
  morphdom patching (guards: scripts, canvas-embed scenes, initialized
  leaflet divs, custom elements — kept, attrs synced), postMessage bridge,
  checkbox enabling, mermaid theming. Siblings: `canvas-embed.js` (live
  read-only canvas scenes w/ pan/zoom), `leaflet-maps.js` (maps; asset
  base parameterized for site export), `query-interact.js` (editable
  cells + kanban drag → field-edit messages; payload key is fieldSource —
  'source' would collide with the postMessage envelope), `api.js`,
  `site-client.js` (static-site runtime bundle).
- **Vault databases:** ```query/```tasks/```kanban scan the vault in the
  worker at render time; notes holding them re-render on ANY file change
  (render-service tracks hasQueries). Writes flow field-edit →
  `actions.editNoteField` (frontmatter via shared/frontmatter — respects
  the clean flag — or the inline `Key:: value` line). Both preview-view
  and canvas-view route field-edit/task-toggle.
- **Plugins** (`src/main/plugins.js`, `src/renderer/plugins.js`): vault
  plugins in `.clew/plugins/<id>/` with engine/preview/app surfaces,
  per-vault opt-in (`vault-settings.json` plugins array). App surfaces
  load via the `__clew_plugin_app__` protocol namespace (CSP has no
  unsafe-eval); everything registered unwinds on vault change. Vault
  scripts: `.clew/scripts/*.js` inject into every preview, no manifest.
- **Site export** (`src/main/export-site.js`, File → Export → Vault as
  Website): one-shot workers with CLEW_SITE_EXPORT=1, marker-URL
  relativization per page depth, assets/ copy, queries baked static.
- `src/renderer/` — `state/` (Emitter stores: vault/workspace/settings/ui/
  bookmarks), `workspace/tree.js` (pure layout model: n-ary splits,
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
- The preview iframe is **deliberately unsandboxed** (a sandbox blocks
  Chromium's PDF plugin for `![[x.pdf]]` embeds). Isolation instead:
  previews live on the `clew-preview://` origin (app is `file://`),
  `setWindowOpenHandler` denies all popups, and a `will-navigate` guard
  pins the app frame. Don't re-add the sandbox attribute without solving
  PDF embeds another way.
- Exports (`export.js`) use the note's own directory as cwd — the user's
  normal jmarkdown config cascade, NOT the Clew preview config.
- Per-vault render options live in `<vault>/.clew/vault-settings.json`
  (`jmarkdownProject: true` re-enables the engine's own-line `[[file.md]]`
  inclusion). Changing them goes through `renderService.reconfigure()`,
  which rewrites the engine config, discards the warm standby worker (it
  imported the old config), and re-renders open previews.

## Conventions and gotchas

- **Editor ownership:** only `editorPool` creates/destroys EditorViews;
  components adopt `entry.view.dom`. The pool also owns dirty state,
  auto-save (1s debounce), a per-path EditorState cache (undo survives
  navigation; discarded when disk content diverges), and conflict state
  (external change + unsaved edits → banner, auto-save paused; the pool
  ignores echoes of its own saves via `lastWrittenText`).
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
- **Commands + keybindings** live in `commands/registry.js` + `builtin.js`
  (CM chord notation). Add shortcuts as commands — never ad-hoc keydown
  listeners — so the palette, the settings hotkey editor, and the native
  menu see them. The menu (`src/main/menu.js`) dispatches command ids over
  `EV_MENU_COMMAND`; `commands/menu-bridge.js` pushes context + the
  effective keymap back over `MENU_STATE` (accelerators are display-only —
  `registerAccelerator: false` — the renderer dispatcher owns every chord).
- **Cmd+W is the renderer's** (close tab): no `role: 'close'` in the menu.
- Editor↔preview scroll sync runs over `preview/scroll-sync.js` (bus +
  per-side suppressors). Emit only on user scroll; `suppress()` before any
  programmatic scroll.
- Obsidian compatibility is a hard constraint: never write into
  `.obsidian/`, keep `[[wikilink]]` semantics Obsidian-shaped, `.md` files
  stay `.md`. Clew state lives in `.clew/` (gitignored).
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
