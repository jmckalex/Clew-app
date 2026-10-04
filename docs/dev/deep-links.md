# Deep links and the `clew` command (as built, 2026-10-03)

FEATURE-IDEAS #8, the owner's pick. Two ways in from outside Clew, one set
of rules, one handler.

```
clew://open?vault=<name|path>&note=<vault-relative path>[&line=N][#heading]
clew://new?vault=<name|path>&daily=1
clew://new?vault=<name|path>&note=<path>

clew open <file or folder>               a vault, or a note in its vault
clew new --daily [--vault <v>]           today's diary entry (created if missing)
clew new <note> [--vault <v>]            a new, empty note (never over a file)
clew export --latex|--pdf|--html <note> [--out <file or folder>]
                                         export a note beside it, or at --out
```

## What may be done (the owner's rule)

- A **link** opens and navigates — nothing else. It never runs code, changes
  trust or writes, except `new`, which creates an empty note (or today's
  diary entry) and SAYS so (a notice in the window). Any other action
  (`clew://run`, `clew://trust`, …) is refused BY NAME; a note path that
  climbs out of the vault (`..`, absolute) is refused.
- A link naming a vault this device does not know (not open, not recent)
  asks first — "Open the vault …? Opening it shows its notes; it does not
  trust its code." Opening never changes trust: an unknown vault opens
  restricted, as any first open does.
- A vault is named by its PATH (`/…`, `~/…`) or by the NAME of a known
  vault's folder (ignoring case); two known vaults of one name are refused —
  name it by its path.
- The **command** is the user's own, typed in their terminal: it opens what
  it names without asking; `export` runs under the vault's trust exactly as
  Export in the menu does (`exportNote({ trusted })` — a restricted vault's
  export has `Run note code` off). It writes ONLY the artefact asked for
  (2026-10-04, Clew-docs): a PDF is built in a temporary folder
  (`exportNote({ buildApart })` — the note's folder on TEXINPUTS, every
  bibliography's on BIBINPUTS, as always) that is removed afterwards, so no
  .tex/.aux/.log/.fls/.out/.fdb_latexmk/.bbl/.blg lands beside the note;
  `--latex` writes the .tex alone. `--out` names a file, or a folder (one
  that exists, or written with a trailing `/`), relative to the command's
  working folder, `~` meaning home; without it, beside the note. A failure
  still names the engine and the log's first error (read before the folder
  goes). The MENU's PDF export is unchanged and still leaves those eight
  build files beside its output (measured).
- What a link or command opens goes into a TAB OF ITS OWN (or the tab
  already showing it) — never over the note being worked on, the PDF-link
  rule (18023d5).

## How it works

- **Parsing** — `main/deep-links.js`, pure (tests/deep-links.test.js): URLs,
  note paths, vault names, the vault a file belongs to (the nearest folder
  holding `.clew` or `.obsidian`, else a known vault containing it, else its
  folder), the command line.
- **Doing** — `main/deep-link-host.js`: `open-url` (macOS, also before
  ready), the command line (Windows, Linux, and a dev build), a second
  launch's command line (`second-instance`), and the command's socket. A
  request opens the vault (`openVaultAnywhere`: its window if open, else a
  new one), then leaves what the window should show in the session's
  `pendingLinks`; the window takes them ONCE (`DEEP_LINK_TAKE`) when it has
  put its vault on screen (`renderer/deep-link.js`, at the end of
  `main.js#showVault`). ◆ A window shows its vault TWICE as it starts (its
  own boot, then main's vault-opened); the second's workspace restore
  replaced what a link opened after the first, so links applied in the last
  8 s are applied again (idempotent). ◆ Links that arrive with the launch
  wait for the restored windows to open their vaults — else a link to one
  found it "not open" and opened it again in a second window (measured).
- **One process per profile** — `app.requestSingleInstanceLock()` in
  main.js, keyed by the userData folder (paths.js sets it first), so smoke
  runs, each with its own, never collide. A second launch hands over its
  command line and exits.
- **The command** — `src/cli/clew.mjs`, plain Node, bundled to
  `dist/cli/clew.mjs` (scripts/build.js) and shipped UNPACKED as
  `Resources/cli/clew.mjs` (package.json `extraResources`). It sends a JSON
  line to a socket in the profile folder (`<userData>/clew-cli.sock`, mode
  0600 — only this user; a named pipe on Windows) and prints the answer:
  exit 0 done, 1 failed (said why), 2 usage. Not running: it starts Clew
  (`CLEW_CLI_LAUNCH` from the shim — without `ELECTRON_RUN_AS_NODE`, or the
  app it starts is Node too and exits at once, measured) and asks again for
  up to 30 s.
- **Installing it** — Help → Install the clew Command… writes a shell shim
  to `/usr/local/bin/clew` when this user may write there, else
  `~/.local/bin/clew` (and says to add it to PATH when it is not there). It
  never asks for an administrator's password. The shim runs Clew's own
  binary as Node — `ELECTRON_RUN_AS_NODE=1 exec <Clew> <Resources>/cli/
  clew.mjs "$@"` — so nothing else is installed (Electron's RunAsNode fuse
  is on: no fuses are configured).

## Packaged and dev

| | Packaged | Dev (`npm run dev`, `electron .`) |
|---|---|---|
| `clew://` registered | yes — electron-builder `protocols` (Info.plist `CFBundleURLTypes`, the Windows registry, the Linux .desktop file) and `setAsDefaultProtocolClient` at launch | NO on macOS: registering would make the bare Electron.app the handler. Give a link on the command line: `electron . 'clew://open?vault=…'` |
| A link arrives as | macOS `open-url`; Windows/Linux the command line (a second launch's, via the lock) | the command line |
| The command's shim runs | `<Clew.app>/Contents/MacOS/Clew` + `Resources/cli/clew.mjs`; starts the app with `open -a <Clew.app>` | the repo's Electron + `dist/cli/clew.mjs`; starts the app with `electron <repo>` |
| Its socket | `<userData>/clew-cli.sock` | the same (dev and packaged share a profile — and, by the lock, one runs at a time) |
| Under CLEW_SMOKE | no socket unless a scenario names one (`CLEW_CLI_SOCKET` — a smoke profile's path is too long for a socket); the unknown-vault question answered by `CLEW_SMOKE_LINK_ANSWER=open|cancel`, logged `smoke-link-ask:`; the shim written to `CLEW_SMOKE_CLI_DIR` | |

## Measured (smoke)

- `deep-link-scenario.js`, five links on the command line: open at a
  heading (`cursor-line=63 heading-line=63`), `clew://run` refused by name,
  `new` note created and opened, today's diary entry opened, an unknown
  vault asked and cancelled — each in its own tab.
- `cli-scenario.js` driven from a shell: the socket `srw-------`; `open`,
  `new --daily`, `new <note>`, `export --html|--pdf` done (exit 0) and shown
  in the window; a bad command → usage (exit 2); a missing file refused
  (exit 1); no app → "Clew is not running" without a launcher, and with the
  shim's launcher Clew STARTED and opened the note (1 s); the shim written by
  the real Help menu item and used.

## Without RunAsNode — the fuses (a note for the owner; nothing changed)

*Clew-boss raised it, 2026-10-03.* Electron's hardening advice is to turn
OFF the `RunAsNode` and `EnableNodeCliInspectArguments` fuses in shipped
builds, and ON `OnlyLoadAppFromAsar` and `EmbeddedAsarIntegrityValidation`.
With RunAsNode on (Clew configures no fuses), any local process can run
Clew's signed binary as plain Node (`ELECTRON_RUN_AS_NODE=1`) and act with
the macOS privacy grants the user gave Clew (Files and Folders, Full Disk
Access if granted). The `clew` shim above relies on exactly that.

**What turning the fuses off would cost — more than the command.**

- `RunAsNode` OFF breaks every worker Clew starts with
  `child_process.fork` — inside Electron, `fork` IS RunAsNode
  (`process.execPath` + `ELECTRON_RUN_AS_NODE=1`): the render workers
  (`render-service.js`), note exports (`export.js`) and site exports
  (`export-site.js`). Reading view, live edit's frames and every export
  would stop. The way out is Electron's own `utilityProcess.fork`, which
  works with the fuse off — but the engine's `watch-worker.js` talks
  `process.send` / `process.on('message')`, and a utility process talks
  `process.parentPort`. Clew would need a small wrapper script that bridges
  the two before importing the worker (no engine change), and the
  render-service's fork/kill/standby logic moved to the utilityProcess
  API. A day's work, plus a full sweep; the risk is in the warm-standby
  and generation-counter paths.
- `EnableNodeCliInspectArguments` OFF: no cost (`--inspect` is debugging).
- `OnlyLoadAppFromAsar` ON: no cost — the app is `app.asar` (dist/ +
  package.json); the engine and assets outside it are files the workers
  read, not the app.
- `EmbeddedAsarIntegrityValidation` ON: electron-builder writes the asar
  hash into Info.plist when asked (`electronFuses` in the build config);
  nothing patches the asar at run time, so no cost beyond the setting.
  The boot test must then run against the packaged binary as now.

**How the command could work without RunAsNode.**

1. **The binary is its own client (recommended).** The shim runs Clew's
   binary NORMALLY with `--clew-cli <command…>`. Very early in main.js —
   where the single-instance lock is taken — a process carrying
   `--clew-cli`:
   - that did NOT get the lock (Clew is running) connects to the socket,
     sends the request, prints the answer and exits with its code, before
     any window or the app's ready;
   - that DID get the lock (Clew is not running) starts the real app
     detached (without the flag), waits for its socket, and does the same.
   Replies, exit codes and `export`'s output path all survive; nothing runs
   as Node. Cost: one Electron process start per command (a few hundred
   ms, it exits before ready). The JSON protocol, the socket and the host
   stay exactly as built.
2. **A POSIX shell shim over the socket** (`nc -U`). macOS's BSD `nc` has
   `-U`; Linux distributions ship different netcats (openbsd-netcat has
   `-U`, others do not, `socat` is not standard). Building a JSON line
   from arguments in `sh` needs careful escaping, and reading the answer
   back means parsing JSON with `sed`. Works on macOS, fragile elsewhere.
3. **Hand the command over as argv** (`second-instance`): the shim runs
   the binary with the command; the running app receives argv and cwd and
   acts. No reply channel — the terminal learns nothing (no "exported …",
   no exit code); acceptable for `open`/`new`, poor for `export`.
4. **`open 'clew://…'`** (macOS `open`, Linux `xdg-open`) for open/new,
   with only `export` needing the socket. The command would then obey the
   LINK rules — asking before an unknown vault, even for the user's own
   command — and still need a client for export (1 or 2).

Recommendation: if the fuses are turned off, do 1 for the command — it
keeps everything the command does today — and move the workers to
`utilityProcess` first, because that, not the command, is what the fuse
would break. Both are the owner's call; nothing has changed tonight.
