# One PDF viewer — retiring Chromium's plugin

Status: PROPOSED (2026-09-30), design only; the owner approves before any
code. Worked through with the iOS session, which moved the web-PDF cache
out of the vault (§4) and wrote the iPad's half (§8).

The goal: EmbedPDF is the ONLY PDF viewer, everywhere, so `plugins: true`
(main.js) can go. The owner's position: they do not embed web PDFs
themselves, but others will, so web PDFs must keep working — better than
now.

## 1. What still reaches Chromium's viewer (2026-09-30)

Everything of Clew's own is EmbedPDF already: `![[x.pdf]]` (pdf-embed.js
upgrades the engine's `<embed class="pdf-embed">`), PDF tabs, canvas PDF
nodes and canvas-scene PDF nodes (`pdf-page.html`, 71180c6). What is left:

- **Portal miniatures** — `canvas/portal.js` shows a PDF node as a raw
  `<iframe src=vaultFileUrl>`.
- **A note's own HTML** — `<iframe src="paper.pdf">`, `<embed>`, `<object
  data>` a note writes itself, for a vault file or a web one.
- **The `<embed class="pdf-embed">` placeholder** between render and
  upgrade — replaced within a frame; with the plugin gone it is simply
  blank for that moment.

## 2. Portal miniatures: a cached first-page image

- The portal's PDF node becomes `<img src=…>` of the first page, cached in
  `<vault>/.clew/cache/pdf-thumbs/<rel>.png` — the office-thumbnail
  arrangement (`main/office-thumbs.js`): a MIRRORED path (a read-only
  surface can build the URL without asking), reused until the PDF's mtime
  moves, jobs strictly one at a time.
- Rendered offscreen by the viewer Clew already has: a hidden window loads
  `pdf-page.html?src=…&thumb=1`, which opens the document and renders page 1
  with EmbedPDF's own `renderPage` (a PDFium bitmap, no screenshot) at the
  portal's size × devicePixelRatio, capped at 1024 px on the long side; main
  collects the PNG with `executeJavaScript` and writes it. PDFium boots in
  a few hundred ms (the office thumbnail's LibreOffice takes seconds), so
  this is cheap enough to do on first sight.
- While it renders: the node shows the PDF's name on a page-shaped plate
  (what a failed render also leaves, with "No preview"). No layout jump —
  the plate has the page's aspect once the page size is known, A4 before.
- Invalidation: mtime (an annotation saved into the PDF re-renders the
  thumbnail on next sight); a vault rename moves nothing — the mirrored
  path simply misses and renders again; `.clew/cache` is disposable.

## 3. A note's own PDF frames, vault files

- After the engine renders a note (render-service's output; Clew side, no
  engine change), one pass rewrites every `<iframe src>`, `<embed src>` and
  `<object data>` whose target is a vault PDF — relative to the note or
  vault-absolute (`/…`), `.pdf` by extension or `type="application/pdf"` —
  to `pdf-page.html?src=<vault URL>`, carrying `#page=N` as `&page=N` and
  keeping `width`, `height`, `style` and `class`. It is then exactly the
  viewer `![[x.pdf]]` gets: annotating, autosave, the flush machinery.
- The same pass runs on block documents (live edit, hover previews) and
  fragments, because they share the render path. Site export does NOT run
  it: an exported page keeps the author's `<iframe>`, and the reader's
  browser shows the PDF with its own viewer.

## 4. Web PDFs: Clew fetches, the page cannot

The obstacle is not EmbedPDF but fetching: a preview document cannot read a
remote PDF across origins (CORS), and the vault-trust CSP (frame-bridge §4.9)
closes `connect-src` to the preview origin anyway. So CLEW fetches, and only
because a render asked:

- **What counts**: the §3 pass finds `<iframe|embed|object>` targets with an
  `http(s)` URL whose path ends `.pdf`, or any URL marked
  `type="application/pdf"`. (A PDF served from a path without `.pdf` —
  arXiv's `/pdf/2301.00001` — is not recognised by its URL; see the open
  questions.) `![[https://…/x.pdf]]` is not dialect today — wikilinks are
  vault paths — and this does not add it.
- **Registration, not a proxy**: each URL found is registered for the
  session under `sha256(url)` and prefetched by main; the frame is rewritten
  to `pdf-page.html?src=clew-preview://vault/<sid>/__clew_remote_pdf__/<hash>
  &readonly=1&origin=<url>`. The protocol route serves a hash a RENDER
  registered in this session and nothing else — 404 for any other, and for
  any session id but this one's — so no page, script or frame can name a
  URL for Clew to fetch. There is no fetch-any-URL channel to abuse. A hash
  still downloading answers when it lands (the viewer shows its loading
  state) or with an error the viewer shows by name; it never redirects the
  frame to the URL. The route is GET-only, `application/pdf`, range-capable,
  and carries the constant ACAO of §2.6 of frame-bridge.md.
- **The fetcher** (main, Node `https`/`http`, NOT Electron `net`: `net`
  shares the default session's cookies and cannot pin an address):
  - `http:` and `https:` only; `GET` only; no cookies, no `Authorization`,
    no `Referer`; a plain `User-Agent: Clew/<version>`.
  - **No local network**: the host is resolved first and EVERY address it
    resolves to is checked; loopback (`127/8`, `::1`), private (`10/8`,
    `172.16/12`, `192.168/16`, `fc00::/7`), link-local (`169.254/16` — the
    cloud metadata address among them — `fe80::/10`), CGNAT `100.64/10`,
    `0/8`, multicast and reserved ranges, and IPv4-mapped/NAT64 forms of
    all of them are refused; the connection is made to the vetted address
    (a pinned `lookup`), so a DNS answer cannot change between check and
    connect. Every redirect is checked the same way, at most 5.
  - Timeouts: 10 s to connect, 20 s to the headers, 120 s in all.
  - A response must be `200`, `Content-Type` `application/pdf` or a generic
    binary type, begin with `%PDF-` within its first 1024 bytes (the spec's
    allowance), and stay under the size cap (100 MB desktop, §8 for iPad) —
    counted as it streams, not trusted from `Content-Length`.
- **Cache — ON THE DEVICE, never in the vault** (the iOS session's point):
  `.clew/` travels with a vault (iCloud, a zip, git), so a shared vault
  could arrive with a planted `.clew/cache/remote-pdfs/<sha256(url)>.pdf`
  and Clew would serve an attacker's bytes as that URL's — cache
  poisoning, around the whole fetch guard; privilege never travels with a
  vault (frame-bridge §4). So: `<userData>/remote-pdfs/` on desktop,
  `Library/Caches/remote-pdfs/` on iOS (purgeable by the system, which a
  cache may be), each `<sha256(url)>.pdf` plus `.json` (URL, fetched at,
  ETag, Last-Modified, size) — keyed by the URL alone, no path, nothing
  absolute, shared by every vault on the device (a URL's bytes are the
  same whoever names it). 1 GB per device, least recently used evicted
  first. A cached copy is served at once and REVALIDATED (conditional GET)
  at most once a day, when a note naming it renders. "Reload from the web"
  in the viewer refetches now. (The first-page THUMBNAILS of §2 are a
  different case and stay in `.clew/cache/`: derived from a vault file and
  regenerable, a planted one shows a wrong picture at worst — and a vault
  synced over iCloud reuses them across devices.)
- **Read-only**: a web PDF is somebody else's document, and its copy lives
  in a cache — nothing is saved into it. `&readonly=1` makes the viewer open
  with EmbedPDF's own switches — `disabledCategories: ['annotation',
  'redaction']` and a permissions override denying annotation — and never
  autosave; this needs NO change in the owner's EmbedPDF fork. The viewer's
  own strip offers **Save a copy to the vault** (copied to the vault's
  attachment folder, named from the URL, never overwriting; the notice
  names the new file, to embed as `![[…]]`) and **Open in browser**.
- **Save a copy** is a binary write through the vault's write path (main
  on desktop, Swift on iOS — never the text-note bridge), into the
  attachment folder, never overwriting.
- **When it cannot load** (the viewer shows why, and offers Open in
  browser, and Retry): offline with no cached copy — "Offline, and not
  fetched before"; offline WITH one — the cached copy, marked "saved copy
  from <date>"; an HTML answer where a PDF was expected — "The site
  answered with a web page, not a PDF — it may need you to sign in" (no
  cookies are sent, so a PDF behind a login never loads here: that is the
  price of no credentials); too large, a refused address, a timeout or an
  HTTP error — each by name.
- **Vault trust** (frame-bridge §4): recommended ON for restricted vaults
  too. It is not code, and a restricted vault already loads remote images
  and frames (`img-src` / `frame-src` stay open, §4.9) — a remote PDF is
  the same kind of request, now made more carefully (no cookies, no
  local network, once and cached rather than on every view). If the owner
  later adds a "load no remote content" switch, it covers images, frames
  and PDFs together.
- **Privacy**: the site learns the user's address when a note naming its
  PDF first renders, and at each daily revalidation — as it does today
  when the preview frame loads the PDF directly, only less often; nothing
  identifies the user beyond that.

## 5. What does not change

`![[x.pdf]]`, PDF tabs, canvas PDF nodes and scene PDF nodes, annotations
autosaving into the vault's own PDFs, the flush machinery, and site export
(which keeps authors' `<iframe>`s pointing where they pointed).

## 6. Then: `plugins: true` goes

- With the plugin disabled, a PDF navigation in any frame is a DOWNLOAD
  to Chromium. So main watches `will-download` on the default session: in
  dev and smoke it logs `smoke-pdf-leak: <url>` and cancels; in a release
  it cancels and tells the window "A PDF could not be shown here" (never a
  silent file in Downloads).
- The sweep: the protocol tour, the live sweep, the PDF and canvas
  scenarios and a new fixture with every form of §3 and §4 (relative,
  absolute, `#page=`, `<embed>`, `<object>`, a web PDF) assert ZERO
  `smoke-pdf-leak` lines. The web PDF in the fixture is served from a
  PRE-SEEDED cache entry, so the page-side flow (registration, the route,
  read-only, Save a copy) is exercised without the network — and without
  any switch that loosens the address guard, which never exists in the
  app.
- Unit tests: the rewrite pass (every form, sizes, `#page=`); the fetcher
  with its resolver passed in (how a test reaches a local server): every
  refused range including mapped forms, a redirect into a refused range,
  the redirect limit, timeouts, Content-Type, the `%PDF-` check, the size
  cap counted while streaming; the cache's eviction.

## 7. EmbedPDF

No fork change is needed: read-only is configuration (`disabledCategories`,
`permissions`), and first-page rendering is the engine's `renderPage`, both
in the vendored build. If the owner wants the read-only state SHOWN in
EmbedPDF's own toolbar (a lock badge) rather than in Clew's strip, that
would be a fork change in `~/Source/EmbedPDF/v2` (branch `ocg-v2`), then
`npm run sync-embedpdf`; not proposed.

## 8. iOS (worked through with the iOS session)

The iPad has no Chromium viewer — WebKit shows a PDF in an iframe as ONE
STATIC PAGE — so everything here is a gain there.

- **Thumbnails: native**, never an offscreen EmbedPDF — PDFium's wasm in
  the iPad's single content process is what wedged a real iPad before.
  `QLThumbnailGenerator` already renders office thumbnails
  (`OfficeThumbs.swift`) at the mirrored `.clew/cache/office-thumbs/<rel>.png`,
  mtime-keyed; PDF thumbnails are the same code at `.clew/cache/pdf-thumbs/
  <rel>.png`, so the two platforms reuse each other's PNGs over iCloud.
  (PDFKit's `PDFPage.thumbnail` if exact size control is ever wanted.)
- **Registration**: the engine runs in a Web Worker; the §3/§4 pass runs in
  the app page's render service (the shim) over the worker's HTML and
  registers the URLs with NATIVE through the bridge
  (`registerRemotePdfs([...urls]) → {url: hash}`) before the HTML is
  served. The bridge answers the app page's main frame only (iOS
  `8ceb533`), so no preview document can register a URL. Native keeps the
  per-session map, cleared with the session id and token on a new session.
- **The fetcher: Network.framework, not URLSession.** URLSession resolves
  internally and reports the address only after connecting, and pinning by
  rewriting the URL to the IP breaks SNI. So: resolve first
  (`getaddrinfo`/`nw_resolver`), refuse the same ranges as §4 on EVERY
  address, open an `NWConnection` to the vetted address with TLS whose SNI
  and verification name are the ORIGINAL host
  (`sec_protocol_options_set_tls_server_name`, `SecPolicyCreateSSL(true,
  host)`), speak a minimal HTTP/1.1 GET (status, headers, `Content-Length`
  or chunked), and do it all again on each of up to 5 redirects — ~200
  lines of Swift, parity with desktop's pinned lookup, immune to DNS
  rebinding. Refusing BEFORE connecting also keeps iOS's Local Network
  privacy prompt from ever appearing for a note's URL.
- **https only**: the app has no App Transport Security exception, so iOS
  already refuses `http:` loads, web content included (an http iframe in a
  note fails there today); `http:` PDFs show "insecure address — open in
  browser". ATS does not cover `NWConnection`, so the rule is enforced in
  code.
- **Memory**: a 50 MB cap, enforced natively while streaming to disk
  (`Content-Length` and a running count). EmbedPDF holds the whole file in
  its wasm heap plus a JS copy — ~100–150 MB for a 50 MB PDF, before
  rendered pages — in the one content process shared with the app page and
  every frame; the live-frame cap (8) is the other half of that budget.
  The cached file is served by SchemeHandler's range-capable `respondFile`,
  never through the bridge.
- **The route**: the same shape, `clew-preview://vault/<sid>/
  __clew_remote_pdf__/<hash>`, the same refusals (unknown sid or
  unregistered hash → 404).
- **The leak detector's twin**: `decidePolicyFor navigationResponse`
  cancels an `application/pdf` response in a subframe and logs it — the
  iPad's equivalent of desktop's `will-download` for the sweep.

## Open questions for the owner

1. **URLs without `.pdf`** (arXiv's `/pdf/…`): recognise only `.pdf` and
   `type="application/pdf"` (recommended — predictable, and an author can
   add the attribute), or also a short list of known PDF hosts.
2. **Remote PDFs in restricted vaults**: on (recommended, §4), or off until
   the vault is trusted.
3. **Proxies**: Node's fetcher does not use the system proxy (Electron's
   `net` would, but cannot pin addresses or shed cookies). Accept
   (recommended; a corporate network without direct access then shows
   "could not connect — Open in browser"), or add proxy support later.
4. **Size caps**: 100 MB a file on desktop / 50 MB on iPad, a 1 GB cache
   per device (recommended), or other numbers.
5. **Site export**: link out, keeping the author's iframe (recommended —
   republishing a third party's PDF from a cache is not Clew's call), or
   bundle the cached copy (read from the DEVICE cache, never a vault's).
