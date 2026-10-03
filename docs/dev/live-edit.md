# Live edit — the design as built

Live edit is Clew's Obsidian-style Live Preview: a third view mode in which
the editor conceals markdown syntax and draws the result in place, except
where the selection touches a construct. This document is the durable
design — CLAUDE.md's "Live edit" subsection is the short form. It began as
the build plan (branch `feat/live-edit`, 2026-09-26); where the build
measured something the plan got wrong, the section says so under **As
built**, and those notes are the truth.

User-facing: the manual's *Live edit and the toolbar* chapter
(`../Clew-docs/site/manual/live-edit.html`) and the demo vault's
`Guide/Live Edit.md` (which holds one of everything and is the test
corpus).

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
- Slash commands — built after v1 as the `//` menu (§6.9).
- Obsidian `%%comments%%` (the engine does not render them; nothing to
  mirror).
- Live edit over documents above `BIG_DOC` (500k chars): the tab falls back
  to source with a notice (§9).

---

## 2. Ground truth: the editor before live edit (at `ed2aabc`)

What the design was written against; kept because it says why each
change landed where it did.

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
| Fragment render | `main/protocol.js` (`POST …/<sid>/__clew_fragment__`), `main/render-service.js#renderFragment` | Text in (JSON `{ token, text }` — the caller token, docs/dev/frame-bridge.md §1), body HTML out; same worker pipeline and config as notes; cached by sha1(text), bounded 500. Runs nothing without the session's token (the Origin guard stays as a second layer). `lib/preview-url.js#fragmentUrl()` exists. Fragment builds skip `data-source-line`. |
| App CSP | `src/renderer/index.html` | `script-src 'self' clew-preview://vault/__clew_assets__/ …; img-src 'self' data: clew-preview:; frame-src clew-preview:; connect-src 'self' clew-preview:`. MathJax in-app, vault images, block iframes and fragment fetches are all allowed today. Remote `http(s)` images are NOT (§12). |
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
liveConfigFacet        settings + vault facts, plus the editor's notePath and tabId (config.js)
liveStateField         the construct model + the revealed set (reveal-field.js)
calloutFoldField       which foldable callouts are folded (view state; block-field.js)
frameHeightField       measured Tier C heights, by id and by kind+ordinal (frames.js)
blockField             StateField<DecorationSet>: block replacements (§3.2)
frameLayer             ViewPlugin: Tier C iframes hoisted into the scroller (§7.3)
inlineLayer            ViewPlugin: inline marks/widgets and line decorations for visibleRanges
liveEvents             Prec.high click handlers (links, tasks, folds, frames…; events.js)
cm-live                an editor class the CSS and the scenarios key on
```

As built: no live keymap (§5.9) and no theme extension — the structure
lives in `styles/live-edit.css` and `styles/toolbar.css`.

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
  model.js            liveModel(state, config) → Construct[] (tree + scanner), memoised
  reveal.js           revealed(construct, ranges, mode), revealSet — PURE, unit-tested
  reveal-field.js     liveStateField: { model, revealed, signature, config }
  block-field.js      blockField + calloutFoldField: block replacements from the model
  inline-layer.js     inline marks/widgets + line decorations over visibleRanges; liveRefresh
  inline-dom.js       inlineTokens (pure, tested) + tokensToDom — the tiny subset (§5.3)
  images.js           imageSpec: where an image construct points
  rich-fences.js      what only the engine draws (fences, directives, environments, HTML)
  frames.js           Tier C: frame kinds, placeholder widget, heights field
  frame-layer.js      Tier C iframe layer: lifecycle, positioning, laziness, cap, messages
  frame-host.js       host-side message switch shared with clew-preview-view (§7.4)
  events.js           click handlers (Prec.high)
  widgets/
    math.js           MathWidget + mathElement over lib/mathjax.js
    chip.js           footnote number, citation, variable, label, date, block id, inline embed
    lines.js          bullet, task, callout head, fence head/foot, env head/foot
    blocks.js         hr, TOC, kanban banner, PropertiesWidget
    table.js          TableWidget (Tier B)
    image.js          ImageWidget (Tier B)
src/renderer/editor/toolbar/
  toolbar-spec.js     groups, items (command ids), priorities, popover kinds
  toolbar-state.js    deriveState(state, model) — PURE, unit-tested
  toolbar-layout.js   layoutGroups(groups, widths, available) — PURE, unit-tested
  clew-editor-toolbar.js   <clew-editor-toolbar> (+ addToolbarButton for plugins)
  clew-selection-bubble.js <clew-selection-bubble>
  popover.js          anchored popover primitive (one open at a time)
  popovers.js         the popover contents
src/renderer/editor/toggle-wrap.js       toggleWrapSpec — unwrap from inside a construct (tested)
src/renderer/editor/frontmatter-edit.js  properties written through the editor (tested)
src/renderer/editor/jmd/scan-cache.js    scanFor(doc) — the one memoised scan
src/renderer/editor/jmd/subsup-parser.js JmdSubscript / JmdSuperscript / JmdBlockId
src/renderer/editor/jmd/markdown-config.js noteMarkdown({normalSyntax}) — the editor's grammar
src/renderer/state/vault-settings-store.js the vault's settings in the renderer
src/shared/fragment-deps.js             isDependentFragment
src/engine/media-alias.js               parseMediaAlias (shared with the renderer)
src/preview-client/client.js            block-document mode (§7.5)
src/main/protocol.js                    __clew_block__ endpoints, wrapPreviewDocument (§7.2)
src/main/render-service.js              renderFragment / renderBlock, epoch + config generation
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
**As built (Phase 0): the SCANNER's record is used** — it carries the
delimiters and parts the tree node lacks, and the grammar claims exactly the
scanner's segments. HTML blocks likewise come from the scanner (its block
list knows custom elements); the tree's `HTMLBlock` is ignored. The scanner's
block constructs also mark OPAQUE ranges (frontmatter, Tier C blocks, math
environments, `:::TeX`/`:::HTML`/`@begin(TeX)` bodies, HTML/script/style)
inside which neither the tree nor the scanner's inline passes contribute.
Every record carries `extents` and `lineExtents` — the ranges a selection
must touch to reveal it — so the §4.5 rules are decided in the model and
`revealed()` is a range test. Quote/callout/alignment markers are ONE
construct PER LINE (`quote` carries `depth` and, inside a callout, its
`callout` type); list items are one construct per item whose extent is the
marker line. Kinds as built: heading strong intense italic underline
highlight strike sub sup code escape hardBreak link autolink image
wikilink embed embedChip tag cite footnote mustache toc math frontmatter
directive environment directiveInline directiveAt richBlock html codeFence
hr table quote callout align bullet numbered task blockId term.
Measured (node, cold, 2026-09-26): 6.7 ms for the demo vault's largest note
(Features/Diagrams.md, 12 KB, including its parse); on a 207 KB document the
model's own work is 4.2 ms over a 23.6 ms parse and a 12.8 ms scan that the
editor has already paid for the overlay.

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
| multi-line footnote | **Corrected (owner's request, 2026-09-27):** concealed to the same `le-fn` badge (`le-fn-long`), title = the body's first paragraph + "…" when there is more. The badge is an INLINE `Decoration.replace` across the note's line breaks, emitted by the BLOCK FIELD (a StateField may replace across line breaks; the inline layer, a ViewPlugin, may not — the old reason for leaving it source), so the note collapses into its paragraph and the sentence continues after it. Containment: while concealed, NEITHER provider draws anything inside it (a list, math, a fence in the body — the engine allows block content) — the block field's `block()` skips contained constructs, the inline layer treats the note as a replaced range and `lines()` skips constructs inside it; revealed, everything inside renders as in prose. Footnotes are numbered ONCE, in the model (`c.number`, document order), so both providers agree. The paragraph shrinks when concealed and grows when revealed — inherent, as a table or a math block does, and not a breach of the line-height rule (which is about line-level chrome). The `le-fn-open` border is gone: revealed, the note is plain prose with its `jmd-footnote*` faces. Arrow keys: the badge is not a block, so `live/keys.js` leaves it alone and CodeMirror treats it as any inline replacement (entering reveals). Smoke: `live-footnotes-scenario.js`. | — |
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
| `> [!type]±  Title` callout | first line replaced by **CalloutWidget** (block-level? No — it is one line: a line-level replace of the `> [!type]± ` marks with an inline widget: icon + `renderInline(title)`; empty title → the type's display name); every line of the quote gets `le-callout le-callout-<type>` (background/border/icon colour per type from `live-edit.css`, mirroring `engine/preview.css` and `callouts.js`'s table — **export `CALLOUT_TYPES` (canonical → {aliases, icon path, colour token}) from `src/engine/callouts.js`** so the editor, the toolbar popover and the engine share one table); `type` normalised through the aliases; an unknown type is a plain quote (the engine's `calloutBlock` returns nothing for it and marked renders a blockquote — plan said "renders as note", measured otherwise in Phase 0) | click on the chevron of a foldable (`+`/`-`) toggles the body fold: a `foldStateField` (per construct id, seeded from `-`/`+`) makes `blockField` replace the body lines with nothing (`Decoration.replace({block:true})` over `[secondLine.from, lastLine.to]`); folding does not edit the file (the `+`/`-` in the source is the *initial* state, as in reading mode) |
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
| code fence | NEVER concealed body: `CodeText` stays source with fence-language highlighting; opener line replaced by **FenceHead** (language badge + copy button; `CodeInfo` text hidden), closer by **FenceFoot**, its line collapsed to a 10px pad finishing the box (`le-fence-foot-line`) — ◆ full height again when revealed, the one line whose height changes on entering (as built it was a full blank line under the code, which reading mode never draws; the owner's report, 2026-09-27); lines get `le-fence` (mono, background) | opener/closer shown | copy button copies `CodeText` |
| rich fences (`mermaid tikz latex tex metapost leaflet query tasks kanban dataview dataviewjs base ad-* meta-bind(-button/-embed/-js/-js-view)` + any language a plugin's engine surface registers — the list lives in `live/rich-fences.js`, imported by the toolbar too. Plugins do NOT declare fence names today (the Charts manifest has only `surfaces`); the model takes `richFences` as config, and how a plugin supplies it — a manifest `fences` key? — is still open, §12) | Tier C frame (§7) when `liveRenderFences`; else as code fence | source | — |
| `:::name` … `:::` (generic: theorem, abstract, title-box, comment, HTML, custom) | opener line → **EnvHead** widget (`name` + attrs summary as a caption, left rule), closer → **EnvFoot**; body lines `le-env le-env-<name>` (left rule `--clew-accent`); `:::TeX` body additionally `le-tex-only` (dimmed, head says "LaTeX only"); `:::comment` dimmed; nesting via `data-depth` from colon count | source | — |
| `@begin(name)`…`@end(name)` | same as above; `@begin(equation\|align\|…)` (the `MATH_ENVIRONMENT_NAMES`) → display MathWidget wrapping the body in `\begin{name}…\end{name}` | source | — |
| `:::mermaid`, `:::TiKZ`, `@begin(TiKZ\|metapost\|mermaid\|reveal)`, `:::game`, `:::Mathematica`, `:::markdown-demo`, `@reveal[…]`, `@name+[…]` for a name the engine renders richly | Tier C frame | source | — |
| `@name+[text]{attrs}` / `::name[content]` (generic block directive) | EnvHead-style caption + content inline | source | — |
| HTML block, `<script>`, `<style>` | source, `le-html` (mono, dim). An HTML block containing a custom element (`<[a-z]+-[a-z-]+`) or `<iframe`/`<video`/`<audio`/`<svg` → Tier C frame when `liveRenderEmbeds` | — | — |
| `{{TOC}}` alone on a line | block **TocWidget** (§5.8) | source | click an entry → cursor to that heading |
| `![[Note]]` `![[Note#H]]` `![[Note#^id]]` `![[x.pdf]]` `![[x.docx]]` `![[x.canvas]]` `![[x.excalidraw]]` `![[x.mp4]]` `![[x.base#View]]` alone on a line | Tier C frame | source | — |
| kanban board note (frontmatter `kanban-plugin`) | a top banner "This note is a Kanban board — boards render in reading mode"; otherwise Tier A only | — | banner button → reading mode |

#### 5.5a Tables — drawn, and edited in place

A table is drawn as a `<table>` (`widgets/table.js`): alignment from the
delimiter row (`tables.js#alignmentOf`), each cell's inline markdown through
`inline-dom.js`. It stays drawn WHILE YOU TYPE IN IT — designed by the
planning session (the design text is the source of this section) and built
as follows; the one sentence: the cell being edited holds a small nested
CodeMirror view whose document is a projection of that cell's text in the
note, and every keystroke lands in the pooled EditorView's document, which
stays the only model and the only undo history.

- **Cells come from the TEXT** (`live/table-cell-model.js#cellRanges`:
  unescaped pipes, padding trimmed; an empty cell is the empty range after
  its first space), not from lezer's `TableCell` — lezer emits no node for
  an empty cell, and an empty cell must be editable. Rows are logical
  (header 0, the delimiter line skipped). Pure and tested
  (`tests/table-cell.test.js`), with `cellAt`, `neighbour` (wrap across
  rows; `{edge}` leaving the table), `escapeCellText`, `forwardChanges`
  and `isExtendedTable`.
- **The active cell** is note state (`live/active-cell.js`):
  `{row, col, from, to, tableFrom}`, mapped through every change (a change
  that swallows the cell's edges clears it). `revealSet(…, pinned)` never
  reveals the table holding it, so the table stays concealed although the
  note's selection is inside its lines. The field must come BEFORE
  `liveStateField` in the bundle — the reveal rule reads its new value.
- **The widget only draws** and marks the active `<td>` (`data-le-active`,
  left empty). Each keystroke changes the table's text, so CodeMirror hands
  it a new widget per keystroke: `updateDOM` patches the changed cells in
  place and never touches the active one. **Measured: CodeMirror does call
  `updateDOM` here** — the cell editor is the same element across typing
  (`same-node=true`), so the design's fallbacks (re-mount and refocus per
  keystroke; a floating editor in a layer) were not needed.
- **The cell editor** (`live/table-cell-editor.js`): one per note editor
  (a WeakMap keyed by the note's view, destroyed with the tab), its state
  REBUILT on each mount — it has no history of its own to keep. It carries
  the note's grammar, highlighting, the dialect overlay, the live INLINE
  layer (so `*x*` conceals in a cell), completions, closeBrackets, and the
  cell keymap. A mounter ViewPlugin in the note puts it in the active `<td>`
  after every layout. Its changes and selection are forwarded to the note
  (`cellEdit` annotation, userEvent kept, so history groups typing as in
  prose); any OTHER note change touching the cell (undo, a reload from disk)
  is projected back (`cellSync`). A `transactionFilter` escapes on the way
  in: a bare `|` → `\|` (not after a backslash), a newline → `<br>`. The
  drawn cell renders them back: `inline-dom.js` reads a literal `<br>` as a
  break token (everywhere — the engine renders it so in prose too) and an
  escaped `\|` as `|` (found in review: the cell first showed the text
  `<br>`; the scenario now asserts the RENDERED cell).
- **Measured: the note editor's theme reaches the cell editor.** CodeMirror
  theme rules are descendant selectors under the note editor's theme class,
  and the cell editor sits inside it — the note's `.cm-content` padding
  (`… 40vh`) made a one-line cell ~40vh tall. live-edit.css wins the cell's
  box back; `cell-height-ok` pins it.
- **Keys** (cell keymap, highest precedence): Tab / Shift-Tab across cells
  and rows, Tab past the last cell appends a row; Enter down a column,
  appending at the bottom; Shift-Enter `<br>`; Escape leaves with the table
  as source at the caret; arrows at a cell's edge move to the neighbour, and
  out of the table at its top/bottom; ⌘Z / ⌘⇧Z / ⌘Y are the NOTE's
  undo/redo.
- **Leaving** (Escape, a click elsewhere, arrowing out, a search) reflows
  that table ONCE (`formatTable`, one isolated undo step, nothing when
  already aligned) — never per keystroke, so a one-cell edit is a one-row
  diff until you leave. The reflow rewrites the lines wholesale, so a caret
  that was in the cell is put back into the same cell after (measured: it
  mapped to the table's edge).
- **Structure** — pure helpers in tables.js beside `formatTable`:
  `insertRow`, `deleteRow`, `insertColumn`, `deleteColumn`, `moveRow`,
  `moveColumn`, `setAlignment`; registry commands `format:table-row-above`,
  `format:table-row` (below), `format:table-delete-row`,
  `format:table-col-left/right`, `format:table-delete-col`,
  `format:table-move-row-up/down`, `format:table-move-col-left/right`,
  `format:table-align-left/center/right/none`, `editor:table-source`,
  `editor:table-edit-cell` (live edit only: the source-mode editor carries no
  active-cell state); `editor:format-table` keeps the cell. They work on the
  active cell or on the table under the cursor in source. Inserting "above
  the header" lands below it; the header and the delimiter row are never
  deleted or moved. Surfaces: the toolbar's Table group and a right-click
  menu on a cell (`popovers.js#openTableMenu`), one item list
  (`toolbar-spec.js#TABLE_ITEMS`). No default hotkeys beyond Tab/Enter.
- **Formatting commands inside a cell** route to the cell editor
  (`format.js#activeEditorView`); only inline ones are allowed there (a
  heading in a cell is refused with a notice). The selection bubble stays out
  of cells (the toolbar has the same styles).
- **A reload from disk** is now the smallest change (`editor/minimal-change.js`,
  used by `pool.js#reload`), so an edit made elsewhere maps through and a cell
  being edited in place re-syncs instead of ending.
- **Edited as source, refused by name** in a strip above the table: an
  EXTENDED table (the engine's colspan `| a || b |`, rowspan cell ending in
  `^`, widths `|---30%---|` — read from marked-extended-tables-headerless),
  which `formatTable` would square away; and a table over 200 rows or 40
  columns.
- **Headerless tables** (added 2026-09-27, the owner's report: a grades table
  of bare pipe rows showed as text). The engine renders two forms GFM does
  not — pure pipe rows, and a separator line first — and lezer parses both
  as a paragraph. `tables.js#headerlessTables` holds the engine's rules
  (its tokenizer's regexes, copied from marked-extended-tables-headerless);
  `model.js#pipeTables` runs them over each paragraph outside a quote and
  adds `table` constructs with `headerless: 'pipes' | 'separator'`.
  `tests/headerless-tables.test.js` asserts PARITY by lexing the same
  documents with the engine's own extension (skipped where the engine master
  is absent). `cellRanges` skips a separator on the FIRST line (unless the
  real delimiter follows it) and reports `headerRows` (0 here); every
  "never the header" rule — insert/delete/move row, the commands' logical
  rows — reads that count instead of assuming row 0. The last row of a
  headerless table is never deleted. Alignment on a pure-pipe table adds a
  separator line (the separator-first form: still headerless, now aligned).
  A table is edited in place only when its lines are exactly the run of
  pipe-led lines editing finds (`tableAround`); otherwise it is drawn only.
  Source mode's Tab/Enter keymap stays GFM-only: a single `| a |` line is a
  table to the engine, and Enter after one must still start a new line.
  Scenario: `smoke/live-headerless-table-scenario.js`.
- Clicking: a plain click edits the cell in place; ⌥-click reveals the source
  at that cell (⌥ means "the source" everywhere in live edit).
- Scenario: `smoke/live-table-edit-scenario.js` (ten steps, real input for
  typing, undo, Tab, escaping, Escape).

#### 5.5b ImageWidget

`<img>` with `src` from `lib/preview-url.js#vaultFileUrl(resolvedPath)` for
vault files (resolve `![[name.png]]` through `vaultStore.resolveFileName`),
`data:` and `clew-preview:` URLs as-is, and `http(s)` URLs **only if the
CSP is widened** (§12; until then such images show a chip "Remote
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
("reading mode is the truth for macros"). §12 lists the v2 option (a
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

As built (Phase 3): the widget is its own compact editor over
`shared/frontmatter.js` (text, number, date and checkbox values edit in
place; lists show as chips; a non-`clean` block is read-only), writing
through `editor/frontmatter-edit.js` — the Properties panel was NOT
refactored into `properties-rows.js`: its rows are bound to the panel's
private state, and a second, smaller renderer sharing the CSS and the
serialisation was the smaller risk. Callout titles stay DOCUMENT text
(styled `le-callout-title`, their inline constructs concealed like any
others) rather than an `inlineDom` rendering, so they edit in place.

### 5.8 TocWidget

Headings from the model (`heading` constructs in order); nested `<ul>` by
level; entries via `renderInline`; click → `view.dispatch({selection,
effects: EditorView.scrollIntoView(pos, {y:'start'})})`. Reflects edits
because `eq` compares a hash of the heading list.

### 5.9 Keys

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

As built (Phase 3): no `live/keymap.js`. Enter already continues lists,
tasks and quotes in both modes (`markdownKeymap`'s
`insertNewlineContinueMarkup`, in editor.js's keymap), and Tab already
indents list items (`indentWithTab` → `indentMore`); what was missing is
now three commands in format.js — `format:indent`, `format:outdent`, and
`editor:toggle-task` on ⌘-Enter, which falls back to CodeMirror's own ⌘-Enter
(`insertBlankLine`) off a task line so the chord takes nothing away.

Corrected with §5.12: the arrow-key claim above holds for INLINE
constructs only. Vertical motion carried the cursor past a block widget
entirely; `live/keys.js` now stops it at the block's near edge (§5.12).

### 5.10 What a construct looks like while revealed

**Measured in Phase 3**: CodeMirror places a `cm-widgetBuffer` image
(1em tall, `vertical-align: text-top`) either side of a replaced range; on a
heading line it lifted the line box by 1px (41.9 vs 40.9), so a concealed
heading stood taller than a revealed one. live-edit.css sets those images on
the baseline at 0.6em; `live-lines-scenario` asserts `height-stable=true`.
Heading SIZE lives on the line (`le-hN`), and live mode neutralises the
`cmt-headingN` span sizes so the two do not compound.

Exactly source mode: the overlay's `jmd-*` faces and `cmt-*` classes. The
live-edit layers add nothing to a revealed construct except keeping the
LINE-level classes that give a heading its size and a list its indent (so
the line does not jump when the cursor enters it). Rule: **entering a line
must never change its height** — heading sizes, list indents, quote
borders and callout backgrounds are line decorations that apply in both
states; only the marks toggle.

---

### 5.11 Link hover previews

Obsidian's page preview, requested by the owner after the build and
designed by the planning session: hovering a link to something in the
vault shows what it points to, rendered by the engine, in a popover that
goes away when the pointer does. Source mode, live edit AND reading mode.

**As built** (deviations from the design are marked ◆):

- **One reader of links.** `editor/link-at.js` (pure, `tests/link-at.test.js`):
  `linkAt(lineText, column)` finds a `[[…]]` / `![[…]]` (target, heading
  or `^id`, alias, `|external`) or a `[text](url)` at a column, inclusive of
  both ends (CodeMirror reports the position AFTER the last character when
  the pointer is over its right half), and null inside a code span.
  `wikilink-click.js` (source mode's ⌘-click) now reads links through it.
  `parseTarget` turns reading mode's `data-href` into the same shape.
  `previewSpec(link, resolvers)` decides what shows:
  a note → `{kind: 'block', text: '![[Folder/Note#Heading|bare]]'}` (the
  resolved PATH, not the name typed, so the engine cannot resolve it
  differently); `[[#Heading]]` and `[x](#Heading)` → the note being edited;
  an image → `{kind: 'image'}`; any other vault file → a block of
  `![[path]]` ◆ (no `|bare`: the keyword is a NOTE embed's chrome and means
  nothing to a PDF, an office thumbnail or media); an unresolved name →
  `{kind: 'unresolved'}` (a note or, with an extension, a file); a URL,
  `mailto:` or `|external` → null, no popover.
- **The popover** is `<clew-link-preview>` (`editor/link-preview.js`,
  `styles/link-preview.css`), one per window, appended to `<body>` like the
  selection bubble ◆ (not `<clew-app>`). Its API is `hover(spec, rect,
  sourcePath, {now})` / `unhover()` / `hide()`, and it owns the timing: 500 ms
  before showing, none when moving from one link to another while it is
  open (or with `now` — a ⌘ press in `mod` mode), 300 ms of grace on
  leaving so the pointer can cross into it. A header names the target
  (`Welcome › The guide`) with an **Open** button (⌘-click: new tab); the
  body is 440 px wide, the document's reported height clamped to 80–360 px,
  scrolling inside beyond that, with 6/14 px of padding the popover adds ◆
  (a block document has no margin of its own — a live frame sits flush with
  the text). An unresolved note is a card, "No note called X", that creates
  it on click; an unresolved file's card is disabled.
- **One iframe**, kept across hovers: a block spec POSTs to
  `__clew_block__` and sets `src` only when the returned hash differs, so
  the same target re-shows without a reload and a repeat render comes from
  the fragment cache. Thirty seconds after closing, `src = about:blank`.
  Messages: `ready` → theme + app-chords; `size` → height; `link-click`,
  `external-link`, `open-external-file` → `frame-host.js` in `block` mode
  (the popover closes first); everything else, `focused` included,
  ignored. The iframe's `color-scheme` follows the theme, as `.le-frame`'s.
- **Closing**: Escape, a pointerdown outside it, window blur, any
  `layout-changed` (tab or mode switch), and — from the editor plugin — any
  non-modifier keydown in the editor or a scroll of it. It never takes
  focus: `hover` touches nothing but its own DOM.
- **The editor plugin** `editor/link-hover.js` is in the note state's base
  extensions (both modes; the cell editor does not carry it ◆ — a cell is
  its own editor and v1 leaves it out). A rAF-throttled `mousemove` on the
  view's DOM asks what is under the pointer: something DRAWN as a link
  (`.le-link`, `.le-wikilink`, `.le-embed-chip` in live edit;
  `.jmd-wikilink-*`, `.cmt-link`, `.cmt-url` in source mode) ◆ — the gate
  that stops `posAtCoords`, which snaps to the nearest position, from
  finding a link the pointer is merely beside — then `posAtCoords` +
  `linkAt` on that line, and `literal-at.js` (code, maths, HTML, metadata
  header; shared with the `//` menu, whose check it was) refuses code. It
  has no `update` method, so it adds nothing to a keystroke (measured:
  `live-perf-scenario` 3.7 ms median live on Diagrams.md, 14.9 ms at 207 KB,
  against 3.5 / 14.4 before — noise). The note a view shows comes from the
  pool (`setViewNotePath`, set on open and on rename) ◆, since a state is
  created before any path is known.
- **Reading mode**: `preview-client/client.js#reportLinkHovers` (not in
  block documents — live frames and the popover's own document stay out,
  as designed) posts `link-hover {target, rect, mod}` on entering an
  `a.internal-link` (not a `data-open-external` one), again when ⌘ is
  pressed or released over it, and `link-unhover` on leaving, on
  `mouseleave` of the document and on scroll (`scrolled: true` → hide).
  `clew-preview-view` offsets the rect by the iframe's and calls the same
  popover — one host, so reading mode came in the same commit.
- **Trigger**: setting `linkPreview: 'hover' | 'mod' | 'off'`, default
  `'hover'`; Settings → Appearance ◆ ("Link previews on hover": Always /
  With ⌘ held / Off — Ctrl off the Mac). `mod` needs ⌘ (Ctrl) held; a ⌘
  keydown over a link shows it at once.
- **Smoke**: `link-preview-scenario.js` + `link-preview-frame.js` over
  `make-hover-vault.mjs` ◆ (a scratch copy of the demo vault plus
  `Hover.md` — one link per line, since a popover opens below its link and
  would cover the next line's; the design's `Dialect Demo.md` and
  `Math and Theorems#Dialect extras` do not have the links or headings
  named). The harness gained `{move:{x,y}, modifiers?}` (CDP `mouseMoved`,
  nothing pressed). Reading mode's link positions cannot be measured from
  the app page (a cross-origin frame), so its fixture link carries a long
  alias that fills seven lines, and the pointer goes to its third line as
  measured in live edit.

### 5.12 The live preview pane

*As built, 2026-09-29:* the pane is fixed and outside the editor's
scroller, so a wheel over it reached nothing — the note stood still while
the pointer was over the pane (measured by bisecting live-blocks'
wheel check to 818cf32). It now passes a wheel it cannot use to the note:
its body's own overflow (a diagram taller than the pane) scrolls first,
natively, and a gesture that began there stays latched to it until its
events pause for 150 ms, as the browser's scroll latching would. The body is
sized to the frame PLUS its padding — sized to the frame alone, every
diagram overflowed by 12 px, a phantom scroll that took the first wheel.

Requested by the owner after the build (the idea is jmacs's live math
tooltip; nothing there was taken as authoritative), designed by the planning
session. While the cursor is inside a formula or a diagram block — its
source showing — a floating pane beside it shows what the CURRENT source
renders to, updated on a typing pause. Source mode, where nothing else
would show it, and live edit, where the construct's widget or frame is
hidden while it is revealed.

**As built** (deviations marked ◆):

- **Targets**: `editor/preview-target.js#previewTargetAt(state, pos)`, pure
  over the scanner (`math`, `directiveBlock`, `environment`) and lezer
  (`FencedCode` + `CodeInfo`), `tests/preview-target.test.js`. Kinds:
  `math-inline` (`$…$`, `\(…\)`), `math-display` (`$$…$$`, `\[…\]`, a
  top-level `\begin{align}` etc. — the scanner's segment, whose body is the
  whole environment — and `@begin(align…)` from the environment list,
  wrapped as block-field.js wraps it), `fence` (mermaid 400 ms; tikz, latex,
  tex, metapost 700 ms), `directive` (`:::TiKZ`/`tikz`/`mermaid`),
  `environment` (`@begin(TiKZ|tikz|tikzpicture|metapost|mermaid)`). Inside =
  `from ≤ pos ≤ to` on the whole extent. Only COMPLETE constructs: an
  unclosed `$$` makes no scanner segment, an unclosed fence has one code
  mark, a directive/environment needs its closer. Queries/Dataview/Bases are
  never targets. Math carries `tex` (what MathJax typesets); the rest `text`
  (the full source). A cursor at a fence's very first character resolves to
  the node before it looking left, so lezer is asked from both sides ◆.
- **The shared base** `components/chrome/floating-pane.js` (`FloatingPane`,
  a subclass of HTMLElement both panes extend): the one kept iframe, `ready`
  → theme + app-chords, `size` → `onFrameSize`, `renderIntoFrame(text,
  sourcePath, {morph})` (POST `__clew_block__`; `'same'` when the hash has
  not changed, `'morphed'` — the body fetched and posted as `render` — when
  the frame already holds a document, else `'loaded'`; a generation counter
  returns null for superseded calls), 30 s blanking after hide,
  `placeAgainst(anchor, {prefer, left})` with flip and clamp, and at most one
  floating pane visible per window (showing one hides the other). The link
  preview (§5.11) was refactored onto it, not copied.
- **The pane** `<clew-preview-pane>` (`editor/preview-pane.js`,
  `styles/preview-pane.css`): maths through `lib/mathjax.js#typesetTex` —
  the widget's own call, so `same-as-widget=true` and leaving the formula
  shows it with no flicker; a TeX error (`data-mjx-error`) shows its message
  in `--clew-danger` UNDER the last good picture. Engine kinds through the
  base's iframe, morphed per update, so the figure morph guard keeps what
  did not change. The frame takes no pointer events and is sized to its
  document's full height; the pane's body scrolls it (60–420 px) ◆ — the
  design's "a pointer may scroll it, clicks do nothing", without a click
  ever reaching (or focusing) the frame. `role="status"`.
- **Placement**: inline maths ABOVE its line at the segment's x, flipped
  below when clipped, as wide as it needs up to the text column; everything
  else BELOW the construct's last line, left edge and width = the text
  column (`.cm-line`'s box). Repositioned through `requestMeasure` on
  geometry/viewport changes and scroll; hidden (visibility) while the anchor
  is off screen.
- **The plugin** `editor/preview-pane-plugin.js` in the note state's base
  extensions (both modes; not the table-cell editor): on `selectionSet ||
  docChanged || focusChanged` it asks previewTargetAt at the head and calls
  `pane.track(view, target, path)`; geometry changes only reposition. In
  live edit a target counts only while a model construct starting at its
  `from` is in the revealed set. The pane renders at once on entering a
  target and on the target's pause while the head stays in the SAME target
  (kind + from). Escape (a keydown listener on the view, which consumes
  nothing) hides it until the head leaves that target; blur, `layout-changed`
  (tab or mode switch) and `previewPane: 'off'` hide it.
- **◆ Arrow keys into block widgets** (`live/keys.js`, in the live bundle):
  measuring the scenario's "ArrowUp/Down out and back" found that
  CodeMirror's vertical motion carries the cursor clean PAST a block
  replacement — from below a `$$` block, ArrowUp landed on the line above
  it; from above, ArrowDown on the line below — so no drawn block (maths, a
  frame, a table, a rule) could be reached from the keyboard. §5.9's "arrow
  keys need nothing special" held for inline constructs only. Now, when the
  motion would cross a block replacement, the cursor stops at its near edge,
  the construct reveals, and the next arrow walks its source.
- **Keystroke cost**: `live-perf-scenario` 3.3 ms median live / 14.7 ms at
  207 KB (before: 3.7 / 14.9) — noise.
- **Setting** `previewPane: 'on' | 'off'`, default on; Settings →
  Appearance, beside link previews.
- **Smoke**: `preview-pane-scenario.js` + `preview-pane-frame.js` over
  `make-live-vault.mjs`'s `Pane.md`. The design's TikZ gate (run only where
  mp-tikz-wasm is staged) was dropped ◆: the pane renders a ```tikz block
  either way — the figure, or the engine's refusal by name — so the step
  asserts the frame is ready, not what it drew. The TikZ step runs LAST and
  the scenario then returns to the mermaid fence, because the pane's one
  iframe must end the run holding the document the frame script reads.

### 5.13 Cross-references — @label, @ref, @cref, @Cref

Designed by the planning session at the owner's request: labels and
references are the manuscript's own links — an index, completion, a
rendered chip, a click that jumps, a hover that previews — with the
numbers the export will print shown while you write.

**§0, the engine contract, verified against vendor/jmarkdown/src** (the
design's reading was right except where marked ◆):

- `post-processor.js` numbers in this order, HTML only: headings under
  `Headings: numeric` (`add_labels_to_headers`: EVERY `:header`, h1
  included, "1.", "1.2."), figures (subfigures `1a`), tables, listings,
  theorems (ONE counter over `.theorem-env`), equations (`div.equation`,
  from `@begin(equation)` only), custom `.jmd-env` per counter group; then
  `process_crossrefs`: a `.xref-label` takes its footnote's number
  (`closest('[id^="footnote-"]')` — a branch that NEVER runs ◆: the
  endnotes carry `id="fn-…"`, so a footnote label's reference prints `??`,
  measured 2026-09-27 and mirrored, the crossref fixture asserting it; an
  engine bug for upstream), else the innermost
  `[data-xref-number]`, else `prevAll('.xref')` — the heading's own number
  span, so only a label IN a numbered heading — else '' (a reference then
  prints `??`). A trailing '.' is stripped. Duplicate keys: the later wins.
- `@ref` prints the BARE number — an equation's too ("2", not "(2)") ◆;
  the design and the manual both said "(2)". `@cref`/`@Cref` go through
  `crossref.js#typedRefText` ("equation&#160;(2)").
- A theorem's name is its `[…]` text (`ctx.text` → `data-name`), NOT a
  `title=` attribute ◆ — the demo vault's Math and Theorems note had
  `{#thm-main title="…"}`, which the engine ignores; fixed.
- `{#key}` cannot carry a colon; `{id=key}` can (theorems.js, floats.js).
- A heading's type word is `sectioning.js#commandForDepth` (`Heading base`,
  `Document class`: depth 1 is a section in an article, a chapter in a
  book).
- Clew's engine config sets `Header style: fenced`, so `Headings: numeric`
  must sit in `---` frontmatter.
- Generated headings — an endnotes title (`<h1>Endnotes</h1>` or a mid-note
  `@endnotes{title=…}`), the bibliography's, the index's — and a heading
  marked `{-}` take NO number and leave the count alone (jmarkdown b212e82,
  2026-10-03; until then the engine numbered them, and a mid-note
  `@endnotes` put every later heading one ahead of Clew). The mirror skips
  `{-}` (`UNNUMBERED_RE`); generated headings are no `#` line in it. The
  crossref fixture holds both, and the parity is strict — the frame no
  longer filters the endnotes heading out.

**As built:**

- **Index**: `shared/note-metadata.js` gains `labels: [{key, kind, line,
  col, title, host: {from, to}}]` — `{#key}`/`{id=key}` on an opener
  (`attrLabel`, exported) and `@label`/`:label` outside code and maths; kind
  is the numbered environment's name, `env:<name>` otherwise, `section`,
  `footnote` or `plain`; an `@label` inside a verbatim body (an equation,
  a diagram) is not one. The opener/closer regexes are RESTATED there ◆ —
  shared/ must not import the renderer's scanner. The indexer's cache
  version is bumped (2) so existing vaults re-extract; `vaultStore.labelsFor`.
- **Numbering** `editor/live/numbering.js#numberDocument(doc)`: a pure pass
  over the note's TEXT ◆ (the design had it over the live model), keyed by
  LINE — an opener's, a heading's — so live edit, source-mode completion and
  hover share one pass and need no live model. Memoised per `Text`; a
  pre-check skips notes with nothing the engine numbers (measured: a 210 KB
  note of diagrams 0.12 ms; a full pass on that note with a theorem in it
  2.4 ms). `typedRefText` is imported from the vendored `crossref.js`
  itself (a leaf module; `&#160;` becomes a real no-break space);
  `commandForDepth`'s tables are ported, and `tests/numbering.test.js`
  reads the vendored `sectioning.js` and asserts they agree. Per note in
  v1; the multi-file offsets are not built.
- **Live edit**: `EnvHeadWidget` says "Theorem 2" / "Figure 1" / "(a)" for
  a subfigure; the `@begin(equation)` MathWidget carries `data-le-tag`
  "(n)", drawn at the right like `.eqn-number`; a numbered heading gets a
  "1.2." widget after its concealed `##`; `@label` stays the ⚓ chip with
  its number in the tooltip; `@ref`/`@cref`/`@Cref` become `le-ref` chips
  showing what the engine will print. An unknown key shows `??` ◆ (the
  design's §3 said "the key"; its decisions table and the engine both say
  `??`, and parity wants the engine's text — the key is in the tooltip),
  as does a numberless target; an undeclared custom environment shows `?`.
  A click jumps to the label's line and leaves a Back entry:
  `recordAnchorJump(…, {editor: true})` puts a `pendingLine` in the entry
  and `clew-editor-view.js` lands on it when Back restores it ◆ (tab
  history restored reading positions only; the editor ignored a same-note
  jump's Back). ⌥-click edits.
- **Hover**: `linkAt` recognises the six spellings (`kind: 'xref'`);
  `previewSpec` asks `resolve.label(key)` → `numbering.js#labelPreview`: the
  host's source through the block endpoint (a heading host as
  `![[Note#Heading|bare]]`), headed "Theorem 2 — Fundamental Triviality".
  The lone fragment's own "Theorem 1." is hidden by a `<style>` block
  PREPENDED to the fragment's text ◆, not a `?label=1` query read by
  protocol.js — no protocol change. In source mode a key is unpainted text
  (only the directive's sigil, name and brackets are classed), so the hover
  gate accepts a bare `.cm-line` for an xref and checks the geometry itself.
- **Completion** `complete/crossrefs.js` in both editors: the note's labels
  from the numbering of the CURRENT state, detailed "theorem 2 — Title";
  applying adds the `]`. Inclusion neighbours in a jmarkdownProject vault
  are NOT built ◆ (v1 is per note throughout).
- **Commands**: `format:label`/`format:reference` write `@label[]`/`@ref[]`
  (a reference then opens completion); `format:cref`, `format:Cref`;
  `editor:jump-to-label` (a list modal; Back returns). The Format menu reads
  "Label — @label[key]", "Reference — @ref[key]", "Typed Reference —
  @cref[key]". No sigil setting.
- **inline-dom** renders `ref`/`label` tokens (table cells, callout titles).
- **Manifest keys**: an engine surface's `fences` and `numbered` (a name or
  `{name, counter, refname}`) pass through plugins.js untouched (it already
  spread the surface spec); `renderer/plugins.js` unions the enabled
  plugins' into `pluginEngineDeclarations()`, which `readLiveConfig` feeds
  to the model (`richFences`) and the numbering (`numbered`); a change
  reconfigures live editors. The demo's Charts plugin declares
  `"fences": ["chart"]`.
- **Parity** (`smoke/crossref-scenario.js`): live edit's chips and the
  numbering's targets, then the ENGINE's own `.xref-ref`/`.xref-cref` texts
  and `data-xref-number`/`.header-label` stamps read from the reading
  document — equal element by element, before and after a theorem is typed
  above the others (`numbers-match=true`). The demo's Math and Theorems
  note matched too.

### 5.14 Citations as objects

A `\cite{key}` is a link to a work: index it, show who cites it, preview
it, open its PDF. Designed by the planning session; built overnight.

**As built** (deviations ◆):

- **Index**: `shared/note-metadata.js` `citations: [{key, line, command,
  pandoc}]` — any `\…cite…` command (starred, up to two `[…]` notes, comma
  lists) and pandoc's `[@a; @b]` / bare `@key` flagged `pandoc: true` (a bare
  `@key` never after a word character — addresses — and never followed by
  `(`/`[` — `@begin(`, `@label[`); code, maths and fences masked. Cache
  version 3. `vaultStore.citationsOf(path)`, `citedBy(key, {pandoc})`
  (pandoc forms count only under the vault's `pandocCitations`).
- **Bib fields**: `shared/bib.js` exposes `file`, `url`, `doi` (the doi
  without a resolver prefix) and `bibFilePath(value)` — Zotero/JabRef's
  `Description:path:mime`, `;`-joined, `\:`-escaped; the first PDF wins.
  The BIB_ENTRIES scan (ipc.js) now names the source `.bib` `bib` ◆ (it was
  `file`, which the BibTeX field now is) and adds `pdf: {path, inVault,
  exists}`, resolved against the .bib's folder, then the vault root.
- **The panel**: `clew-bibliography.js` gains "This note | Library". The
  Refs tool is now ALWAYS in the right sidebar ◆ (it was gated on
  `bibliographyPanel`): the Library renders nothing, so only "This note"
  (which renders the note) stays behind the setting, and it says so when
  off. Library rows: author-year, key, title, "Cited in N notes" (disclosure
  → notes, each opening at the citation's line), Insert (`\cite{key}`, or
  `[@key]` under pandocCitations, at the caret of `activeEditorView()`),
  Copy key, PDF (in-vault → a Clew PDF tab; outside → the OS via
  `SHELL_OPEN_PATH` with a `file://` url, the open-file guard's route;
  missing → a notice naming it), DOI/URL. Search is SUBSTRING terms over
  key/authors/title/year, ranked by the key ◆ — the design's fuzzy match
  found "alex" in the letters of "LaTeX" (measured).
- **Live edit**: the cite chip (`reveal: false`, `data-le-cite`) opens the
  right sidebar on Refs → Library at the entry, highlighted
  (`events.js#showCitation`); ⌥-click edits.
- **As built, 2026-10-01 — the chip's TEXT is the engine's.** The plan's
  `Author Year` label (row above, §4) was a local guess, and a wrong one:
  `\cite{Akerlof/Kranton:2000}` read "Kranton 2000" (bib.js's authors are
  already short, "Akerlof & Kranton", and were re-parsed as one name), where
  reading mode says "Akerlof and Kranton (2000)" — the owner's report. Now
  `live/cite-text.js` renders every citation of the note, in order, in ONE
  block render (each a paragraph behind a plain-word marker; read back from
  the element carrying `data-bibtex`), caches it per note (citation header
  + an epoch bumped by a .bib edit or an engine-reconfiguring setting) and
  re-asks only when the note's list of citations changes. Pills equal
  reading mode for every form measured — chicago author-year with pre/post
  notes, `\citeauthor`, `\citeyear`, several keys, and vancouver's `[1,3]`
  (smoke/cite-pill-scenario.js); typing beside 300 citations costs nothing
  measurable and asks for no render (cite-perf-scenario.js). Until the text
  is in, or without a bibliography, `live/cite-label.js` shapes the local
  label by command ("(Akerlof and Kranton 2000)" for `\citep`); an unknown
  key is the key in the danger colour. The hover's button on a citation is
  "Show in Library" (the spec carries `cite: [keys]`), ⌘ opening the entry's
  PDF; it read "Open" and reopened the note already open. `\fullcite` is
  no pill: the engine's whole entry drawn inline (widgets/fullcite.js),
  italic titles kept through an attribute-free rebuild of its HTML,
  text-equal to reading mode in chicago (one key, two) and vancouver (`[2]`
  — a numeric style renders it as its number); smoke/fullcite-scenario.js.
- **Hover**: `linkAt` recognises the `\cite` family (`kind: 'cite'`);
  `previewSpec` renders `\fullcite{key}` per key through the block endpoint
  when the vault names a `bibliography` (Biblify resolves only then —
  render-service.js#biblifyConfig; measured: "Alexander, J. McKenzie. 2023.
  The Structural Evolution of Morality."), else a card with the .bib's
  author-year and title ◆; an unknown key a card refusing it by name. A
  note's OWN `Bibliography:` header is not seen: the fragment is rendered
  alone, without the note's metadata (the demo's Citations note is such a
  note — its hovers show the card).
  Reading mode: the client reports `[data-bibtex]` spans (Biblify's
  resolved citations) as `link-hover {cite}`; the view hovers the same
  spec ◆ — built, but NOT asserted by a scenario (a reading frame's
  citation coordinates cannot be measured from the app page).
- **Graph**: a "References" switch on the graph (`graphReferences`, app
  setting): a square node per cited key (`--clew-graph-reference`), an edge
  from each citing note, pandoc forms per the vault setting; clicking one
  opens its Library entry. The host exposes `data-nodes`/`data-links`.
- **Smoke**: `citations-scenario.js` over `make-citations-vault.mjs` (real
  input throughout) and `citations-fullcite-scenario.js` (the formatted
  hover, with a bibliography named).

### 5.15 PDF annotations → note

What you highlighted in a PDF becomes a note you can link to, quote from,
and re-run. Designed by the planning session; built overnight.

**As built** (deviations ◆):

- **Viewer** (`preview-client/pdf-core.js`, from the EmbedPDF master's own
  types — `plugin-annotation`, `plugin-scroll`, `engine.getPageGeometry` /
  `getTextSlices`): `handle.listAnnotations()` waits for the annotation
  plugin's `loaded` event, then maps `getAnnotations()` (subtype 9–12
  highlight/underline/squiggly/strikeout, 1 note, 3 freetext, 15 ink;
  popups, links and replies skipped) to `{id, page, kind, text, contents,
  color}`. A markup annotation's `text` is the document text under its
  `segmentRects` — the glyphs whose centres fall inside, as one
  `getTextSlices` slice (the selection plugin's own method); `custom.text`
  (what the UI stored at creation) is the fallback. Reading order: page,
  then top-down (EmbedPDF's y grows downward). `scrollToPage`,
  `currentPage`, and `createAnnotations(specs)` for scenarios.
- **Page host** (`pdf-page.js`): answers `list-annotations` /
  `pdf-page` / `test-create-annotations` — from its PARENT only ◆ (any
  frame holding a reference could otherwise post to it). The design said
  "and pdf-embed.js" ◆: note embeds are not asked — the command works on
  the file tab.
- **Losing an edit on a tab switch** ◆ (measured, and not new): the viewer
  autosaves on a 2.5 s debounce, and an unloading document takes its pending
  timer with it — a highlight made just before its PDF tab was rebuilt was
  LOST (the viewer held 3 of 4). The list request now flushes a pending save
  first, so the command never names an annotation the PDF will not keep.
  The general case (switching away within 2.5 s of an edit) is left for
  the owner — see HANDOVER.
- **Page anchors**: `[[x.pdf#page=N]]` — `actions.openWikilink` opens the
  PDF tab and `showPdfPage` records `pdfPage` in the tab (a viewer built
  later opens there via `pdfViewerUrl(url, {page})`) and asks the viewer,
  which scrolls UNTIL `currentPage` says so ◆ (a scroll asked for before the
  pages are laid out lands nowhere — it worked only when a log line slowed
  the page; measured) and answers `pdf-page-shown`; the host asks until it
  does. Reading mode's links go through the same `openWikilink`. The
  live-edit chip's "p. 12" is not built ◆ — the note writes `|p. N` aliases.
- **The command** `pdf:extract-annotations` (palette, on an active PDF tab)
  and the explorer's "Extract annotations to a note" on a `.pdf`
  (`renderer/pdf-annotations.js`): asks the tab's viewer (opening a tab if
  none), then `shared/pdf-annotations-note.js#annotationsNote(pdfPath,
  annotations, existing)` — pure, tested. `<pdf> — Annotations.md` beside
  the PDF: frontmatter `source`, `extracted` (LOCAL date ◆ — toISOString
  named yesterday past midnight), `## Page N`, and per annotation ONE
  blockquote ◆ — text, comment and `[[x.pdf#page=N|p. N]] ^pdf-<id>` inside
  it, so the block id names all three (the design had the comment as a
  following paragraph, outside the block the id names). Re-running merges:
  existing ids untouched, new ones under their page in order, nothing
  deleted, byte-identical when nothing is new.
- **Smoke**: `pdf-annotations-scenario.js` over `make-pdf-vault.mjs` — a
  four-page PDF written by hand (the demo's sample.pdf has one page, and a
  two-page one could not scroll page 2 to the top).

### 5.15a Quote-and-cite from a PDF

FEATURE-IDEAS #2 (owner-approved 2026-10-03): text selected in any PDF
viewer — a tab, a canvas card, a note's embed — goes into the note being
written in one gesture:

    > Conventions are equilibria in a game of coordination; their
    > evolutionary dynamics are slow.
    >
    > \cite[p. 1]{skyrms:1996} · [[Paper.pdf#page=1|PDF p. 1]]

**As built:**

- **Two ways in.** A "Quote in note" item (a drawn quotation-mark icon)
  in EmbedPDF's OWN selection menu, next to Copy — added at runtime with
  the viewer's `commands.registerCommand` and `ui.mergeSchema`
  (`selectionMenus` is read when the menu is drawn, so no fork change);
  and the command `pdf:quote-selection` (palette, Edit → Quote PDF
  Selection in Note, ⌥⌘Q). Inside a PDF TAB (or canvas card) ⌥⌘Q does
  not reach the app — pdf-page.html forwards no chords, EmbedPDF owning
  ⌘F, ⌘C and ⌘Z there — so the menu item is the in-viewer route; the chord
  works from a note, and from a PDF embedded in a note's reading view. ◆
  That last one needed a fix found here: the preview client's `chordOf`
  claimed to mirror the registry's but lacked its Option recovery (a Mac's
  ⌥Q is key "œ"), so NO ⌥ chord was ever forwarded from a preview —
  measured with a real ⌥⌘Q: nothing before, quoted after.
- **The viewer** (`pdf-core.js`): each document reports when it gains or
  loses a selection (`pdf-selection` to window.top); the app keeps the
  newest one's window and asks it (`pdf-quote-request`); the answer, or the
  menu item's unasked send, is one `pdf-quote` message {path, page — the
  first page the selection touches —, text per page, remote, error}.
  Listeners follow the message-guard rule (the app page only from the
  preview origin; viewers only from window.top).
- **The note** (`renderer/pdf-quote.js`): the active tab when it is a note
  in source or live; else the note last active in an editing mode; else
  the one note being edited on screen. A note in reading mode has no
  cursor and is never written into — the command says so. The insert is a
  block of its own: on a blank line, before a block the cursor starts, or
  after the END of the block the cursor is in (never inside a paragraph,
  quote or list; a heading ends at its line), blank lines either side,
  the cursor after it so a second quote lands beneath. The tab's recorded
  cursor is updated too: the host restores it when the note is shown
  again, and a spot recorded before the insert would be inside the quote
  (measured — a later quote split the first).
- **The citation**: the `.bib` entry whose `file` field resolves to this
  PDF (BIB_ENTRIES' `pdf.path`). Several (a chapter and its book), or none
  while the vault has a bibliography → a picker: "Quote without a
  citation", entries with the same FILE NAME first (a .bib written on
  another machine), then the rest. No .bib at all → no citation, and the
  notice says why. `\cite[p. N]{key}`, or `[@key, p. N]` with
  `pandocCitations`. A web PDF (§4) is refused by name — save a copy.
- **The text** (`shared/pdf-quote.js`, pure, tested): one paragraph; a
  word broken by a line-end hyphen joined (`evo-\nlutionary`), soft
  hyphens dropped. Markup the dialect would read is escaped, every rule
  checked by rendering through the engine: `* _ ^ ~ \` <`, `==`, `::`
  (a description list), `@name`, an opening `/` (dialect only), a first
  line that would be a heading, list, table row or quote. ◆ Two need
  more than a backslash: `[` never (`\[` is display maths here) — only `[[`
  and `[@` become `&#91;`; and a backslash is doubled. ◆ `$` is `\$` since
  jmarkdown e02cd51 wraps an escaped dollar in `span.escaped`, out of
  MathJax's reach (it typesets `$5 and $10` in the page, after the engine);
  before it, `\\\$` was needed, and live edit showed it as `\$5`. Now live
  edit and reading view both show `$5` (`smoke/escapes-scenario.js`), and a
  LaTeX export writes `\$` (the engine's own e02cd51 fixtures).
- ◆ **`p. N` is the PDF's page**, the one `#page=N` opens. Journal PDFs
  carry `/PageLabels` (both real papers measured do: Yu 2012's page 2 is
  "p. 524"); pdfium's `FPDF_GetPageLabel` is not wrapped by the fork's
  engine, so the printed page needs a fork change — the owner's call.
- **Smoke**: `pdf-quote-scenario.js` over `make-quote-vault.mjs`
  (`--real`, `--real-unlisted`, `--pandoc`, `--chord`); selections through EmbedPDF's
  own `setSelection` (the `test-select-text` hook — what a drag ends in),
  the menu item by a REAL click (`frameClick` now searches open shadow
  roots, where the viewer draws its UI).

### 5.16 Sidenotes

When the pane is wide, footnotes sit in the margin beside the text that
cites them, in reading mode and in live edit. Designed by the planning
session; built overnight, after the multi-paragraph footnote correction
(§5.2) it builds on.

**As built** (deviations ◆):

- **Setting** `sidenotes: 'auto' | 'on' | 'off'`, default `auto` — a pane
  ≥ 960 px wide with ≥ 220 px of margin right of the text; Settings →
  Appearance.
- **Reading mode** (`preview-client/client.js#layoutSidenotes`): the engine's
  references are `sup.footnote-ref a[href^="#fn-"]` and its endnotes
  `li#fn-<label>` in `section.footnotes` (inline-footnotes.js — the design
  guessed `#footnote-` ◆). Each note is a CLONE of its endnote (the backref
  removed, the number run into its first paragraph) in a `.clew-sidenotes`
  layer carrying `data-clew-keep`, absolutely placed at its reference's
  height beside the body, pushed below the previous note's bottom + 8 px on
  a collision; laid out again after every `clew:render`, on resize, on
  load and when fonts are ready. The end list (and placed `.jmd-endnotes`)
  is hidden by a body class, so print and export are untouched. The host
  sends the setting (`sidenotes` message) on `ready` and on change. Site
  export: untouched in v1.
- **Live edit** (`live/sidenotes.js`, in the live bundle): a `.le-sidenotes`
  layer inside the scroller (the frame layer's arrangement), measured
  through `requestMeasure` on doc/viewport/geometry/reveal changes. Each
  CONCEALED note's badge (`.le-fn`, one-line and multi-line alike) gets its
  body — the first paragraph, through the inline subset renderer, "…" when
  there is more — at the badge's height; a revealed note has none (its
  source is on screen). A body opening with a fence or a table stays the
  badge's tooltip. Built nodes are cached by content, so typing elsewhere
  rebuilds nothing.
- **Smoke** `sidenotes-scenario.js` + `sidenotes-frame.js`: live edit and
  reading mode both measured — top alignment within 2 px, the collision
  resolved, the end list hidden; the narrow case is made inside the
  reading document by widening its body ◆ (a frame script runs once, at the
  end of a run).

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
4. **Width-aware**: too narrow for one row, the bar wraps onto a second
   (2026-09-29); only past two rows do groups drop into an overflow menu by
   priority; the mode switch never drops. (As built 2026-10-01: the mode
   switch is not in the toolbar at all — it is in each pane's tab strip.)
5. **Declarative**: `toolbar-spec.js` is the single description; the
   element renders it; settings reorder/hide groups.
6. **Dialect-aware**: labels and icons say what the dialect produces
   (`*strong*` not "bold"); under `normalSyntax` the same buttons relabel
   to Bold/Italic and run the same commands (the commands already insert
   the right markers for the dialect; verify `edit:format-strong` inserts
   `**` under normal syntax — it does not today; extend `format.js` to read
   the vault setting).

### 6.2 Spec shape (`toolbar-spec.js`)

(As built 2026-10-01: the `mode` group below left the toolbar for the tab
strip — `VIEW_MODES` in toolbar-spec.js, drawn by `clew-tab-bar.js`.)

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

As built (Phase 6): the fence command that takes a language is a NEW id,
`format:code-fence-lang {lang}` (the existing `format:code-fence` keeps its
behaviour for rebindings); callouts are `format:callout {type, fold}` plus
`format:callout-<type>` for each canonical type (the five `format:alert-*`
remain). The popovers are one module (`toolbar/popovers.js`), not a
directory. Under normalSyntax Strong writes `**` and Italic `*` (format.js
reads the vault setting), and the dialect-only buttons (intense, underline,
highlight) hide. The attachment button is a file input feeding
attachments.js's `saveAndInsert` — no new IPC. Plugin API version 2 in both
halves (main's discovery accepts apiVersion 2).

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

**Two rows (owner's ask, 2026-09-29).** `layoutRows(groups, widths,
available, { maxRows, previousRows, hysteresis, … }) → { rows, visible,
overflow }` replaces hiding with wrapping; `layoutGroups` is its one-row
case. Rows break at group boundaries in NATURAL order (greedy; no later
group backfills an earlier row, so buttons stay where they were); the mode
switch ends row 1 (top right, where it sits on one row). Only when two rows
cannot hold everything does the priority rule above send groups to `…`,
whose button is then reserved at the end of row 2. The ROW COUNT comes from
the always-there groups only: a context group (the table tools, `when:
inTable`) fits into those rows or goes to `…`, so entering a table never
changes the bar's height (it did, in the first build, and every change
moved the editor's scroll — which hides the selection bubble). Going back
from two rows to one needs 8 px of slack (hysteresis). One row, plus `…`,
while the visual viewport is shorter than `--toolbar-two-row-min-height`
(560 px: an iPad with its keyboard up). The element measures the `…` button
and its own padding (no desktop sizes assumed), places groups with CSS
`order` around a zero-height `.toolbar-break`, sizes itself `rows ×
--toolbar-row`, and on a change of rows dispatches `toolbar-resize {delta}`:
`clew-editor-view` moves the editor's scroll by `delta` in the same frame,
so the text below the bar holds still, and brings the caret back only if
the new row covered it. Arrow keys follow VISUAL order (row by row, `…`
last); Up/Down go to the nearest control on the other row.

### 6.5 The element (`<clew-editor-toolbar>`)

- Light DOM, `role="toolbar"`, `aria-label="Formatting"`; one per
  `<clew-editor-view>`, prepended inside `.editor-host` above the editor
  (below the conflict banner when both show); 36px tall; sticky; background
  `--clew-bg-secondary`, bottom border `--clew-border`.
- Buttons: 28×28, icon 16px, `title` = label + ` (${chord})`; `aria-pressed`
  for toggles; `disabled` from `enabled(s)` or the registry's `isEnabled`.
- Segmented mode switch at the trailing end, always visible. (As built
  2026-10-01: in the tab strip instead, left of "+".)
- Keyboard (roving tabindex): the bar is reachable by `Alt-Shift-t`
  (`view:focus-toolbar` command) — arrows move, Home/End jump, Enter/Space
  activate, Escape returns focus to the editor. Popover items: arrows,
  Enter, Escape (closes, focus to its button), typing filters the code
  popover.
- Tooltips are native `title` (no custom tooltip system — consistent with
  the rest of the app).
- Theme: everything via `--clew-*`; hover `--clew-hover`, active
  `--clew-active-item`, pressed toggles `--clew-accent` text.
- The mode switch is NOT in the toolbar (as built, 2026-10-01): it sits
  in each pane's tab strip (`clew-tab-bar.js`), pinned left of "+", so the
  three modes are one click apart in every state and no view spends a row
  on them. ⌥⇧T focuses the switch where no formatting toolbar shows.

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

### 6.9 The `//` menu (`complete/slash-spec.js`, `complete/slash-commands.js`)

Obsidian's slash commands, built after v1 at the owner's request. **The
trigger is `//`, not `/`**: a single slash opens the dialect's italic
(`/text/`), and a menu popping up at the start of every italic would be
noise. `//` can never be an italic — the engine's rule
(`syntax-modifications.js#italics`, `^\/([^\/.?!]+[.?!]?)\/`) needs a
character that is not a slash between the two, and the scanner's opener
(`(^|\s)\/(?=[^\s/])`) agrees — so the double slash costs the dialect
nothing.

- **When it fires** (`slashQuery`, pure): `//` at the start of a line or
  after whitespace, then a query of words separated by single spaces
  (`//heading 2`). `https://`, `a//b`, `///`, `// comment` (a space right
  after the slashes) and two spaces in a row do not fire. Not inside code
  (fenced or inline), maths, raw HTML or the metadata header — the lezer
  node at the cursor and the scanner's `metaHeader` decide.
- **What it offers** (`slashItems`, pure): the Format menu
  (`shared/format-spec.js`), section by section, plus Link and Attachment
  from the toolbar's Insert group — so the menu bar, the palette, the hotkey
  editor and this menu cannot drift. Labels split at ` — ` into a name and
  the syntax it writes (shown as the detail). "Insert Row Below" is left
  out (it needs a table). Under `normalSyntax` intense, underline and
  highlight are hidden and strong/italic relabel as bold/italic, as the
  toolbar does. In a table cell edited in place only
  `CELL_SAFE_COMMANDS` (moved to format-spec.js; format.js refuses the
  rest in a cell with the same list).
- **How it shows**: a CodeMirror completion source beside the wikilink,
  tag and citation sources, in the note editor AND the cell editor, so
  source mode and live edit alike. With nothing typed after `//` the items
  carry the menu's sections, ranked in menu order; once a query is typed
  they drop the sections and rank by the fuzzy match, as a palette does
  (CodeMirror always ranks sections above scores, so a sectioned list
  would put a poor match in Text Style above a perfect one in Block). No
  `validFor`: the source is asked on every keystroke, which is what
  switches between the two shapes.
- **Accepting** deletes `//` and the query, then runs the item's command
  on the next tick (after the completion closes — Wikilink opens a
  completion of its own). Escape closes the menu and leaves `//` as text.
- Setting `slashCommands` (default on; Settings → Editor toolbar).
- Smoke: `slash-menu-scenario.js` (real typing; README).

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
- `sourcePath` → part of the key, and a `<key>.source` sidecar beside the
  temp file (Appendix D). The plan's original text, superseded: `watch-worker.js`/`index.js` must let a
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

- `POST …/<sid>/__clew_block__` — body: JSON `{ token, text, sourcePath }`
  (sent with no Content-Type; `lib/caller-token.js#renderPost`); the same
  caller-token check (docs/dev/frame-bridge.md §1) and 100k limit; renders
  (or serves cached) and responds `{ hash }`.
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

As built (Phase 0), three differences, each measured or forced:

- **The block document is a FULL engine build**, not fragment HTML wrapped
  in a copied head: `renderService.renderBlock(text, {sourcePath})` runs the
  worker with `fragment: false`, so the head (MathJax config, mermaid,
  highlight, CSS, jQuery) comes from `clew-template.html` exactly as a
  note's does. protocol.js's shared part is `wrapPreviewDocument(html,
  {session, sid, block})` — the api/client/vault-script/plugin injection
  both kinds of document get — which also puts `data-clew-block="1"` on a
  block's `<html>`. The client's `render` morph already takes a full
  document, so the re-render path needs nothing new. Blocks share the
  fragment cache (bounded 500) under a distinct key.
- `isDependentFragment` lives in `src/shared/fragment-deps.js` (render-service
  cannot load outside Electron, and the test runs under node); it also
  counts ```leaflet. `renderFragment` itself now uses it by default, so a
  canvas card that embeds a note stops being served stale too. The key
  carries `#fragmentEpoch`, bumped by `onFileChanged` and `reconfigure`.
- A `sourcePath` escaping the vault is a 403; malformed JSON a 400.
- No `currentFile` option reaches the worker (Appendix D).

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
   data-kind>` with `height` from `frameHeightField` (by construct id and by
   kind+ordinal, for this editor's session — NOT persisted to the tab; a
   reopened note lays out at default heights first; as planned: persisted to the tab's `view.frameHeights` so a reopened
   note lays out without jumps) or a kind default (mermaid 240, embed 160,
   query 200, pdf 480, …); shows a skeleton (kind icon + "Rendering…")
   until the first `size`, and the last error message on `error`
   (rendered errors come from the engine as `.clew-embed-refused` /
   `.clew-figure-refused` inside the frame — those are content, not layer
   errors).
7. Destroy on: plugin destroy (mode off, tab close), record gone, eviction.
   (As built: no RENDER_SUBSCRIBE — see the note below.)

Scroll chaining: a wheel over a frame whose document is not scrollable
chains to the editor's scroller in Chromium (cross-origin included). The
block document sets `html, body { overflow: hidden }` so it is never
scrollable — its height IS its content height. Verify with real input in
the smoke scenario (§10).

Focus: a click inside a frame posts `focused` → `workspaceStore.activateTab`
(as previews do); chords forwarded via `app-chord` act on this tab.
Clicking the placeholder's margin (outside the frame) places the cursor
→ the block reveals → the frame hides.

As built (Phase 5), measured corrections: the frames are created only for
placeholders CodeMirror has DRAWN (viewport plus its margin), and that
margin can hold more small frames than the cap (17 mermaid blocks at 80px
did) — so eviction ranks undrawn, then drawn-but-off-screen, and never
creates past the cap (the placeholder keeps its skeleton). Pinned kinds are
kept within three screens by distance from CodeMirror's height map
(`lineBlockAt`), which knows where undrawn blocks are. A frame element's
`color-scheme` must equal its document's (preview.css declares one per
theme) or Chromium paints an opaque backdrop. A frame's height is also
remembered by kind + ordinal, so editing a block (which changes its id)
does not snap it back to the default height. Frames restale on
`EV_FILE_CHANGED` for another path when they are dependent; the note's own
saves are skipped (no RENDER_SUBSCRIBE: rendering the whole note in the
background to learn about restales would cost more than it saves).

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
  resize asynchronously) posting `{type:'size', height}` when it changes by
  ≥1px; the final `size` after fonts load (`document.fonts.ready`).
  **The height is the BODY's box**, not `documentElement.scrollHeight` as
  first planned: scrollHeight never drops below the frame's viewport, so a
  block could only grow (measured in Phase 0: an 84px mermaid block in a
  240px frame reported 236).
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

As built (review after Phase 5): the fragment-edit row's trigger
(`EV_RENDER_DONE`) never fires for a live-edit note, because the layer does
not RENDER_SUBSCRIBE. The replacement: the frame layer re-renders EVERY
frame when a setting that reconfigures the engine changes — the vault's
`texFragments`, `normalSyntax`, `jmarkdownProject`, `pandocCitations`,
`plugins`, `bibliography*` (vault-settings-store) and the global
`texFragments` (settings-store, later, since that store emits before main
has written). And render-service now keys EVERY fragment by a configuration
generation bumped in `reconfigure()`: without it the same text kept the same
hash after a reconfigure, and the layer's "hash unchanged → skip" never
morphed. `live-blocks-scenario` flips normalSyntax last and asserts the
Child embed's `*styled*` became `<em>` (`strong` with the listener removed).

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
| `slashCommands` | bool | true | Toolbar — "// menu: type // for the Format menu" (§6.9) |
| `linkPreview` | `hover` \| `mod` \| `off` | `hover` | Appearance — "Link previews on hover" (§5.11) |
| `previewPane` | `on` \| `off` | `on` | Appearance — "Live preview of maths and diagrams while editing" (§5.12) |
| `sidenotes` | `auto` \| `on` \| `off` | `auto` | Appearance — "Footnotes in the margin" (§5.16) |
| `graphReferences` | bool | false | the graph's own switch (§5.14) |

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
- **As built — measured, not windowed** (`live-perf-scenario.js`): a
  keystroke in live edit costs ~0.4 ms more than in source on a 12 KB note
  and ~2.2 ms more on a 207 KB one (medians 3.5 vs 3.1, 14.4 vs 12.2 ms), so
  the block field stays whole-document; the viewport window above was not
  needed.
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
| `toolbar-layout.test.js` | `layoutGroups`: fits/overflows by priority, `Infinity` never drops, `when`-false excluded, overflow button width accounted only when needed. `layoutRows`: natural-order wrapping, no backfill, mode ends row 1, nothing hidden until two rows are full, the priority rule past them, one row under `maxRows: 1`, hysteresis, a context group never changing the row count. |
| `format-toggle.test.js` | `toggleWrap` unwraps from an empty cursor inside a construct; wraps otherwise; multi-range. |
| `workspace-tree.test.js` (+) | `mode: 'live'`; `editMode` set by `setTabMode`; clone carries it; serialize/hydrate round trip; legacy JSON without `editMode`. |
| `fragment-dependent.test.js` | `isDependentFragment` for each trigger and for plain prose. |
| `frontmatter-edit.test.js` | `applyProperties` produces the same text the panel would; `clean:false` refused. |

### 10.2 Smoke scenarios

`smoke/README.md` carries every scenario's assertions and fixture recipe:
`block-endpoint`, `normal-syntax`, `live-mode-persistence` (two runs),
`live-edit`, `live-lines`, `live-tables`, `live-blocks` (+ frame script,
with `CLEW_SMOKE_FRAME_MATCH=__clew_block__` and the memory numbers),
`live-toolbar` (with `CLEW_SMOKE_MENU=1`) and `live-perf`. The existing
`fence-highlight`, `footnote-highlight`, `math-highlight`,
`editor-hotkeys`, `reading-scroll`, `embed-refresh` and `embed-collapse`
scenarios guard source and reading mode. The harness grew for this:
`CLEW_SMOKE_FRAME_MATCH`, clicks carrying `modifiers`, and `wheel`.

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

## 11. Documentation

- Manual: `../Clew-docs/site/manual/live-edit.html` (a chapter under
  Writing), plus the editor, reading-mode, settings-and-hotkeys and plugins
  chapters. A behaviour change here is not finished until they match.
- Demo vault: `Guide/Live Edit.md` (one of everything), linked from
  `Welcome.md`; `Guide/Editing.md`, `Guide/Reading Mode.md`,
  `Guide/Settings and Hotkeys.md`.
- CLAUDE.md: the "Live edit" subsection.

## 12. Decisions in force

Chosen when the design was written; each has an alternative the owner may
still prefer, and changing one is a small, local edit.

| decision | as built | alternative |
| --- | --- | --- |
| Clicking a concealed link | follows it; ⌥-click edits; ⌘-click opens a new tab | plain click edits, ⌘-click follows |
| Remote `http(s)` images | not loaded in the editor (CSP unchanged); a chip says "shown in reading mode" | widen `img-src` — notes then contact remote hosts when opened for editing |
| Toggle live/source chord | ⌘⇧E | palette/menu only |
| New tabs | open in source (`newTabMode`) | live, as Obsidian does |
| `\|live` office embeds | a thumbnail in live edit | a pinned LibreOffice frame |
| MathJax macros | one page-wide MathJax: macros leak across notes (documented) | a per-note InputJax |
| Tables | edited in place on a click; Esc, ⌥-click or "Edit as source" for the source; reflow once on leaving | reveal source on click; never reflow automatically |
| Reading mode's bar | none — the mode switch is in the tab strip | none |
| Annotation entries | one blockquote per annotation (text, comment, page link, block id) | the comment as a paragraph after the quote |
| Annotation colours | plain blockquotes | callouts by colour |
| The Refs panel | always present; Library always, "This note" behind bibliographyPanel | gated as before |
| Library search | every term a substring | fuzzy |
| Citation hover without a named bibliography | the .bib's author-year and title on a card | nothing |
| What the insert commands write | `@label` / `@ref` / `@cref` | a per-vault sigil setting |
| Cross-reference completion scope | this note | the whole vault, detailed by note |
| Unknown or numberless reference | `??` in the danger colour, reason in the tooltip | hide the chip, show the source |
| Custom numbered environments | the manifest's `numbered` key; undeclared → `?` | count any `{#key}` environment per name |
| Preview pane: block placement | below the block, the text column's width | to the right of the text on a wide pane |
| Preview pane: inline maths | above the line at the formula | a tooltip under the caret |
| Preview pane: cadence | 150 ms maths, 400 ms mermaid, 700 ms TeX kinds | one setting for all |
| Preview pane: queries, Dataview, Bases | not previewed (a vault scan per pause) | previewed on a 1.5 s pause |
| Preview pane: Escape | hides until the cursor leaves that formula or block | hides for the session |
| Preview pane: source mode | on | live edit only |
| Link hover previews | plain hover after 500 ms; 440 × ≤360 px; in reading mode too | ⌘-hover only (Obsidian's default — the `mod` setting) |
| Slash-command trigger | `//` at a line start or after whitespace (a single `/` is the dialect's italic) | `/` at a line start only, accepting a menu over every line that opens with an italic |

Follow-ons deliberately left out: table drag handles, multi-cell selection and pasting a grid into cells;
Meta Bind widgets in prose; plugin-declared
rich fence names; persisting frame heights across reopenings; drag handles
for blocks; a focus mode.

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
Host-side switch shared via `frame-host.js`. Reading mode → host:
`link-hover {target, rect, mod}` and `link-unhover {scrolled?}` (§5.11).

## Appendix D — the engine change that was not needed

No upstream change. Every reader of
`global.current_file` is Clew's own code (`engine/vault-model.js#currentPage`
— Dataview, dataviewjs, Bases, Meta Bind — and `engine/kanban-board.js`),
and `![[#Heading]]` self-embeds are not supported by the engine in reading
mode either. So render-service leaves a `<key>.source` sidecar beside a
fragment's temp file naming its note, and `vault-model.js#currentFilePath`
answers with that note (`tests/fragment-source.test.js`). The master also
carried the owner's uncommitted edits in the very file the change would have
touched — another reason not to.
