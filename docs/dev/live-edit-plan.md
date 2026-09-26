# Live edit mode — implementation plan

Status: DESIGN, written 2026-09-26 on branch `feat/live-edit`, for the model
that builds it. Everything here was checked against the tree at `ed2aabc`
(0.10.0). Where this plan and the code disagree, measure, then fix the plan.

When the feature ships, this file becomes `docs/dev/live-edit.md` — the
durable dev doc CLAUDE.md indexes — with the phase/acceptance sections
deleted and the architecture sections kept current.

---

## 0. How to work this plan

Read, in order: `CLAUDE.md`, `HANDOVER.md`, this file. Then `npm install`
in this worktree (it shares nothing with the main checkout: no
`node_modules/`, `zeta-assets/`, `mptikz-assets/`, `build-engine/`), then
`npm test` (644 green) and `node scripts/build.js` before touching anything.

House rules that bite here (all from CLAUDE.md; restated because every one
of them is tempting to break in this feature):

- Plain JS ES modules, web components, tabs. No frameworks, no TypeScript.
- **The engine never runs in the renderer.** Anything that needs jmarkdown
  goes through the render service's fragment path (§7). The renderer may
  parse (lezer, the jmd scanner) but never render markdown to HTML itself
  beyond the tiny inline subset defined in §5.3.
- **Never edit `vendor/`.** The one engine change this plan needs (§7.2,
  `currentFile`) goes to the jmarkdown master and is re-synced.
- **Shortcuts are commands** (`commands/registry.js`) — never ad-hoc
  keydown listeners. Every toolbar button dispatches a command id.
- **The compat line is drawn.** Live edit renders what reading mode renders
  and refuses what reading mode refuses, by name. Do not add Obsidian
  behaviours on your own judgment.
- Heavy wasm (EmbedPDF, mp-tikz-wasm, LibreOffice) lives in
  `clew-preview://` documents, never the app page. MathJax is the ONE
  library this plan loads into the app page, and `lib/mathjax.js` already
  does (the CSP allows `clew-preview://vault/__clew_assets__/`).
- Stage explicit paths; never `git add -A`. Run the smoke harness for every
  UI change. The manual in `../Clew-docs` and the demo vault are part of
  the deliverable (§11).
- Owner's bug reports have been consistently right. Measure before naming
  a cause.

Definition of done for the whole feature: every phase's acceptance list in
§12 passes, `npm test` is green, every scenario in §10 runs clean over its
fixture, the manual and demo vault match, CLAUDE.md has the new subsection,
and HANDOVER.md is rewritten.

---

## 1. What is being built

**Live edit** is a third view mode for note tabs, alongside `source` and
`reading`: the CodeMirror editor, with the markdown *syntax concealed and
the result drawn in its place* everywhere except where the cursor is.
Obsidian calls this Live Preview. The rule the whole feature hangs on:

> A construct is **revealed** (its source shown, exactly as in source mode)
> when any selection range touches it; otherwise it is **concealed**
> (delimiters hidden, content styled, or the block replaced by a rendering).
> Moving the cursor into a construct reveals it; moving out conceals it.
> Nothing about the document changes. Live edit is source mode wearing a
> costume, and every keystroke lands in the same `EditorView` (§3.1).

What "rendering" means depends on the construct (§5 has the full
catalogue):

- **Tier A — decorations.** Inline styles, headings, lists and tasks,
  quotes and callouts, links and wikilinks, tags, footnote badges,
  citations, escapes, directive/environment frames, block ids, frontmatter
  as properties rows, horizontal rules, `{{TOC}}`, and **all math** (inline
  and display, typeset by MathJax in the app page — no engine round trip).
  Pure CodeMirror decorations, synchronous, cheap.
- **Tier B — renderer-built widgets.** Tables (a real `<table>` built from
  the parse tree) and images (`<img>` over `clew-preview://`). Renderer
  DOM, no engine.
- **Tier C — engine-rendered block frames.** Everything the engine or the
  preview-client stack owns: mermaid, TikZ/MetaPost/LaTeX figures, leaflet
  maps, `query`/`tasks`/`kanban`, Dataview/Bases, note/PDF/office/canvas/
  Excalidraw embeds, `@reveal`, `:::game`, `:::Mathematica`,
  `:::markdown-demo`, HTML blocks with custom elements. Each such block is
  a placeholder in the editor and a small `clew-preview://` iframe rendered
  through the existing fragment path (§7). Reading mode's fidelity, bounded
  by laziness and a frame cap.

Plus a **toolbar** (§6): a per-pane formatting bar driven by the command
registry, with context-sensitive state, popovers for the structured
inserts, width-aware overflow, keyboard navigation, a mode switch, a
settings-driven layout, and a selection bubble variant.

### 1.1 Non-goals (v1)

- In-place editing inside rendered tables (cells edit as source on
  activation; §5.5). Obsidian's table editor is a v2 item.
- Meta Bind widgets rendered live in prose (`INPUT[…]` shows as a chip;
  the frame path renders the fences). §5.4.
- Live rendering of `|live` office embeds (thumbnail in live edit; §7.6).
- Slash commands (`/` menu). Listed as a follow-on in §13.
- Multi-paragraph inline footnotes concealed (single-line ones are; §5.2).
- Obsidian `%%comments%%` (the engine does not render them; nothing to
  mirror).
- Live edit over documents above `BIG_DOC` (500k chars): the tab falls back
  to source with a notice (§9).

---

## 2. Ground truth: the editor as it stands

Read these before designing anything; the plan assumes them.

| Thing | Where | What matters here |
| --- | --- | --- |
| Editor assembly | `src/renderer/editor/editor.js#makeNoteState` | One extension list. `markdown({ base: markdownLanguage, extensions: [{remove:['IndentedCode','SetextHeading']}, jmdFootnotes, jmdMath], codeLanguages: fenceLanguage })`. `markdownLanguage` = GFM + Subscript + Superscript + Emoji, so the tree has `Table`, `Task`, `Strikethrough` (`~~`), `Subscript` (`~x~`), `Superscript` (`^x^`), `Autolink`. |
| Editor pool | `editor/pool.js` | Owns every `EditorView`; per-path `EditorState` cache (undo survives navigation); dirty/auto-save/conflict. Components adopt `entry.view.dom`. **Live edit must not create a second view or a second state** — it is a reconfiguration of the same one. |
| Dialect overlay | `editor/jmd/overlay.js` → `jmarkdown-scan.js` | A ViewPlugin painting `jmd-*` mark decorations from the pure regex scanner. Scan memoised per `Text`; decorations built for `visibleRanges` only; degrades past `BIG_DOC`. The scanner emits FLAT `captures {start,end,face}` plus `folds`, `injections`, `regions` — no structured constructs (fixed in §4.1). |
| Grammar extensions | `jmd/math-parser.js` (`JmdMath`, before `Escape`), `jmd/footnote-parser.js` (`JmdFootnoteMark`, before `Link`) | Precedent for claiming dialect syntax in the LEZER tree. "A face cannot un-parse a node": when the tree and the overlay disagree, fix the grammar. |
| Math segments | `jmd/math-segments.js` (`MARKDOWN_MATH_CONFIG`) | `$…$`, `$$…$$`, `\(…\)`, `\[…\]`, top-level `\begin{equation|align|alignat|gather|multline|flalign|eqnarray|displaymath}` (starred too). Escapes respected; no pair crosses a blank line. |
| Theme | `editor/theme.js`, `styles/editor.css` | `cmt-*` classes from lezer tags; `jmd-*` from the overlay; every colour a `--clew-*` variable from `styles/themes/{dark,light}.css`. `.cm-gutters` hidden; `.cm-line` padding `0 24px`; content max-width `--clew-editor-line-width`. |
| Fence grammars | `editor/langs/` | ```tikz/latex/tex → TeX stream mode; ```metapost → MetaPost; everything else plain. |
| Tables | `editor/tables.js` | Pure `splitRow`/`tableAround`/`formatTable`/`blankRow` + a `Prec.high` keymap. Reuse the pure parts for the table widget. |
| Formatting commands | `commands/format.js` + `shared/format-spec.js` | Every inline/heading/list/alert/table/insert/block action is already a registry command (`edit:format-*`, `format:*`); `FORMAT_MENU` drives the native Format menu. `needsEditor = notePath && mode !== 'reading'` — already true for a `live` mode. **The toolbar reuses these; it adds only what is missing.** |
| Command registry | `commands/registry.js`, `builtin.js`, `menu-bridge.js` | `registerCommand({id,name,hotkeys,when,run})`; `effectiveKeymap()`; `prettifyChord` (in builtin.js — export it). Menu state pushed over `MENU_STATE` (`readingMode`, `hotkeys`, …). |
| Mode today | `workspace/tree.js` (`tab.view.mode: 'source'|'reading'`), `state/workspace-store.js#setTabMode`, `commands/actions.js#toggleReadingMode`, `components/workspace/clew-tab-group.js#render` (reading → `<clew-preview-view>`, else `<clew-editor-view>`), `main/menu.js` (View → "Reading Mode" checkbox), `main/settings.js` (`newTabMode: 'source'|'reading'`) | Every one of these grows a third value (§3.3). |
| Editor view | `components/workspace/clew-editor-view.js` | Adopts the pooled DOM, conflict banner, view-state save/restore (`cursor`, `scrollTop`, `cursorLine`, `readingLine`, `pendingLine`), scroll-sync bus. Toolbar and mode effect hook in here. |
| Preview view | `components/workspace/clew-preview-view.js` | The host side of the preview postMessage protocol (`ready`, `link-click`, `checkbox-toggle`, `task-toggle`, `field-edit`, `api-request`, `focused`, `chord`, `app-chord`, `scrolled`, `source-line-click`, `embed-collapse`, `morph-failed`, …). The block-frame layer needs the SAME switch (§7.4 factors it out). |
| Fragment render | `main/protocol.js` (`POST …/<sid>/__clew_fragment__`), `main/render-service.js#renderFragment` | Text in, body HTML out; same worker pipeline and config as notes; cached by sha1(text), bounded 500. Origin-guarded (file:// and clew-preview:// only). `lib/preview-url.js#fragmentUrl()` exists. Fragment builds skip `data-source-line`. |
| App CSP | `src/renderer/index.html` | `script-src 'self' clew-preview://vault/__clew_assets__/ …; img-src 'self' data: clew-preview:; frame-src clew-preview:; connect-src 'self' clew-preview:`. MathJax in-app, vault images, block iframes and fragment fetches are all allowed today. Remote `http(s)` images are NOT (§13 decision). |
| MathJax in app | `lib/mathjax.js` | Lazy tex-svg from the preview assets, config mirrored from the engine default (`tags: 'ams'`). Used by canvas cards. Extend, don't duplicate (§5.6). |
| Vault settings | `<vault>/.clew/vault-settings.json` via `CH.VAULT_SETTINGS_GET/SET` | `normalSyntax` flips the dialect to standard Markdown emphasis. The editor does not read it today; live edit must (§4.3). |
| Smoke harness | `main.js` (CLEW_SMOKE*), `smoke/README.md` | Real input via CDP, frame scripts via webFrameMain, `CLEW_SMOKE_MENU=1`. §10 adds a multi-frame knob. |

Engine facts the catalogue relies on (`vendor/jmarkdown/src/syntax-modifications.js`,
read 2026-09-26): italics `/^\/([^\/.?!]+[.?!]?)\//`; strong `/^\*([^\*]+)\*/`;
intense `/^\*\*([^*]+)\*\*/`; highlight `/^==([^=]+)==/`; underline
`/^__([^_]+)__/`; subscript `/^_([a-zA-Z0-9]|\{[^}]*\})/`; superscript
`/^\^([a-zA-Z0-9]|\{[^}]*\})/`. So in this dialect `_x_` is NOT emphasis
(it is subscript-x followed by a literal underscore) and `^x^` is NOT a
thing (superscript-x, literal caret) — the CLAUDE.md statement is right and
the authoring skill's `^x^` line is wrong. `~x~` is strikethrough. `%`
inline comments exist only when a note's metadata header asks for them
(`create_inline_comment_extension`) — not modelled.

---

## 3. Architecture

### 3.1 One EditorView, one facet

Live edit is a **runtime reconfiguration of the existing note state**, not a
new editor. `makeNoteState` gains a `Compartment` holding the live-edit
extension bundle, and the pool exposes:

```js
// editor/pool.js
setMode(tabId, mode)   // 'source' | 'live' — dispatches liveCompartment.reconfigure(...)
```

A `Compartment` (not a `StateEffect` flag) so that the cached
`EditorState` for a path carries its own configuration and undo history
untouched, and so that turning live edit off unloads every plugin and
field (no decoration set lingers, no frame layer keeps iframes alive).

The bundle (`editor/live/index.js#liveEdit(config)`) is:

```
liveConfigFacet        static per-vault facts: normalSyntax, reveal mode, render flags
revealField            StateField<RevealState>: which constructs are revealed (from selection)
blockField             StateField<DecorationSet>: block-level replacements (§3.2)
inlineLayer            ViewPlugin: inline marks/widgets/line decorations for visibleRanges
frameLayer             ViewPlugin: Tier C iframes hoisted into the scroller (§7.3)
liveKeymap             Enter/Backspace/Tab behaviours that only make sense concealed (§5.9)
liveEventHandlers      click on links/checkboxes/frames, hover tooltips
liveTheme              EditorView.theme for le-* structure (colours stay in editor.css)
```

Everything else in `makeNoteState` stays exactly as it is: the overlay keeps
painting `jmd-*` faces (they are what "revealed" looks like), the grammars
stay, completions stay, tables keymap stays.

### 3.2 Two decoration providers, by CodeMirror's rules

CodeMirror 6 forbids a ViewPlugin from providing decorations that change the
vertical block structure — block widgets, or replacements that span a line
break — because the viewport is computed before plugins update. Therefore:

- **`blockField` (StateField → `EditorView.decorations.from(field)`)** owns
  every `Decoration.replace({ widget, block: true })` and every replacement
  spanning lines: display math, tables, images on their own line, Tier C
  placeholders, frontmatter, `{{TOC}}`, horizontal rules, folded callout
  bodies, concealed directive opener/closer lines. It is recomputed on
  `docChanged` (from the lezer tree + the scanner's constructs, whole
  document — both are incremental/memoised) and re-filtered on
  `selectionSet` (cheap: reveal is a range test).
- **`inlineLayer` (ViewPlugin, `decorations` accessor)** owns marks, inline
  widgets and `Decoration.line` for `view.visibleRanges` only, rebuilt on
  `docChanged || viewportChanged || selectionSet || revealChanged`, memoised
  per (doc, viewport, reveal signature).

Both read one shared model: `editor/live/model.js#liveModel(state)` — the
list of **constructs** in the document (§4), memoised per `Text` via a
`WeakMap`, so the two providers never disagree about where a construct is.

### 3.3 Mode plumbing (every place `'reading'` is special today)

| Where | Change |
| --- | --- |
| `workspace/tree.js` | `view.mode: 'source' \| 'live' \| 'reading'`. New `view.editMode: 'source' \| 'live'` — the edit mode this tab last used, so ⌘E from reading returns to it. `createTab` sets `mode` from the caller's default (unchanged API). `cloneTab` copies `editMode`. `serialize`/`hydrate` carry both; a workspace.json from before this change loads with `editMode` undefined → treated as `'source'`. |
| `state/workspace-store.js#setTabMode` | When `mode !== 'reading'`, also set `view.editMode = mode`. |
| `commands/actions.js` | `toggleReadingMode()`: reading → `view.editMode ?? defaultEditMode()`; else → reading (flush first, as now). New `toggleLiveEdit()`: source ↔ live (no-op in reading). New `setViewMode(mode)`. `defaultEditMode()` = settings `defaultEditMode` (`'source'` unless the user changed it). |
| `commands/builtin.js` | `workspace:toggle-mode` (⌘E) unchanged id, new run; **new** `workspace:toggle-live` `['Mod-Shift-e']` "Toggle live edit / source"; `workspace:mode-source`, `workspace:mode-live`, `workspace:mode-reading` (no hotkeys; menu radios + palette); `view:toggle-toolbar`. |
| `commands/menu-bridge.js` | Push `viewMode` (`'source'\|'live'\|'reading'\|null`) and `toolbarVisible` alongside `readingMode` (keep `readingMode` — `needs:'editor'` reads it). |
| `main/menu.js` | View menu: "Reading Mode ⌘E" checkbox stays; add "Live Edit ⌘⇧E" checkbox (`checked: viewMode === 'live'`); a radio triplet "Source / Live Edit / Reading" under a `Mode` submenu; "Editor Toolbar" checkbox. `defaultState` gains `viewMode: null, toolbarVisible: false`. |
| `components/workspace/clew-tab-group.js#render` | `mode === 'reading'` → preview view (as now). `'source'` and `'live'` BOTH → `<clew-editor-view>`; the rendered-mode comparison treats them as one ('editor') so a source↔live flip does NOT `replaceChildren` (the editor view handles it, next row). |
| `components/workspace/clew-editor-view.js` | On connect and on `layout-changed`, read `tab.view.mode` and call `editorPool.setMode(tabId, mode === 'live' ? 'live' : 'source')`. Mount/unmount `<clew-editor-toolbar>` per the toolbar setting (§6.8). |
| `clew-preview-view.js` `source-line-click` | `setTabMode(tabId, tab.view.editMode ?? defaultEditMode())`, not the literal `'source'`. |
| `main/settings.js` DEFAULTS | `newTabMode` accepts `'live'`; new `defaultEditMode: 'source'`; new live/toolbar keys (§8). |
| `clew-settings-view.js` | New "Live edit" and "Toolbar" sections (§8). |
| `commands/format.js#needsEditor` | Unchanged (`mode !== 'reading'`). |
| `editor/wikilink-click.js` | Unchanged for source; live edit's own handler runs first (§5.2 links) and returns true when it consumed the click. |

`CLEW_SMOKE_MENU=1` must show the new items (§10).

### 3.4 Module map (new files)

```
src/renderer/editor/live/
  index.js            liveEdit(config) → Extension (the bundle); liveCompartment
  config.js           liveConfigFacet + readLiveConfig(settings, vaultSettings)
  model.js            liveModel(state) → Construct[] (tree + scanner → one list), memoised
  reveal.js           revealField; revealed(construct, selection, mode) — PURE, unit-tested
  block-field.js      blockField: block replacements from the model
  inline-layer.js     inline marks/widgets/line decorations over visibleRanges
  widgets/
    math.js           MathWidget (inline + display) over lib/mathjax.js
    task.js           checkbox widget; bullet/number marker widgets
    link.js           LinkWidget (md link / wikilink / autolink), unresolved state
    badge.js          footnote number, citation chip, block-id anchor, tag chip, directive chip
    callout.js        callout title bar (icon + inline-rendered title), fold chevron
    env.js            directive / environment head + foot
    table.js          TableWidget (Tier B) from lezer Table nodes + inline-dom
    image.js          ImageWidget (Tier B)
    frontmatter.js    PropertiesWidget (rows shared with the Properties panel)
    toc.js            {{TOC}} widget from headings
    hr.js             horizontal rule
    fence.js          code-fence head/foot chrome (language badge, copy)
    frame.js          Tier C placeholder widget (height cache, skeleton)
  inline-dom.js       renderInline(state, from, to) → DocumentFragment (the tiny subset, §5.3)
  frame-layer.js      Tier C iframe layer: lifecycle, positioning, laziness, cap, messages
  frame-host.js       host-side message switch shared with clew-preview-view (§7.4)
  keymap.js           Enter/Backspace/Tab conceal-aware behaviours
  events.js           click/hover handlers
  height-cache.js     per-editor LRU of block heights keyed by construct hash
src/renderer/editor/toolbar/
  toolbar-spec.js     groups, buttons, priorities, popover kinds (declarative)
  toolbar-state.js    deriveState(state, model) — PURE, unit-tested
  toolbar-layout.js   layoutGroups(groups, widths, available) — PURE, unit-tested
  clew-editor-toolbar.js   <clew-editor-toolbar> element
  clew-selection-bubble.js <clew-selection-bubble> element
  popover.js          anchored popover primitive (one open at a time)
  popovers/           link.js table.js callout.js heading.js code.js diagram.js math.js insert.js block.js
src/renderer/editor/jmd/scan-cache.js   scanFor(doc) — the one memoised scan (overlay, folding, live share it)
src/renderer/editor/jmd/subsup-parser.js JmdSubscript / JmdSuperscript / JmdBlockId grammar (§4.2)
src/renderer/state/vault-settings-store.js   cache + 'vault-settings-changed' (§4.3)
src/preview-client/client.js            block-document additions (§7.5) — same file, one flag
src/main/protocol.js                    __clew_block__ endpoint (§7.2)
src/main/render-service.js              renderFragment(text, { sourcePath, dependent }) (§7.2)
```

Changed files are named in their sections. CSS: a new
`src/renderer/styles/live-edit.css` (imported by `main.css`) for `le-*`
structure and colours-by-variable; `toolbar.css` likewise.

---

## 4. The construct model

### 4.1 Extend the scanner to emit constructs

`jmarkdown-scan.js` today returns `{captures, regions, folds, injections}`.
Add a fifth array, **`constructs`**, populated by the same passes that emit
captures (so positions cannot disagree), each:

```js
{
  kind,          // see table
  start, end,    // whole construct, delimiters included
  open,          // {start,end} of the opening delimiter run (null for tags)
  close,         // {start,end} of the closing delimiter (null when none)
  ...parts       // kind-specific offsets, all absolute
}
```

| kind | parts | emitted by |
| --- | --- | --- |
| `italic` | `body` (`close` null when a blank line ended it) | the `/…/` pass |
| `highlight` | `body` (likewise) | `==…==` |
| `mustache` | `name` | `{{…}}` |
| `wikilink` / `embed` | `target`, `heading`, `blockId`, `alias` (ranges or null), `aliasText` (string); `open` is `[[` or `![[` | wikilink pass |
| `tag` | `name` (no `#`) | tag pass |
| `cite` | `command` (e.g. `citep`, no backslash), `notes: [range]` (the `[pre][post]` interiors), `keys: [range]` (one per comma-separated key) | `\cite{}` family |
| `footnote` | `label`, `group`, `body` (null when unclosed — the opener alone), `multiline: bool` | footnote pass |
| `directiveBlock` | `name` (null for a bare `:::`), `content`, `attrs`, `colons`, `body` (`close` null when unclosed, running to EOF) | `:::name` pass, incl. the verbatim `:::TiKZ`/`:::mermaid` |
| `directiveInline` | `name`, `content`, `attrs`, `block: bool` (`::name[…]` vs `:name[…]`) | inline directive pass |
| `directiveAt` | `name`, `content`, `attrs`, `block: bool` (`@name+[…]`) | `@name[…]` pass |
| `environment` | `name`, `content`, `attrs`, `body` (`close` null when unclosed) | `@begin/@end` pass, incl. the verbatim TeX/mermaid bodies |
| `metaHeader` | `body` (`open` null for a fence-less legacy header) | metadata header pass |
| `htmlBlock` / `scriptBlock` / `styleBlock` | — | HTML/script/style passes |
| `math` | `display: bool`, `body`, `env` (name or null; for an environment `body` is the whole `\begin…\end`, `open`/`close` the commands) | the math-segments pass already run first |

As built (Phase 0): every part is a `{start, end}` range or null — no
bare `bodyStart`/`bodyEnd` numbers; `content`/`attrs` are the INTERIORS of
the `[…]`/`{…}` groups; a block's `body` runs from the line after its
opener to the newline before its closer. The array is sorted by `start`,
outer before inner. `scan-cache.js#scanFor(doc)` is the one memoised scan
(overlay's non-degraded path and folding use it). The typedef in
`jmarkdown-scan.js` is the reference.

Keep `captures` byte-identical (the 100-odd scanner tests stay green; add
`tests/jmarkdown-constructs.test.js`). The scanner is Clew's own copy of the
jmacs port; offer the change upstream afterwards, it is not a blocker.

### 4.2 Grammar prerequisites (lezer)

Live edit reads emphasis from the lezer tree, and the tree is wrong for the
dialect in two places. Fix the grammar, not the faces:

1. **`jmd/subsup-parser.js`** — a `parseInline` extension registered
   `before: 'Escape'` (the math parser's position; order among the jmd
   parsers: math, then this, then footnotes) that claims:
   - `_c` / `_{…}` → `JmdSubscript` (marks: `JmdSubSupMark` for the `_`
     and the braces);
   - `^c` / `^{…}` → `JmdSuperscript`;
   - a `^` **preceded by whitespace** whose rest-of-line matches
     block-refs.js's `ID` to end of line → `JmdBlockId` instead (mirrors
     the engine's claim-the-whitespace rule; import `ID` from
     `src/engine/block-refs.js` like `block-ids.js` does), and a line that
     is only `^id` → the same node.
   Consequence: `_x_` no longer parses as `Emphasis`, `x^2^` no longer as
   `Superscript`, matching the engine. Gate the whole extension on
   `normalSyntax` being off (under normal syntax `_x_` IS emphasis).
2. **Emphasis meaning is decided by the delimiter character**, read from
   the `EmphasisMark` text: `*x*` → strong, `**x**` → intense, `__x__` →
   underline; `_x_` cannot occur (above). lezer `Subscript` (`~x~`) and
   `Strikethrough` (`~~x~~`) both → strike. Under `normalSyntax`: `*`/`_`
   emphasis → italic, `**`/`__` → bold, `~~` → strike, `~x~` → subscript,
   `^x^` → superscript (standard lang-markdown meaning).

The markdown language config becomes a `Compartment` in `makeNoteState`
so a `normalSyntax` flip reconfigures every open editor without losing
undo history (§4.3). As built (Phase 0): the config is one node-importable function,
`jmd/markdown-config.js#noteMarkdown({normalSyntax})`, which editor.js
installs inside the exported `markdownCompartment` and which the grammar
tests (`math-`, `footnote-`, `subsup-syntax`) parse with — so the tests see
what the editor sees. Block-id detection needs the id to run to the end of
the INLINE SECTION (the engine's `$` is end-of-paragraph, not end-of-line).
Visible side effect in source mode: `_x_` no longer paints `cmt-emphasis`,
nor `^x^` GFM superscript — the engine renders neither. Add `tests/subsup-syntax.test.js` (parse with
`markdownLanguage.parser.configure(...)` under node, assert node names at
positions — the pattern `tests/math-syntax.test.js` uses).

### 4.3 Vault settings in the renderer

New `state/vault-settings-store.js`: loads `CH.VAULT_SETTINGS_GET` on
`vault-opened`, exposes `get(key)`, and emits `vault-settings-changed(key)`
after any `set` (the settings view routes its `VAULT_SETTINGS_SET` calls
through it; `note-api.js`, `clew-app.js`, `clew-file-explorer.js` may keep
their direct reads or migrate — not required). The pool listens for
`normalSyntax` and reconfigures the markdown compartment of every live view
and drops the state cache (cached states hold the old grammar).

### 4.4 The unified model

`live/model.js#liveModel(state)` walks `syntaxTree(state)` once and merges
the scanner's constructs (via `scan-cache.js`) into one ordered array of
`Construct` records with a common shape:

```js
{ id,            // stable hash of (kind, text) — the height-cache / frame key
  kind,          // 'heading' | 'strong' | … (the catalogue's names, §5)
  tier,          // 'A' | 'B' | 'C'
  level,         // 'inline' | 'line' | 'block'   (decides the reveal extent, §4.5)
  from, to,      // document offsets
  lineFrom, lineTo,
  hidden: [{from,to}],   // delimiter ranges to conceal (inline/line kinds)
  ...kind-specific }
```

Tree-derived kinds: heading, strong, intense, italic-std, underline,
strike, sub, sup, code, codeFence, link, autolink, image, quote, callout
(a `Blockquote` whose first line matches `/^>\s*\[!([\w-]+)\]([+-]?)\s*(.*)$/`),
bullet, numbered, task, hr, table, htmlBlock, escape, hardBreak, math (from
`JmdMath`), footnote (from `JmdFootnoteMark` pairs), subscript/superscript/
blockId (from §4.2), paragraph. Scanner-derived kinds: the §4.1 table.
Where both know a construct (math, footnotes) the tree wins and the scanner
entry is dropped (positions are identical by construction — assert in dev).

Alignment lines (`>> text <<`, `>> text`) are detected by regex on the
line BEFORE the Blockquote nodes on that line are considered, and win.
Description lists (`Term:: …`, `Term::` + indented body) likewise by regex
(paragraph-level, cosmetic only).

Memoised per `Text` in a `WeakMap`; the tree comes from
`ensureSyntaxTree(state, doc.length, 50)` — accept a partial tree past the
timeout (the inline layer only needs the viewport; the block field can be
re-run on the next update when the parser catches up: listen for
`syntaxTree(state) !== lastTree` in the field's update).

### 4.5 The reveal rule (pure, `live/reveal.js`)

```js
revealed(construct, ranges, mode)   // ranges: state.selection.ranges
```

- `mode === 'construct'` (default): revealed iff some range `[a,b]`
  (normalised) intersects the construct's **reveal extent**, boundaries
  inclusive: `a <= extent.to && b >= extent.from`.
- `mode === 'line'`: the extent is widened to whole lines first.
- Extents: `inline` kinds → `[from, to]`; `line` kinds (heading marks, list
  markers, quote/callout markers, alignment marks, block-id lines, fence
  opener/closer) → their line; `block` kinds (display math, table, Tier
  B/C blocks, frontmatter, TOC, hr, directive/environment opener+closer as
  a pair) → `[lineFrom.from, lineTo.to]`.
- Nesting: a revealed outer construct does NOT reveal inner ones
  (`*a /b/ c*` with the cursor on `a` shows the asterisks, keeps `/b/`
  concealed). A revealed inner construct does not reveal the outer.
- A callout/quote/env **body** is never "revealed" as a unit — its lines
  are ordinary markdown; only the marker/head/foot lines reveal
  (line-level), so typing inside a callout keeps the callout chrome.
- Editor not focused: reveal state still follows the selection (Obsidian
  parity; simpler than a focus special case).

`revealField` stores the set of revealed construct ids and a `signature`
string; providers compare signatures to skip rebuilds.

---

## 5. Construct catalogue

Legend — **conceal:** what happens when not revealed; **reveal:** what the
source looks like when touched (always the source-mode face unless stated);
**act:** interactions on the concealed form.

CSS classes are `le-<kind>`; delimiters concealed with
`Decoration.replace({})` (nothing) unless an inline widget is named.

### 5.1 Headings, paragraphs, breaks

| construct | conceal | reveal | act |
| --- | --- | --- | --- |
| `# …` ATX 1–6 | hide `HeaderMark` + the following space; `Decoration.line({class:'le-h le-h1'})`; font size/weight from `editor.css` (reuse `.cmt-heading*` sizes so revealed and concealed match) | `#` marks shown in `--clew-formatting` | — |
| trailing `#`s | hidden | shown | — |
| hard break (`  ` / `\`) | `\` hidden; a faint `↵` widget? No — nothing (Obsidian shows nothing) | shown | — |
| `\x` escapes (`Escape`) | hide the backslash | shown | — |
| entities `&amp;` | leave as source (rare) | — | — |
| alignment `>> t <<` / `>> t` | hide the marks; `le-center` / `le-right` line class (`text-align`) | shown | — |
| description list `Term:: def` | `Term` gets `le-dt` (600 weight); nothing hidden | — | — |

### 5.2 Inline constructs

| construct | conceal | act |
| --- | --- | --- |
| `*strong*` | hide marks; `le-strong` (=`.cmt-emphasis` weight 650) | — |
| `**intense**` | hide; `le-intense` (small caps) | — |
| `/italic/` | hide; `le-italic` | — |
| `__underline__` | hide; `le-underline` | — |
| `==highlight==` | hide; `le-highlight` (background `--clew-search-match`) | — |
| `~strike~` / `~~strike~~` | hide; `le-strike` | — |
| `_c` `_{…}` / `^c` `^{…}` | hide `_`/`^`/braces; `le-sub`/`le-sup` (`vertical-align`+`font-size:.75em`) | — |
| `` `code` `` | hide backticks; `le-code` (keep `.cmt-code` face) | — |
| `$x$` `\(x\)` | replace the whole segment with **MathWidget** (§5.6) | click → cursor at segment start (reveals) |
| `[text](url)` | hide `[`, `](url)`; text as `le-link`; `title` attr = url | **click follows** (external via `openExternal`; vault paths via `actions.openWikilink`); ⌥-click places the cursor instead. Hover: url tooltip. |
| `<https://…>` autolink | hide `<>`; `le-link` | click follows |
| `[[Target]]` | hide brackets; show `Target` (or `alias` when present — the target+pipe hidden) as `le-wikilink`; `le-unresolved` when `vaultStore.resolveNoteName(target)` is null (a resolve cache invalidated on `vault-changed`); `[[#Heading]]` shows `Heading` | click follows (`actions.openWikilink(target, {newTab: alt/meta})`); ⌥-click edits; `\|external` honoured exactly as `wikilink-click.js` does |
| `![[…]]` embeds | § 5.4 (image) / §7 (everything else); **inline** embeds (not alone on the line) show as a chip `⧉ name` + follow on click | |
| `#tag` `#a/b` | `le-tag` chip (existing `.jmd-tag` look, `#` kept) | click → `clew-app.openSearch()` with `tag:#name` prefilled (extend `openSearch(query)`) |
| `[fn: body]` `[^label: body]` (single line) | replace with a **superscript badge** `¹` numbered in document order (`le-fn`); body in a hover tooltip rendered by inline-dom | click → cursor at the opener (reveals) |
| multi-line footnote | NOT concealed (opener/body/closer keep their `jmd-footnote*` faces); the opener gets a `le-fn-open` left border so the note reads as a block | — |
| `\cite{k}` family | replace with chip `le-cite`: the key text; when `complete/citations.js`'s index resolves it, chip text = `Author Year` (extract a `citationLabel(key)` helper from that module) and tooltip = title; multiple keys → one chip per key inside one pill; command variant (`citep`/`citet`/`fullcite`) shown as a tiny prefix glyph only when not `cite` | click → reveals |
| `{{name}}` mustache | `{{TOC}}` alone on a line → §5.8; otherwise chip `le-var` with the name | — |
| `:name[content]{attrs}` / `@name[text]{attrs}` (inline, generic) | hide `:name[`, `]`, `{attrs}`; content styled `le-directive` (dotted underline, `title` = `name` + attrs) | — |
| `:TeX[…]` | keep the content but dim (`le-tex-only`, opacity .55, `title="LaTeX only"`); brackets hidden | — |
| `:HTML[…]` | content shown normally (brackets hidden) | — |
| `:label[k]` | anchor badge `⚓ k` (`le-label`) | — |
| `:ref[k]` `:cref` `:Cref` `@ref[k]` | `le-ref` link-styled `k` | click → cursor to the matching `:label[k]` if in this note |
| `:today` | today's date (`toLocaleDateString`) `le-today` | — |
| `INPUT[…]` / `VIEW[…]` (Meta Bind) | chip `le-widget` showing `type:field` — NOT rendered live (non-goal) | click → reveals |
| inline HTML tags | source, `cmt-meta` face | — |
| `^block-id` trailing / own line | hide; badge `le-block-id` (`⌗`) at the line end with tooltip `id` | click → copies `[[Note#^id]]` via the existing `copyBlockReference` path |

Concealed inline widgets set `WidgetType.ignoreEvent` → false for `click`
only, and their `toDOM(view)` attaches the handler (the widget receives
`view`). Cursor placement on click uses `view.posAtDOM(widget.dom)`.

### 5.3 The inline subset renderer (`inline-dom.js`)

`renderInline(state, from, to, model) → DocumentFragment`, used for callout
titles, table cells, footnote tooltips, TOC entries. It walks the syntax
tree's children in `[from,to]` and the model's inline constructs there and
emits: text, `<strong>`, `<em>`, `<u>`, `<mark>`, `<del>`, `<sub>`, `<sup>`,
`<code>`, `<a class="le-link">` (data-target for wikilinks), `<span
class="le-tag">`, `<span class="le-math">` (MathJax via §5.6), citation
chips. Anything else is emitted as its source text. It is NOT a markdown
renderer and must stay that size; `tests/inline-dom.test.js` pins the
subset with jsdom-free string assertions (render to a detached element
under node with a minimal DOM shim — or assert on a serialised token list
from a pure `inlineTokens(state, from, to)` and keep DOM building trivial;
prefer the latter).

### 5.4 Lists, tasks, quotes, callouts

| construct | conceal | act |
| --- | --- | --- |
| `- ` `* ` `+ ` bullet | replace `ListMark` with a **BulletWidget** (`•`, depth-styled: `•`, `◦`, `▪`); line class `le-li le-li-<depth>` with hanging indent: `padding-left: calc(24px + depth*1.5em)`, `text-indent: -1.5em`, the widget `display:inline-block; width:1.5em` so wrapped lines align under the text | click on the bullet → select the item's text |
| `1. ` numbered | keep the number text, hide nothing; same hanging indent with `min-width` | — |
| `- [ ]` / `- [x]` task | bullet hidden; `TaskMarker` replaced by **TaskWidget** (`<input type=checkbox>`), checked → line class `le-done` (muted, line-through the text) | click toggles: dispatch `[ ]`↔`[x]` at the marker (never rewrite anything else; goes through auto-save like any edit) |
| `> ` quote | hide `QuoteMark`+space; line class `le-quote le-quote-<depth>` (left border `--clew-quote`, padding) | — |
| `> [!type]±  Title` callout | first line replaced by **CalloutWidget** (block-level? No — it is one line: a line-level replace of the `> [!type]± ` marks with an inline widget: icon + `renderInline(title)`; empty title → the type's display name); every line of the quote gets `le-callout le-callout-<type>` (background/border/icon colour per type from `live-edit.css`, mirroring `engine/preview.css` and `callouts.js`'s table — **export `CALLOUT_TYPES` (canonical → {aliases, icon path, colour token}) from `src/engine/callouts.js`** so the editor, the toolbar popover and the engine share one table); `type` normalised through the aliases, unknown types render as `note` with the raw name as title (engine behaviour) | click on the chevron of a foldable (`+`/`-`) toggles the body fold: a `foldStateField` (per construct id, seeded from `-`/`+`) makes `blockField` replace the body lines with nothing (`Decoration.replace({block:true})` over `[secondLine.from, lastLine.to]`); folding does not edit the file (the `+`/`-` in the source is the *initial* state, as in reading mode) |
| admonition fences ```` ```ad-type ```` | Tier C (engine) | — |

Nested lists inside quotes/callouts compose (the line classes stack).

### 5.5 Blocks

| construct | conceal | reveal | act |
| --- | --- | --- | --- |
| `---` / `***` hr | block widget `<hr class="le-hr">` | source | click → reveals |
| frontmatter / metadata header | block widget **PropertiesWidget**: the typed rows of the Properties panel (§5.7) | raw YAML with `jmd-meta-*` faces | edits write through the same editor (undoable) |
| `$$…$$`, `\[…\]`, `\begin{align}…` | block **MathWidget** (display) | source, `jmd-math` face | click → reveals |
| table | block **TableWidget** (§5.5a) | source, formatted by nothing (never rewrite on reveal) | click on a cell → cursor to that cell's source start |
| image alone on a line (`![alt](src)`, `![[img.png\|320x60]]`) | block **ImageWidget** (§5.5b) | source | click → reveals; ⌥-click opens the file |
| code fence | NEVER concealed body: `CodeText` stays source with fence-language highlighting; opener line replaced by **FenceHead** (language badge + copy button; `CodeInfo` text hidden), closer by **FenceFoot** (thin rule); lines get `le-fence` (mono, background) | opener/closer shown | copy button copies `CodeText` |
| rich fences (`mermaid tikz latex tex metapost leaflet query tasks kanban dataview dataviewjs base ad-* meta-bind` + any language a plugin's engine surface registers — the list lives in `live/rich-fences.js`, imported by the toolbar too) | Tier C frame (§7) when `liveRenderFences`; else as code fence | source | — |
| `:::name` … `:::` (generic: theorem, abstract, title-box, comment, HTML, custom) | opener line → **EnvHead** widget (`name` + attrs summary as a caption, left rule), closer → **EnvFoot**; body lines `le-env le-env-<name>` (left rule `--clew-accent`); `:::TeX` body additionally `le-tex-only` (dimmed, head says "LaTeX only"); `:::comment` dimmed; nesting via `data-depth` from colon count | source | — |
| `@begin(name)`…`@end(name)` | same as above; `@begin(equation\|align\|…)` (the `MATH_ENVIRONMENT_NAMES`) → display MathWidget wrapping the body in `\begin{name}…\end{name}` | source | — |
| `:::mermaid`, `:::TiKZ`, `@begin(TiKZ\|metapost\|mermaid\|reveal)`, `:::game`, `:::Mathematica`, `:::markdown-demo`, `@reveal[…]`, `@name+[…]` for a name the engine renders richly | Tier C frame | source | — |
| `@name+[text]{attrs}` / `::name[content]` (generic block directive) | EnvHead-style caption + content inline | source | — |
| HTML block, `<script>`, `<style>` | source, `le-html` (mono, dim). An HTML block containing a custom element (`<[a-z]+-[a-z-]+`) or `<iframe`/`<video`/`<audio`/`<svg` → Tier C frame when `liveRenderEmbeds` | — | — |
| `{{TOC}}` alone on a line | block **TocWidget** (§5.8) | source | click an entry → cursor to that heading |
| `![[Note]]` `![[Note#H]]` `![[Note#^id]]` `![[x.pdf]]` `![[x.docx]]` `![[x.canvas]]` `![[x.excalidraw]]` `![[x.mp4]]` `![[x.base#View]]` alone on a line | Tier C frame | source | — |
| kanban board note (frontmatter `kanban-plugin`) | a top banner "This note is a Kanban board — boards render in reading mode"; otherwise Tier A only | — | banner button → reading mode |

#### 5.5a TableWidget

Built from the lezer `Table` node: `TableHeader`/`TableRow`/`TableCell`
ranges; alignment from the `TableDelimiter` row via `tables.js#splitRow`
(export an `alignmentOf(delimiterRowText)` from tables.js). Cells rendered
with `renderInline`. `eq()` compares the table's source text. Column widths
are the browser's. Click a cell → `view.dispatch({selection:{anchor:
cell.from}})` → the block reveals as source; the existing `tableKeymap`
takes over (Tab/Enter). A table with a trailing `^block-id` line keeps the
badge below the widget.

#### 5.5b ImageWidget

`<img>` with `src` from `lib/preview-url.js#vaultFileUrl(resolvedPath)` for
vault files (resolve `![[name.png]]` through `vaultStore.resolveFileName`),
`data:` and `clew-preview:` URLs as-is, and `http(s)` URLs **only if the
CSP is widened** (§13 decision; until then such images show a chip "Remote
image — shown in reading mode"). Size from the wikilink alias (`|320`,
`|320x60` — reuse the parsing in `src/engine/wikilinks.js`; export
`imageSize(alias)` from there) or from `![alt](src =300x)`-style not
supported (engine does not). `estimatedHeight` from the height cache; on
`load`, cache the natural height. `alt` → `title`.

### 5.6 Math (MathJax in the app page)

Extend `lib/mathjax.js`:

```js
export function mathReady()            // Promise<void>, loads once
export function typesetTex(tex, { display }) // → HTMLElement (mjx-container), SYNC once ready
export function texCached(tex, display)      // → HTMLElement | null (no load side effect)
export const mathEvents                       // Emitter: 'ready'
```

`typesetTex` uses `MathJax.tex2svg(tex, { display })`, with
`svg: { fontCache: 'local' }` in the app config so every widget's SVG is
self-contained (widgets come and go; a global glyph cache would be
invalidated by CodeMirror's DOM recycling). LRU 2000 entries keyed
`(display, tex)`; the cached element is `cloneNode(true)`d into each
widget. Errors: MathJax returns a container with `data-mjx-error`; the
widget then shows the source in `jmd-math` face with a red underline and
the message as `title`.

`MathWidget.toDOM(view)`: `texCached` hit → clone; miss → a
`<span class="le-math-pending">$…$</span>` (the source), call `mathReady()`
then `typesetTex`, then `view.dispatch({effects: mathRedraw.of(null)})`
(the inline layer / block field rebuild on that effect). `eq` compares
`(tex, display)`. Display widgets are block replacements; inline are inline
replacements.

Macros and numbering: MathJax keeps `\newcommand` state per page, so a
macro defined in one note leaks into another opened later; equation
numbers (`tags:'ams'`) increment across re-typesets. Mitigation in v1: the
block field typesets a document's display blocks in order on first build
(`MathJax.texReset()` first), so macros defined earlier in the SAME note
work; cross-note leakage is documented in the manual as a known limitation
("reading mode is the truth for macros"). §13 lists the v2 option (a
per-note MathJax `InputJax` instance).

### 5.7 PropertiesWidget

Extract the row rendering of `components/panels/clew-properties.js` into
`components/panels/properties-rows.js` (`buildRows(container, props,
{onChange, readOnly})`) and the write path into
`editor/frontmatter-edit.js#applyProperties(view, props)` (replace the
frontmatter range through the editor; `shared/frontmatter.js` for
parse/serialise, honouring `clean: false` → `readOnly` with an "Edit as
YAML" button that moves the cursor into the block). The panel and the
widget both use these; `tests/frontmatter.test.js` already covers the
subset. The widget is a block replacement of the whole header including
both `---` fences; `eq` compares the header text.

### 5.8 TocWidget

Headings from the model (`heading` constructs in order); nested `<ul>` by
level; entries via `renderInline`; click → `view.dispatch({selection,
effects: EditorView.scrollIntoView(pos, {y:'start'})})`. Reflects edits
because `eq` compares a hash of the heading list.

### 5.9 Conceal-aware keys (`live/keymap.js`, `Prec.high`, every handler returns false when not applicable)

- **Enter** at the end of a list item continues the list (`- `, `1. ` with
  the next number, `- [ ] ` for tasks — an empty item + Enter removes the
  marker instead (Obsidian/GFM editors' rule)). `markdownKeymap`'s
  `insertNewlineContinueMarkup` already does most of this — verify it
  handles tasks; extend rather than replace.
- **Enter** inside a callout/quote continues the `> ` prefix (same helper).
- **Backspace** at the start of an item's text removes the marker (again
  `deleteMarkupBackward` from lang-markdown — keep it; make sure the
  concealed bullet widget does not swallow the key: it does not, widgets
  are not focusable).
- **Tab / Shift-Tab** in a list item indents/outdents (`indentMore`/
  `indentLess` from `@codemirror/commands`, applied to the item's lines) —
  after the table keymap and before `indentWithTab`. Also registered as
  `format:indent` / `format:outdent` commands for the toolbar.
- **⌘-Enter** on a task line toggles it (`editor:toggle-task`, new command,
  works in source mode too).
- Arrow keys need nothing special: CodeMirror places the cursor at the
  edge of a replaced range, the construct reveals, and the next arrow moves
  through the now-visible delimiter. Test this explicitly (§10).

### 5.10 What a construct looks like while revealed

Exactly source mode: the overlay's `jmd-*` faces and `cmt-*` classes. The
live-edit layers add nothing to a revealed construct except keeping the
LINE-level classes that give a heading its size and a list its indent (so
the line does not jump when the cursor enters it). Rule: **entering a line
must never change its height** — heading sizes, list indents, quote
borders and callout backgrounds are line decorations that apply in both
states; only the marks toggle.

---

## 6. The toolbar

### 6.1 Principles

1. Every button dispatches a **command id** through `runCommand` — the
   registry's `when` gates apply, the tooltip shows the effective chord
   (`prettifyChord(effectiveKeymap())`), the hotkey editor and the palette
   see every action, and a plugin command can be placed on the bar.
2. The toolbar is **stateful**: buttons reflect the construct under the
   cursor (pressed for strong/italic/…; the block-style dropdown reads
   "Heading 2"; indent/outdent enabled only in lists; table buttons only in
   tables).
3. It **never steals focus**: `pointerdown` on any control calls
   `preventDefault()`, so the editor keeps its selection; popovers that
   need typing (link URL, code language search) take focus explicitly and
   return it to the editor on close.
4. **Width-aware**: groups drop into an overflow menu by priority; the mode
   switch never drops.
5. **Declarative**: `toolbar-spec.js` is the single description; the
   element renders it; settings reorder/hide groups.
6. **Dialect-aware**: labels and icons say what the dialect produces
   (`*strong*` not "bold"); under `normalSyntax` the same buttons relabel
   to Bold/Italic and run the same commands (the commands already insert
   the right markers for the dialect; verify `edit:format-strong` inserts
   `**` under normal syntax — it does not today; extend `format.js` to read
   the vault setting).

### 6.2 Spec shape (`toolbar-spec.js`)

```js
export const TOOLBAR_GROUPS = [
  { id: 'mode', priority: Infinity, align: 'end', items: [
      { kind: 'segmented', id: 'view-mode', options: [
          { value: 'source',  icon: 'code',   label: 'Source',    command: 'workspace:mode-source' },
          { value: 'live',    icon: 'pencil', label: 'Live edit', command: 'workspace:mode-live' },
          { value: 'reading', icon: 'book',   label: 'Reading',   command: 'workspace:mode-reading' } ],
        state: (s) => s.mode } ] },
  { id: 'history', priority: 10, items: [
      { kind: 'button', icon: 'undo', command: 'edit:undo', enabled: (s) => s.canUndo },
      { kind: 'button', icon: 'redo', command: 'edit:redo', enabled: (s) => s.canRedo } ] },
  { id: 'block', priority: 90, items: [
      { kind: 'dropdown', id: 'block-style', popover: 'heading', label: (s) => BLOCK_LABELS[s.blockType], width: 128 } ] },
  { id: 'inline', priority: 100, items: [
      { kind: 'toggle', icon: 'strong',    command: 'edit:format-strong',    active: (s) => s.inline.has('strong'),
        label: (s) => s.normalSyntax ? 'Bold — **text**' : 'Strong — *text*' },
      { kind: 'toggle', icon: 'intense',   command: 'edit:format-intense',   active: (s) => s.inline.has('intense') },
      { kind: 'toggle', icon: 'italic',    command: 'edit:format-italic',    active: (s) => s.inline.has('italic') },
      { kind: 'toggle', icon: 'underline', command: 'format:underline',      active: (s) => s.inline.has('underline') },
      { kind: 'toggle', icon: 'highlight', command: 'edit:format-highlight', active: (s) => s.inline.has('highlight') },
      { kind: 'toggle', icon: 'strike',    command: 'edit:format-strike',    active: (s) => s.inline.has('strike') },
      { kind: 'toggle', icon: 'sub',       command: 'format:subscript',      active: (s) => s.inline.has('sub') },
      { kind: 'toggle', icon: 'sup',       command: 'format:superscript',    active: (s) => s.inline.has('sup') },
      { kind: 'toggle', icon: 'code',      command: 'edit:format-code',      active: (s) => s.inline.has('code') },
      { kind: 'toggle', icon: 'math',      command: 'edit:format-math',      active: (s) => s.inline.has('math') } ] },
  { id: 'list', priority: 80, items: [
      { kind: 'toggle', icon: 'ul',   command: 'format:bullet-list',   active: (s) => s.blockType === 'bullet' },
      { kind: 'toggle', icon: 'ol',   command: 'format:numbered-list', active: (s) => s.blockType === 'numbered' },
      { kind: 'toggle', icon: 'task', command: 'format:task-list',     active: (s) => s.blockType === 'task' },
      { kind: 'button', icon: 'outdent', command: 'format:outdent', enabled: (s) => s.inList },
      { kind: 'button', icon: 'indent',  command: 'format:indent',  enabled: (s) => s.inList } ] },
  { id: 'insert', priority: 70, items: [
      { kind: 'dropdown', icon: 'link',     popover: 'link' },
      { kind: 'button',   icon: 'wikilink', command: 'edit:insert-wikilink' },
      { kind: 'button',   icon: 'image',    command: 'format:insert-attachment' },
      { kind: 'dropdown', icon: 'table',    popover: 'table',   active: (s) => s.blockType === 'table' },
      { kind: 'dropdown', icon: 'callout',  popover: 'callout', active: (s) => s.blockType === 'callout' },
      { kind: 'dropdown', icon: 'fence',    popover: 'code',    active: (s) => s.blockType === 'code' },
      { kind: 'dropdown', icon: 'sigma',    popover: 'math' },
      { kind: 'dropdown', icon: 'diagram',  popover: 'diagram' },
      { kind: 'dropdown', icon: 'plus',     popover: 'insert' },   // footnote, citation, label, ref, TOC, date, template, block ref, hr
      { kind: 'dropdown', icon: 'box',      popover: 'block' } ] }, // the Format menu's Block group + Alignment
  { id: 'table-tools', priority: 60, when: (s) => s.blockType === 'table', items: [
      { kind: 'button', icon: 'row-below', command: 'format:table-row' },
      { kind: 'button', icon: 'format',    command: 'editor:format-table' } ] },
];
```

Icons are names in `lib/icons.js`; add the missing glyphs from Font
Awesome Free 7 (CC BY 4.0 — already credited in THIRD-PARTY-NOTICES.md for
`callouts.js`; extend the notice line). `BLOCK_LABELS` maps `blockType`
to "Paragraph / Heading 1 … / Quote / Callout / Bullet list / Numbered
list / Task list / Code / Table / Math / Env: theorem".

New commands the spec needs (register in `builtin.js`/`format.js`, all
`when: needsEditor`): `edit:undo`, `edit:redo` (CM `undo`/`redo` on the
active view; no hotkeys — CM's history keymap owns ⌘Z), `format:indent`,
`format:outdent`, `format:insert-attachment` (native file dialog →
`attachments.js#saveAndInsert`, exported), `format:insert-link` (takes
`{url, text}` args — commands accept `args` already), `format:callout-<type>`
for every canonical type in `CALLOUT_TYPES` (replaces/extends the five
`format:alert-*`, which stay as aliases for rebindings), `format:table`
(args `{rows, cols}`; the fixed `format:table-2/3/4` stay),
`format:code-fence` gains args `{lang}`, `format:math-env` (args `{name}`),
`format:figure` (args `{kind: 'tikz'|'latex'|'tex'|'metapost'|'mermaid', show}`),
`format:env` (args `{name}` → `:::name` wrap; `@begin` form when the
selection's document already uses `@begin` anywhere — a small heuristic,
documented), `editor:toggle-task`.

### 6.3 State (`toolbar-state.js`, pure)

```js
deriveState(state, model) → {
  mode, normalSyntax, canUndo, canRedo,
  blockType,        // 'paragraph'|'h1'..'h6'|'quote'|'callout'|'bullet'|'numbered'|'task'|'code'|'table'|'math'|'env'|'html'|'frontmatter'
  envName,          // for 'env'
  inline: Set,      // 'strong'|'intense'|'italic'|'underline'|'highlight'|'strike'|'sub'|'sup'|'code'|'math'|'link'|'wikilink'|'tag'|'cite'|'footnote'
  inList, listDepth, inTable, selectionEmpty, multiLine
}
```

Computed at `selection.main.head` from the model (constructs containing
head, innermost wins per family) and the tree (block type of the line).
`canUndo/canRedo` from `undoDepth/redoDepth` (`@codemirror/commands`).
Unit-tested over string fixtures (`tests/toolbar-state.test.js`).

The editor view recomputes on its update listener (throttled to one per
animation frame) and calls `toolbar.setState(s)`; the element diffs and
patches `aria-pressed`/`disabled`/labels — no re-render.

Toggle correctness: `format.js#toggleWrap` unwraps only when the markers
sit immediately outside/inside the selection. With an empty selection
INSIDE `*word*` it would wrap again. Fix: `toggleWrap(view, before, after)`
first asks the model for the innermost construct of that kind containing
each range and, if found, removes ITS delimiters (selection mapped). Add
`tests/format-toggle.test.js` over `EditorState` (no DOM needed).

### 6.4 Layout (`toolbar-layout.js`, pure)

`layoutGroups(groups, widths, available) → { visible: id[], overflow: id[] }`:
sort by priority descending, add groups while `sum(widths) + separator
widths ≤ available - overflowButtonWidth` (skip the overflow button width
when nothing overflows and everything fits), `priority: Infinity` groups
always visible, `when(state)`-false groups excluded before layout. The
element measures each group's width once per (font, zoom) via an offscreen
render, and re-lays out on a `ResizeObserver` of the host. Overflowed
groups render inside the `…` popover as vertical menus with the same
buttons and states.

### 6.5 The element (`<clew-editor-toolbar>`)

- Light DOM, `role="toolbar"`, `aria-label="Formatting"`; one per
  `<clew-editor-view>`, prepended inside `.editor-host` above the editor
  (below the conflict banner when both show); 36px tall; sticky; background
  `--clew-bg-secondary`, bottom border `--clew-border`.
- Buttons: 28×28, icon 16px, `title` = label + ` (${chord})`; `aria-pressed`
  for toggles; `disabled` from `enabled(s)` or the registry's `isEnabled`.
- Segmented mode switch at the trailing end, always visible.
- Keyboard (roving tabindex): the bar is reachable by `Alt-Shift-t`
  (`view:focus-toolbar` command) — arrows move, Home/End jump, Enter/Space
  activate, Escape returns focus to the editor. Popover items: arrows,
  Enter, Escape (closes, focus to its button), typing filters the code
  popover.
- Tooltips are native `title` (no custom tooltip system — consistent with
  the rest of the app).
- Theme: everything via `--clew-*`; hover `--clew-hover`, active
  `--clew-active-item`, pressed toggles `--clew-accent` text.
- The mode switch is also shown in **reading mode** (a slim bar holding
  only the mode group), so the three modes are one click apart in every
  state — mounted by `clew-preview-view` when the toolbar setting is not
  `'never'`.

### 6.6 Popovers (`popover.js` + `popovers/*`)

One primitive: `openPopover({ anchor, content, onClose, role })` positions
below the anchor (flips above when it would overflow the window; clamps
horizontally), traps arrows, closes on Escape/outside pointerdown/window
blur/editor scroll, restores focus. Contents:

| popover | content | result |
| --- | --- | --- |
| `heading` | list: Paragraph, H1–H6, Quote, Callout (opens the callout list), Bullet, Numbered, Task, Code, Math block; current item marked | `format:heading-N` / `format:heading-clear` / list commands |
| `link` | form: URL (autofocus, prefilled when the selection is a URL), Text (prefilled from selection), "Insert" | `format:insert-link {url,text}` → `[text](url)`; empty url + text → `[[text]]` via `edit:insert-wikilink` |
| `table` | 8×8 hover grid with a live "3 × 4" caption; Enter inserts the highlighted size | `format:table {rows, cols}` |
| `callout` | every canonical type with its icon and colour swatch, plus "Foldable (start open / collapsed)" toggles | `format:callout-<type> {fold}` |
| `code` | search field over `fenceLanguage` names ∪ a common list (js, python, bash, json, yaml, html, css, latex, tikz, tex, metapost, mermaid, …); Enter inserts | `format:code-fence {lang}` |
| `math` | Inline `$…$`, Display `$$…$$`, environments (equation, align, gather, multline, cases via display) | `edit:format-math`, `format:math-block`, `format:math-env {name}` |
| `diagram` | Mermaid, TikZ, LaTeX snippet, plain TeX, MetaPost; a `show=` selector (figure/code/both) | `format:figure {kind, show}` |
| `insert` | Footnote, Citation, Label, Reference, Table of contents, Today's date, Template…, Copy link to block, Horizontal rule, Description list | existing `format:*` / `edit:*` ids |
| `block` | the Format menu's Block group (from `shared/format-spec.js` so it cannot drift) + Alignment | existing ids |
| overflow `…` | the overflowed groups as menus + "Customise toolbar…" (opens Settings) + "Hide toolbar" | — |

### 6.7 Selection bubble (`<clew-selection-bubble>`)

One per window, appended to `<clew-app>`. Shown when the active editor's
main selection becomes non-empty **by pointer** (pointerup) or by keyboard
and stays still for 400ms; positioned above the selection's first line
(`view.coordsAtPos(from)`), centred on the selection's horizontal middle,
flipped below when clipped. Contents: the `inline` group plus link,
wikilink, highlight, code — same spec objects, `variant: 'bubble'` (smaller,
no labels). Hidden on selection collapse, doc change, scroll, blur, Escape,
or when the setting `selectionBubble` is off. It reuses `setState`.

### 6.8 Visibility and customisation

- `editorToolbar: 'live' | 'always' | 'never'` (default `'live'`): show in
  live mode only / in source too / never. `view:toggle-toolbar` flips
  between the current non-`never` value and `never` (and back to the
  previous value, remembered in the setting `editorToolbarPrev`).
- `editorToolbarGroups: string[] | null` — ordered visible group ids; null
  = spec default. Settings → Toolbar: a checkbox per group with ▲▼
  ordering, and a "Reset" button. The `mode` group cannot be hidden.
- `selectionBubble: true`.
- Plugin API (`plugins.js`, app scope, `PLUGIN_API_VERSION` 2):
  `clew.toolbar.addButton({ id, group?, icon (svg path or name), label,
  command })` — appended to the named group (default `insert`); unwound on
  vault change with the plugin's other registrations.

---

## 7. Tier C: engine-rendered block frames

### 7.1 Why frames, why hoisted

Reading mode renders the whole note in one `clew-preview://` document with
the full preview-client stack. A live-edit block needs the SAME renderer
for the SAME fragment of text, so: one small preview document per rich
block, rendered by the existing fragment path. Two facts shape the
implementation:

- CodeMirror recycles the DOM of block widgets that scroll out of the
  viewport, and **any DOM move reloads an iframe** (CLAUDE.md, learned on
  office embeds). So the iframes do not live inside the widgets. They live
  in a **frame layer** appended to `view.scrollDOM` (absolutely positioned,
  scrolls with the content natively), and each rich block's widget in the
  document is a **placeholder** that only reserves height. Frames are
  positioned onto their placeholders after every layout; a placeholder
  that leaves the rendered viewport hides its frame (`visibility:hidden`)
  but does not destroy it.
- N documents cost memory. Frames are **lazy** (created for placeholders
  within the viewport ± one screen) and **capped** (`liveFrameCap`, default
  16, LRU by last-visible time). Kinds with interaction state — leaflet,
  kanban, query tables (edited cells), PDF, canvas — are pinned while their
  placeholder is within three screens. Everything else reloads cheaply on
  return (the fragment is cached by hash in main, the assets are cached by
  the HTTP cache).

### 7.2 Main-process side

`render-service.js`:

```js
renderFragment(text, { sourcePath = null, dependent = false } = {})
```

- `dependent: true` (the caller's regex hit: `!\[\[`, ```` ```(query|tasks|kanban|dataview|dataviewjs|base) ````,
  `INPUT[`/`VIEW[`, `@reveal`, a `.canvas`/`.base` embed) → the result is
  NOT kept in `#fragments` across file changes: key it with the current
  `#fragmentEpoch`, a counter `onFileChanged` increments. Export the regex
  as `isDependentFragment(text)` and unit-test it.
- `sourcePath` → the worker build option `currentFile: <abs path>` — an
  **upstream jmarkdown change**: `watch-worker.js`/`index.js` must let a
  build set `global.current_file` (and whatever the same code path derives
  from the input path for relative `![[#Heading]]`/`this`) from an option
  instead of the input file. Small, additive, config-gated in spirit; make
  it in `~/Sites/jmckalex/software/jmarkdown` (branch `at-migration`, read
  its CLAUDE.md/HANDOVER.md first), then `npm run sync-engine`. Until it
  lands, frames render with the temp file as `current_file`, which affects
  only Dataview `this`, Bases' `this.file`, and `![[#Heading]]` self-embeds
  — refuse those by name in the frame (a one-line notice) rather than
  rendering wrong data.

`protocol.js`, alongside `__clew_fragment__`:

- `POST …/<sid>/__clew_block__` — body: JSON `{ text, sourcePath }`;
  same origin guard and 100k limit; renders (or serves cached) and
  responds `{ hash }`.
- `GET …/<sid>/__clew_block__/<hash>?src=<encoded sourcePath>&theme=<t>` —
  the block document: the fragment HTML wrapped by the same head/tail the
  note documents get. **Factor the wrapping** (`wrapPreviewDocument(html,
  { session, sid, sourcePath, block: true })`) out of the rendered-note
  branch so the two cannot drift: MathJax config + src, mermaid,
  FontAwesome, highlight CSS, `preview.css`, jquery, the note API in
  `<head>` (gated per vault as now, `sourcePath` = the NOTE), the client at
  the end of body, enabled preview-surface plugin scripts and vault
  scripts. The `<html>` carries `data-clew-block="1"`. A missing hash
  (cache bounded/evicted) → 404, and the layer re-POSTs.
- `Cache-Control: no-store` on both (block content is not immutable).

### 7.3 The frame layer (`live/frame-layer.js`)

A ViewPlugin owning `<div class="le-frames">` inside `view.scrollDOM`
(`position:absolute; inset:0 auto auto 0; width:100%; pointer-events:none;
z-index:1`). Per rich construct (from the model, `tier === 'C'`):

```
FrameRecord { id, kind, text, sourcePath, placeholderPos, iframe|null, hash|null,
              height, lastVisible, pinned, state: 'idle'|'posting'|'loading'|'ready'|'error' }
```

Lifecycle:

1. `update()` — diff the model's Tier C constructs against the records by
   `id` (hash of kind+text): new → record; gone → destroy frame; text
   changed → same record, `hash=null` (re-POST on next visible).
2. `requestMeasure` read phase — for each record, find the placeholder's
   rect: `view.coordsAtPos(placeholderPos)` gives the block widget's top
   (use the widget's DOM rect via `view.domAtPos` when present, else
   `coordsAtPos` → null means out of the rendered viewport). Compute
   `top = rect.top - scrollDOM.getBoundingClientRect().top + scrollDOM.scrollTop`,
   `left`, `width` (the content width: `.cm-content`'s rect, so frames
   respect `--clew-editor-line-width`).
3. Write phase — visible-or-near records without an iframe (and under the
   cap, evicting the oldest unpinned first): create
   `<iframe class="le-frame" allow="fullscreen">` (no sandbox — the same
   reasoning as the preview; the frame is cross-origin from the app),
   `pointer-events:auto`, `src` set AFTER insertion (the lesson from office
   embeds), pointing at the GET URL once the POST has answered. Position
   every frame; hide the ones whose placeholder is not rendered.
4. Messages from a frame (`event.source === record.iframe.contentWindow`):
   `ready` → post `theme` + `app-chords`; `size` → `record.height = h`,
   and `view.dispatch({effects: frameHeight.of({id, h})})` so the
   placeholder widget's `estimatedHeight`/CSS height updates → CodeMirror
   re-measures → positions refresh (one round trip; converges because
   `size` is only posted on real changes, and the widget's `updateDOM`
   applies the height without recreating the DOM). Interaction messages →
   `frame-host.js` (§7.4). `morph-failed` → reload `src`.
5. Re-render — when a record's text changes, or on `EV_RENDER_DONE` for
   the note, or on `EV_FILE_CHANGED` for any path when the record is
   `dependent` (debounced 300ms, skipping echoes of this note's own save):
   POST again; if the hash changed, `fetch` the body HTML and post
   `{type:'render', html}` to the frame so the client **morphs** in place
   (leaflet/pdf/kanban state survives where the morph guards allow) rather
   than reloading.
6. Placeholder widget (`widgets/frame.js`): `<div class="le-frame-slot"
   data-kind>` with `height` from `height-cache.js` (LRU by construct id,
   per editor, persisted to the tab's `view.frameHeights` so a reopened
   note lays out without jumps) or a kind default (mermaid 240, embed 160,
   query 200, pdf 480, …); shows a skeleton (kind icon + "Rendering…")
   until the first `size`, and the last error message on `error`
   (rendered errors come from the engine as `.clew-embed-refused` /
   `.clew-figure-refused` inside the frame — those are content, not layer
   errors).
7. Destroy on: plugin destroy (mode off, tab close), record gone, eviction.
   `RENDER_SUBSCRIBE` the note path while any frame exists (so
   `EV_RENDER_DONE` restales arrive), `RENDER_UNSUBSCRIBE` on destroy.

Scroll chaining: a wheel over a frame whose document is not scrollable
chains to the editor's scroller in Chromium (cross-origin included). The
block document sets `html, body { overflow: hidden }` so it is never
scrollable — its height IS its content height. Verify with real input in
the smoke scenario (§10).

Focus: a click inside a frame posts `focused` → `workspaceStore.activateTab`
(as previews do); chords forwarded via `app-chord` act on this tab.
Clicking the placeholder's margin (outside the frame) places the cursor
→ the block reveals → the frame hides.

### 7.4 One host-side message switch (`live/frame-host.js`)

Extract the `switch (msg.type)` from `clew-preview-view.js#onMessage` into
`handlePreviewMessage(msg, ctx)` with `ctx = { tabId, path, post,
suppressor, mode: 'note' | 'block', onScroll… }`; the preview view keeps
its scroll/reading-line behaviours behind `mode === 'note'`; the frame
layer calls it with `mode: 'block'` (no `scrolled`/`anchor-jump`/
`source-line-click` handling — a block has none). `link-click`,
`external-link`, `open-external-file`, `checkbox-toggle` (only when the
payload carries a path+line — `task-toggle` does; a plain checkbox in a
transcluded note has no line, refuse silently), `task-toggle`,
`field-edit`, `api-request` (sourcePath = the note), `focused`, `chord`,
`app-chord`, `embed-collapse` (writes the alias keyword through
`actions.setEmbedCollapsed` — the LINE is the construct's line, known to
the record, not `msg.line`).

### 7.5 The block document's client (`preview-client/client.js`)

Same file, one switch on `document.documentElement.dataset.clewBlock`:

- Skip: inverse-search click handling, scroll reporting (`scrolled`),
  anchor-jump history, TOC scroll.
- Add: **size reporting** — a `ResizeObserver` on `document.body` plus a
  `MutationObserver` (debounced 50ms; MathJax/mermaid/figures/leaflet
  resize asynchronously) posting `{type:'size', height:
  document.documentElement.scrollHeight}` when it changes by ≥1px; the
  final `size` after fonts load (`document.fonts.ready`).
- Keep everything else: morph on `render`, checkbox enabling, kv events,
  theme, chord forwarding, `focused`, the note API.

Styling: `preview.css` already applies; add a `html[data-clew-block]`
block: `body { margin: 0; padding: 0 }`, `overflow: hidden`, and no
`data-source-line` outlines.

### 7.6 Kinds and their frame policy

| kind (from the model) | dependent | pinned | default height |
| --- | --- | --- | --- |
| ```mermaid / `:::mermaid` / `@begin(mermaid)` | no | no | 240 |
| ```tikz / latex / tex / metapost, `:::TiKZ`, `@begin(TiKZ\|metapost)` | no (fragments named by `clew-fragments=` are resolved in the worker; a fragment EDIT reconfigures → `EV_RENDER_DONE` → re-POST) | no | 200 |
| ```leaflet | yes (GeoJSON/GPX files) | yes | 400 |
| ```query / tasks / kanban / dataview / dataviewjs / base | yes | kanban + query yes | 200 |
| ```ad-* | no | no | 120 |
| note embed `![[Note]]` `#H` `#^id` (+ `\|collapsed\|open\|quiet\|bare` keywords, honoured by the engine as in reading mode) | yes | no | 160 |
| `![[x.pdf]]` | no | yes | 480 |
| `![[x.docx]]` (and the other five) | thumbnail (yes — mtime); **`\|live` renders as a thumbnail in live edit** with a note "Live LibreOffice embeds open in reading mode" — a frame is evictable and a booted LibreOffice must not be | no | 320 |
| `![[x.canvas]]`, `![[x.excalidraw]]` | yes | canvas yes | 320 |
| `![[x.mp4]]` / `.mp3` / `.wav` | no | no | 240 / 54 |
| `![[x.base#View]]` | yes | no | 200 |
| `@reveal[…]` (all three shapes) | no | yes | 520 (or the attrs' height) |
| `:::game`, `:::Mathematica`, `:::markdown-demo`, generic `:::name` the engine renders richly (a list in `rich-fences.js`, initially: game, Mathematica, markdown-demo) | no | no | 160 |
| HTML block with custom elements / iframe / media | no | no | 160 |

Everything the engine refuses by name renders its refusal inside the
frame, exactly as reading mode shows it.

---

## 8. Settings (all app-global unless noted)

| key | values | default | UI section |
| --- | --- | --- | --- |
| `newTabMode` | `source` \| `live` \| `reading` | `source` (unchanged; do not move users) | Appearance (existing row, new option) |
| `defaultEditMode` | `source` \| `live` | `source` | Live edit — "⌘E returns from reading mode to" |
| `liveReveal` | `construct` \| `line` | `construct` | Live edit — "Reveal syntax for: the construct under the cursor / the whole line" |
| `liveRenderMath` | bool | true | Live edit |
| `liveRenderFences` | bool | true | Live edit — "Render diagram and query fences in place" |
| `liveRenderEmbeds` | bool | true | Live edit — "Render embeds and media in place" |
| `liveFrameCap` | 4–64 | 16 | Live edit (number row, "Advanced") |
| `editorToolbar` | `live` \| `always` \| `never` | `live` | Toolbar |
| `editorToolbarPrev` | (internal) | — | — |
| `editorToolbarGroups` | id[] \| null | null | Toolbar (group list) |
| `selectionBubble` | bool | true | Toolbar |

Per-vault: nothing new; `normalSyntax` is read (§4.3). Every key goes into
`main/settings.js` DEFAULTS, the settings view, and the manual's settings
page (§11).

Changing `liveReveal`/`liveRender*` reconfigures the live compartment of
every open live editor (`editorPool.reconfigureLive()`); changing
`editorToolbar*` re-renders toolbars (they listen to `settings-changed`).

---

## 9. Performance and bounds

- **Model**: one tree walk + one scanner run per document version, shared
  by both providers, folding, and the overlay (`scan-cache.js`). Target:
  < 8 ms for the 61-file demo vault's longest note, < 40 ms for a 200 KB
  note on the owner's machine; measure with `performance.now()` around
  `liveModel` under `CLEW_SMOKE_LOG=1` (log `live-model-ms`) — and
  **check the baseline before believing a timing** (HANDOVER §9).
- **Inline layer**: viewport only, like the overlay. Rebuild cost is the
  decoration count in view — a few hundred.
- **Block field**: whole-document, but only on `docChanged` (re-filter on
  selection). For documents over 100k chars, compute block replacements
  only within viewport ± 20k chars snapped to construct boundaries (the
  overlay's degrade pattern) — accept edge artefacts.
- **`BIG_DOC` (500k)**: live edit refuses — the tab shows source with a
  one-line notice ("Live edit is off for documents over 500 KB"); the mode
  stays `live` in the workspace so a smaller revision turns it back on.
- **MathJax**: LRU 2000; synchronous once loaded; first load ~1 MB from the
  HTTP cache. Never typeset outside the viewport (inline) — display blocks
  are typeset by the block field in document order once (macro order), the
  rest lazily.
- **Frames**: lazy + capped (§7.3). A note with 50 mermaid blocks has ≤16
  documents alive. Measure `app.getAppMetrics()` under
  `CLEW_SMOKE_METRICS` for the frames scenario and record the numbers in
  `smoke/README.md` (the office-embed precedent: ~1.2 GB was measured and
  written down).
- **Reveal churn**: cursor movement changes only the reveal signature;
  providers rebuild only when it changes; the block field re-filters
  without re-walking.

---

## 10. Testing

### 10.1 Unit tests (`node --test`, `tests/`)

| file | pins |
| --- | --- |
| `jmarkdown-constructs.test.js` | every construct kind with exact `start/end/open/close/parts`; nested directives; unclosed blocks (`close: null`); constructs never emitted inside code/math; `captures` unchanged for the existing fixtures (snapshot equality against the pre-change scan of the demo vault's Dialect Demo). |
| `subsup-syntax.test.js` | `H_2O` → `JmdSubscript` at `_2`; `x^{10}` → `JmdSuperscript`; `_x_` NOT `Emphasis`; `text ^abc-1` at EOL → `JmdBlockId`; `x^2` mid-line NOT a block id; under normalSyntax config `_x_` IS `Emphasis`. |
| `live-model.test.js` | `liveModel` over string fixtures → kinds, tiers, levels, hidden ranges; alignment beats blockquote; callout detection + aliases; table/hr/frontmatter/TOC blocks; rich-fence classification incl. plugin-registered names. |
| `live-reveal.test.js` | `revealed()` for every level: cursor at `from`, at `to`, inside, adjacent-but-outside; multi-range; `line` mode; nesting independence. |
| `inline-dom.test.js` | the token list for each supported inline kind; unsupported constructs pass through as text. |
| `toolbar-state.test.js` | `deriveState` over fixtures: block types, inline sets (innermost wins), `inList`/`inTable`, normalSyntax relabelling. |
| `toolbar-layout.test.js` | `layoutGroups`: fits/overflows by priority, `Infinity` never drops, `when`-false excluded, overflow button width accounted only when needed. |
| `format-toggle.test.js` | `toggleWrap` unwraps from an empty cursor inside a construct; wraps otherwise; multi-range. |
| `workspace-tree.test.js` (+) | `mode: 'live'`; `editMode` set by `setTabMode`; clone carries it; serialize/hydrate round trip; legacy JSON without `editMode`. |
| `fragment-dependent.test.js` | `isDependentFragment` for each trigger and for plain prose. |
| `frontmatter-edit.test.js` | `applyProperties` produces the same text the panel would; `clean:false` refused. |

### 10.2 Smoke scenarios (`smoke/`, each with its assertions in the README table)

Harness change first: `CLEW_SMOKE_FRAME_SCRIPT` today runs against "the
preview iframe". Add `CLEW_SMOKE_FRAME_MATCH=<substring>`: when set,
`main.js` runs the frame script in EVERY `clew-preview://` frame whose URL
contains it (each result line prefixed with the frame's URL hash). Document
in CLAUDE.md's smoke paragraph.

| scenario | drives | asserts |
| --- | --- | --- |
| `live-edit-scenario.js` (over the demo vault, `Projects/Dialect Demo.md`, tab forced to `live`) | opens the note, waits for the model | `mode=live`; heading line has `le-h1`; `hidden-marks=0` visible `cmt-formatting` in `.cm-content` outside the cursor line; `math-widgets>=2` each containing `svg`; wikilink widget text `the design`; `tag-chips>=1`; theorem env has `le-env-head` text `theorem`; `:::TeX` body has `le-tex-only`; footnote badge `¹` with tooltip text; then REAL input: click inside `*strong*` → `revealed=strong` (two `*` visible in `cmt-formatting` on that line, no other line changed); ArrowRight ×7 out → `concealed=true`; click the task checkbox of a `- [ ]` line the scenario appended → doc line becomes `- [x]` and after 1.2 s the file on disk has it; `line-height-stable=true` (the heading line's `getBoundingClientRect().height` before/after the cursor enters it). Screenshot. |
| `live-blocks-scenario.js` + `live-blocks-frame.js` (fixture from its header: mermaid, ```query, `![[Child]]`, `![[sample.pdf]]`, leaflet, `@reveal[Nothing/]` refused, 20 extra mermaid blocks below the fold) | opens in live, waits for `size` on the first four | `frames<=16` at all times; each visible frame reports `height>0` and its placeholder's height equals it (±1); `refused-by-name=true` for the reveal frame (text of `.clew-embed-refused`); rewrite `Child.md` through NOTE_WRITE → the embed frame's document contains `UPDATED` within 3 s (`has-UPDATED=true`); scroll to the bottom by real wheel input over a frame (`scroll-chained=true` — `scrollTop` moved) and back → the leaflet frame's `data-frame-id` unchanged (`pinned-survived=true`); place the cursor on the mermaid block → `frame-hidden=true` and the source visible; `CLEW_SMOKE_METRICS` recorded. |
| `live-toolbar-scenario.js` | `CLEW_SMOKE_MENU=1`; opens a note in live | `smoke-menu: View > Live Edit [Cmd+Shift+E]` and the Mode radios; `groups=N visible`; click Strong with a real drag selection (or tripleClick a line) → line text wrapped in `*…*`; cursor into the word → `pressed=strong`; open the table popover, click 3×2 → a 3-row 2-col table inserted (`tables.js#tableAround` on the doc); narrow the pane (`splitActive('right')` twice) → `overflow` holds `insert`/`list` and `mode` still visible; keyboard: `Alt-Shift-t` focuses the bar, ArrowRight ×3, Enter → the command ran; tripleClick a line → `bubble=visible`, Escape → hidden; `⌘⇧E` → `mode=source` and toolbar hidden under the default setting; `⌘⇧E` → live again. |
| `live-mode-persistence-scenario.js` (two runs over one fixture) | run 1 sets live on a tab, flips to reading with ⌘E, quits | run 2: `restored-mode=reading editMode=live`; ⌘E → `mode=live`; ⌘-click a block in reading (real input over the preview) → lands in `live` at that line (`landed=<line>`). |
| `live-tables-scenario.js` | a note with a table with inline markdown in cells | `table-widget=1 rows=3`; a cell's HTML holds `<strong>`; click cell (2,1) → `revealed=table cursor-cell=2,1`; Tab → next cell (the existing keymap). |
| existing scenarios | `fence-highlight`, `footnote-highlight`, `math-highlight`, `editor-hotkeys`, `reading-scroll` | must pass unchanged in source mode (regressions in the grammar change show up here). |

### 10.3 Manual QA checklist (owner's pass, not automatable)

Typing feel at 120 wpm in a long note; ⌘Z across a conceal/reveal;
find/replace panel over concealed text (matches highlight inside widgets?
— they will not; document that the search panel reveals matches by moving
the selection); copy/paste of concealed ranges yields source (CodeMirror
copies the document, not the DOM — verify); IME composition inside a
concealed word; light theme; zoom levels (`View → Zoom`); a split with
reading mode on the right scrolling in sync while typing in live on the
left; drag-and-drop an image into a live note; the properties panel and
the frontmatter widget editing the same note.

---

## 11. Documentation and demo vault (part of the deliverable)

- **Manual** (`../Clew-docs/site/manual/`, own repo, `make check-links`):
  `editing.html` — new sections "Live edit" (the reveal rule in the user's
  words, what renders in place, the click-vs-edit rule for links, the
  known limitations: macros across notes, multi-line footnotes, Meta Bind
  chips, `|live` office embeds, tables edit as source) and "The toolbar"
  (every group, popovers, overflow, keyboard, customisation, the bubble);
  `reading-mode.html` — "Every note tab is in one of THREE modes", ⌘E /
  ⌘⇧E semantics, the mode switch; `settings-and-hotkeys.html` — every
  §8 key and the new commands/chords; `index.html` — a feature line;
  screenshots via the harness (the memory file `clew-manual.md` has the
  screenshot tricks). Update the manual's own `VERSION`/changelog per its
  README.
- **Demo vault**: `Guide/Editing.md` — live edit + toolbar, exercising
  every Tier A construct on the page itself (it is the test corpus);
  `Guide/Reading Mode.md` — three modes; `Guide/Settings and Hotkeys.md`;
  a new `Guide/Live Edit.md` that holds one of everything (headings, every
  inline form, a task list, a callout with a title, a foldable callout, a
  table with inline markdown, display math with a `\newcommand`, a
  mermaid fence, a `![[Welcome#…]]` embed, an image with a size, a
  `:::theorem`, a `:::TeX`, a footnote, a citation, a `{{TOC}}`) — with
  `Welcome.md` linking it. Reset demo baselines before committing
  (HANDOVER §8).
- **CLAUDE.md**: a "Live edit" subsection under Architecture (the facet/
  compartment, the two providers rule, the model, the frame layer and why
  it is hoisted, the endpoint, the settings) and the harness knob.
- **HANDOVER.md**: rewritten at the end of the build session.
- **THIRD-PARTY-NOTICES.md**: the added Font Awesome glyphs.

---

## 12. Phases and acceptance

Each phase is committed on `feat/live-edit` as it lands (small commits,
explicit paths) and leaves `npm test` green and every existing smoke
scenario passing. Ship order matters: 1–3 are useful alone.

**Phase 0 — foundations** (no visible change)
`scan-cache.js`; scanner `constructs` (+tests); `subsup-parser.js` (+tests)
behind the markdown Compartment; `vault-settings-store.js`; `liveModel`
(+tests); `revealed` (+tests); `renderFragment` options + `isDependentFragment`
(+test); `__clew_block__` endpoints + `wrapPreviewDocument` refactor;
client.js block flag + size reporting; `CLEW_SMOKE_FRAME_MATCH`.
Accept: tests green; `curl`-level check of the endpoints via a smoke
scenario that `fetch`es them from the app (`block-endpoint=200`).

**Phase 1 — the mode** (live = source, visually)
§3.3 in full; settings keys + rows; menu; commands; `editorPool.setMode`
with an empty live bundle; toolbar NOT yet. Accept:
`live-mode-persistence-scenario.js`; `CLEW_SMOKE_MENU` shows the items;
`workspace-tree` tests.

**Phase 2 — Tier A inline**
`inline-layer.js` with §5.2 (except cite chips' author-year, which needs
the citations index helper — do it here if cheap), MathWidget inline,
reveal field, `liveReveal` setting, click rules. Accept: the first half of
`live-edit-scenario.js` (through `concealed=true`, `line-height-stable`).

**Phase 3 — Tier A lines and blocks**
§5.1 headings/alignment, §5.4 lists/tasks/quotes/callouts (+fold), §5.5
hr/frontmatter/display math/fence chrome/env frames/TOC/kanban banner,
§5.9 keymap. Accept: the rest of `live-edit-scenario.js`; `frontmatter-edit`
tests; `inline-dom` tests.

**Phase 4 — Tier B**
TableWidget, ImageWidget. Accept: `live-tables-scenario.js`; images in
`Guide/Live Edit.md` render with their sizes.

**Phase 5 — Tier C**
Frame layer, placeholder widget, height cache, host switch refactor,
policies (§7.6), restale. Accept: `live-blocks-scenario.js` + metrics in
the README; `embed-refresh`-style freshness proven (`has-UPDATED`).

**Phase 6 — toolbar**
Spec, state, layout, element, popovers, keyboard, bubble, settings UI,
new commands, plugin API v2, menu item. Accept: `live-toolbar-scenario.js`;
`toolbar-*` and `format-toggle` tests.

**Phase 7 — docs, demo, polish**
§11 in full; a pass over light theme, zoom, and the QA list; performance
numbers written into `smoke/README.md`; CLAUDE.md + HANDOVER.

---

## 13. Decisions for the owner (defaults chosen so the build never blocks)

| decision | default in this plan | alternative |
| --- | --- | --- |
| Clicking a concealed link | follows it; ⌥-click edits (Obsidian parity) | ⌘-click follows, plain click edits (source-mode parity) |
| Remote `http(s)` images in live edit | NOT loaded (CSP unchanged); chip says "shown in reading mode" | widen `img-src` to `https:` — notes then contact remote hosts when opened for editing |
| Toggle live/source chord | `Mod-Shift-e` (free today) | none — palette/menu only |
| Default for new tabs | stays `source` | `live` (Obsidian's default) |
| `\|live` office embeds in live edit | thumbnail + note | boot LibreOffice in a pinned frame |
| MathJax macro isolation | shared page instance; documented | per-note `InputJax` (v2) |
| Tables | rendered ↔ source on activation | in-place cell editing (v2) |
| Toolbar in reading mode | slim bar with the mode switch only | none |

Follow-ons this plan deliberately leaves out: slash commands; in-place
table cells; multi-line footnote concealment; Meta Bind widgets in-app
(Web Awesome is already bundled — plausible v2); a per-note MathJax;
drag handles for blocks; a "focus mode" that hides the toolbar and
sidebars.

---

## Appendix A — lezer node names in play

`Document Paragraph ATXHeading1-6 HeaderMark Emphasis StrongEmphasis
EmphasisMark InlineCode CodeMark FencedCode CodeInfo CodeText Link Image
LinkMark URL LinkTitle LinkLabel LinkReference Autolink Blockquote QuoteMark
BulletList OrderedList ListItem ListMark Task TaskMarker HorizontalRule
Table TableHeader TableRow TableCell TableDelimiter Strikethrough
StrikethroughMark Subscript SubscriptMark Superscript SuperscriptMark
HTMLBlock HTMLTag Escape Entity HardBreak Emoji CommentBlock
ProcessingInstructionBlock` + Clew's `JmdMath JmdFootnoteMark` + new
`JmdSubscript JmdSuperscript JmdSubSupMark JmdBlockId`.

## Appendix B — CSS class contract (`live-edit.css`, `toolbar.css`)

Structure classes `le-*` (this plan), faces `jmd-*` (overlay), lezer
`cmt-*` (theme.js). Every colour is a `--clew-*` variable; add
`--clew-callout-<type>` tokens to both theme files mirroring
`preview.css`'s callout palette, and `--clew-toolbar-bg`/`-border` (aliases
of secondary/border, so themes can diverge later). Line-height invariance
(§5.10) is a rule, not a class.

## Appendix C — message protocol additions

Frame → host: `size {height}` (new). Host → frame: nothing new (`render`,
`theme`, `app-chords`, `event kv`, `scroll-to-line` unused in blocks).
Host-side switch shared via `frame-host.js`.

## Appendix D — the one engine change

`watch-worker.js` build options gain `currentFile` (absolute path) →
`global.current_file` and the input-path-derived base for self-references.
Additive; default = the input file, so nothing else changes. Made in the
jmarkdown master, staged by explicit path, then `npm run sync-engine` here.
