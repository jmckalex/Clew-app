# Clew

An open-source, Obsidian-style note-taking app built on the
[jmarkdown](https://github.com/jmckalex/jmarkdown) engine — a thread through
your notes.

Clew opens **vaults** (any folder of `.md`/`.jmd` files, including existing
Obsidian vaults, which are never modified: Clew keeps its own state in
`.clew/` and ignores `.obsidian/`). Notes are edited in source mode with
jmarkdown-aware highlighting and rendered by the full jmarkdown engine in
reading mode — math, TikZ, citations, footnotes, theorem environments and all,
with LaTeX/PDF export from the same source.

## Status

Early but broadly functional. Working today:

- **Vaults**: picker + recent vaults; file explorer (create/rename/trash/
  reveal, inline rename); external edits picked up live (chokidar)
- **Editor**: CodeMirror 6 with full jmarkdown-dialect highlighting
  (`/italics/`, `*strong*`, `**intense**`, `==highlight==`, directives,
  `@begin` environments, math, citations, footnotes), `[[` and `#`
  autocompletion, Cmd+click link following, auto-save
- **Reading mode** (Cmd+E): the full jmarkdown engine renders the note —
  MathJax, TikZ, footnotes, theorem environments — in a sandboxed preview
  that live-updates in place (morphdom) as you type, with wikilink
  navigation and Cmd+click inverse search back to the editor line
- **Wikilinks**: `[[Note]]`, `[[Note|alias]]`, `[[Note#Heading]]`,
  `![[Note]]` transclusion embeds; unresolved links styled + click-to-create;
  renames rewrite links across the vault
- **Workspace**: tabs, split panes (drag tabs to rearrange/split), per-tab
  history, layout persisted per vault
- **Navigation**: quick switcher (Cmd+O), command palette (Cmd+P), backlinks
  with context, outgoing links, tag pane, outline, global + local graph views
  (d3-force), full-text search with `path:`/`file:`/`tag:`/`"phrase"` operators
- **Linked editing**: source and reading panes of the same note scroll in
  sync (both directions), reading mode opens at the editor's cursor, and
  task checkboxes clicked in reading mode write back to the source
- **Settings** (Cmd+,): appearance (theme, editor font/line width), daily
  notes, templates, and a full hotkey editor (record, reset, conflicts)
- **More**: daily notes, templates ({{date}}, {{time}}, {{title}}),
  bookmarks, drag-to-move in the explorer, light/dark themes + user CSS
  snippets, word count, **export to HTML / LaTeX / PDF** via the engine

Not yet: live-preview (WYSIWYG) editing, plugins, canvas, sync — see the
project plan for what's deliberately deferred.

## Development

```sh
npm install
npm run dev     # esbuild watch + Electron with live reload
npm test        # node --test unit tests
npm run build   # one-shot build into dist/
```

Plain JavaScript ES modules and web components throughout — no framework, no
TypeScript. esbuild bundles the renderer (CodeMirror) and main process.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
