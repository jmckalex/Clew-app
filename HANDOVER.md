# Handover — 2026-08-25 (PDF viewer, Excalidraw, engine syncs, table editing)

Session-rollover state. Durable architecture, conventions, and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session; keep it short and current.

## 0. Where things stand

- Branch **`feat/excalidraw`** (9 commits), based on `main`. Working tree
  clean, `npm test` → **217 green**. Demo/study vaults clean.
- **`main` is where everything else landed** — the whole three-session
  backlog was committed at the start of this session (11 commits), then
  the PDF work, two engine syncs and a canvas fix on top.
- `../Clew-docs` is clean, 5 commits this session. Read **its** HANDOVER
  for the website; the DNS blocker there is unchanged.
- **The branch is not merged.** That is the first decision waiting.

## 1. Decisions

1. **Merge `feat/excalidraw`?** It is complete and documented (§3). Nothing
   depends on it staying separate.
2. ~~The Excalidraw plugin's licence~~ — **settled.** Its LICENSE file is
   AGPL-3.0 (its package.json says MIT; the file governs). Its two regexes
   are gone from `src/shared/excalidraw-file.js`, replaced by a builder
   written from the on-disk format, with behaviour verified unchanged. The
   rule is recorded in CLAUDE.md: the PLUGIN is AGPL and its source must
   never enter this tree; `@excalidraw/excalidraw` itself is MIT and is
   embedded normally.

Also still open from before: the **v0.8.0 tag collision** (the tag is on an
older commit; retag or go 0.9.0), and `out/` holds stale artefacts.

## 2. PDFs are EmbedPDF now (merged to main)

All three surfaces — note embeds, the file tab, canvas nodes — run
EmbedPDF (MIT, Pdfium-wasm, 9.5 MB staged), replacing Chromium's plugin.
One implementation, `preview-client/pdf-core.js`. **Annotations autosave
into the vault's own PDF** (2.5s debounce → `renderer/pdf-save.js` →
`CH.PDF_WRITE` → `vault.writePdf`, which refuses anything that is not an
existing `.pdf` inside the vault). CJK fallback fonts are an app setting
(`pdfCjkFonts`), downloaded on demand into userData.

Owner-verified: print, find, text selection and trackpad feel all hold up.
Owner-reported and fixed: the first-render flash (Chromium's plugin
painting for a frame before removal — now hidden by CSS), Fullscreen doing
nothing (no iframe had `allow="fullscreen"`), and a ⟷ expand-to-width
control for the narrow note column.

**The 139 MB CJK download has never been run end to end.** URL construction
and per-file logic are verified separately; nobody has watched 26 files
land.

## 3. Excalidraw (branch `feat/excalidraw`)

Obsidian vaults are full of `.excalidraw.md`. Clew now opens, edits and
creates them, using the real Excalidraw **shimmed, not ported** — porting
meant 86k lines of React against Clew's ~4k-line canvas, re-authored
forever. Upgrading is `npm install @excalidraw/excalidraw@latest` + build.

- **React is quarantined** in one bundle (`dist/excalidraw/page.js`, 8 MB
  minified, the only minified bundle) loaded in an iframe only when a
  drawing is opened. Never in the app's renderer.
- **The file layer is the contract** (`src/shared/excalidraw-file.js`, 13
  tests): LZString base64 in 256-char lines, reproduced byte-identically —
  verified against the plugin's own `compress()`. Saving splices into the
  original text, so frontmatter, prose, `## Text Elements` and the
  compression all survive; an unedited scene re-serialises byte-for-byte.
- **Both extensions work**, `excalidrawFormat` chooses which Clew creates.
  Drawings are indexed either way — `drawingText()` reads the words out of
  the scene, so a `[[wikilink]]` inside a drawing is a real link.
- Embeds are read-only; canvas nodes are editable; libraries persist per
  vault in `.clew/excalidraw-library.json`.

Round-trip validated against the plugin's OWN parser (9/9) — the closest
thing to "does Obsidian read this?" without Obsidian. **Untested:**
drawings holding embedded images (`files{}`).

## 4. Everything else this session

- **Engine synced twice** from the golden master's dirty tree: `@image`/
  `@video` with translated attributes, then pandoc citations (`[@key]`) and
  `\citefile`. Pandoc citations are wired as a vault setting
  (`pandocCitations`, off by default — `@` is the directive sigil, so a
  bare `@word` becomes a citation key).
- **Canvas style bar fixed**: line/path style, fill and opacity did nothing
  and dropped the selection, because `.canvas-stylebar` was missing from
  `#onPointerDown`'s chrome guard. All three guards now use a shared
  `canvas-chrome` class.
- **Table editing** (`editor/tables.js`): Tab/Enter walk cells and rows,
  adding rows at the end, reflowing as you go. Not a shim — Advanced
  Tables emits plain GFM.
- **`npm run vault-report -- <vault>`** (scripts/vault-report.js): walks an
  Obsidian vault read-only and names what Clew would not understand.
  Calibrated both ways — Clew's own vaults report "opens cleanly".
- Splits, panes, NUL byte, Note Headers 1.2.0 (animated HTML banners via
  `data-clew-keep`) — all on main, all documented in the manual.

## 5. Gaps, now MEASURED against real vaults

`npm run vault-report` was run against two public Obsidian vaults. The
ranking below is data, not impressions.

**obsidianmd/obsidian-help** (Obsidian's own help vault, 175 notes):

| finding | count |
|---|---|
| callouts beyond GFM's five, 16 distinct types | **102** |
| block references `[[note#^id]]` | 13 |
| `permalink` / `publish` frontmatter (Publish; harmless) | 229 |
| exotic code fences (twig, liquid, mathjax, htaccess) | 25 |

**s-blu/obsidian_dataview_example_vault** (264 notes):

| finding | count |
|---|---|
| ```` ```dataview ```` | **253** |
| ```` ```dataviewjs ```` | 130 |
| callouts beyond GFM's five (`[!help]` alone 79) | 79+ |

What that says:

1. **Callouts are the biggest gap by an order of magnitude**, and they are
   CORE Obsidian, not a plugin — 102 in Obsidian's own documentation, 79+
   in a vault about something else entirely. `[!info]`, `[!todo]`,
   `[!example]`, `[!abstract]`, `[!danger]`, `[!hint]`, `[!question]`,
   `[!success]`, `[!failure]`, `[!bug]`, `[!quote]`, `[!summary]`… all
   fall back to plain blockquotes. The engine already renders GFM's five,
   so this is mapping the rest onto that machinery, plus foldable
   `[!note]-` and custom titles. **Do this first.**
2. **Block references** `[[note#^id]]` — also core, 13 in the help vault.
3. **Dataview** is confirmed as the plugin that matters, though 253/130 in
   a vault *about* Dataview is a biased sample. Translate the safe DQL
   subset; refuse `dataviewjs` honestly rather than half-supporting it.
4. Kanban and Tasks did not appear in either sample — worth a third vault
   before ranking them.

Both vaults are cloned under the session scratchpad; re-clone with
`git clone --depth 1 https://github.com/obsidianmd/obsidian-help.git` and
`…/s-blu/obsidian_dataview_example_vault.git`.

## 6. Standing session rules (unchanged, still earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- Always pass `CLEW_SMOKE_VAULT`; `git status` demo/study vaults after
  every smoke.
- The owner's bug reports have been consistently RIGHT.
- **Write assertions that can fail.** A table-editing smoke came back
  4/4 green with two assertions that were vacuous (`doc.lines >= 9`, and a
  literal `true`). Rewritten to count rows and cursor cells, it proved the
  real thing.
- Verify artefacts by content: the .canvas file, the .excalidraw.md bytes,
  the saved PDF — not the log.
- `npm run dev` and `npm run package` **re-sync the engine** from the
  master's working tree. That is how newer engine work arrives unbidden;
  it is not your edit.
