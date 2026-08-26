# Handover — 2026-08-26 (0.9.0 shipped; Charts; drawings with images; showpiece figures)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. Where things stand

- Everything is on **`main`**, working tree clean, `npm test` → **342
  green**. Demo and study vaults clean. `../Clew-docs` clean and deployed.
- **0.9.0 IS RELEASED.** Tagged `v0.9.0` (the mis-tagged v0.8.0 stays as
  history), all four artefacts built and **uploaded to the droplet** with
  byte-verified sizes: the universal dmg is signed, notarized, stapled and
  Gatekeeper-accepted (`spctl: accepted, source=Notarized Developer ID`);
  Windows NSIS, AppImage and deb cross-built as before (untested at
  runtime). `make check-links` → **all local links resolve** (was 4 dead
  download links). The public site still waits on the Clew-docs DNS
  blocker; the droplet itself is fully populated. Old artefacts moved to
  `out/old/`, not deleted.
- This session, in order: the **Charts plugin** (```chart fences +
  dataviewjs `renderChart` bridge — the first engine-surface plugin);
  **Excalidraw embedded images** (the `## Embedded Files` section is now
  resolved and rehydrated, injected entries stripped on save; vanilla
  `files{}` unit-tested and smoke-proven); the **CJK font download run end
  to end** (26/26 files, byte-exact against the manifest); site export
  fixes (plugin preview surfaces ship; CLEW_DATAVIEW_JS reaches export
  workers); and **showpiece demo figures** (below).

## 1. The demo Diagrams note, and how figures render now

- TikZ shows the owner's genuinely-3D shells figure from "The
  incompleteness of classical mechanics" (BJPS) — supplied by the owner
  directly; the paper file is `~/Documents/Articles/Published/The
  incompleteness of classical mechanics/`. MetaPost shows **figure 14 of
  `~/Documents/Archived/lfp/ep/figures/ep-figures.mp`** (owner's 1998
  GPL'd library): an abacus-machine flowchart on the `boxes` package,
  extracted with the three connector macros it needs. Fence attributes
  like `@begin(metapost){width='45%'}` work (scale/width/embed).
- **TikZ/MetaPost figures no longer get white plates in dark mode.**
  `src/engine/preview.css` inverts them (`invert(1) hue-rotate(180deg)`):
  white-on-transparent in dark, black-on-transparent in light. Grayscale
  hierarchy survives inversion (faint stays faint); site export shares the
  stylesheet.
- The cached SVGs under `Features/TiKZ/` and `Features/MetaPost/` are
  COMMITTED so the vault renders without TeX; regenerate by deleting them
  and opening the note with a toolchain present.

## 2. Charts facts a future session will want

- `demo-vault/.clew/plugins/charts/`: engine surface parses the YAML and
  refuses by name (`time:`, `id:`, unknown keys/types); preview surface
  draws `data-chart` placeholders with vendored Chart.js 4.5.1
  (`dependencies` + `scripts/vendor-chartjs.js`, copy committed).
  Canvas carries `data-clew-keep`; unchanged configs don't re-animate.
- `global.clewCharts.emit(config)` is the dataviewjs bridge hook;
  `dataview-js.js` looks it up, so no plugin → named failure. The sandbox
  now binds `window` (naming proxy), `this.container`/`dv.container`
  (passable token, fails by name on use), and bare `renderChart`.
- Upstream obsidian-charts is **AGPL with a stale MIT package.json — the
  Excalidraw trap**; format reimplemented from charts.phib.ro, no source
  read.

## 3. Open items, in the order I would take them

- **Bases map views: now MEASURED** — kepano's vault has 3 `type: map`
  views (68 table, 4 cards). Clew has Leaflet; small real demand.
- **FLATTEN** — still gated on a fifth vault; all 92 occurrences are in
  the teaching vault.
- **Charts extras if demand appears**: `time:` axes (needs a date
  adapter), sankey, Charts View.
- **Win/Linux artefacts have still never been run on real machines.**
- `../Clew-docs`: the DNS change is the one blocker between the deployed
  droplet and a public site.

**Settled, do not reopen:** `%%comments%%`; `\[\[` escapes; licensing
(notices regenerated for chart.js + @kurkle/color; Excalidraw plugin and
obsidian-charts are AGPL — formats only).

## 4. Things that cost time to find

- **`export-site.js` builds its own worker env** — a per-vault flag wired
  through render-service does NOT reach exports automatically
  (CLEW_DATAVIEW_JS was missing since Dataview landed). Add new flags in
  both places; verify exports by content.
- **A lazy regex turned gray to yellow**: `rgb(a, b, c)` fed to
  `/\(([^)]+?)(?:,\s*[\d.]+)?\)/` eats the third channel as "alpha".
  Green assertions, visibly wrong screenshot — **assert content AND look
  at the picture.**
- **`document.body.textContent` includes `<style>` sheets** — mermaid's
  CSS defines `.error-icon`, so a text-based "no error box" assertion
  false-positives. Use `innerText`.
- **mpost SVG output emits `<text>` with NO font-family** — browsers
  substitute, so TeX-kerned fragments show slight spacing quirks
  ("empt y"). Cosmetic; the alternative (paths) needs a pipeline change.
- **Obsidian's Excalidraw plugin keeps images OUT of the scene** — vault
  attachments named in `## Embedded Files`, mapped by fileId. Rehydrate on
  load, and STRIP injected entries on save or every save copies the image
  into the markdown. `embeddedFileLinks()` in shared/excalidraw-file.js.
- **`npm run package:dist` builds arm64 by default** — the release dmg
  needs `-- --universal` (the site links `Clew-<v>-universal.dmg`).
- Smoke recipe: `openNote(path, {newTab: true, defaultMode: 'reading'})` +
  `setTabMode(id, 'reading')`; frame script polls and THROWS on failure;
  drive site export via `ipc.invoke('clew:export-site', {outDir})`;
  `qlmanage -t -s 1200 -o . file.svg` thumbnails SVGs/PDFs for eyeballing
  outside the app.

## 5. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- Always pass `CLEW_SMOKE_VAULT`; `git status` the demo and study vaults
  after every smoke run.
- **The owner's bug reports have been consistently right.**
- **Write assertions that can fail** — and eyeball the artefact anyway.
- **Verify artefacts by content**, never the log line that says it worked
  (this session: dmg via `stapler validate` + `spctl` + `lipo -archs`,
  fonts byte-for-byte against the manifest, remote binaries by size).
- **Prefer measuring to guessing.**
- `npm run dev` and `npm run package` **re-sync the engine** from the
  golden master; run `sync-engine` and check `git status` BEFORE tagging.
