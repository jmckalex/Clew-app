# In-app update check — design

Status: v1 BUILT (2026-10-03) to the owner's answers (§6). Clew-docs owns
the site and its deploys, so §3 says what the site must SERVE, not how to
deploy it — and is now the EXACT schema the app reads.

## 1. Recommendation

- **v1, every platform: CHECK and NOTIFY.** Clew asks clew-app.com once a
  day whether a newer version exists and, if so, says so, with a download
  link and the release notes. It downloads and installs nothing itself.
- **v2, per platform, later**: `electron-updater` auto-install where the
  platform can VERIFY what it installs — macOS (signed and notarized today)
  and the AppImage; Windows only once the installer is code-signed; the
  deb never (a package manager's job).

Why not `electron-updater` everywhere now (all read from `out/` and
`package.json` as of 0.11.1):

- **macOS** installs updates with Squirrel.Mac, which needs a **zip**
  target beside the dmg (none is built), and a `latest-mac.yml` that
  matches the served files. Today's names `Clew-0.11.1.dmg`, which does not
  exist: the arm64 and x64 builds each wrote the file, and neither dmg has
  that name. Both are fixable (a zip target, both architectures built in
  ONE electron-builder run so one yml lists both).
- **Windows**: the NSIS installer is unsigned. `electron-updater` would
  download and RUN an installer whose only check is a sha512 read from the
  same server — so a compromised droplet would mean code execution on every
  Windows install. With a signing certificate and `publisherName`, the
  updater verifies the publisher; until then, notify only.
- **Linux**: `electron-updater` can replace a writable AppImage in place;
  for the deb it would need `pkexec`, which is not a v1 thing.
- A check is ~50 lines and no dependency; the updater is a dependency, a
  background downloader and a per-platform install path to test.

## 2. The check (v1)

- Main process, never the renderer: `net.fetch` of the feed over HTTPS,
  30 s after launch and every 24 h while running; compare with
  `app.getVersion()` (semver); stay quiet about a version the user chose to
  skip. Offline, a 404 or a malformed feed: silent (logged).
- Nothing is sent but the request itself — no identifier, no telemetry,
  no version in the URL. The manual says so.
- Never in dev builds or under `CLEW_SMOKE`.
- Setting `updateCheck`: `on` (default) / `off`. Help → "Check for
  Updates…" works either way and always answers (up to date, newer
  available, could not check).

## 3. The feed — what the site must serve

`https://clew-app.com/downloads/latest.json`, written by the release step
beside the binaries (`node scripts/write-latest-json.mjs [outDir]`, which
reads the built artifacts and writes their SERVED names, sha512 and sizes):

```json
{
  "version": "0.12.0",
  "released": "2026-10-05",
  "notes": "https://clew-app.com/manual/whats-new.html#v0-12-0",
  "files": {
    "mac-arm64": { "url": "Clew-0.12.0-arm64.dmg", "sha512": "<base64>", "size": 222428189 },
    "mac-x64": { "url": "Clew-0.12.0-x64.dmg", "sha512": "<base64>", "size": 226079778 },
    "win-x64": { "url": "Clew-Setup-0.12.0.exe", "sha512": "<base64>", "size": 190590642 },
    "linux-appimage": { "url": "Clew-0.12.0.AppImage", "sha512": "<base64>", "size": 223791314 },
    "linux-deb": { "url": "clew_0.12.0_amd64.deb", "sha512": "<base64>", "size": 177189340 }
  }
}
```

- **The exact rules the app applies** (`main/update-check.js#readFeed`):
  `version` is semver (a prerelease such as `0.12.1-dev.1` ranks below its
  release); every URL — `notes` and each file's `url` — is resolved against
  the FEED's own URL and kept only if it stays on the feed's origin over
  https, so `"Clew-0.12.0-arm64.dmg"` means `/downloads/Clew-0.12.0-arm64.dmg`
  and `"../manual/whats-new.html#v0-12-0"` the manual (an absolute
  `https://clew-app.com/…` works too; anything elsewhere is dropped);
  `sha512` is base64, as electron-builder writes its own; a platform key the
  feed lacks just means that machine is offered the notes without a
  download. Keys: `mac-arm64`, `mac-x64`, `win-x64`, `linux-appimage`,
  `linux-deb`. Anything else in the file is ignored.
- Served with `Cache-Control: no-cache` (nginx), so a release is seen at
  once; uploaded LAST, after the binaries, so it never names a file that is
  not there yet.
- The release step: Clew-app's packaging writes `out/latest.json` from
  `package.json` and the artifacts it built; Clew-docs' `stage-downloads`
  copies it with the binaries and `sync-downloads` uploads it last. Setting
  electron-builder's `artifactName` to the SERVED names (no spaces:
  `Clew-Setup-${version}.exe`) retires the rename `stage-downloads` does
  today.
- For v2 the same directory also serves electron-builder's own files
  (`latest.yml`, `latest-mac.yml`, `latest-linux.yml`, the zips and
  blockmaps) — the generic provider pointed at `https://clew-app.com/downloads/`.

## 4. What the user sees

A notice in the window, in the style of the watch-cap notice, not a modal:
"Clew 0.12.0 is available. What's new · Download · Skip this version".
Download opens the file for THIS machine in the browser — the right dmg for
the architecture, the AppImage when `process.env.APPIMAGE` says Clew runs
from one, the deb otherwise on Linux, the installer on Windows. Nothing
restarts, nothing installs.

## 5. Signing and notarization, per platform

| Platform | Today | v1 (notify) | v2 (auto-install) needs |
|---|---|---|---|
| macOS | Developer ID signed, notarized, stapled (`--notarize --dmg`) | nothing more | a zip target; notarization of the app inside the zip; the same Developer ID (Squirrel.Mac checks the designated requirement); one build for both architectures |
| Windows | NSIS installer UNSIGNED (SmartScreen warns) | nothing more | an Authenticode certificate (OV or EV) and `publisherName`, so the updater verifies the publisher |
| Linux AppImage | unsigned | nothing more | a writable AppImage (electron-updater replaces it in place); optionally a detached signature |
| Linux deb | unsigned | nothing more | not planned: a package manager's job (an apt repository on the droplet, if ever) |

## 6. The owner's answers (2026-10-03)

1. **v1 notify-only** — no electron-updater yet.
2. **On by default**, with the setting (Settings → Updates) and a manual
   line.
3. **No Windows code-signing certificate** for now.
4. **Release notes** live on a "What's new" page in the manual, linkable per
   version (`#v0-12-1`); Clew-docs drafts 0.12.1's.

## 7. As built (v1, 2026-10-03)

- `main/update-check.js` (pure: semver, `readFeed`, `platformKey`,
  `decide`) and `main/updater.js` (`net.fetch`, 30 s after launch and every
  24 h, once per version per run, told to the focused window).
  `renderer/update-notice.js` draws the notice; Help → Check for Updates…
  (`app:check-updates`) always answers; Settings → Updates (`updateCheck`);
  Skip writes `skippedUpdate`.
- **Never from a dev build or a smoke run against the real feed.** The one
  way to exercise it there is a LOOPBACK `CLEW_UPDATE_FEED`
  (`smoke/update-check-scenario.js` + `smoke/update-feed.mjs`); measured:
  the only request leaving is to the loopback feed; the notice offers What's
  new, Download (this machine's file) and Skip; Skip removes it and a manual
  check still answers; a feed that is down is silent on schedule and named
  on a manual check; a plain smoke run makes no request at all.
