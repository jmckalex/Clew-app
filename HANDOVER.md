# Handover — 2026-08-26 evening (map views, FLATTEN, Kanban + Tasks dialects)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. Where things stand

- Everything on **`main`**, working tree clean, `npm test` → **362
  green**. Demo and study vaults clean. `../Clew-docs` clean; site AND all
  four 0.9.0 binaries are deployed to the droplet (byte-verified) — only
  the DNS change stands between the droplet and a public clew-app.com.
- **0.9.0 is released** (earlier today): tagged, universal dmg signed +
  notarized + stapled, win/linux cross-built, check-links clean. Charts
  plugin, Excalidraw embedded images, CJK fonts verified, showpiece
  TikZ/MetaPost figures (now rendered as theme-aware ink via CSS
  invert — no more white plates).
- This evening, in order:
  - **Bases map views** (measured: 3 in kepano) — rows with a
    `coordinates` property become markers on the same `clew-leaflet`
    machinery the fences use; `defaultZoom`, named `markerColor` pins;
    `markerIcon` names Lucide icons Clew does not ship (pins stay pins).
    Verified against kepano's real Map.base, live in-app.
  - **CARTO watermarks every keyless tile request now** ("API KEY
    REQUIRED" tiles) — found while eyeballing the map smoke. Default tile
    style is now `osm`; voyager/light/dark remain by name.
  - **FLATTEN + real GROUP BY + lambdas** — a FIFTH measured vault
    (Obsidian-Vault-Project-Management, in `../test-vaults/`) used
    FLATTEN in real queries, always with lambdas and filter(). DQL data
    commands now run as a pipeline in written order over `{page, extra}`
    rows; GROUP BY exposes `key`/`rows`; `FLATTEN rows AS R` ungroups;
    dv-expr has `(x) => …` lambdas; filter/map/any/all/none.
    **DQL `list()` now CONSTRUCTS (wraps) while Bases' `list()`
    normalizes — the dialects truly differ; DQL contexts override the
    shared table.** Coverage: fifth vault 67→83%, teaching vault 43→66%,
    the three other real vaults still 100%.
  - **Obsidian Kanban boards + the Tasks plugin's dialect** — both were
    in the corpus after all (bramses: 4 boards + a tasks dashboard; the
    fifth vault: a Taskviewer). `kanban-plugin:` frontmatter renders the
    note as a read-only board with LIVE checkboxes (true source lines →
    the existing data-source-line toggle); the ```tasks fence serves both
    dialects — all-Clew lines render as before, plugin instructions run
    the plugin dialect, and unknown lines now refuse BY NAME (fixing
    Clew's own fence silently ignoring junk). `… by function` refused as
    JavaScript. Verified against bramses' real files in-app.

## 1. Open items, in the order I would take them

- **Card drag between lanes on plugin boards** (write-path: move a list
  item under another heading) — the read side ships; the edit is v2.
- **Tasks dialect extras if demand appears**: boolean line combinations,
  `done before/after` roll-ups, `group by` more keys, Dataview-style
  `[due:: …]` bracket fields.
- **Win/Linux 0.9.0 artefacts have never been run on real machines.**
- The DNS change (owner's registrar) → then `make dns-check` + `make tls`
  in Clew-docs.
- Charts extras (time axes, sankey) — still zero corpus demand.

**Settled, do not reopen:** `%%comments%%`; `\[\[` escapes; licensing
(Excalidraw plugin + obsidian-charts AGPL — formats only;
obsidian-kanban is GPL-3.0-compatible but equally unread;
obsidian-tasks MIT).

## 2. Things that cost time to find (new this evening)

- **The two dialects of `list()`**: Dataview's constructs
  (`FLATTEN list(expr) AS x` is the LET idiom BECAUSE it wraps), Bases'
  normalizes (`list(loc).contains(this)` depends on idempotence). One
  function table with a DQL-side override; do not "unify" them.
- **DQL clauses are a pipeline in WRITTEN order** — `WHERE` after
  `FLATTEN` sees the bindings. parseQuery keeps `steps`; the flat fields
  remain for renderers/refusals.
- **`start()`-claims-everything is how a whole-document extension works**
  (kanban-board.js): gate on `global.current_file`'s frontmatter, return
  index 0, consume all of src in one token. Registered AFTER callouts so
  marked offers it first.
- **The corpus had Kanban/Tasks usage all along** — earlier surveys
  grepped for the wrong things. When measuring, grep for the FORMAT
  (frontmatter keys, fence bodies), not the plugin name.
- Earlier today's traps (export-site's own worker env, the lazy rgba
  regex, innerText vs textContent, mpost SVG fonts, Embedded Files
  strip-on-save, `--universal`) are in this file's git history and still
  hold.

## 3. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- Always pass `CLEW_SMOKE_VAULT`; `git status` the demo and study vaults
  after every smoke run.
- **The owner's bug reports have been consistently right.**
- **Write assertions that can fail** — and eyeball the artefact anyway
  (that is how the CARTO watermark was caught).
- **Verify artefacts by content**, never the log line that says it worked.
- **Prefer measuring to guessing** — and re-measure: two "never seen in a
  sample" items turned out to be sitting in the corpus.
- `npm run dev` / `npm run package` re-sync the engine from the golden
  master; run `sync-engine` and check `git status` BEFORE tagging.
