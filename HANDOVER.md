# Handover — 2026-08-26 (the Charts plugin, and what it proved)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. Where things stand

- Everything is on **`main`**, working tree clean, `npm test` → **339
  green**. Demo and study vaults clean. `../Clew-docs` manual updated to
  match (plugins, queries, diagrams chapters) and committed.
- This session: **Charts** — Obsidian's ```` ```chart ```` YAML fence and
  the dataviewjs `renderChart(config, el)` bridge, built as the demo
  vault's third plugin (`demo-vault/.clew/plugins/charts/`). It is the
  first plugin to use the **engine surface**, and the worked example of an
  engine + preview pair: the engine surface parses/refuses and emits a
  `data-chart` placeholder; the preview surface draws it with a vendored
  Chart.js 4.5.1 (MIT; `dependencies` + `scripts/vendor-chartjs.js`, copy
  committed like the icon). Upstream obsidian-charts is **AGPL with a
  stale MIT package.json — the same trap as Excalidraw**; the format was
  reimplemented from charts.phib.ro, no upstream source read.
- Fallout fixes that outlive charts: **site export now ships enabled
  plugins' preview surfaces** (`assets/plugins/<id>/`, whole folder) and
  **passes CLEW_DATAVIEW_JS to its workers** — dataviewjs output used to
  silently bake as "not run" even in vaults that enable it.
- The dataviewjs sandbox grew Obsidian-shaped bindings: `window` (a
  naming proxy), `this.container` / `dv.container` (passable token that
  fails by name on use), bare `renderChart`.

## 1. Charts facts a future session will want

- Fence → `buildChart()` maps the documented modifiers onto a finished
  Chart.js config; **unknown/unsupported keys refuse the whole chart by
  name** (`time:` and `id:` are the deliberate refusals — a date adapter
  is not shipped; sankey is refused as an unknown type).
- The preview glue keeps charts alive across morphs: canvas carries
  `data-clew-keep`, unchanged `data-chart` is left alone (no re-animate),
  theme recolor via `Chart.defaults` + `update('none')` on a `data-theme`
  MutationObserver.
- `global.clewCharts.emit(config)` is the bridge hook; `dataview-js.js`
  only looks it up, so no plugin → named failure, and the coupling stays
  one-way. Configs cross worker→preview as JSON; functions are refused
  naming their path.
- `demo-vault/Guide/Charts.md` is documentation AND test corpus: 5 live
  fences + 1 deliberate `time:` refusal + 1 renderChart chart. The smoke
  frame script asserted exactly that (6 live Chart instances, 1 refusal).

## 2. The compatibility measurement (kept for the open items)

`npm run vault-report -- <vault>` and `npm run dataview-report -- <vault>`
(imports src/engine, so it measures shipping code). Corpus vaults live in
`../test-vaults/` — obsidian-help, s-blu, kepano, bramses re-cloned this
session. Findings that still steer priorities: dataviewjs is
documentation, not usage (130 occurrences in the teaching vault, 0 in
three real ones — and s-blu's two renderChart blocks are fenced
`//dataviewjs`, display-only); kepano abandoned Dataview for Bases; the
DQL subset covers 25/25 queries in the real vaults. Charts itself scored
**zero** in the corpus — it was built as a flagship for the plugin
system, not from compat pressure.

## 3. Open items, in the order I would take them

- **FLATTEN** — 92 occurrences, all in the teaching vault. Check a fifth
  vault before building it.
- **Bases map views** are refused; Clew has Leaflet, so possible.
- **Charts extras if demand ever appears**: a date adapter for `time:`,
  sankey, Charts View (the other plugin). None seen in the wild yet.
- **The 139 MB CJK font download has never been run end to end.**
- **Excalidraw drawings with embedded images (`files{}`)** are untested.
- **The v0.8.0 tag is on the wrong commit** — retag or go to 0.9.0;
  `out/` holds stale artefacts, and check-links flags the four missing
  download files on the site.
- `../Clew-docs` has its own HANDOVER; the DNS blocker there is unchanged.

**Settled, do not reopen:** `%%comments%%`; Obsidian's `\[\[` escape;
licensing (GPL-3.0-or-later; `npm run notices` regenerated this session
for chart.js + @kurkle/color; Excalidraw plugin AND obsidian-charts are
AGPL — formats only, never their source).

## 4. Things that cost time to find

- **`export-site.js` builds its own worker env.** A per-vault flag wired
  through render-service does NOT reach exports automatically —
  CLEW_DATAVIEW_JS was missing there since Dataview landed. Next flag:
  add it in both places, and verify the export by content.
- **A lazy regex turned gray to yellow.** `rgb(a, b, c)` fed to
  `/\(([^)]+?)(?:,\s*[\d.]+)?\)/` captures two channels and eats the
  third as "alpha" → `rgba(218, 218, 0.15)` = yellow grid lines. The
  smoke assertions were all green while the screenshot was visibly
  wrong: **assert content AND look at the picture.**
- **Smoke recipe that works** (scenario → frame): `openNote(path,
  { newTab: true, defaultMode: 'reading' })` + `setTabMode(tab.id,
  'reading')`, then let the frame script poll the preview document and
  THROW on failure — "smoke failed:" in stdout is the signal. Site
  export can be driven headlessly via
  `ipc.invoke('clew:export-site', { outDir })` in a scenario.
- Older traps (local-midnight dates, `^` superscript vs block ids,
  fence-aware walks, linkKey canonicalisation, marked UNSHIFT order,
  four-backtick wrappers) are in CLAUDE.md and last session's git
  history; they all still hold.

## 5. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- Always pass `CLEW_SMOKE_VAULT`; `git status` the demo and study vaults
  after every smoke run.
- **The owner's bug reports have been consistently right.**
- **Write assertions that can fail** — and eyeball the artefact anyway
  (see the yellow grid above).
- **Verify artefacts by content**, never the log line that says it worked.
- **Prefer measuring to guessing.**
- `npm run dev` and `npm run package` **re-sync the engine** from the
  golden master's working tree; that is not your edit.
