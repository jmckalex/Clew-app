#!/bin/bash
# The in-app checks of a PACKAGED build, beside smoke/boot-test.sh — what every
# 0.12.1 dev build was checked with since dev.13 (until 2026-10-22 a script in
# the packaging session's scratchpad). Each run is the packaged binary under
# the smoke harness, hidden, a fresh profile of its own (smoke/sweep-lib.sh),
# every request off the machine logged (CLEW_SMOKE_NET_LOG):
#
#   demo                the welcome screen's "Explore the demo vault": the
#                       button there, the copy made fresh, the vault opened
#                       (demo-click-scenario.js, CLEW_SMOKE_DEMO_TARGET)
#   trust               an untrusted vault with code (make-trust-vault.mjs):
#                       the modal prompt, answered Keep restricted — decided,
#                       not trusted, the status bar's "Restricted · Trust…"
#   lpr-restricted      latex-pdf-refusal-scenario.js on a fresh profile: a
#   lpr-trusted         note's, a book's and a proof's PDF via LaTeX refused by
#                       name, the menu's notice, only the .tex written; then
#                       the vault known (trusted): every route builds
#   postscript          PostScript in figures through the bundled Ghostscript
#                       (postscript-scenario.js): four figures mpw-ok, the
#                       PSTricks and EPS colours, the rotated text, gs.wasm
#                       fetched, no mpw-error
#   network             no request left the machine in any of them
#
#   smoke/packaged-checks.sh <app-binary> [out-dir]
#     app-binary  e.g. out/mac-arm64/Clew.app/Contents/MacOS/Clew
#     out-dir     default /tmp/clew-packaged-checks (cleared; logs + shots)
#
# As boot-test.sh: FROM THESE SOURCES OR NOTHING (the app's build stamp must
# match this checkout's src/ — exit 4; PACKAGED_CHECKS_ALLOW_STALE=1 checks an
# older build anyway), and a QUIET MACHINE OR NOTHING (the 1-minute load below
# PACKAGED_CHECKS_MAX_LOAD, default 6, within PACKAGED_CHECKS_WAIT seconds,
# default 1200 — exit 3, nothing run): mp-tikz-wasm's watchdog fails a figure
# whose worker makes no progress for 20 s. Do not edit this checkout's src/
# while it runs: every run re-checks the stamp and refuses (2026-10-22).
#
# Exit: 0 all passed · 1 an assertion failed, or a run never started ·
#       2 bad arguments · 3 the machine never went quiet · 4 not built from
#       this checkout.
cd "$(dirname "$0")/.." || exit 2
. smoke/sweep-lib.sh
BIN=${1:-}
S=${2:-/tmp/clew-packaged-checks}
MAX=${PACKAGED_CHECKS_MAX_LOAD:-6}
WAIT=${PACKAGED_CHECKS_WAIT:-1200}
[ -n "$BIN" ] || { echo "usage: smoke/packaged-checks.sh <app-binary> [out-dir]" >&2; exit 2; }
case "$S" in /|"$HOME"|"$HOME/"|.|..) echo "packaged-checks: refusing to clear $S" >&2; exit 2;; esac
[ -x "$BIN" ] || { echo "packaged-checks: no executable at $BIN" >&2; exit 2; }
STALE_ENV=()
if ! node scripts/stale-check.mjs --app "$BIN"; then
	if [ -n "${PACKAGED_CHECKS_ALLOW_STALE:-}" ]; then
		echo "packaged-checks: checking it anyway (PACKAGED_CHECKS_ALLOW_STALE)" >&2
		STALE_ENV=(CLEW_SMOKE_ALLOW_STALE=1)
	else
		echo "packaged-checks: STOPPED — package from this checkout, or set PACKAGED_CHECKS_ALLOW_STALE=1; nothing was run" >&2
		exit 4
	fi
fi

load1() { sysctl -n vm.loadavg | awk '{ print $2 }'; }
below() { awk -v l="$1" -v m="$MAX" 'BEGIN { exit !(l < m) }'; }
waited=0
until below "$(load1)"; do
	if [ "$waited" -ge "$WAIT" ]; then
		echo "packaged-checks: ABORTED — load $(load1) still >= $MAX after ${WAIT}s; nothing was run" >&2
		exit 3
	fi
	sleep 20
	waited=$((waited + 20))
done
echo "packaged-checks: load $(load1) < $MAX after ${waited}s wait; $BIN"

rm -rf "$S"; mkdir -p "$S"
fail=0
check() { # label, then a command that must succeed
	local label=$1; shift
	if "$@"; then echo "  ok   $label"; else echo "  FAIL $label"; fail=1; fi
}
has() { grep -qF -- "$2" "$S/$1.lines"; }
run() { # name, scenario, vault ('' for none), profile, extra env...
	local n=$1 sc=$2 v=$3 ud=$4; shift 4
	env CLEW_SMOKE_LOG=1 CLEW_SMOKE_NET_LOG=1 CLEW_SMOKE_SOURCES="$PWD" ${STALE_ENV[@]+"${STALE_ENV[@]}"} CLEW_USER_DATA="$ud" CLEW_SMOKE="$S/$n.png" \
		CLEW_SMOKE_SCRIPT="$PWD/smoke/$sc" ${v:+CLEW_SMOKE_VAULT="$v"} "$@" \
		perl -e 'alarm shift; exec @ARGV' 300 "$BIN" > "$S/$n.log" 2>&1
	grep -E 'smoke-[a-z-]+:|smoke failed' "$S/$n.log" | grep -v -E 'smoke-asset|smoke-net' | sed 's/\[smoke:info\] //' > "$S/$n.lines"
	echo "== $n (load $(load1)): $(wc -l < "$S/$n.lines") lines, full log $S/$n.log"
	sweep_booted "$n" "$S/$n.log"
	! grep -q 'smoke failed' "$S/$n.log" || { echo "  FAIL smoke failed: $(grep -m1 'smoke failed' "$S/$n.log")"; fail=1; }
}

run demo demo-click-scenario.js '' "$(sweep_ud demo)" CLEW_SMOKE_DEMO_TARGET="$S/demo-target"
check "the welcome screen's button" has demo 'smoke-demo: button=true'
check "the demo vault copied fresh" has demo 'smoke-demo-sync: fresh=true'
check "the demo vault opened" has demo 'smoke-demo: vault=demo-target'

node smoke/make-trust-vault.mjs "$S/trust" > /dev/null && echo keep > "$S/trust/trust-mode.txt"
run trust trust-guard-scenario.js "$S/trust" "$(sweep_ud trust)" CLEW_SMOKE_TRUST_PROMPT=1
check "the prompt on an undecided vault" has trust 'smoke-trust: first trusted=false decided=false prompt=true'
check "Keep restricted: decided, not trusted, the indicator" has trust 'smoke-trust: kept trusted=false decided=true prompt=false indicator="Restricted · Trust…"'

node smoke/make-book-vault.mjs "$S/lpr-r" > /dev/null
run lpr-restricted latex-pdf-refusal-scenario.js "$S/lpr-r/vault" "$(sweep_ud lpr-restricted)"
check "restricted: the vault untrusted" has lpr-restricted 'smoke-lpr: trusted=false'
for route in note-pdf book-pdf proof; do
	check "restricted: $route refused by name" has lpr-restricted "smoke-lpr: $route refused="
done
check "restricted: the menu's notice" has lpr-restricted 'smoke-lpr: menu notice='
check "restricted: only the .tex written" has lpr-restricted 'smoke-lpr: files=["lpr/Conventions.tex"]'

node smoke/make-book-vault.mjs "$S/lpr-t" > /dev/null
UD=$(sweep_ud lpr-trusted); printf '{"recentVaults":["%s"]}\n' "$S/lpr-t/vault" > "$UD/clew-settings.json"
run lpr-trusted latex-pdf-refusal-scenario.js "$S/lpr-t/vault" "$UD"
check "trusted: the vault known" has lpr-trusted 'smoke-lpr: trusted=true'
check "trusted: the note's PDF" has lpr-trusted 'smoke-lpr: note-pdf output='
check "trusted: the book's PDF" has lpr-trusted 'smoke-lpr: book-pdf output=Books/Signals/build/Signals.pdf'
check "trusted: the chapter proof" has lpr-trusted 'smoke-lpr: proof output=Books/Signals/build/Signals (proof, Conventions).pdf'

node smoke/make-figures-vault.mjs "$S/v-ps" > /dev/null
run postscript postscript-scenario.js "$S/v-ps" "$(sweep_ud postscript)" CLEW_SMOKE_FRAME_SCRIPT="$PWD/smoke/postscript-frame.js" CLEW_SMOKE_FRAME_MATCH=PostScript.md
L=$S/postscript.lines
check "PostScript: four figures, every one mpw-ok" test "$(grep -c 'smoke-ps-frame: tikz-diagram state=mpw-tikz mpw-ok' "$L")" -eq 4
check "PostScript: PSTricks blue and red" has postscript 'colours=["rgb(0, 0, 255)","rgb(255, 0, 0)"]'
check "PostScript: the EPS green" has postscript 'colours=["rgb(0, 153, 0)"]'
check "PostScript: the turned text" has postscript 'rotated=true'
check "PostScript: no mpw-error" test "$(grep -c 'mpw-error' "$L")" -eq 0
check "PostScript: gs.wasm fetched" grep -q 'smoke-asset: mptikz/ghostscript/gs.wasm' "$S/postscript.log"

net=$(cat "$S"/*.log | grep -c 'smoke-net:')
check "network: no request left the machine ($net)" test "$net" -eq 0

sweep_verdict packaged-checks
[ "$fail" -eq 0 ] && echo "packaged-checks: PASSED" || { echo "packaged-checks: FAILED — read $S/*.lines against the header"; exit 1; }
