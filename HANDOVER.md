# Handover — 2026-08-24 (docs split out to ../Clew-docs; manual, bibliography, split/alignment fixes)

Session-rollover state. Durable architecture, conventions, and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session; keep it short and current.

## 0. Where things stand

- Branch `main`. **Everything is now committed**: the three sessions'
  backlog (150 modified, 3 untracked, 11 staged deletions) went in as ten
  commits on top of `5fbb59b`, grouped by the change they made —
  licence headers, icon redraw, signing/notarization, canvas groups, the
  `docs/` move, bibliography, the three bug fixes, the version bump.
  Working tree clean. `npm test` → **190 green**.
  Demo/study vaults carry only intended edits (§3, §5).
- **`../Clew-docs` is the exception**: that repo was created this session
  and is fully committed (4 commits, clean tree). Nothing is pending
  there. It has its **own `HANDOVER.md`** — read that, not this file,
  when working on the website or the manual.
- **The 0.8.0 release set in `out/` is now stale**: it was built before
  this session's manual, bibliography feature, and bug fixes. Shipping any
  of that means rebuilding — which folds into the still-undecided
  **`v0.8.0` tag collision** (tag exists on an older commit; retag or go
  0.9.0). The new features make 0.9.0 the natural answer, but nobody has
  chosen. Signing/notarization is settled and working — see the 2026-08-23
  handover in git history (`git show 5fbb59b:HANDOVER.md`) for the full
  release/notarization/canvas/icon/licence record; all of it still holds.

`docs/` is gone from this repo — see §1.

**Still true when committing: stage explicit paths, never `git add -A`**
(§5). Two files needed splitting to keep the history honest, and the same
trick will be wanted again: `scripts/make-icon.js` carried both the icon
redraw and the cross-repo site write, and `package.json` carried both the
mac build config and the version bump. Both were split by filtering hunks
out of `git diff` and `git apply --cached`-ing the rest; the licence
headers were separated from 18 files' real changes by constructing
"HEAD content + header" blobs straight into the index.

## 1. The docs moved out — ../Clew-docs (new repo, this session)

The website and the 28-page manual are no longer in this repo. They are a
third sibling under `~/Source/Clew/`, beside `Clew-app` and `Clew-iOS`,
with their own git history (4 commits, clean) and their own deployment.
**That repo has its own `HANDOVER.md`, `README.md` and `CLAUDE.md`** —
its session state, the deploy procedure, and the manual's house style all
live there and are not repeated here.

Why it happened now: the manual was still untracked, so 7 MB of
screenshots would otherwise have entered *this* repo's history
permanently on the next commit.

- Nothing in the build, packaging, or tests referenced `docs/`. The one
  code coupling is `scripts/make-icon.js`, which now writes the site's
  `icon.svg`/`favicon.svg`/`icon-256.png` into `../Clew-docs/site/images`
  and skips the step (existing `existsSync` guard) if that repo is not
  checked out. Verified: the path resolves.
- **New features MUST still update the manual** — but a stale manual no
  longer shows up in this repo's `git status`. This is now the easiest
  thing in the project to forget; both `CLAUDE.md` files say so.
- Deployment is `make sync` in `Clew-docs` (rsync to the droplet,
  `clew-app.com`). §8 below has the state of that.

## 2. Bug fixes this session (owner-reported, all smoke-verified)

- **`>> right` / `>> centered <<` alignment did nothing in previews**:
  the engine emits `.jmarkdown-right`/`.jmarkdown-center` but ships no
  CSS for them (only its docs-site stylesheets define them). Fixed with
  two rules in `src/engine/preview.css`. *Upstream candidate*: the rules
  belong in the engine's `jmarkdown.css` so every consumer gets them.
- **Splits could not be closed from a preview** (and worse, ⌘W closed a
  tab in the *other* pane): chords forwarded from the preview iframe ran
  against the app's active group, but clicks inside the cross-origin
  iframe never reach the pointerdown focus tracking. Fixed in
  `clew-preview-view.js` (chord handler activates its own `tabId` first;
  new `focused` message) + `client.js` (posts `focused` on pointerdown).
  Don't regress: an iframe click must count as pane focus.
- **Welcome banner had too much empty space**: `header-height: 120` in
  `Welcome.md`, and the header plugin (v1.1.0) gained `header-position`
  (CSS background-position) and `header-align` (top/center/bottom).
  `plugins.html` quotes this plugin — keep the quotes in sync.

## 3. New feature: vault-wide bibliography + References panel

Vault settings (Settings → This vault / `.clew/vault-settings.json`):
`bibliography` (path from vault root or absolute), `bibliographyStyle`
(named style or `.csl` path), `bibliographyPanel` (bool). **No engine
changes** — the design facts:

- `render-service.js#writeEngineConfig` emits a `Biblify` config section
  (absolute paths; custom styles via `template: {name, file}`). The
  engine's 8 named styles ship inside it already (apa, chicago, harvard1,
  vancouver, bjps, ajp, econometrica, ergo — `vendor/jmarkdown/src/csl/`).
- **Per-note override is engine precedence**: metadata headers are
  processed after the config file, so `Bibliography:` / `Bibliography
  style:` properties win per note. Verified (vault apa, note bjps).
- **The References panel's feed** is a hidden
  `<aside class="clew-bib-panel-source"><div class="biblify-bibliography"
  data-all="true">` at the end of `clew-template.html` — the citation
  post-pass runs on the *templated* document and fills (or removes) it.
  The panel (`panels/clew-bibliography.js`, right-bar "Refs" tab, gated
  on the vault setting via `clew-app.js` `when:` + the
  `clew:vault-settings-changed` window event) fetches rendered HTML over
  the new `RENDER_HTML` IPC and lifts the list out, sanitized — so it
  works with the note in source mode too.
- Sectional bibliographies (engine, verified): bare `@bibliography` =
  per-section (collects since last marker), `{all}`, `{scope="#css"}`,
  `{style= title=}`; a sectional marker's style reaches its section's
  inline citations. All composes with the vault setting; documented in
  `citations.html#sectional`.

## 4. Real bugs found, NOT fixed (owner triage)

1. `query-fences.js#scanNotes` (~line 148) uses bare `entry.isDirectory()`
   — **queries don't traverse symlinked folders**, contra CLAUDE.md's
   walk rule.
2. Map distance tool leaks: third Shift-click starts a new measurement
   but the old line/readout stay until re-render
   (`leaflet-maps.js:259-279`).
3. App-surface plugins load only on vault open — the settings checkbox
   implies live toggling but doesn't reload them (`renderer/plugins.js`
   only runs on `vault-changed`).
4. Alias wikilinks render in the unresolved dashed style though they
   navigate correctly (engine resolver checks basenames only,
   `src/engine/wikilinks.js:84-98`).
5. A kanban wider than the note column silently clips trailing columns
   (macOS overlay scrollbar invisible) — documented honestly in the
   manual; the landing `kanban.jpg` shows 3 of 4 columns because of it.
6. Landing page still claims "37 pages" for the demo-vault export
   (drifted; manual says "roughly forty"). **Now a `../Clew-docs` item.**
7. Still open from before: engine passes `<` raw in code spans.

## 5. Standing session rules (learned the hard way)

- **NEVER `git add -A`** — stage explicit paths (§0 list).
- Always pass `CLEW_SMOKE_VAULT`; `git status` demo/study vaults after
  every smoke. This session's intended vault edits: `Welcome.md`,
  `.clew/plugins/header/*` (demo). `demo-vault/clewdata.json` is tracked —
  restore it (`git checkout`) after any smoke that clicks the Habit
  Tracker.
- The owner's bug reports have been consistently RIGHT — reproduce THEIR
  gesture path (this session: the split bug needed a real keystroke inside
  the preview iframe to reproduce; store-driven repros passed wrongly).
- Theme-changing smokes persist to app-global settings — follow with a
  restore-dark run.
- Verify artefacts by content, not logs.

## 6. Verification kit (works, use it)

Smoke pattern as in CLAUDE.md; `window.__clew` = stores, registry, ipc,
actions, editorPool. New tricks that earned their keep:

- Interactive grids (Habit Tracker) re-render per click — frame scripts
  must **re-query elements before every click**.
- Wide content: collapse sidebars (`workspace:toggle-left/right-sidebar`)
  before screenshotting; delete a vault's `.clew/workspace.json` for a
  clean single-pane layout (it regenerates).
- Renderer diagnostics that survive quit: wrap store methods and stream a
  log via `C.ipc.invoke('clew:note-write', …)` into a THROWAWAY vault;
  or read `.clew/workspace.json` after quit for final layout.
- Frame scripts can dispatch real `KeyboardEvent`s to test the preview
  chord forwarder; a frame script that throws skips the screenshot.
- Headless Chrome (`--headless --screenshot`) renders any HTML page for a
  visual check without Electron — used in `../Clew-docs` for both the
  manual pages and the social card.

## 7. Open items (carried + new)

1. **v0.8.0 tag collision / version bump + rebuild** — blocks release
   (release set in `out/` predates this session's features).
2. Windows/Linux artefacts never launched on real hardware. (The site's
   Windows download filename mismatch is **fixed**: `Clew-docs`'
   `make stage-downloads` renames `Clew Setup X.Y.Z.exe` →
   `Clew-Setup-X.Y.Z.exe` on the way to the server, so the page's
   hyphenated href is the one that ships.)
3. `out/` holds stale 0.7.0 artefacts beside the (now also stale) 0.8.0s.
4. §4 bug list above; canvas style bar still ignores selected ink.
5. Upstream jmarkdown candidates: alignment CSS (§2), code-span `<`,
   sidebar-restore emit, engine extension-registry hook (see 5fbb59b
   handover §6.10).
6. Kanban/query polish and Obsidian-universe candidates — unchanged from
   last session's list.
7. Manual follow-ups if features change: it documents split behaviour,
   citations, panels, settings keys — keep it truthful. It now lives in
   `../Clew-docs`.
8. **Neither this repo nor `../Clew-docs` has a git remote.** Everything —
   150 uncommitted files here, ~50k words of manual there — exists on one
   machine only. Worth deciding on before the release, not after.

## 8. Website hosting (set up this session, not yet live)

`../Clew-docs` deploys to the same DigitalOcean droplet as the owner's
other sites (`ssh do` → 144.126.236.254, Ubuntu 24.04, nginx 1.24,
certbot). It follows the house pattern in `~/Sites/digital_ocean/`
(`/var/www/<name>`, `web:web`, `--rsync-path="sudo rsync"`), departing
from it in one respect: a directory sync with `--delete` instead of an
explicit file list, because the site is 70 files and a hand-kept list
would be wrong the first time a chapter is added.

**The app has its own domains now**: `clew-app.com` (canonical) and
`clew-app.net` (redirects to it), both registered with GoDaddy. That is
why the site is not on `jmckalex.org` at all.

**Blocked on one thing only: DNS.** Both domains still resolve to
GoDaddy's parking IPs; repointing the A records at 144.126.236.254 needs
registrar access. `make dns-check` in `Clew-docs` is the gate and refuses
to go on until all four names agree. After that it is
`make provision`, `make nginx-install`, `make sync`, `make tls` — the
last runs certbot for all four names, including the two `.net` ones that
only redirect (a browser in HTTPS-first mode tries `https://clew-app.net`
before `http://`, so an uncertificated alternate fails rather than
redirecting). Nothing on the droplet has been changed — everything so far
is read-only inventory.

Release binaries (~640 MB) are deliberately outside git and outside the
ordinary sync: `make stage-downloads` copies them from this repo's `out/`,
`make sync-downloads` uploads them. The landing page's four `downloads/…`
links 404 until that runs — they always have; the directory never existed.
Not run yet, because the version is undecided (§0/§7.1): `VERSION` in that
Makefile and the nine `0.8.0` strings in the landing page have to move
together with whatever this repo tags.

The site also gained full social-preview tags and a generated 1200×630
card this session. The card is rendered from HTML that reuses the landing
page's palette and tagline, and **must be re-rendered on a Mac** (it uses
Avenir Next). Details in `../Clew-docs/HANDOVER.md` §4 — including that
none of it can be checked against Facebook's or Twitter's debuggers until
DNS resolves, since they fetch the live URL.
