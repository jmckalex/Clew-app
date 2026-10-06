#!/bin/bash
# The app sweep: every apps-in-notes scenario (docs/dev/frame-bridge.md
# §7–§9c) on a fresh fixture, printing each one's assertion lines — compare
# them with smoke/README.md. Written for the async callApp (2026-10-07: the
# app API is shared code, so a change to it runs ALL of these, not only the
# new scenario).
#
#   node scripts/build.js && smoke/app-sweep.sh [out-dir]   (~25 minutes)
#
# Each run gets a profile of its own (smoke/sweep-lib.sh) — or its fixture's
# own ud-trusted / ud-restricted, inside out-dir — and one that never started
# fails the sweep by name, exit 1. Two loopback stubs serve app-origins
# (probe-stub.mjs) and the Ticker's Live stocks (finnhub-stub.mjs); both are
# stopped at the end.
cd "$(dirname "$0")/.."
node scripts/stale-check.mjs || { echo "app-sweep: dist/ is not built from these sources — nothing was run" >&2; exit 3; }
. smoke/sweep-lib.sh
S=${1:-/tmp/clew-app-sweep}
case "$S" in /|"$HOME"|"$HOME/"|.|..) echo "app-sweep: refusing to clear $S" >&2; exit 1;; esac
E=node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
rm -rf "$S"; mkdir -p "$S"
STUBS=()
stop_stubs() { for p in "${STUBS[@]}"; do kill "$p" 2>/dev/null; done; }
trap 'stop_stubs; sweep_cleanup' EXIT

# run <name> <scenario> <vault> <userData> [ENV=value …]
run() {
	local n=$1 sc=$2 v=$3 ud=$4; shift 4
	env CLEW_SMOKE_LOG=1 CLEW_USER_DATA="$ud" CLEW_SMOKE="$S/$n.png" CLEW_SMOKE_SCRIPT="smoke/$sc-scenario.js" CLEW_SMOKE_VAULT="$v" "$@" \
		perl -e 'alarm shift; exec @ARGV' 300 "$E" . > "$S/$n.log" 2>&1
	grep -E 'smoke-[a-z-]+:|smoke failed|found no' "$S/$n.log" | grep -v -E '^smoke-(asset|boot):|\] smoke-asset' \
		| sed -E 's/^\[smoke:[a-z]+\] //' > "$S/$n.lines"
	echo "== $n: $(wc -l < "$S/$n.lines") lines, full log $S/$n.log"
	cut -c1-400 "$S/$n.lines" | sed 's/^/   /'
	sweep_booted "$n" "$S/$n.log"
}

# The app page's own origin.
rsync -a --exclude .clew demo-vault/ "$S/v-origin/"
run app-origin app-origin "$S/v-origin" "$(sweep_ud app-origin)"

# The bridge, mode by mode (make-app-vault.mjs; app-mode.txt).
for mode in battery lifecycle writes headless events; do
	node smoke/make-app-vault.mjs "$S/v-bridge-$mode" > /dev/null
	echo "$mode" > "$S/v-bridge-$mode/app-mode.txt"
	case $mode in
		battery) frame=(CLEW_SMOKE_FRAME_SCRIPT=smoke/app-bridge-frame.js CLEW_SMOKE_FRAME_MATCH=://) ;;
		lifecycle) frame=() ;;
		*) frame=(CLEW_SMOKE_FRAME_SCRIPT=smoke/app-bridge-frame.js CLEW_SMOKE_FRAME_MATCH=clew-frame) ;;
	esac
	run "bridge-$mode" app-bridge "$S/v-bridge-$mode" "$(sweep_ud "bridge-$mode")" ${frame[@]+"${frame[@]}"}
done

# The demo's six apps: the gallery restricted and trusted, then each one-app case.
for ud in restricted trusted; do
	node smoke/make-app-gallery-vault.mjs "$S/v-gallery-$ud" gallery > /dev/null
	run "gallery-$ud" app-gallery "$S/v-gallery-$ud/vault" "$S/v-gallery-$ud/ud-$ud" \
		CLEW_SMOKE_FRAME_SCRIPT=smoke/app-gallery-frame.js CLEW_SMOKE_FRAME_MATCH=clew-frame
done
for kase in insert timer picker progress reading ticker; do
	node smoke/make-app-gallery-vault.mjs "$S/v-case-$kase" "$kase" > /dev/null
	net=(); [ "$kase" = ticker ] && net=(CLEW_SMOKE_NET_LOG=1)
	run "gallery-$kase" app-gallery "$S/v-case-$kase/vault" "$S/v-case-$kase/ud-trusted" \
		CLEW_SMOKE_FRAME_SCRIPT=smoke/app-gallery-frame.js CLEW_SMOKE_FRAME_MATCH=clew-frame ${net[@]+"${net[@]}"}
done

# Pinned apps.
for mode in reading live control forms; do
	node smoke/make-app-pin-vault.mjs "$S/v-pin-$mode" "$mode" > /dev/null
	frame=(); [ "$mode" = reading ] && frame=(CLEW_SMOKE_FRAME_SCRIPT=smoke/app-pin-frame.js CLEW_SMOKE_FRAME_MATCH=Pin.md)
	run "pin-$mode" app-pin "$S/v-pin-$mode/vault" "$S/v-pin-$mode/ud" ${frame[@]+"${frame[@]}"}
done

# A network grant bound to its origins, against two loopback stubs.
A=48761 B=48762
node smoke/probe-stub.mjs $A "$S/probe-stubs.log" > /dev/null 2>&1 & STUBS+=($!)
node smoke/probe-stub.mjs $B "$S/probe-stubs.log" > /dev/null 2>&1 & STUBS+=($!)
sleep 1
for ud in trusted restricted; do
	node smoke/make-app-origins-vault.mjs "$S/v-origins-$ud" $A $B > /dev/null
	run "origins-$ud" app-origins "$S/v-origins-$ud/vault" "$S/v-origins-$ud/ud-$ud" \
		CLEW_SMOKE_FRAME_SCRIPT=smoke/app-origins-frame.js CLEW_SMOKE_FRAME_MATCH=clew-frame
done

# The Ticker's Live stocks against a Finnhub stub; the key a secret (app.secrets).
F=48763
node smoke/finnhub-stub.mjs $F test-key-123 "$S/finnhub-stub.log" > /dev/null 2>&1 & STUBS+=($!)
sleep 1
node smoke/make-ticker-live-vault.mjs "$S/v-ticker" stub $F > /dev/null
run ticker-live ticker-live "$S/v-ticker/vault" "$S/v-ticker/ud" \
	CLEW_SMOKE_FRAME_SCRIPT=smoke/ticker-live-frame.js CLEW_SMOKE_FRAME_MATCH=clew-frame
echo "   the key in: run log $(grep -c 'test-key-123' "$S/ticker-live.log"), vault/profile files $(grep -rl 'test-key-123' "$S/v-ticker" 2>/dev/null | wc -l | tr -d ' ')"

# An app's secrets: kept, revoked, forgotten — and the value nowhere.
V=$(node smoke/make-app-secrets-vault.mjs "$S/v-secrets")
run app-secrets app-secrets "$V" "$S/v-secrets/ud" CLEW_SMOKE_SCRIPT_RELOADED=smoke/app-secrets-reloaded.js
echo "   the value in: run log $(grep -c 'S3CR3T-VALUE-7f3a' "$S/app-secrets.log"), vault/profile files $(grep -rl 'S3CR3T-VALUE-7f3a' "$S/v-secrets" 2>/dev/null | wc -l | tr -d ' ')"

sweep_verdict app-sweep
