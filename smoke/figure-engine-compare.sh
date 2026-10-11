#!/bin/bash
# smoke/figure-engine-compare.sh <out-dir> [settings…]
# What an owner's exports look like under each value of `exportFigureEngine`
# (default: external auto), side by side. For each value: a fresh
# make-figure-engine-vault.mjs copy at <out-dir>/<value>/ opened TRUSTED on a
# profile of its own, figure-engine-compare-scenario.js (Diagrams, Figures and
# the Signals book as HTML, LaTeX and PDF via LaTeX; a cold round, then a warm
# one), and smoke/proc-sampler.mjs on the app's process tree meanwhile. Then
# each HTML export and the book's pages are drawn to PNG (html-shot.cjs) and
# each PDF's pages (pdftoppm), and figure-engine-compare-check.mjs compares
# the values: <out-dir>/report.txt, and <out-dir>/side-by-side/*.png (the
# first value left, the second right). Runs are invisible, like every other.
set -u
R=$(cd "$(dirname "$0")/.." && pwd); O=$1; shift
SETTINGS=${*:-"external auto"}
(cd "$R" && node scripts/stale-check.mjs) || { echo "figure-engine-compare: dist/ is not built from these sources — nothing was run" >&2; exit 3; }
. "$R/smoke/sweep-lib.sh"
E=$R/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
mkdir -p "$O"
for s in $SETTINGS; do
	D=$O/$s
	node "$R/smoke/make-figure-engine-vault.mjs" "$D" >/dev/null
	printf '{ "setting": "%s" }\n' "$s" > "$D/vault/.figure-engine-compare.json"
	U=$(sweep_ud "$s"); printf '{ "recentVaults": ["%s"] }\n' "$D/vault" > "$U/clew-settings.json"
	(cd "$R" && exec env CLEW_SMOKE_LOG=1 CLEW_USER_DATA="$U" CLEW_SMOKE="$D/shot.png" \
		CLEW_SMOKE_SCRIPT="$R/smoke/figure-engine-compare-scenario.js" CLEW_SMOKE_VAULT="$D/vault" \
		perl -e 'alarm shift; exec @ARGV' 1800 "$E" . > "$D/run.log" 2>&1) &
	APP=$!
	node "$R/smoke/proc-sampler.mjs" "$APP" "$D/memory.tsv" &
	wait "$APP"; wait
	sweep_booted "$s" "$D/run.log"
	grep -ho 'smoke-fec: .*' "$D/run.log" > "$D/exports.txt"
	# What a reader sees: each HTML export, the book's pages, each PDF.
	mkdir -p "$D/shots"
	for h in "$D/vault/fe/cold/"*.html "$D/vault/Books/Signals/build/Signals/"*.html; do
		[ -f "$h" ] || continue
		n=$(basename "$h" .html); case $h in */Books/*) n="book-$n";; esac
		"$E" "$R/smoke/html-shot.cjs" "$h" "$D/shots/$n.html.png" 900 >/dev/null 2>&1
	done
	for p in "$D/vault/fe/cold/"*.pdf "$D/vault/Books/Signals/build/Signals.pdf"; do
		[ -f "$p" ] || continue
		n=$(basename "$p" .pdf); case $p in */Books/*) n="book-$n";; esac
		pdftoppm -r 60 -png "$p" "$D/shots/$n.pdf"
	done
done
node "$R/smoke/figure-engine-compare-check.mjs" "$O" $SETTINGS | tee "$O/report.txt"
sweep_verdict figure-engine-compare
