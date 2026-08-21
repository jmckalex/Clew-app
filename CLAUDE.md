# CLAUDE.md

Guidance for Claude Code working in the **Clew** repository.

## Project at a glance

Clew is an open-source Obsidian-style note app: Electron shell, plain-JS web
components, CodeMirror 6 editor, and the **jmarkdown** engine
(`~/Sites/jmckalex/software/jmarkdown`, branch `at-migration`, consumed as a
`file:` dependency) for rendering. GPL-3.0-or-later.

**Session state, recent work, and open items live in `HANDOVER.md`** —
read it first. The full design plan (architecture rationale, milestones,
engine embedding facts, risks) lives at
`~/.claude/plans/groovy-forging-shell.md`. `demo-vault/` is both the
documentation (a Welcome hub + `Guide/` notes) and the test corpus — every
guide note exercises the features it documents.

- **House style:** plain JavaScript ES modules + web components. No
  frameworks, no TypeScript. Tabs for indentation. Small hand-rolled
  utilities over dependencies.
- **Build:** esbuild via `scripts/build.js` — four bundles (main ESM, preload
  CJS, renderer, preview-client) plus verbatim copies of `styles/`,
  `index.html`, and `src/engine/`. `npm run dev` = esbuild watch + Electron;
  renderer rebuilds hot-reload the window, main/preload rebuilds respawn
  Electron.
- **Tests:** `npm test` (`node --test`, files in `tests/`): workspace tree,
  note-metadata extractor, BibTeX parser, and the ported jmarkdown-scan
  suite — 90 tests. DOM/UI work is verified with the smoke harness instead.
- **Smoke harness:** `CLEW_SMOKE=/path/out.png CLEW_SMOKE_SCRIPT=scenario.js
  [CLEW_SMOKE_FRAME_SCRIPT=frame.js] electron .` boots the app, runs the
  scenario in the renderer (dev hook `window.__clew` exposes the stores,
  registry, ipc), optionally drives the preview iframe's document via
  webFrameMain, screenshots, and quits. Use it for every UI change.

## Architecture (three processes + render workers)

- `src/main/` — `main.js` (window, menus, navigation guards, smoke hook),
  `vault.js` (vault manager, chokidar watcher, file ops, attachment saving,
  `.clew/` state), `indexer.js` (the metadata cache: extractor over every
  note, link resolution, incremental patches), `render-service.js` (one-shot
  warm jmarkdown workers — see below — plus `toolchainPath()`, which extends
  PATH with TeX/homebrew dirs), `protocol.js` (`clew-preview://`),
  `search.js`, `export.js` (HTML/LaTeX/PDF via the engine), `rename-links.js`
  (vault-wide wikilink rewriting), `settings.js`, `ipc.js` (every handler;
  channel names in `src/shared/channels.js`).
- `src/preload/preload.cjs` — the entire bridge: `window.clew.{invoke,on}`,
  restricted to `clew:*` channels.
- `src/shared/` — `channels.js`, `note-metadata.js` (regex-level extraction;
  NEVER the engine), `bib.js` (BibTeX fields for citation completion).
- `src/engine/` — assets the render worker loads: `wikilinks.js` (Obsidian
  links/embeds incl. media), `obsidian-fences.js` (```mermaid fences),
  `clew-template.html` (local assets, no CDN), `preview.css`.
- `src/preview-client/client.js` — injected into every rendered note:
  morphdom patching, postMessage bridge, checkbox enabling, mermaid theming.
- `src/renderer/` — `state/` (Emitter stores: vault/workspace/settings/ui/
  bookmarks), `workspace/tree.js` (pure layout model: n-ary splits,
  kind-aware tabs — 'note' | 'file' | 'graph' | 'settings' | 'empty' — and
  per-tab history), `editor/` (`pool.js` owns every EditorView; `jmd/` is the
  dialect overlay ported from jmacs; `complete/` has wikilink/tag/citation
  sources; `attachments.js` paste/drop), `commands/` (`registry.js` chord
  dispatch + `builtin.js` every command), `preview/scroll-sync.js`,
  `components/` (light-DOM web components), `styles/` (all colors are custom
  properties in `styles/themes/{dark,light}.css` on `body[data-theme]`).

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
- The preview iframe is **deliberately unsandboxed** (a sandbox blocks
  Chromium's PDF plugin for `![[x.pdf]]` embeds). Isolation instead:
  previews live on the `clew-preview://` origin (app is `file://`),
  `setWindowOpenHandler` denies all popups, and a `will-navigate` guard
  pins the app frame. Don't re-add the sandbox attribute without solving
  PDF embeds another way.
- Exports (`export.js`) use the note's own directory as cwd — the user's
  normal jmarkdown config cascade, NOT the Clew preview config.

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
  listeners — so the palette and the settings hotkey editor see them.
- **Cmd+W is the renderer's** (close tab): no `role: 'close'` in the menu.
- Editor↔preview scroll sync runs over `preview/scroll-sync.js` (bus +
  per-side suppressors). Emit only on user scroll; `suppress()` before any
  programmatic scroll.
- Obsidian compatibility is a hard constraint: never write into
  `.obsidian/`, keep `[[wikilink]]` semantics Obsidian-shaped, `.md` files
  stay `.md`. Clew state lives in `.clew/` (gitignored).
- Engine changes belong upstream in the jmarkdown repo, additive and
  config-gated, coordinated with its own conventions (read its CLAUDE.md +
  HANDOVER.md first; stage by explicit path — its working tree deliberately
  carries uncommitted files).
