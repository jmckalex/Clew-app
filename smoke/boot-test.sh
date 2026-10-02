#!/bin/bash
# The boot test for a SIGNED build. `codesign --verify` proves the signature,
# not that the app runs: the hardened runtime is what breaks the forked render
# worker and the wasm TeX (HANDOVER §6, CLAUDE.md "Packaging"). This boots the
# PACKAGED binary under the smoke harness, each run with a fresh
# CLEW_USER_DATA, on the fixture its smoke/README.md row names:
#
#   figures-scenario    make-figures-vault.mjs; every figure `mpw-ok` with
#                       paths > 0, `pending=0`, `cache-probe first=engine
#                       second=cache`
#   live-edit-scenario  a scratch copy of demo-vault/ (it opens
#                       Projects/Dialect Demo.md; any other vault proves
#                       nothing — the 0.11.0 run that got another scenario's
#                       fixture printed blanks and threw on an empty note)
#
#   smoke/boot-test.sh [app-binary] [out-dir]
#     app-binary  default out/mac-arm64/Clew.app/Contents/MacOS/Clew
#     out-dir     default /tmp/clew-boot-test (cleared; logs + screenshots)
#
# QUIET MACHINE OR NOTHING. mp-tikz-wasm's watchdog fails a figure whose
# worker makes no progress for 20 s, so on a busy machine the figures run
# reports errors that are the machine's, not the app's. Before anything runs,
# the script waits for the 1-minute load average to drop below
# BOOT_TEST_MAX_LOAD (default 6), checking every 20 s for up to
# BOOT_TEST_WAIT seconds (default 1200). If it never does, it ABORTS — exit
# 3, nothing launched. It never proceeds on a timeout: the loop this
# replaces gave up after its wait and launched anyway, at load 14.71
# (2026-09-29). Figures run first, while the machine is known quiet.
#
# FROM THESE SOURCES OR NOTHING. Before the wait, the app's own build stamp
# (dist/build-stamp.json in its app.asar — scripts/stale-check.mjs) must
# match this checkout's src/, or the test stops: exit 4, naming what changed.
# BOOT_TEST_ALLOW_STALE=1 tests an older build anyway (a release DMG after
# main moved on), and says so in every run.
#
# Exit: 0 both passed · 1 an assertion failed · 2 bad arguments ·
#       3 the machine never went quiet (nothing was run) ·
#       4 the app was not built from this checkout (nothing was run).
cd "$(dirname "$0")/.." || exit 2
BIN=${1:-out/mac-arm64/Clew.app/Contents/MacOS/Clew}
S=${2:-/tmp/clew-boot-test}
MAX=${BOOT_TEST_MAX_LOAD:-6}
WAIT=${BOOT_TEST_WAIT:-1200}
case "$S" in /|"$HOME"|"$HOME/"|.|..) echo "boot-test: refusing to clear $S" >&2; exit 2;; esac
[ -x "$BIN" ] || { echo "boot-test: no executable at $BIN" >&2; exit 2; }
STALE_ENV=()
if ! node scripts/stale-check.mjs --app "$BIN"; then
	if [ -n "${BOOT_TEST_ALLOW_STALE:-}" ]; then
		echo "boot-test: testing it anyway (BOOT_TEST_ALLOW_STALE)" >&2
		STALE_ENV=(CLEW_SMOKE_ALLOW_STALE=1)
	else
		echo "boot-test: STOPPED — rebuild and package from this checkout, or set BOOT_TEST_ALLOW_STALE=1; nothing was run" >&2
		exit 4
	fi
fi

load1() { sysctl -n vm.loadavg | awk '{ print $2 }'; }
below() { awk -v l="$1" -v m="$MAX" 'BEGIN { exit !(l < m) }'; }
waited=0
until below "$(load1)"; do
	if [ "$waited" -ge "$WAIT" ]; then
		echo "boot-test: ABORTED — load $(load1) still >= $MAX after ${WAIT}s; nothing was run" >&2
		exit 3
	fi
	sleep 20
	waited=$((waited + 20))
done
echo "boot-test: load $(load1) < $MAX after ${waited}s wait; $BIN"

rm -rf "$S"; mkdir -p "$S"
fail=0
check() { # label, then a command that must succeed
	local label=$1; shift
	if "$@"; then echo "  ok   $label"; else echo "  FAIL $label"; fail=1; fi
}
run() { # scenario, vault, extra env...
	local n=$1 v=$2; shift 2
	env CLEW_SMOKE_LOG=1 CLEW_SMOKE_SOURCES="$PWD" ${STALE_ENV[@]+"${STALE_ENV[@]}"} CLEW_USER_DATA="$S/ud-$n" CLEW_SMOKE="$S/$n.png" \
		CLEW_SMOKE_SCRIPT="$PWD/smoke/$n-scenario.js" CLEW_SMOKE_VAULT="$v" "$@" \
		perl -e 'alarm shift; exec @ARGV' 300 "$BIN" > "$S/$n.log" 2>&1
	grep -E 'smoke-[a-z-]+:|smoke failed' "$S/$n.log" | grep -v smoke-asset > "$S/$n.lines"
	echo "== $n (load $(load1)): $(wc -l < "$S/$n.lines") lines, full log $S/$n.log"
	! grep -q 'smoke failed' "$S/$n.log" || { echo "  FAIL smoke failed: $(grep -m1 'smoke failed' "$S/$n.log")"; fail=1; }
}

node smoke/make-figures-vault.mjs "$S/v-fig" > /dev/null
run figures "$S/v-fig" CLEW_SMOKE_FRAME_SCRIPT="$PWD/smoke/figures-frame.js"
L=$S/figures.lines
figs=$(grep -cE 'smoke-figures-frame: (tikz|metapost)-diagram' "$L")
check "figures reported ($figs)" test "$figs" -gt 0
check "every figure mpw-ok" test "$(grep -E 'smoke-figures-frame: (tikz|metapost)-diagram' "$L" | grep -c ' mpw-ok ')" -eq "$figs"
check "no figure with paths=0" test "$(grep -cE 'smoke-figures-frame: (tikz|metapost)-diagram.* paths=0 ' "$L")" -eq 0
check "pending=0" grep -q 'smoke-figures-frame: pending=0 ' "$L"
check "cache-probe first=engine second=cache" grep -q 'cache-probe first=engine second=cache' "$L"

rsync -a --exclude .clew demo-vault/ "$S/v-le/"
run live-edit "$S/v-le"
L=$S/live-edit.lines
check "mode=live" grep -q 'smoke-le: mode=live' "$L"
check "prose concealed" grep -qF 'prose="Some italics, strong, intense, and highlighted text with a"' "$L"
check "classes" grep -q 'classes=le-italic,le-strong,le-intense,le-highlight' "$L"
check "math widgets drawn" grep -qE 'math-widgets=([2-9]|[1-9][0-9]+) svg=all' "$L"
check "line-height-stable=true" grep -q 'line-height-stable=true' "$L"
check "after-arrows concealed=true" grep -q 'after-arrows concealed=true' "$L"
check "followed path=Welcome.md" grep -q 'followed path=Welcome.md' "$L"

[ "$fail" -eq 0 ] && echo "boot-test: PASSED" || echo "boot-test: FAILED — read $S/*.lines against smoke/README.md"
exit "$fail"
