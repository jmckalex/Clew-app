# The frame bridge — design

Status (2026-09-30): §1 AGREED with the iOS session and BUILT on desktop;
§2.8 step 0 BUILT. §2 (the app page's own origin), §3 (Compatibility), §4
(vault trust) and §5–§16 (the bridge) REVISED to the owner's answers to
all eleven open questions ("Decisions", at the end), with §4 agreed by the
iOS session after its review added the engine's own code paths (§4.1).
**2026-10-02: the owner approved building phases 1–4 (§15), with the app
sections revised first — R1–R3** (phase 1, §4, BUILT on desktop the same
night — "As built" at the end of §4) (apps run in restricted vaults, app
network, app identity on rename; marked "R1"–"R3" where they land, summed
up with the choices left open under "Revision R1–R3" at the end, and the
iOS-facing points under §13). §1 is a prerequisite: the bridge must stand
on a protocol that can tell who is asking.

## 1. The caller token

### 1.1 Why

The render endpoints (`__clew_fragment__`, `__clew_block__`) run the engine
on text a caller posts. Today nothing reliably tells a legitimate caller
from any other document that can reach the scheme:

- **Desktop** (measured 2026-09-29): the `clew-preview://` handler sees NO
  `Origin` header on these POSTs — not from the app page (canvas cards,
  live-edit block frames), not from a preview document (a canvas scene's
  cards). The existing "refuse an http(s) Origin" guard therefore cannot be
  relied on, and "refuse `Origin: null`" has nothing to key on.
- **iOS** (the iOS session's measurement, 1,982 logged requests): WebKit
  does separate callers — the app page sends `clew-app://app`, a
  same-origin preview document's render POST sends none, a preview
  document's CORS-mode GET sends `clew-preview://vault`, a sandboxed
  `srcdoc` frame sends `null`. So on iOS an Origin guard works, as a second
  layer. But CORS stops a caller READING a response, not the request: the
  sandboxed frame's POST still reached the handler and ran the engine.

Origin cannot be the uniform mechanism — desktop has none to read. A secret
the host hands only to documents it trusts can be, and the check must come
before the engine.

### 1.2 The token

- **One per vault open**, 32 random bytes, hex, held in memory only. Never
  persisted, never logged, never put in a URL or in served HTML.
  - Desktop: one per window (`VaultSession`), created with the session. A
    window receives a vault only while it has none, and nothing closes a
    vault short of closing the window, so per session IS per vault open.
    The session id is random too (`b561983`).
  - iOS: one scene, one web view, one session — so the token and the session
    id (a constant `s1` until now) are both regenerated on every vault open;
    the old vault's preview URLs die then anyway.
- **Rotation**: a reload keeps its session, and so its token; a new vault
  open is a new token. No mid-session rotation in v1.

### 1.3 Who gets it, and how

- **The app page** — over its existing trusted channel, and only its OWN
  session's: desktop, beside `sessionId` on the two paths that deliver a
  window its own vault — the `EV_VAULT_OPENED` event and the `VAULT_CURRENT`
  reply — but NOT in `vaults.info` itself, which the open handlers also hand
  back to a different window when the vault is already open elsewhere
  (`main.js#openVaultAnywhere`); iOS, from native through the shim's
  `VAULT_CURRENT` (the bridge answers only the main frame at `clew-app://`,
  iOS `8ceb533`).
- **Preview documents — by handshake, never in the HTML.** A token in a
  served document is only as secret as that document, and preview HTML is
  read widely (the iOS app page fetches every note's HTML a second time;
  desktop's CORS must let `null` read while the app page is `file://`).
  - The preview client asks LAZILY, the first time it needs to POST (today:
    a canvas scene's first fragment card): `{source: 'clew-preview', type:
    'caller-token'}` to `window.parent`. A document that never POSTs never
    holds the token — a block document with no canvas in it, a link preview.
  - **The app page answers only its own frames**: `event.origin` must be
    `clew-preview://vault` and `event.source?.parent` must be the app's own
    `window` — readable across origins, and it counts every child browsing
    context, where a DOM query would miss the iframes inside custom elements
    and shadow roots (the frame layer, the floating panes, the canvas views);
    a stale WindowProxy fails it closed. The reply, `{source:
    'clew-preview-host', type: 'caller-token', token}`, goes to that window
    with targetOrigin `clew-preview://vault`, so a frame that has navigated
    elsewhere in the meantime receives nothing. One answerer for the whole
    page (reading view, live block frames, the floating panes, canvas
    cards), not one per host.
  - **A preview document answers its own frames the same way**, once it holds
    the token — a canvas scene's cards, nested embeds — so the token passes
    only down a chain of Clew clients. A frame whose parent is not a client
    (a raw vault `.html`) never receives one.
  - The client accepts the answer only from `window.parent` and keeps it in
    a closure — not a global, not the DOM. Its POSTs wait on it (they
    already wait for load).
  - **The ask retries and gives up.** A custom-scheme iframe moved in the DOM
    keeps a stale WindowProxy on WebKit and postMessage then drops silently
    both ways (the bug behind the clew-preview-view rebuild patch), so a lost
    ask must not hang a POST forever: re-ask every ~1 s, at most 5 times,
    then fail the POST with a visible error; and re-ask on `pageshow`.
  - **A top-level preview document** — the reading-view PDF export on both
    platforms (desktop `print-pdf.js`; iOS `PrintPDF.swift`, its scripts in
    `src/shim/print-pdf.js`), which loads the note's preview TOP-LEVEL in a
    hidden view with no host — is handed the token by the native side,
    through the same self-post that already switches the page to the light
    theme. At the top `window.parent === window`, so the client's rule
    covers it. (iOS's Quick Look and share are native: no preview
    document.)
- **Nobody else.** A frame a note embeds — a sandboxed `srcdoc`, a remote
  `https://` page, a future bridge app — fails the origin test at both ends.
  A note's own script can see the answer arrive (it is the same document);
  that is the vault's own code at the vault's own trust level, as today.

### 1.4 What must carry it, and how

- **The render POSTs** — always, as a field of the JSON body
  (`{ token, text, sourcePath }`; the fragment POST moves from a raw-text body
  to the same JSON shape), through one helper both platforms share
  (`lib/preview-url.js#renderPost`). A body field, not a header (a custom
  header makes the request non-simple: a preflight), not a query string
  (URLs end up in places bodies do not).
- **No `Content-Type` header**: the body goes as fetch's default
  `text/plain`, and the server parses it as JSON regardless. From
  `clew-app://app` an `application/json` POST is preflighted, and the iOS
  handler does not answer `OPTIONS`. The 100 KB limit covers the whole body.
- **GET reads** cannot carry it — `<img>`, `<script>`, fonts, CSS and frame
  navigations cannot add a header or a body. GETs stay as they are, their
  capability being the path: the session id in every preview URL is random,
  and a frame not handed a URL cannot build one — the `Referer` and
  `ancestorOrigins` it sees carry the origin only, not the path.

### 1.5 What the server does with it

- A render POST whose body token does not match its session's (constant-time
  compare) is refused with 403 before the engine sees anything. That is the
  rule on both platforms. The Origin guard stays as defence in depth
  (desktop: http(s) refused; iOS also refuses `null`, which separates
  callers there).
- **Cross-origin reads** (`Access-Control-Allow-Origin`) are not part of the
  token's security on either platform, since no served document holds it.
  Desktop is unchanged (`3575f24`: echoed only for `clew-preview://vault`
  and `null`; its handler sees no Origin, so in practice none is sent, and
  every consumer works). iOS echoes only `clew-app://app`, on both schemes,
  with `Vary: Origin` — measured against a baseline with every consumer
  unchanged, and the `null` frame then blocked on every read.

### 1.6 Later

- **(c), the desktop app page on its own origin** (`clew-app://`, as iOS):
  desktop's ACAO rule becomes iOS's (the app origin, never `null`), and the
  token stays on the POSTs — no rework.
- **The frame bridge**: bridge apps never receive the session token. They
  reach Clew only through a host-issued `MessageChannel` port per embed
  (per-app identity, §5 onward), and everything privileged is done by the
  host on their behalf. And they must never be SERVED under
  `clew-preview://vault/<sid>/…`: a frame loaded from such a URL reads the
  session id from its own `location`.
- **Null-origin reads on desktop** (HANDOVER §1) are a separate question —
  what a sandboxed frame may read, not what it may run — and the owner's.

### 1.7 iOS mapping (agreed with the iOS session)

- `SchemeHandler.swift`: 403 on either render POST without the session's
  token (constant-time), plus refusing Origin `null`/http(s) on the POSTs;
  ACAO echoed for `clew-app://app` only, on both schemes, `Vary: Origin`.
- A random session id and a random token, generated per vault open, held in
  Swift memory, handed to the app page only through the bridge.
- The shim: `VAULT_CURRENT` carries the token; the POST call sites and the
  handshake answerer are shared renderer code — one change serves both.
- Preview documents: nothing injected; the shared preview client asks.
- The print view (`PrintPDF.swift`): the token's self-post evaluated beside
  the light-theme script.

### 1.8 Test plan

- Unit: the handler's check (no token, wrong token, wrong length, right
  token) as a pure function over the body; the answerer's rule (origin and
  parent) as a pure function; the ask's retry and give-up; the token never
  appears in a URL the app builds or in served HTML.
- Smoke: the protocol tour and the full sweep before and after — every render
  POST consumer (canvas cards and scenes, nested cards, live-edit block
  frames, the preview pane, link previews) unchanged; a render POST from
  the app page without the token answers 403 (the endpoint's own regression
  test); a reading-view PDF of a note embedding a canvas prints its cards.

## 2. The app page's own origin — option (c)

Status: PROPOSED (2026-09-29), design only. The owner's decision: close the
desktop null-origin read gap BY DESIGN — no measurement, no probing,
assume the worst — by moving the app page off `file://` onto
`clew-app://app`, the origin the iOS app page already has. To be BUILT
before any embedded-app feature ships.

**Built (phase 2, 2026-10-02):** the move — `main/app-files.js`,
`protocol.js#installAppProtocol`, `loadURL('clew-app://app/index.html')`,
the constant ACAO, `renderOriginAllowed`, the subframe guard, the portal
fix. Measured: origin `clew-app://app`, `isSecureContext` true, a clipboard
write succeeds, the app page's render POST and block/preview reads succeed,
the page carries `frame-ancestors 'none'`, a path outside dist/renderer and
a vault path 404, a note's iframe at the app page is refused
(`smoke/app-origin-scenario.js`). §2.10's storage question answered: the
preview frames' storage IS repartitioned under the new top-level site — the
TikZ/MetaPost result cache re-typeset each figure once
(`cache-probe first=engine` on the first run of the new build over a
profile that had it cached, `first=cache` after).

### 2.1 Why

The app page is `file://`, so its origin is `null`, the same value a
sandboxed frame has. A response the app page must read therefore has to be
readable by `null` (`main/preview-cors.js` echoes it), and every sandboxed
frame a note, a plugin or a remote page can create is `null` too. §1 stops
such a frame RUNNING the engine; nothing stops it READING vault files. With
the app page on its own origin, reads are granted to that origin alone and
`null` is refused outright — the rule iOS already has.

### 2.2 The scheme

- `clew-app` joins `clew-preview` in the ONE `protocol.
  registerSchemesAsPrivileged` call (`protocol.js`; Electron allows the call
  once, before `ready` — a second call risks the first scheme's privileges).
  Privileges: `standard` (a tuple origin, `'self'` in the CSP, `/…`
  resolving against the host, module scripts), `secure` (a secure context:
  `navigator.clipboard` and the clipboard permission-policy delegation to
  the LibreOffice and Excalidraw frames), `supportFetchAPI`, `corsEnabled`,
  `stream`. Never `bypassCSP`; no `allowServiceWorkers`; `codeCache` left
  off at first (turning it on later means `clearCodeCaches` beside the
  asset stamp's `clearCache`).
- The name and host are EXACTLY `clew-app://app` on both platforms, so the
  origin constants are shared: `APP_ORIGIN` joins `PREVIEW_ORIGIN` in
  `shared/` (§1's answerer, the postMessage targets, the ACAO value).

### 2.3 What the handler serves

- `protocol.handle('clew-app', …)` on the DEFAULT session only (the
  `persist:clew-canvas` webview partition never gets it), registered in
  `whenReady` beside the preview handler, before any window.
- It serves the app's own files and nothing else: host `app`, path mapped
  onto `dist/renderer/` with a realpath clamp (inside asar when packaged),
  a MIME table that includes `text/javascript` for the module bundle and
  `text/css` (and `.map` in dev; packaged builds exclude maps, so a clean
  404), `Cache-Control: no-store` (dev hot reload and menu reload go
  through it; the asset stamp does not follow renderer builds). Any other
  host, any path outside `dist/renderer/`, anything that looks like a vault
  path → 404. It never serves vault content: a root-relative URL in engine
  HTML injected into the app DOM would otherwise land on it.
  `canvas/node-content.js` rewrites those onto the preview origin;
  `canvas/portal.js` does not (read from the code, not run — under
  `file://` such a URL points nowhere either), and the build gives it the
  node-content rewrite.
- The app document carries its CSP as a response HEADER as well as the
  meta tag, adding `frame-ancestors 'none'` (a meta tag cannot carry it):
  no frame can ever host the app page.

### 2.4 Loading, preload, reload

- `win.loadFile(dist/renderer/index.html)` → `win.loadURL('clew-app://app/
  index.html')`. Nothing else in the window's creation depends on the URL:
  the preload still attaches to the main frame only, `contextIsolation`
  stays on, `sandbox`/`webSecurity` stay at their defaults, no
  `nodeIntegrationInSubFrames`.
- Reloads (dev hot reload, View → Reload, a crashed renderer) re-run the
  boot handshake, which already re-asks `VAULT_CURRENT` for the session id
  and the caller token — the same path iOS takes when WebKit kills its
  content process.
- The smoke harness is unaffected (it drives the main frame by
  `executeJavaScript` and picks preview frames by `clew-preview:`).

### 2.5 The CSP

Unchanged text; the page it sits on changes what `'self'` means — from any
`file:` URL to `clew-app://app` alone, a tightening. The app page loads no
fonts, workers or wasm (all of those live in preview documents, which carry
no CSP), so no `font-src`, `worker-src` or `'wasm-unsafe-eval'` is needed;
plugin app surfaces and MathJax stay in `script-src` as the preview-origin
URLs they are. (iOS's copy adds `frame-src https: http:` because its canvas
web nodes are iframes; desktop's are `<webview>`s, outside `frame-src`.)

### 2.6 Cross-origin reads

- Every `clew-preview://` response carries `Access-Control-Allow-Origin:
  clew-app://app` — a CONSTANT, not an echo, because whether the desktop
  handler will see an `Origin` from the new page is unknown until built (it
  sees none from `file://`). Only the app page can hold that origin, so the
  constant grants exactly it — measured on iOS (a throwaway build sending
  the constant on BOTH schemes: every consumer worked, `null` reads were
  blocked), so one code shape serves both platforms and no `Vary` is
  needed; `clew-app`'s own responses carry the same constant. `null`
  leaves `CORS_READERS`, and so does the need for it;
  `tests/preview-cors.test.js` changes with it.
- Preview documents reading preview URLs are same-origin and need no ACAO;
  the app page's no-cors loads (`<img>`, `<iframe>`, `<script>`) never did.
  What needs it are the app page's CORS-mode reads: the render POSTs and
  block-document GETs (`renderPost`, `frame-layer.js`, `floating-pane.js`)
  and the two `fetch(previewUrl)` calls (`clew-preview-view.js`,
  `clew-canvas-view.js`) — today they succeed with no ACAO at all, most
  likely because a `file://` page is exempt, and every one of them fails
  QUIETLY (cards fall back, frames return null) if the header is wrong.
- The render POSTs' Origin guard becomes an allowlist where an Origin
  arrives: `clew-app://app`, `clew-preview://vault`, or none; `null` and
  http(s) refused (iOS's second layer). The token (§1) stays the rule.

### 2.7 Navigation and framing

- Kept as they are: `will-navigate` cancels every main-frame navigation
  (which also stops a file dropped outside the editor replacing the app);
  `setWindowOpenHandler` sends http(s) to the browser and denies the rest;
  webview guests stay pinned to http(s) (the comment there gains
  `clew-app`).
- Added: no SUBFRAME may load `clew-app://` — a `will-frame-navigate` guard
  on the window, beside `frame-ancestors 'none'` on the document. Nothing
  legitimate frames the app page. iOS drops `clew-app` from its subframe
  allowlist too (the owner's decision; nothing used it — done on the iOS
  branch, `65d2708`), so neither platform lets a frame load the app page.

### 2.8 postMessage: who is heard, and who is addressed

Every post between the app page and its frames targeted `'*'`, and most
receivers checked a `source` tag, not `event.origin` — the targets forced
while the app page was `null` (it cannot be a targetOrigin), the receivers
not. So the work splits:

- **Step 0, receivers — BUILT (2026-09-29), ahead of (c)**: any frame can
  post to `window.top` or its parent (a remote page a note embeds; on iOS a
  canvas web card, a DIRECT child of the app page), and the app page's
  bridges acted on whatever arrived — PDF, drawing and office writes, the
  Excalidraw library read and replace, vault file-name resolution (the iOS
  session's finding, by code reading). Now `shared/message-guard.js`: the
  app page's bridges (`pdf-save.js`, `pdf-frames.js`, the office dock's
  embed branch, the PDF page-shown wait) act only for
  `event.origin === PREVIEW_ORIGIN` and answer `event.origin`; a document's
  host listeners (`client.js` — which applied `render` HTML from ANY sender,
  so a remote child could put markup in the note — `api.js`, and the viewer
  pages' reply listeners) accept only the window they expect: the parent,
  or the window the request went to. Not "a frame the app created": the
  legitimate senders include nested ones (an office live embed, the
  Excalidraw and PDF viewers inside notes post to `window.top` from two
  frames deep), and a preview-origin document is vault content, trusted by
  design. The listeners that already matched their sending frame (the
  reading view, floating panes, canvas view, frame layer, office dock's own
  frame, PDF annotations) were already right.
- **Step 2, targets — after the move (BUILT 2026-10-02)**: downward (app page → preview frame)
  targetOrigin `PREVIEW_ORIGIN` for every post, not only replies; upward, a
  client cannot hard-code its parent (the app page, a canvas scene's preview
  document, or itself in the print view), so posts that carry data target
  `location.ancestorOrigins[0] ?? location.origin` — measured on WebKit:
  `["clew-app://app"]` for a top-level card, `["clew-preview://vault",
  "clew-app://app"]` for a nested one, EMPTY at the top (print), where
  `postMessage(msg, undefined)` throws and the parent is the document
  itself; content-free signals may stay `'*'`. The app page's own listeners
  then also require `event.origin === PREVIEW_ORIGIN` where they match a
  frame today.

### 2.9 What does not move

The preview origin (`clew-preview://vault`) and everything on it; the print
view (a preview document top-level — §1's self-post case); the office
thumbnail window; the `<webview>` partition; the SharedArrayBuffer switch
(process-wide, no COOP/COEP anywhere; the app page uses no SAB; real
cross-origin isolation stays impractical while preview documents embed
arbitrary https content).

### 2.10 Storage, and anything else keyed to the old origin

- **The app page stores nothing origin-keyed**: no localStorage,
  sessionStorage, IndexedDB, Cache Storage or cookies in the renderer, and
  none in CodeMirror or xterm; every piece of state goes over IPC
  (settings, workspace, vault settings, bookmarks, the KV store, the
  Excalidraw library). Clew's own plugins (charts, header, word-count) use
  none either. So Clew itself has nothing to migrate.
- **An app-surface plugin** runs in the app page, and a third-party one
  MAY keep localStorage/IndexedDB under `file://`; after the move it
  starts empty, ONCE — the owner's decision: nothing is copied, and the
  release notes say so (a plugin that wants its state to survive keeps it
  in the vault or through the plugin API).
- **Preview frames** may find their storage re-partitioned under the new
  top-level site (whether Chromium partitions under a custom-scheme top
  site in Electron 43 is not known until built): the TikZ/MetaPost result
  cache (IndexedDB) would re-typeset each figure once, Excalidraw's own UI
  preferences would reset once. Caches, not user data; the build records
  which it was (`figures-frame.js` already probes that cache across runs).
- The HTTP cache needs nothing: the release that ships (c) carries a new
  app version, which changes the asset stamp, which clears the whole cache
  already. V8's code cache recompiles the bundle once under its new URL.
  No permission grants are stored (Clew sets no permission handlers);
  zoom levels are not persisted by Electron.

### 2.11 The token and the bridge on top

- §1 is unchanged: the app page still receives its token over IPC and is
  still the one answerer for its frames; the render POSTs now also carry
  `Origin: clew-app://app` wherever Chromium sends one.
- Bridge app frames (§5 onward) are neither `clew-app://` nor served under
  `clew-preview://vault/<sid>/…` (a frame reads the session id from its own
  URL); they get no ACAO, no token, and no path into the app except the
  host-issued port.

### 2.12 iOS

Already there. What (c) asks of iOS is what §1.7 already lists (ACAO for
`clew-app://app` only), plus the optional subframe tightening in §2.7 and
the shared `APP_ORIGIN` constant.

### 2.13 How the build proves it, and the order

0. The receiver checks (§2.8 step 0) — BUILT, ahead of everything else,
   on both platforms.
1. The move (one commit): the scheme, the handler, `loadURL`, the CSP
   header with `frame-ancestors`, the constant ACAO with `null` removed,
   the Origin allowlist, the frame guard, the portal URL fix, comments and
   docs. Checked like §1: a baseline before, then the protocol tour, the
   full sweep, figures, global plugin, canvas, PDF, live blocks, the
   caller-token and block-endpoint scenarios — zero CORS or load errors,
   every consumer unchanged — plus new assertions: the page's origin is
   `clew-app://app`, `isSecureContext` is true and a clipboard write
   succeeds, a render read from the app page succeeds, and the figure
   cache's behaviour across the move is recorded.
2. The postMessage targets (§2.8 step 2), its own commit, with every save
   path (PDF, Excalidraw, office) and the note API exercised.

The riskiest failures are the quiet ones (a wrong ACAO degrades cards and
frames silently; a missing `secure` silently loses the clipboard), which is
why the checks assert them directly. The move is revertible in one commit:
Clew migrates no data of its own.

## 3. Compatibility

### 3.1 The rule

Nothing a user relies on today may break without being flagged. The bridge
ADDS an embed kind — an app frame, sandboxed, never under `/<sid>/`,
reached through a port — and RECLASSIFIES nothing: no existing frame
becomes an app frame by being detected, and none is re-sandboxed or moved
off its origin by the bridge. What changes for existing frames comes from
§1 (built) and §2 only.

### 3.2 Every frame and embed kind today

| Kind | Where it lives | Origin, sandbox | What it reaches today | Under the design |
|---|---|---|---|---|
| Reading view | app page iframe of the note's preview document | `clew-preview://vault`, unsandboxed | every vault file (same origin); note scripts; the note API by postMessage (per-vault `noteApi` gate) | unchanged; its parent's origin changes (still cross-origin); the app page's re-fetch of it needs the new ACAO |
| Live block frames, link preview, preview pane | app page iframes of block documents | same | same | unchanged; POSTs carry the token (§1, built) |
| Canvas tab | app page: note cards (preview documents), PDF (EmbedPDF page), Excalidraw page, live office, images and media, text cards and portals (fragment POSTs) | same, unsandboxed; web cards are `<webview>` in their own partition | same | unchanged |
| Canvas embed in a note | a scene inside the preview document: text cards (fragment POSTs), nested note frames (`?cdepth`), web cards | same; web cards `sandbox="allow-scripts allow-same-origin …"`, i.e. the remote site's own origin | same; web cards reach nothing of Clew's | unchanged; cards ask for the token (§1, built) |
| Excalidraw | `__clew_assets__/clewex/page.html`, in tabs, canvas nodes and note embeds | preview origin | its drawing, saved through the app page's bridge | unchanged; the bridge gains origin checks (§2.8) |
| EmbedPDF | `pdf-page.html` (tabs, canvas nodes); in-document in note embeds | preview origin | its PDF, saved through `PDF_WRITE` | unchanged; same |
| Office (ZetaOffice) | the dock's iframe in the app page; live embeds in preview documents; the thumbnail window | preview origin | its document, saved through `OFFICE_WRITE`; posts to `window.top` | unchanged; `window.top` becomes `clew-app://app`, still `'*'` until §2.8 |
| `@reveal` vault deck | iframe to `clew-preview://vault/<sid>/…/index.html` | preview origin, unsandboxed by design | every vault file; its parent's DOM and `window.clew` | unchanged |
| `@reveal` remote deck | iframe to an http(s) URL | the site's own | nothing of Clew's | unchanged |
| Raw `<iframe>` in a note, vault HTML | relative `src` → `clew-preview://vault/<sid>/…` | preview origin, unsandboxed unless the author adds it | every vault file; `window.parent.clew`; the parent's DOM | unchanged |
| Raw `<iframe>` in a note, remote | an http(s) URL | the site's own | nothing of Clew's | unchanged |
| Raw `<iframe>` the author SANDBOXED (no `allow-same-origin`), or a sandboxed `srcdoc` | as written | `null` | assume the worst: CORS reads of vault files (fetch, module scripts, web fonts) as well as plain loads | **plain loads unchanged (`<img>`, classic `<script>`, stylesheets, navigation); CORS reads REFUSED** — the gap §2 closes |
| `header-html` banner (Note Headers, a demo-vault plugin) | iframe behind the title | `sandbox="allow-scripts"` → `null` today | as the row above | **the owner's decision: full vault access.** The plugin gives the banner `allow-scripts allow-same-origin` — a same-origin vault page with the note's own reach, what `@reveal` vault decks and plain vault iframes already are. It sits inside §4: in a RESTRICTED vault every vault HTML document is served with `script-src 'none'` (§4.4), so a banner draws (HTML, CSS, CSS animation) and runs nothing; in a trusted vault it runs as the note does. The demo's `matrix-rain.html` is unaffected either way |
| Plugin app surface | a classic script in the APP page (`__clew_plugin_app__`) | the app page's | everything the app page has | unchanged, except storage it kept under `file://` (§2.10) |
| Plugin preview surface, vault scripts, note scripts | scripts inside preview documents | preview origin | as the reading view | unchanged; a script that posted to the render endpoints itself (none known, never documented) needs the token — it can ask as the client does |
| `dataviewjs` | the render worker, not a frame | — | the vault model | unchanged |
| Print view, office thumbnails | hidden windows, top-level preview documents | preview origin | as the reading view | unchanged |
| Site export | static files | — | — | unchanged |

**On iOS** (the iOS session's corrections): canvas web cards are
`<iframe sandbox="allow-scripts allow-same-origin allow-forms"
referrerpolicy="no-referrer">` — the remote site's own origin, a DIRECT
child of the app page (the app document's `frame-src` allows http(s) for
them); they reach nothing of Clew's by reads, and after step 0 nothing by
messages either. EmbedPDF is `pdf-page.html` everywhere, note embeds and
canvas scenes included (no in-document viewer). There is no ZetaOffice: the
office dock and embeds are Quick Look thumbnails (`<img>`), and
`OFFICE_WRITE` answers "not available". The print view is a hidden
WKWebView with the preview document top-level; Quick Look renders office
thumbnails natively. App settings live in localStorage under
`clew-app://app` (the shim), which (c) does not touch.

### 3.3 Confirmed: the token breaks nothing documented

Only Clew's own UI code posts to `__clew_fragment__` / `__clew_block__`
(canvas cards and portals, the floating panes, live block frames, canvas
scenes); no plugin API or note API path reaches them, no demo-vault script
or plugin does, and the manual never documented them.

### 3.4 What is lost, and the ways back

1. **Null-origin frames lose vault reads** (author-sandboxed iframes). That
   loss IS the fix; without it a
   sandboxed frame can read the vault. Ways back, per case: drop the
   sandbox (the frame becomes a same-origin vault page with the note's own
   trust — what `@reveal` decks and plain vault iframes already are);
   inline the assets; or, later, a bridge app with a declared read grant.
2. **A third-party app-surface plugin's localStorage/IndexedDB** starts
   empty once (§2.10: not copied — the owner's decision; the release notes
   say so).
3. **A frame that is not on the preview origin, or not the window a
   listener expects, is no longer heard** (§2.8 step 0, built): a remote or
   sandboxed frame posting Clew's own message shapes to `window.top`, or a
   child posting host messages to its parent. Nothing documented does this;
   it is how an untrusted frame would act. Vault HTML on the preview origin
   posting to `window.top` is still heard by the bridges (vault content,
   trusted by design).

For a vault HTML app that WANTS the bridge's isolation later, the way in is
a compatibility shim inside the app frame that presents `window.clew` over
the port, so code written against `window.parent.clew` keeps working —
opt-in, never automatic.

## 4. Vault code and trust: asked once per vault, per device

Status: the owner's DECISION (2026-09-30), designed here for approval.
Design only.

### 4.1 What runs a vault's code today

On both platforms, read from the code (Clew-boss and the iOS session
confirmed it):

- `.clew/scripts/*.js` are injected into EVERY preview, ungated.
- Notes run their own code: inline `<script>`, `Script:` metadata, the
  engine's ```` ```script ```` blocks, custom elements a note defines.
- Vault plugins (`.clew/plugins/<id>`, which SHADOW a global plugin of the
  same id) are enabled by the vault's own `vault-settings.json`, which
  travels with it: engine surfaces run in the render worker (Node,
  network), preview surfaces in previews, app surfaces in the APP PAGE with
  IPC (on iOS, in the one frame the native bridge answers).
- `dataviewJs` (the render worker: the vault's text, and the network) and
  the Note API's `noteApi` gate are flags in that same file.
- **A note makes the ENGINE run code, at render time** — the most severe
  path (the iOS session's finding; audited in the vendored engine,
  2026-09-30). The render worker is a plain Node process on desktop (full
  `fs`, `child_process`), so a note in a vault someone sends you runs
  arbitrary code on the machine the first time it renders:
  - metadata keys that load and run a vault file: `Load javascript:`
    (`runInThisContext`), `Load extensions:`, `Load directives:`,
    `Load environments:` (dynamic `import()` from the note's folder)
    (`metadata-header.js`), and `Extension …` keys, which define
    extensions from the header's own text;
  - note-authored code evaluated by extensions: function and script
    blocks (`function-extensions.js`, `script-blocks.js`), inline
    function expressions (`inline-function-extension.js`), mathjs
    expressions (`mathjs-extension.js`);
  - Mathematica blocks, handed to `wolframscript` (`mathematica.js`) where
    it is installed.
  (The engine's config cascade at RENDER is the home directory and the
  worker's working directory — Clew's own engine folder — so a vault's
  `.jmarkdown/config.json` is not read there.)
- Exports run with the note's directory as their working directory, so a
  `.jmarkdown/config.json` inside the vault can load engine extensions.
- Previews carry no CSP, so any of it can `fetch()` vault content anywhere.

So opening a vault someone sent you runs their code, before any bridge
exists. (The shell panel is not in this list: it is the user's own shell.)

### 4.2 The rule

- **Per vault, per device.** On a device's first open of a vault, every
  path in §4.1 starts OFF — restricted mode — and Clew asks once.
- **The decision and every enablement live ON THE DEVICE** (userData
  `vault-trust.json`; iOS: a native JSON in Application Support, reached
  over the bridge, never localStorage), keyed by a device-side vault
  identity (§4.3), never in the vault.
- **The vault may only ASK.** The keys `vault-settings.json` carries today
  (`plugins`, `noteApi`, `dataviewJs`) are read as a REQUEST list the
  prompt shows, never as grants; changing a request never changes a grant.

### 4.3 The device-side vault identity

- Never chosen by the vault: an id stored inside it would let a crafted
  vault claim another vault's trust.
- Desktop: the root's realpath, with a fingerprint checked on open (the
  root directory's device, inode and birth time), so a different vault
  unpacked at a trusted vault's path asks again. A moved or renamed vault
  asks again, once.
- iOS: no absolute paths (the container path changes on every install,
  measured): the container-relative path for a vault in Documents; the
  security-scoped bookmark's provider-relative path for a vault in Files.
- The bridge's app keys (§7) derive from this identity too, so an app's
  origin — and its storage and grants — survive updates.

### 4.4 What a restricted vault still does

Everything that is Clew's own code over the vault's data works: rendering
(the engine under Clew's generated config), maths, mermaid, TikZ, MetaPost
and LaTeX figures, callouts, citations, cross-references; maps, PDFs (view
and annotate), Excalidraw, office documents, canvases, embeds; ```query /
```tasks / ```kanban, Dataview DQL and Bases (Clew's own parser, not eval),
with editable cells and kanban drags; editing in every mode, search, the
graph, backlinks, file operations, the shell panel; and the user's own
global plugins where the user enabled them for this vault (§4.7).

What does not run: vault scripts; a note's inline scripts, `Script:`
files, ```` ```script ```` blocks and custom elements; vault plugins;
```dataviewjs (refused BY NAME in place: "this vault's code is off —
Trust…"); the Note API. **App frames are not on this list (R1)**: they run
in a restricted vault too, each behind its own prompt, isolated by their
own origin and CSP rather than by the vault's trust (§7).

How, in two layers:

- **Nothing is served**: no vault scripts or vault preview surfaces
  injected (`protocol.js`), no vault engine surfaces in the worker's config,
  `CLEW_DATAVIEW_JS` off.
- **The engine runs no note code**: one config switch in the jmarkdown
  ENGINE (the master, then re-synced — `"Run note code": false`, say),
  which Clew's generated config sets for a restricted vault, and which
  every path in §4.1's engine list honours — the four `Load …` keys,
  `Extension …` keys, function/script blocks, inline functions, mathjs,
  Mathematica — each REFUSED BY NAME in place ("this vault's code is off —
  Trust…"), never skipped silently. Engine-side, because stripping header
  keys in Clew is fragile (inclusions, casing, new keys). **This one is
  urgent**: unlike the rest of §4 it closes an exposure that exists TODAY
  (a shared vault's note runs Node code on first render), so it can ship
  ahead of the rest of the trust work — the switch first, defaulting to
  today's behaviour, then Clew setting it.
- **Nothing inline runs**: a restricted vault's previews carry a CSP whose
  `script-src` names only Clew's own script URLs (`/__clew_preview__/`,
  `/__clew_assets__/`, enabled GLOBAL plugins under
  `__clew_plugin_file__`) plus a hash for the template's one inline script
  (the MathJax configuration), and no `'unsafe-inline'` — so a note's
  `<script>` and its `onclick=` attributes do not execute. Every engine
  feature that emits inline script is inventoried at build: the
  vault-authored ones are exactly what restricted mode blocks; engine
  boilerplate, if any, is allowed by hash.

- **Exports use the user's own configuration only**: a restricted vault's
  HTML and LaTeX exports run the engine with a working directory OUTSIDE
  the vault, so its config cascade sees only the user's global
  `~/.jmarkdown` and never a vault's `.jmarkdown/config.json` (which can
  load engine extensions — code); relative paths still resolve against
  the note's own folder (to verify at build). Trusted, exports behave as
  today. (iOS has no HTML/LaTeX/site export; its one export prints the
  reading view, which inherits restricted rendering and the preview CSP.)
- **Vault HTML runs nothing either**: every vault `.html` document Clew
  serves ON THE PREVIEW ORIGIN in a restricted vault — a `header-html`
  banner, a vault iframe, a `@reveal` deck from the vault — carries
  `script-src 'none'` as a response HEADER: it draws, it does not run. An
  app's files served on ITS OWN origin by the `clew-frame` handler (§7) do
  not get it (R1): the app's scripts are the point, and what contains them
  is the origin, the sandbox and the app CSP (§7), not the vault's trust.
  The same files loaded as plain vault HTML (`<iframe src="Apps/Timer/
  index.html">`) are on the preview origin and DO get it — the preview
  handler's rule never looks at whether a folder holds a manifest.
  (Measured on iOS: WebKit honours a CSP on WKURLSchemeHandler responses
  in both forms, header and meta, blocking inline and external scripts;
  SchemeHandler serves raw vault HTML untouched, so the header is the
  form. On iOS the trust store is native and SchemeHandler itself does the
  injecting, so the gate reads the store directly.)

A TRUSTED vault's previews and vault HTML carry no `script-src`
restriction: they behave as today (§4.10).

### 4.5 The prompt

- **When**: the first open of a vault on this device that CONTAINS
  something that would run. A vault with no scripts, plugins, script
  blocks or requests never asks — there is nothing to trust. The count comes
  from the tree (`.clew/scripts`, `.clew/plugins`) and the indexer (notes
  with scripts or ```dataviewjs). Apps do not count (R1): they never need
  the vault's trust, so a vault whose only code is apps never asks, and its
  apps ask for themselves (§9).
- **What**: a sheet drawn by the app page (never inside a preview, where
  vault content could imitate it): "This vault contains code: 3 scripts,
  2 plugins (Charts, Header), 14 notes with scripts. It asks for the Note
  API. A vault's code can read every note. Trust this vault on this Mac?
  [Trust] [Keep restricted]", a Details disclosure naming the files, and —
  only when the vault asks for it — "Let its scripts reach the internet"
  (off by default, §4.9).
- **Keep restricted**: a quiet indicator ("Restricted · Trust…") in the
  status bar, and a placeholder wherever code would have run.
- **iPad**: the same sheet in the VISUAL viewport (a long note or the
  keyboard must not hide it), 44 pt targets, full screen on compact width.

### 4.6 Managing and revoking

- Settings → This vault → Trust: trusted on this device (a switch), and
  the per-vault enablements — vault scripts, plugins, the Note API,
  `dataviewJs`, network, apps and their grants — each on the device.
- Settings → Trusted vaults (a section of its own: Settings has no General
  section): every vault this device has decided about, to trust, revoke or
  forget.
- Revoking reloads the vault in restricted mode: previews re-render, app
  ports close.

### 4.7 Global plugins

The user installed them (userData): they are the user's code, not the
vault's. Their per-vault ENABLE moves to the device and is NOT gated by
trust — a restricted vault can use the user's own global plugins where the
user switched them on for it; a vault's request to enable one is shown in
the prompt and honoured only with a yes. A vault plugin of the same id
shadows the global one only when the vault is trusted. Tier 2 (§11) keeps
its own userData switch on top.

### 4.8 Migration: the owner's existing vaults

On the first launch after the change, every vault this device already
knows (`openVaults` and `recentVaults`) is recorded as TRUSTED, and the
enablements its `vault-settings.json` holds are copied into the device
store — this device has already run that code, so nothing changes for the
user: zero clicks. A one-time notice says what changed and where Trusted
vaults live. The demo vault (Clew's own, copied from the app bundle) is
trusted by construction. iOS does the same for the vaults in its list.
Updates never ask again, because the identity (§4.3) survives them.

### 4.9 Network: a CSP for previews

- Every preview-origin HTML document Clew serves gets `connect-src 'self'
  blob: data:` and `form-action 'none'` (plus `worker-src 'self' blob:`):
  no `fetch`, XHR, WebSocket, EventSource or beacon to another host, and no
  form posted off the machine.
- Left open, because features need them: `img-src` (remote images, map
  tiles — Leaflet loads tiles as images), `media-src`, `frame-src` (remote
  iframes, `@reveal` decks, canvas web cards), `style-src`/`font-src` (a
  note's own stylesheet links).
- Clew's own preview features use no remote `fetch` (EmbedPDF, MathJax,
  mermaid, mp-tikz, ZetaOffice and Excalidraw assets are all local) — to be
  proved at build by running the protocol tour and the sweep under the CSP
  with zero violations.
- A device-side "Allow network" per vault (trusted vaults only) lifts
  `connect-src` to any host.
- The residual, said plainly: a trusted script can still leak data in the
  URL of an image or a frame it loads; closing that would break remote
  images and maps. The CSP stops the easy path (posting vault content to a
  server), not a determined script the user chose to trust. The render
  worker (`dataviewJs`, engine surfaces) has Node's network, which no CSP
  reaches: trust is its only gate.

### 4.9b Links out of a restricted vault (2026-10-03)

Clew-iOS found, in shipped iOS builds, that its preview scheme followed a
vault's symlink OUT of the vault (a lexical clamp, not realpath): a link to
the app's preferences was served. Desktop now holds the rule R1 gave Tier-1
reads for EVERY reader: in a vault this device has not trusted, a path is
the vault's only when its realpath is inside the root's (missing or
dangling: outside) — the preview handler (403, `X-Clew-Refused:
leaves-vault`), the tree walk and watcher, the index (and so search,
backlinks and app queries), the .bib scan, the canvas rename walk, site
export, and the render worker's extensions (an embed says "this link
leaves the vault" in place). A trusted vault's links are followed as
before — the owner's vaults use 68 of them. `engine/vault-bounds.js`;
`smoke/symlink-scenario.js`.

### 4.9a As built (phase 1, desktop, 2026-10-02)

- The device store (`main/vault-trust.js`, version 2) keeps per vault
  `trusted`, `decided` and `enable` {scripts, plugins, noteApi, dataviewJs,
  network}; the vault's settings keys are its request
  (`main/vault-requests.js`). A legacy entry (the interim guard's) copies its
  vault's enablements on first sight, network ON — a dry run over a copy of
  the owner's real store gave all nine known vaults exactly what they had.
- One `session.access` drives everything; the CSP is `main/preview-csp.js`
  as a response header, the template's inline scripts allowed by hashes
  read off a render of an empty document. A trusted vault WITH the network
  gets no CSP at all — the migrated vaults' documents are byte-identical
  (render dump, with and without their own `.clew`).
- A trust change, and the scripts and network switches, reload the window
  behind the close question (`session.askToReload`).
- **§4.9's claim was not quite true**: EmbedPDF's stamp plugin fetches its
  default stamp library from `cdn.jsdelivr.net/npm/@embedpdf/default-stamps/
  …/manifest.json` whenever a viewer opens. In a note (restricted, or
  trusted without the network) the CSP now blocks it and the in-note viewer
  has no default stamps; viewers in tabs (`pdf-page.html`, no CSP) and the
  migrated vaults still fetch it. The owner chose to vendor them (2026-10-02):
  `vendor/default-stamps` (MIT, a committed copy — not an npm install, which
  would have reconciled an out-of-step lockfile), served at
  `__clew_assets__/stamps`, `pdf-core.js` points `stamp.manifests` there:
  every viewer has its 17 default stamps and makes no outbound request
  (`smoke/pdf-stamps-scenario.js` with `CLEW_SMOKE_NET_LOG=1`). The rest of
  the bundle's remote URLs were checked: Google Fonts (UI and signature
  faces) and the jsdelivr pdfium.wasm and font packages are all already
  overridden by pdf-core.js (`fonts: null`, a local `wasmUrl`, a local
  `fontFallback`) — the stamps manifest was the one left.
- Scenarios whose fixture relied on a note's own script running (canvas-esc's
  Esc owner, the deliberate PDF leak) now open their fixture as a KNOWN vault.

### 4.10 Compatibility, once trusted

A trusted vault behaves as today (§3), with one difference: its scripts
cannot reach another host with `fetch()` until its network switch is on.
A restricted vault shows placeholders where code would have run, and
nothing else in §3.2 changes.

## 5. The bridge: what it is for

Notes can embed custom apps — a timer, a flashcard drill, a chart editor, a
data-entry form — as HTML in an iframe, and those apps want to reach into
Clew: read the note they sit in, keep their own state, write back, open a
link. The bridge gives them ONE way to do that, in two tiers (the owner's
stated preference over sanitised native embeds, HANDOVER §1):

- **Tier 1, the default**: the Note API (`renderer/note-api.js`) extended
  to embedded apps with a per-app identity and per-app grants. No Node, no
  `.clew/`, nothing a shared vault could turn into code execution.
- **Tier 2, for power users**: Node, reached only through a user-installed
  plugin, desktop only, off by default.

What an app frame is NOT: a note's own scripts, vault scripts
(`.clew/scripts`), preview plugins, and plain vault HTML in an iframe all
keep what they have today (§3) — vault content at the vault's own trust,
same-origin with the preview. The bridge is an opt-in embed kind; nothing
becomes an app by being detected.

## 6. Threat model

What is protected: the vault's contents (reads) and integrity (writes);
the trust-bearing files that turn into code (`.clew/plugins`,
`.clew/scripts`, `vault-settings.json`) and everything in userData (grants,
global plugins, settings); Node, i.e. the machine; the user's attention
(a frame drawing a fake Clew dialog); other apps' data.

- **A malicious shared vault.** Someone sends a vault; opening it must
  grant NOTHING — no Node, no write to anything trust-bearing, no grant.
  A vault can only ASK: its app manifests request capabilities, and the
  user grants them on this machine (grants live in userData, never in the
  vault — §9). Today a vault's code already runs on open (§4.1): the
  owner's decision puts all of it behind one per-device question (§4).
- **A malicious vault's APP, in a vault left restricted (R1).** The case
  R1 creates: the vault is not trusted, yet its app's code runs. What
  contains it, in layers: its own origin (`clew-frame://<key>`, §7), so no
  same-origin path to the preview, the app page or another app; the sandbox
  (`allow-scripts allow-same-origin allow-forms` — no top navigation,
  popups, downloads or modal dialogs); navigation pinned to its own origin
  (§7); no session id (it is never served under `/<sid>/`, and its frame
  carries `referrerpolicy="no-referrer"`); no caller token; no ACAO for its
  origin on `clew-preview://` (§2.6), so it cannot READ vault files even
  with a URL; the app CSP (R2, §7) for the network; and, in a restricted
  vault, it does not load until the user has answered its prompt (§7).
  - **With no grants** it can compute and draw inside its frame, read its
    OWN folder (files the vault already holds — nothing new), and keep
    origin storage on this device that only it can read. It can draw a
    convincing fake Clew dialog inside its rectangle — a phishing surface —
    but anything typed into it has nowhere to go: no network (R2), no
    write, no navigation off its origin. It can spin a CPU: on desktop
    site isolation confines that to its own process; on iPad it freezes
    Clew (§6, denial of service), which is one reason a restricted vault's
    app waits for its prompt before it loads.
  - **With "read this note"** (`note.read`) it can also read the embedding
    note's text — the vault's own text, which the vault's author already
    has. On its own that grant is safe ONLY because nothing can leave: so
    the outbound channels matter more here than anywhere else. R2's
    `connect-src 'self'` closes fetch, XHR, WebSocket, EventSource and
    beacons; the residual R2 states (an image or frame URL carrying the
    text out) is closed for apps by the recommended `default-src 'self'`
    (§7, open choice A). What stays open even then, said plainly: WebRTC's
    ICE requests (STUN/TURN), which no CSP governs in Chromium or WebKit,
    and a few bytes per hostname lookup through DNS hints (the handler
    sends `X-DNS-Prefetch-Control: off`). Closing WebRTC needs an engine
    switch (desktop: a WebRTC IP-handling policy on the window, to be
    measured in phase 3; iOS to look at its options).
  - **With `app.kv` / `app.files`** whatever it learns or is told can be
    written into data that TRAVELS with the vault (`clewdata.json`,
    `<app>/data/`) — back to its author if the vault syncs both ways. Within
    this vault that discloses nothing the author could not read anyway
    (Tier-1 reads never leave the vault, below), but what the USER types
    into the app can travel. The prompt says so for a restricted vault
    (§9).
  - **`notes.read` never leaves the vault, by realpath.** Clew follows a
    vault's symlinks (CLAUDE.md), and a vault someone sends can carry one
    pointing at the home directory. In a RESTRICTED vault every Tier-1 read
    is clamped to the vault root by realpath (a link out of the vault reads
    as `not-found`), as are `.clew/` and the trust-bearing files always; in
    a trusted vault the user's trust covers its links, as Clew's own walks
    do. The app's own folder is always clamped (§7).
  - **Never in a restricted vault**: Tier 2 (§11) — the hello answers
    `tier2: false` and `node:*` is not offered; the vault-wide network
    switch (§4.9), which is for trusted vaults; and anything the vault's
    trust would unlock (vault scripts, plugins, note code, the Note API for
    NOTES). An app's capabilities are its own and never add up to the
    vault's.
- **A compromised remote frame.** An https page a note embeds, or an app
  that loads a third-party script. It can post to any window it can reach
  (`window.top`, its parent). It gets no bridge unless the user granted its
  ORIGIN explicitly; everything else that listens is closed to it by §2.8
  step 0 (built).
- **An app seeking escalation.** A granted app asking for more: writing
  under `.clew/` (never Tier 1 — that is Tier 2 by definition), running
  arbitrary commands, reading beyond its grants, claiming another app's
  identity, keeping a port after revocation, flooding the host. Answers:
  identity is the frame's ORIGIN, issued by Clew's own scheme handler
  (§7); every method checks the grant at call time; revocation closes the
  port; size and rate limits (§8).
- **A confused deputy.** The host doing, with its own authority, what an
  app merely named: a path outside what the user meant (writes are text
  types, inside the vault, never `.clew/`, and `notes.create` never
  overwrites); the Note API's `command` method (runs ANY command — not in
  Tier 1); `open` of an external target (the existing external-link rules
  and `main/open-file.js#planOpen` refusals apply, executables refused by
  name); a write racing the user's own editing (writes go through the
  editor pool, §10).

- **Denial of service.** An app frame can freeze or crash what it runs
  in. On desktop, Chromium's site isolation puts a `clew-frame` origin in
  its own renderer process, so a runaway app costs its frame. On iOS 18
  WKWebView has NO site isolation: every app frame runs on the app page's
  web-content process and main thread, so a tight loop freezes Clew and a
  runaway allocation gets the content process killed (the app page
  reloads), and no port-level kill switch can pre-empt a busy thread (the
  iOS session's point). Mitigations, not a cure: app frames count against
  the live-frame cap (8 on iOS), and an app frame scrolled far off screen
  is unloaded.

Out of scope, stated: code the VAULT runs at the vault's trust (note
scripts, vault scripts, preview plugins) — it is same-origin with the
preview by design, and the bridge does not try to contain it; and the
machine itself (malware already running).

## 7. App frames: where they live and who they are

- **The embed, `@app[…]`** (the owner's choice), modelled on `@reveal`
  (`engine/reveal-embed.js`): ONE named environment in the config serves
  all three shapes — `@app[Apps/Timer]` inline, `@app+[Apps/Timer]` block,
  and `@begin(app)` … `@end(app)`:

      @app[Apps/Timer]
      @app+[Apps/Flashcards]{height=480px}
      @app+[Apps/Chart]{width=80% aspect="16/9" style="margin: 1em auto"}

  The target is a vault FOLDER holding `clew-app.json` (the manifest: `id`,
  `name`, `version`, `entry`, `capabilities`) and the app's files. Options:
  `width`, `height` (a bare number is px), `aspect`, `style`, `class`, and
  `pin=top|bottom` (2026-10-04, `shared/app-pin.js`: held at that edge of
  the pane while its place is out of view there — `position: sticky`'s
  rule, done by style on the HOISTED holder in reading view and on the
  frame in live edit, so the frame never moves or reloads). The
  engine's attribute grammar severs unquoted units and throws on a bare
  slash, so the handler reuses reveal-embed's repair (units glued back;
  anything with a slash quoted — `aspect="16/9"`, and the manual says so).
  Refused BY NAME, in place of the frame: a path that is not a folder, a
  folder without `clew-app.json`, a manifest that does not parse, a path
  outside the vault, and — until phase 5 — an http(s) URL ("remote apps
  are not supported yet"). Obsidian shows `@app[…]` as text, as it does
  `@reveal[…]`.
- **Its own origin**: served at `clew-frame://<key>/…` — a scheme of its
  own, registered in the same one `registerSchemesAsPrivileged` call
  (`standard`, `secure`, `supportFetchAPI`, `corsEnabled`, `stream`), whose
  handler serves ONLY the app's folder (realpath clamp, read-only), never
  `/<sid>/` and never another app's files. `<key>` is derived by Clew from
  the device-side vault identity (§4.3 — no absolute paths on iOS, where
  the container moves on every install) and **the manifest's `id` (R3)**:
  a hash of the two, written as a DNS label (lowercase hex, at most 63
  characters). Two vaults' apps never share an origin, even with the same
  manifest id; an app keeps its origin — its storage and its grants —
  across updates AND across a move or rename of its folder.
- **Why the manifest id, not the folder path (R3)** — the recommendation,
  over keeping the path and stating the loss:
  - It is what a user expects: moving `Apps/Timer` to `Tools/Timer`, or
    renaming it, is the same app, and should not ask again or forget its
    state.
  - It is what the data already does: `app.kv` lives under `apps/<id>/` in
    `clewdata.json` (§9), and `app.files` inside the folder, so both
    survive a move whatever the key is. A path key would leave the app's
    ORIGIN storage and grants behind while its kv data and files came
    along — one app with two identities.
  - It is no weaker: the vault controls an app's code under either key
    (an app updated in place keeps its origin and grants either way), and
    the vault identity in the hash keeps every vault's apps apart, so a
    vault can only ever claim its OWN apps' ids.
  - The cost: **two folders in one vault with the same `id` are BOTH
    refused, by name**, in place of each frame — "two apps in this vault
    say they are `timer`: Apps/Timer, Old/Timer — give one a new id" —
    never "the first one wins", which would let a folder take over another
    app's grants and storage by sorting earlier. Duplicating an app folder
    to experiment means editing its id; the refusal says so. The id
    grammar: 1–64 characters of `a-z 0-9 . _ -`, starting with a letter or
    digit; anything else refuses the manifest by name. The ids are found
    by the indexer (it already walks every file; `clew-app.json` is a
    name it knows), so the duplicate check costs no walk of its own.
  - What still loses the origin: the VAULT moving (§4.3 asks again, once,
    and its identity is new) — the same for both keys.
- **Its CSP (R2)**: every document the `clew-frame` handler serves carries
  a CSP header, and an app's network is OFF by default:
  `connect-src 'self'` (fetch, XHR, WebSocket, EventSource, beacons) and
  `form-action 'none'`, which is R2 as accepted. **Recommended on top
  (open choice A)**: since apps are a new embed kind with nothing to stay
  compatible with, the whole fetch family is `'self'` too —
  `default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'
  'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline';
  form-action 'none'; base-uri 'self'` — which closes R2's stated residual
  (image, frame, font and stylesheet URLs) for an app nobody granted the
  network. Inline script and eval are allowed because the app's own code
  is the point (frameworks use both); the CSP is about where data goes,
  not what runs. Without choice A, the residual is §4.9's, said the same
  way: an app can leak what it holds in the URL of an image or a frame.
- **`network` (R2)**: a capability that lifts that default, declared in
  the manifest and granted per app per vault like the rest (§9): bare,
  for any host — the prompt says "send data to the internet"; or scoped,
  `"network": ["https://api.example.com"]`, for those origins only —
  "send data to api.example.com". The handler builds the CSP from the
  grant when it SERVES the document, so a grant or a revocation reloads
  the app's frames (their ports close first, §9); `network` lifts the
  same directives choice A restricted, to the granted origins.
- **Navigation is pinned to its own origin**: an app frame may navigate
  only within `clew-frame://<key>/` — a `will-frame-navigate` guard on
  desktop, the navigation policy on iOS — because a frame navigating
  itself to `https://…?<data>` is an outbound channel no CSP closes (CSP
  has no navigation directive). The sandbox already denies top navigation
  and popups.
- **In a restricted vault (R1)**: the app frame is NOT loaded until the
  user has answered its prompt — the embed shows a placeholder with the
  prompt over it, naming the vault as restricted (§9) — even for an app
  that asks for nothing ("…wants to run here"); a "Don't allow" keeps the
  placeholder and is remembered like a grant. In a trusted vault the frame
  loads at once and only capabilities wait for the prompt, as below. This
  is my reading of "each behind its own grant prompt", and it is also the
  iPad's denial-of-service mitigation (§6): nothing from an untrusted vault
  spins a thread before the user says yes. Being its own origin answers "how
  does an isolated app read its own files": same-origin, like any web page
  reads its own; what it cannot do is read the VAULT (a different origin,
  no ACAO for it — §2.6), which it asks for through the bridge.
- **The frame element**: created by the preview client inside the note's
  flow, `sandbox="allow-scripts allow-same-origin allow-forms"` — safe with
  `allow-same-origin` because the origin is NOT the parent's — which still
  denies top navigation, popups, downloads and modal dialogs; and
  `referrerpolicy="no-referrer"`, so the parent's URL (which carries the
  session id) never reaches it, whatever the scheme's default policy.
- **Identity**: the app page is the host (never the preview document,
  which is vault content and the app's parent). The app's injected bridge
  client (`clew-bridge.js`, served by the `clew-frame` handler the way
  `api.js` is injected into previews) posts `{hello, v: [1]}` to
  `window.top`; the app page, seeing `event.origin` =
  `clew-frame://<key>` — unforgeable, only Clew's handler serves it —
  knows WHICH app; it finds WHERE by walking `event.source.parent` to the
  view that holds it (the office dock's `#tabForEmbed` walk), which gives
  the note path; and it answers with a fresh `MessageChannel` port,
  transferred to `event.source` with targetOrigin `clew-frame://<key>`.
  From then on the port IS the embed: one port per frame instance, the
  capability checks keyed on (app, note). The preview document never sees
  the port (a transfer targeted at the child's origin), and cannot create
  a document on the app's origin.

## 8. The protocol

- Over the port, JSON-clonable messages. Request `{v: 1, id, method,
  params}`; answer `{v: 1, id, ok: true, result}` or `{v: 1, id, ok: false,
  error: {code, message}}`; event `{v: 1, event, payload}` (note changed,
  theme, grant changed, find requests).
- Versioning: `hello` offers the versions the client speaks; the host's
  reply names the one chosen and the GRANTED capabilities, plus `tier2:
  false|<plugin ids>` — capability detection, so an app degrades rather
  than failing (and iOS answers `tier2: false`).
- Error codes: `denied` (not granted, or revoked), `unknown-method`,
  `bad-params`, `too-large`, `rate-limited`, `not-found`, `conflict` (an
  editor conflict the user must resolve), `unavailable` (e.g. Tier 2 on
  iOS), `internal`.
- Limits, per port: a request of at most 1 MB serialised (a note larger
  than the live-edit ceiling, 500 KB, is read whole but written through the
  pool only); at most 32 requests in flight; a token bucket of 50
  requests/s (burst 200), writes 5/s; beyond them `rate-limited`, and a port
  that keeps flooding is closed and shown as such.
- The client exposes `window.clew` in the app with the Note API's names
  (`clew.notes.read(…)`), `clew.ready` (the hello), `clew.can(cap)`.

## 9. Capabilities, grants, revocation

**Tier 1, v1**, each a named capability over the Note API's own methods
(one dispatcher: `handleApiRequest` gains a caller `{kind: 'app', app,
sourcePath, grants}` beside today's `{kind: 'note', sourcePath}`, and each
method names the capability it needs):

| Capability | Methods | Notes |
|---|---|---|
| (always) | `context`, theme events | the note path and theme; nothing else |
| `note.read` | `notes.read`, `properties.get` on the EMBEDDING note | |
| `notes.read` | the same on any note or text file | |
| `query` | `notes.list`, `search`, `index.get`, `index.backlinks` | |
| `app.kv` | `kv.*` in the app's OWN namespace (`apps/<id>/…` in `clewdata.json`) — small state | travels with the vault, visibly |
| `app.files` | `files.list/read/write/delete/mkdir` inside the app's OWN data folder — below | binary allowed |
| `note.write` | edits to the embedding note, through the editor pool | §10 |
| `notes.write` | the same on other notes | |
| `notes.create` | new notes; never overwrites | |
| `links.open` | `open` on internal targets; external ones through the existing rules | |
| `find` | find both ways: Clew's find reaches the app's text (the app answers find requests); the app asks Clew to find in the note | |
| `clipboard` | copy across the boundary: the host writes the app's text to the clipboard, and hands a paste to the app | |
| `editor.insert` | insert at the note editor's cursor, through the pool | |
| `network` (R2) | none — it changes the app's CSP (§7): bare, any host; or a list of origins | prompt: "send data to the internet" / "…to api.example.com" |

On iOS the clipboard goes through native `UIPasteboard` over the bridge
(WebKit ties `navigator.clipboard` writes to a user activation that the
message hop loses), and a paste reaches an app only from a paste gesture in
Clew's own UI — a programmatic pasteboard read raises iOS's paste alert
every time.

Never in Tier 1: `command` (arbitrary commands), any path under `.clew/`,
settings, plugins, binary writes, the OS opener beyond the external-link
rules, Node.

- **App files** (`app.files`, the owner's "both"): an app's files live in
  `data/` INSIDE its own folder (`Apps/Timer/data/`) — they travel with the
  app (copying the folder copies the app and its data), and the app READS
  them same-origin (its `clew-frame://` origin serves its folder), so only
  writes cross the bridge. Paths are relative to `data/` and clamped to it
  (realpath); the app's code outside `data/` is never writable by the app;
  never `.clew/`; no note types (`.md`, `.jmd`, `.canvas`, `.base` —
  notes are `notes.create`/`notes.write`, their own grants), so the index
  never sees app data as notes. Binary goes over the port as an
  `ArrayBuffer` (transferred, not copied). Limits: 25 MB a file, 250 MB an
  app on desktop. Granted like any capability — declared in the manifest,
  asked once per app per vault. Writes are atomic; names starting `.` are
  refused; the quota is checked per write.
  - **iPad** (the iOS session): WKScriptMessage bodies carry no
    ArrayBuffer, so the shim moves binaries as base64 — a 25 MB write
    would be a ~33 MB string, with copies, in the one web-content process
    that holds everything. So: 10 MB per write (a larger file as chunked
    appends of at most 4 MB, up to 25 MB), 100 MB per app; native checks
    the quota per write, through Swift's binary write path. READS stay
    same-origin from the `clew-frame` handler — no bridge — which
    MATERIALIZES a file iCloud has evicted before serving it (mid-session
    too: read as materialize-then-serve) and clamps with realpath against
    symlinks.
- **Grant UX**: the first time an app embed appears, the app page draws —
  over the frame, outside it, so the app cannot forge it — "Timer (from this
  vault) asks to: read this note, keep its own data. [Allow] [Deny]"; the
  frame gets no port until answered. A manifest asking for more later asks
  again, for the new capabilities only. Remote apps: the same, naming the
  origin, and never granted by default.
  - **In a restricted vault (R1)** the prompt names that, and comes before
    the frame loads (§7): "Timer is an app in **a vault you haven't
    trusted**. It wants to run here, and to: read this note, keep its own
    data (which travels with the vault). Its code runs apart from Clew and
    from the vault. [Allow] [Don't allow]". A request pairing a read with
    `network` is said as the pair it is: "read this note and send data to
    the internet".
- **Storage**: userData `app-grants.json`, keyed by (vault identity on this
  machine, manifest id — R3) → capabilities, granted when, and the folder
  it was granted at (shown in Settings, never part of the key). Never in
  the vault; a vault sent to someone arrives with no grants.
- **Visible and revocable**: Settings → This vault → Apps lists each app,
  its grants and its live embeds; revoking closes every port of that app at
  once (its calls then answer `denied`). An indicator shows while an app
  with write grants holds a live port.

### 9a. As built (phase 3, the read side, desktop, 2026-10-02)

- `engine/app-embed.js` marks the place; `main/app-embeds-rewrite.js`
  resolves it as the document is served (`main/app-frames.js#resolveApp`
  refuses by name; `appKey` = sha256(vault identity, id), 40 hex);
  `main/app-registry.js` registers it for the window; `protocol.js#
  installFrameProtocol` serves the folder with the app CSP and the bridge
  client; `preview-client/app-embed.js` builds the frame on `app-run`;
  `renderer/app-host.js` prompts, hands the port, limits it, relays;
  `main/app-calls.js` decides every call; `main/app-grants.js` keeps the
  answers. The duplicate-id check reads the indexer's `appFolders`.
- The app CSP's `frame-ancestors` must name BOTH the preview origin and the
  app page's (every ancestor is checked) — the first build named only the
  preview origin and the frame was blocked.
- Found while building, and closed: in a restricted vault the INDEX
  answers (list, search, index.get, backlinks) must take the same realpath
  clamp as reads — the indexer follows symlinks, so `notes.list` named a
  file outside the vault (no content was readable).
- Choice D, measured (`smoke/app-webrtc-frame.js`): by default an app frame
  gathers 2 host/udp ICE candidates (no CSP governs WebRTC); with the
  WINDOW's IP-handling policy `disable_non_proxied_udp` it gathers none —
  the per-window setting reaches the app's out-of-process frame, so nothing
  process-wide is needed. Not set: it would also stop WebRTC in a note's
  own remote frames (a video call page), which is the owner's call.
- The demo vault carries `Apps/Flashcards` (note.read + app.kv) and
  `Guide/Apps in Notes.md`.

### 9b. As built (events and awareness, desktop, 2026-10-03)

- **`note-changed`** (§8): when the embedding note changes on disk — a
  save, a sync, another app — the app's ports that may READ it
  (`note.read`/`notes.read`) get `{event: 'note-changed', payload: {path}}`,
  at most once per 250 ms each (`app-host.js#noteChanged`, from
  `EV_FILE_CHANGED`). The demo's Flashcards re-reads its cards on it.
- **`grant-changed`** (§8): an app asking for more later, answered Allow,
  gets the new set on its LIVE ports — `{event: 'grant-changed', payload:
  {granted}}`, and the client's `clew.can()` follows — with no reload
  (`refreshGrants`). Anything taken away (a capability, the run, `network`
  either way — the CSP is fixed at load) closes the ports and reloads, as
  before; Settings → Revoke always does (it forgets the app).
- **The indicator** (§9): while an app holding `note.write`, `notes.write`,
  `notes.create` or `editor.insert` has a live port, the status bar says
  "✎ Writer can edit notes" (or "✎ 2 apps can edit notes"); a click opens
  Settings at This vault → Apps. Ports whose frame has gone are swept every
  2 s, so it goes when the note closes.
- **Live embeds in Settings** (§9): each app's row says which notes it is
  live in now, in this window (`app-host.js#liveEmbeds`; `APPS_LIST`
  carries each app's key).
- Measured: `smoke/app-bridge-scenario.js`, mode `events` — the first
  frame welcomed with `note.read` gets `grant-changed` `app.kv,note.read`
  and `clew.can('app.kv')` true without reloading; `note-changed` once for a
  save; the indicator for Writer only, gone on close.

## 10. Writes

Every write goes through the editor's save path, never around it: if the
note is open, the edit is a transaction on its pooled EditorState (undo
covers it, the dirty dot shows, auto-save writes it, a conflict banner
stops it when the disk has diverged — `conflict` to the app); if it is not,
through the same pool entry opened headless, so the same code decides. Main
snapshots the pre-write content into `.clew/history` on every write, as it
does for the user's own. Text types only, inside the vault, never `.clew/`.

**As built (phase 4, desktop, 2026-10-03).** Main authorizes each write
(`app-calls.js`: the path a text note in the vault, never hidden or
`.clew/`, realpath-clamped in a restricted vault) and answers `{ perform,
path }`; the host (`app-host.js`) makes the edit on the pooled EditorState
of the editor the user is EDITING the note in, or through a headless pool
entry that saves at once — measured: an app's append and insert land in the
open editor (dirty, then saved), one real ⌘Z takes back its last edit,
history keeps the old text, and with the note open for reading only the
write lands on disk headless and the pool entry closes. `notes.create` is
main's exclusive create (a second create answers `conflict`). Two things the
build found: a note can have SEVERAL pool entries (a split, a reading tab's
pooled editor), each its own state, so the edit must go to one — the
editing one — and reach the rest through the disk, as the user's own edits
do; and an app's frame must live outside the morph (hoisted, as office live
embeds are), or an edit above it restarts the app.

## 11. Tier 2: Node

- Only through a USER-INSTALLED plugin (the global plugins dir in
  userData — never a vault plugin) that declares a `node` surface, enabled
  per vault — and that enabling, for Node, is recorded in userData, not in
  `vault-settings.json`.
- Off by default under a global switch in userData ("Allow plugins to run
  Node for apps").
- Out of process: the plugin's node module runs in a forked plain-node
  child per session, as the engine does; the app reaches it through the
  bridge (capability `node:<plugin-id>`, granted per app per vault), and
  the host relays calls to the child — the plugin defines its own RPC; no
  raw Node reaches a frame.
- Approval pinned to a content hash of the plugin's files; a changed hash
  stops it until re-approved; a visible indicator while any Node child
  runs; a kill switch (Settings, and the indicator's menu) that stops them
  all.
- Desktop only: iOS answers `tier2: false`, and apps check `clew.can()`.
- Never in a restricted vault (R1): the hello answers `tier2: false` there
  on every platform, whatever the user installed or enabled.

## 12. How it relates to what exists

- **The Note API**: the same dispatcher, the same method names; notes keep
  `window.clew` in previews. Apps are a second caller kind with their own
  grants.
- **Vault scripts, preview plugins, note scripts**: unchanged, and NOT
  apps — they get no port. They are vault content in the preview; a script
  there cannot obtain an app's port (the transfer targets the app's origin).
- **Plugins**: Tier 2 rides on the plugin trust boundary (installed
  globally, enabled per vault) with the extra userData gate.
- **Migration**: a vault HTML app written against `window.parent.clew`
  moves by adding a manifest and an `@app[…]` embed; a shim in the bridge
  client presents the old shape over the port, so its code keeps working
  (§3.4). Nothing moves automatically.

## 13. iOS

Measured on WebKit by the iOS session (2026-09-30, a throwaway build):

- **The port handshake works**: a grandchild `clew-frame://keya` frame's
  hello reached the app page (`event.source.parent.parent === window`),
  the host transferred a fresh MessageChannel port with targetOrigin
  `clew-frame://keya`, messages flowed both ways; in the frame the host's
  origin read `clew-app://app`.
- **A third scheme with arbitrary hosts works**: each host its own tuple
  origin and a secure context; same-origin fetch of its own files; storage
  isolated per host; the parent's DOM out of reach. One more
  `setURLSchemeHandler`; the navigation policy adds `clew-frame` to the
  SUBFRAME allowlist, never the main frame.
- **Order**: the bridge must not ship on iOS before §2.6's narrowed ACAO —
  in the scratch build an app frame could still read vault files through
  the `*` ACAO.
- `window.webkit.messageHandlers.clew` exists in EVERY frame (WebKit
  defines it); it refuses non-main frames since iOS `8ceb533`, and the
  design never relies on its absence.
- No Tier 2; grants and the trust store in Application Support; the grant
  and trust prompts in the visual viewport; the DoS limit in §6.

**For Clew-iOS to review (R1–R3, 2026-10-02)** — not yet seen by the iOS
session; each is a question as much as a plan:

1. **R1, apps in restricted vaults.** SchemeHandler serves `clew-frame`
   documents WITHOUT §4.4's `script-src 'none'` (a different scheme, so a
   different branch), while raw vault HTML on `clew-preview` keeps it. In
   a restricted vault the app frame does not load until its prompt is
   answered — on iPad that is also the only DoS defence that acts BEFORE a
   thread can spin (§6). The prompt (visual viewport, 44 pt) names the
   vault as restricted. Tier-1 reads in a restricted vault are clamped to
   the vault root by realpath — does the provider-relative identity (§4.3)
   give a root to clamp against for a vault in Files, and do security-
   scoped bookmarks resolve symlinks the way `realpath` does?
2. **R2, the app CSP** as a SchemeHandler response header, built from the
   grant store at serve time (native, so the handler reads it directly);
   a grant or revocation reloads the app's frames. Measured on iOS already:
   WebKit honours header CSPs on scheme-handler responses (§4.4). New to
   check: `default-src 'self'` with `'wasm-unsafe-eval'` on WebKit 18; the
   navigation policy pinning a `clew-frame` subframe to its own host (it
   already decides subframe schemes); whether WebKit has any switch for
   WebRTC ICE in a WKWebView (the residual in §6), and whether it honours
   `X-DNS-Prefetch-Control`.
3. **R3, the key** = hash(vault identity, manifest id), so the key needs no
   path — simpler on iOS than the path key was. The duplicate-id refusal
   needs the manifest ids from the index (the shared indexer code), and
   `app-grants.json` in Application Support keys by (identity, id).

## 14. Test plan

- Unit: the capability map per method; the grant store; manifest parsing;
  the rate limiter; the protocol codec; the `clew-frame` path clamp.
- Smoke (defensive — our own guards, no attack pages): an app fixture with
  a manifest; no port before a grant, `denied` for an ungranted method, the
  port after; revocation closes it; a preview document asking for a port
  gets none; writes land through the pool (undo takes them back, history
  keeps the old text); `.clew/` refused; the limits answer `too-large` and
  `rate-limited`.
- Smoke, R1–R3: in a restricted vault the app frame is a placeholder until
  its prompt is answered, then runs while the vault's scripts, plugins and
  note code stay off (their refusals unchanged); a Tier-1 read through a
  symlink out of a restricted vault answers `not-found`; the app CSP
  refuses a `fetch` to another LOCAL origin (`clew-preview://vault/…` —
  our own server, no outside host) and an `<img>` from it under choice A,
  and allows them to a granted origin; a frame navigation off the app's
  origin is cancelled; moving the app folder keeps its grants and its
  localStorage; two folders with one id are both refused by name.

## 15. Phases

0. Built: the caller token (§1), the receiver checks (§2.8 step 0).
1. Vault trust (§4) — independent of the bridge and worth shipping on its
   own, since it closes an exposure that exists today; before any app
   feature, because app grants rest on it.
2. (c), the app page's own origin (§2), then §2.8 step 2.
3. Tier 1, read side: the `clew-frame` scheme and handler, the bridge
   client, the port handshake, `note.read`/`notes.read`/`query`/
   `app.kv`/`app.files`/`links.open`, grants (UX, storage, revocation);
   with R1–R3: the app CSP and `network`, navigation pinned, apps in
   restricted vaults behind their prompt, the manifest-id key and the
   duplicate-id refusal, the realpath clamp on restricted reads.
4. Tier 1, write side: `note.write`/`notes.write`/`notes.create`/
   `editor.insert` through the pool; `find`; `clipboard`.
5. Remote apps (explicit origin grants).
6. Tier 2 (desktop).

## 16. Docs impact

The manual gains a "Trusting a vault" page (restricted mode, the prompt,
Trusted vaults, the network switch — every user meets it on the first
shared vault they open), an "Apps in notes" chapter (the manifest, `@app[…]`, the
capabilities, the grant prompt, limits, what remote apps need), the Note
API page names the caller kinds, the plugins page the `node` surface and
its switch, and a security page states the trust boundaries (§6) in the
user's terms.

## Decisions (the owner, 2026-09-30)

1. **`header-html` banners get full vault access** — `allow-scripts
   allow-same-origin`, the note's own reach — inside §4: in a restricted
   vault vault HTML runs nothing (§4.4), so the reach applies only to
   trusted vaults (§3.2). The manual states it.
2. **Plugin storage resets once** with the move to `clew-app://app`;
   nothing is copied; the release notes say so (§2.10).
3. **§2.8 step 2 (the targets) is its own commit**, after the move.
4. **iOS drops `clew-app` from its subframe allowlist** (§2.7).
5. **The embed is `@app[…]`**, a named environment like `@reveal` —
   `@app[…]`, `@app+[…]`, `@begin(app)` (§7).
6. **App data is both**: a `clewdata.json` namespace (`app.kv`) and files
   in the app's own `data/` folder (`app.files`) (§9).
7. **Remote apps come later** (phase 5 of §15).
8. **Grants are per app, per vault.**
9. **A restricted vault's exports use only the user's global config**
   (§4.4).
10. **A vault with no code never asks** (§4.5).
11. **Known vaults are trusted silently**, with a one-time notice (§4.8).

Details this revision adds, for the owner to change if wanted: the app's
data folder is `<app>/data/`; its limits are 25 MB a file and 250 MB an app
on desktop, 10 MB a write (25 MB a file by chunked appends) and 100 MB an
app on iPad.

**Found in review, and more urgent than the rest (§4.1, §4.4):** a note's
metadata header and several engine extensions make the render worker run
note-supplied code — Node code on desktop — on first render, today. The
fix is one switch in the jmarkdown ENGINE (a master change), honoured by
every such path, which Clew sets for restricted vaults; it can ship ahead
of the rest of §4.

## Revision R1–R3 (the owner, 2026-10-02)

Accepted by the owner and written in above:

- **R1, apps run in restricted vaults** (§4.4, §4.5, §6, §7, §9, §11):
  each behind its own prompt, before it loads; vault scripts, plugins, note
  code and plain vault HTML stay off; Tier 2 never; a trusted vault is
  unchanged. A vault whose only code is apps never asks for trust.
- **R2, app network** (§7, §9): `connect-src 'self'` and `form-action
  'none'` on every app document by default; the `network` capability,
  bare or scoped to listed origins, lifts it per app per vault.
- **R3, app identity** (§7, §9): the key is hash(vault identity, manifest
  id), so a moved or renamed app folder keeps its origin, storage and
  grants; two folders with one id are both refused by name.

Choices this revision leaves for the owner (the build follows the
recommendation unless told otherwise):

- **A. `default-src 'self'` for apps** (§7), on top of R2's
  `connect-src`: recommended — apps have no compatibility burden, and it
  closes the image/frame-URL residual for every app that has not been
  granted the network, which is what makes "read this note" safe in a
  restricted vault (§6). The cost: an app showing a remote image needs
  `network` for that origin.
- **B. A restricted vault's app waits for its prompt even when it asks for
  nothing** (§7): recommended, as the reading of "behind its own grant
  prompt" and the iPad's only up-front DoS defence. The alternative loads
  capability-free apps at once.
- **C. Pinning an approved app's code in a restricted vault** (not built):
  a content hash of the app's files (not `data/`) stored with the grant,
  so a vault that syncs new code into a granted app asks again — Tier 2's
  rule (§11) applied to untrusted vaults. Not recommended for v1: without
  the network an app's new code can reach nothing its old code could not;
  worth revisiting with phase 5.
- **D. WebRTC** (§6): no CSP governs its ICE requests. On desktop a
  window-wide WebRTC IP-handling policy may close it for app frames (Clew
  itself uses no WebRTC); phase 3 measures it and reports before setting
  anything process-wide.
