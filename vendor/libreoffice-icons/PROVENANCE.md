# LibreOffice Sifr icon theme — provenance

`images_sifr.zip` (2,411,404 bytes,
sha256 `5b4e5985658a78b5bb3e68550be1ee3adf9ab0af249c9d147599693d9dd9ad5d`)
extracted 2026-09-01 from Ubuntu's
`libreoffice-style-sifr_24.2.7-0ubuntu0.24.04.6_all.deb`
(`http://archive.ubuntu.com/ubuntu/pool/universe/libr/libreoffice/`),
path `./usr/lib/libreoffice/share/config/images_sifr.zip` — the SAME
LibreOffice 24.2 line as the pinned ZetaOffice wasm build
(zeta-assets/PROVENANCE.md), so the icon set matches the UI it skins.

Sifr is part of LibreOffice, © The Document Foundation and contributors,
licensed MPL-2.0 (with parts under the LibreOffice icon themes' usual
CC-BY-SA/public-domain mix); see
<https://wiki.documentfoundation.org/Design/Icons>. Redistributed here
unmodified.

Why it exists: the ZetaOffice bundle ships ONLY Colibre, and the wasm
build neither re-reads `SymbolStyle` after startup nor survives its
packed zip being overwritten mid-boot (both measured). So Clew serves a
byte-spliced `soffice.data` in which this zip REPLACES the Colibre entry
(src/main/zeta-icons.js) — LibreOffice believes it is loading Colibre
and draws Sifr. When updating the wasm bundle, refresh this zip from the
matching LibreOffice release.
