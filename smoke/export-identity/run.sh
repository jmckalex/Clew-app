#!/bin/bash
# The export-identity harness: every note of a fixed vault (make-vault.mjs —
# the demo vault plus the constructs exports have had to get right) exported
# as HTML and LaTeX through the app's own route (clew:export-note), and the
# demo book both ways, each output hashed. Run it before and after a change;
# compare.sh says which outputs changed, compare-pdfs.py whether the changed
# .tex still print alike. This is how every engine vendoring since 0.12.0 was
# measured ("150 exports … LaTeX changed only in …").
#
#   smoke/export-identity/run.sh <out-dir> [app-binary]
#     out-dir     cleared, then: vault/ (its out/ and Books/Signals/build/
#                 hold the outputs), home/, lines.txt (one result per export),
#                 outputs.sha (sha256 and path of every output), run.log
#     app-binary  a packaged Clew; default the dev build (`electron .`), whose
#                 dist/ must be built from this checkout (the harness refuses
#                 a stale one — node scripts/build.js)
#
# The vault is TRUSTED (known to the run's profile), as the owner's are; HOME
# is an EMPTY folder, so no one's own ~/.jmarkdown shapes the outputs —
# EXPORT_IDENTITY_USER_HOME=1 keeps yours (a run measured that way is only
# comparable with another that was). Under the empty HOME mermaid-cli finds
# no browser (puppeteer's lives under ~/.cache: "mmdc failed: Could not find
# Chrome"), so a LaTeX export leaves its Mermaid diagram out with a warning
# and every output is the same from run to run (measured, 166 of 166); with
# your HOME it is drawn, and its PDF in out/*-figures differs on every run by
# its CreationDate alone.
#
# Exit: 0 every export ran (errors are results, in lines.txt) · 1 the run
#       never started, or did not finish · 2 bad arguments.
cd "$(dirname "$0")/../.." || exit 2
. smoke/sweep-lib.sh
OUT=${1:-}
BIN=${2:-}
[ -n "$OUT" ] || { echo "usage: smoke/export-identity/run.sh <out-dir> [app-binary]" >&2; exit 2; }
case "$OUT" in /|"$HOME"|"$HOME/"|.|..) echo "export-identity: refusing to clear $OUT" >&2; exit 2;; esac
[ -z "$BIN" ] || [ -x "$BIN" ] || { echo "export-identity: no executable at $BIN" >&2; exit 2; }
rm -rf "$OUT"; mkdir -p "$OUT/home"
OUT=$(cd "$OUT" && pwd)
node smoke/export-identity/make-vault.mjs "$OUT/vault" || exit 2
UD=$(sweep_ud identity)
printf '{"recentVaults":["%s"]}\n' "$OUT/vault" > "$UD/clew-settings.json"
HOME_FOR_RUN=$OUT/home
[ -n "${EXPORT_IDENTITY_USER_HOME:-}" ] && HOME_FOR_RUN=$HOME
if [ -n "$BIN" ]; then CMD=("$BIN"); else CMD=(node_modules/.bin/electron .); fi
env HOME="$HOME_FOR_RUN" CLEW_USER_DATA="$UD" CLEW_SMOKE="$OUT/shot.png" CLEW_SMOKE_LOG=1 \
	CLEW_SMOKE_SCRIPT="$PWD/smoke/export-identity/scenario.js" CLEW_SMOKE_VAULT="$OUT/vault" \
	perl -e 'alarm shift; exec @ARGV' 1200 "${CMD[@]}" > "$OUT/run.log" 2>&1
grep -E 'smoke-ident:' "$OUT/run.log" | sed 's/.*smoke-ident: //' > "$OUT/lines.txt"
(cd "$OUT/vault" && find out Books/Signals/build -type f 2>/dev/null | LC_ALL=C sort | while IFS= read -r f; do
	printf '%s  %s\n' "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$f"
done) > "$OUT/outputs.sha"
sweep_booted export-identity "$OUT/run.log"
exports=$(grep -c -E ' (html|latex): ' "$OUT/lines.txt")
echo "export-identity: $(grep -c . "$OUT/vault/export-identity.json" | awk '{print $1 - 2}') notes, $exports exports ($(grep -c ': ok' "$OUT/lines.txt") ok, $(grep -c 'error=' "$OUT/lines.txt") errors), $(wc -l < "$OUT/outputs.sha" | tr -d ' ') outputs → $OUT"
grep -q '^done$' "$OUT/lines.txt" || { echo "export-identity: the run did not finish — $OUT/run.log"; sweep_failed export-identity; }
sweep_verdict export-identity
