# The frame bridge — design

Status: §1 AGREED with the iOS session (2026-09-29) and BUILT on desktop
(iOS's side is its own). Next, by the owner's decision: the app page's own
origin (option (c), `clew-app://app`) and a Compatibility section, then
the bridge itself (per-app identity, capabilities, grants, Tier 2) —
design only until the owner approves it whole. §1 is a prerequisite: the
bridge must stand on a protocol that can tell who is asking.

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
  (per-app identity, §2 onward), and everything privileged is done by the
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
