# CLAUDE.md

Guidance for Claude Code working in the **Clew** repository.

## Project at a glance

Clew is an open-source Obsidian-style note app: Electron shell, plain-JS web
components, CodeMirror 6 editor, and the **jmarkdown** engine
(`~/Sites/jmckalex/software/jmarkdown`) for rendering. GPL-3.0-or-later.

The full design plan (architecture, milestones M1–M5, engine embedding facts,
risks) lives at `~/.claude/plans/groovy-forging-shell.md`. Read it before
large changes.

- **House style:** plain JavaScript ES modules + web components. No
  frameworks, no TypeScript. Tabs for indentation. Small hand-rolled utilities
  over dependencies.
- **Build:** esbuild via `scripts/build.js` (three bundles: main, preload,
  renderer + verbatim copy of `styles/` and `index.html`). `npm run dev` runs
  esbuild watch + Electron; renderer rebuilds hot-reload the window, main
  rebuilds respawn Electron.
- **Tests:** `npm test` (`node --test`, files in `tests/`). Pure logic
  (workspace tree, later: link resolution, metadata extraction) gets tests;
  DOM components are exercised via the smoke hook instead.

## Architecture (three processes)

- `src/main/` — app lifecycle (`main.js`), vault manager + chokidar watcher
  (`vault.js`), app settings (`settings.js`), all ipcMain handlers
  (`ipc.js`). Renderer-supplied paths are vault-relative; `vaults.resolve()`
  rejects escapes.
- `src/preload/preload.cjs` — the entire bridge: `window.clew.{invoke,on}`,
  channels restricted to the `clew:` prefix. Channel names live in
  `src/shared/channels.js`, imported by both sides.
- `src/renderer/` — everything visible:
  - `state/` — Emitter-based stores (`vaultStore`, `workspaceStore`,
    `settingsStore`, `uiStore`). Components subscribe via `ClewElement.listen`
    (auto-unsubscribed on disconnect).
  - `workspace/tree.js` — the pure layout model: n-ary splits, tab groups,
    per-tab history, (de)serialization. Unit-tested; keep it DOM-free.
  - `editor/pool.js` — **owns every CodeMirror EditorView**, keyed by tab id,
    plus dirty state and auto-save (1s debounce; flush on blur/close).
    Components adopt `entry.view.dom` but never destroy views.
  - `components/` — web components in light DOM (no shadow DOM). The
    workspace reconciler (`clew-workspace.js`) reuses elements by
    `data-node-id` so editor DOM survives layout changes.
  - `styles/` — plain CSS, copied verbatim. All colors are custom properties
    defined only in `styles/themes/{dark,light}.css` on `body[data-theme]`.

## Conventions and gotchas

- **Editor ownership:** only `editorPool` creates/destroys EditorViews.
  A `<clew-editor-view>` adopts the pooled DOM node; tab drag/splits reparent
  it losslessly. Call `editorPool.flush(tabId)` before anything that might
  drop a buffer.
- **Cmd+W is the renderer's** (close tab). Don't add `role: 'close'` to the
  app menu.
- Commands + keybindings live in `renderer/commands/registry.js` (chord
  dispatch, CM notation) and `renderer/commands/builtin.js` (every command
  definition). Add new shortcuts as commands there — never as ad-hoc
  keydown listeners — so the palette and future hotkey editor see them.
- The render pipeline (M2+) — engine patches, wikilink extension, preview
  protocol, sync contract — is documented in the plan file; the preview
  client lives in `src/preview-client/`, engine assets in `src/engine/`.
- The vault watcher emits full-tree refreshes on structure changes and
  `EV_FILE_CHANGED` per content change; open clean editors reload themselves
  (dirty editors keep local edits — conflict UI is future work).
- **Smoke testing:** `CLEW_SMOKE=/path/out.png CLEW_SMOKE_SCRIPT=scenario.js
  electron .` boots the app, runs the scenario in the renderer (dev hook:
  `window.__clew` exposes the stores), screenshots, and quits. Use this to
  verify UI work headlessly.
- The jmarkdown engine must NEVER run in-process (it mutates globals and can
  `process.exit`); rendering goes through forked one-shot warm workers (M2).
- Obsidian compatibility is a hard constraint: never write into `.obsidian/`,
  never rename `.md` on users, keep `[[wikilink]]` semantics Obsidian-shaped.
