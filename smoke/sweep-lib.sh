# Sourced (never run) by every smoke runner that launches Electron:
# live-sweep.sh, pdf-sweep.sh, pdf-baseline.sh, protocol-tour.sh,
# render-dump.sh, boot-test.sh. Two rules, one place:
#
# 1. A PROFILE OF ITS OWN, ALWAYS. A run without CLEW_USER_DATA takes the dev
#    profile, ~/Library/Application Support/clew — on a case-insensitive disk
#    the SAME folder as the packaged app's "Clew" — and its single-instance
#    lock loses to an open Clew.app: Electron exits 0 having run nothing.
#    live-sweep.sh printed "0 lines" for every scenario and passed (measured
#    2026-10-05, the owner's dev.6 open). It would otherwise also run on the
#    owner's real settings and trust store. `sweep_ud <name>` is a folder in
#    ONE mkdtemp root per runner, removed when the runner exits; a name asked
#    for twice is the same folder (a scenario's second run, a seeded
#    clew-settings.json). Nothing here reads the caller's CLEW_USER_DATA.
# 2. A SCENARIO THAT NEVER RAN FAILS THE RUNNER, BY NAME. The harness prints
#    `smoke-boot:` (main.js) the moment it has a window, whatever else
#    happens; a run whose log gained none never started. `sweep_booted
#    <name> <log> [<boot lines the log held before>]` after each run — the
#    count for a log a runner appends to — and `sweep_verdict <runner>` last:
#    exit 1 naming each one. `sweep_failed <name>` records any other failure
#    (a nested runner's non-zero exit).

SWEEP_TMP=${TMPDIR:-/tmp}; SWEEP_TMP=${SWEEP_TMP%/}
SWEEP_UD=$(mktemp -d "$SWEEP_TMP/clew-sweep-ud.XXXXXX") || { echo "sweep: no temporary folder for the profiles" >&2; exit 2; }
SWEEP_FAILED=""
sweep_cleanup() {
	case "$SWEEP_UD" in "$SWEEP_TMP"/clew-sweep-ud.??????) rm -rf "$SWEEP_UD" ;; esac
}
trap sweep_cleanup EXIT

sweep_ud() {
	mkdir -p "$SWEEP_UD/$1" && printf '%s' "$SWEEP_UD/$1"
}

sweep_failed() {
	SWEEP_FAILED="$SWEEP_FAILED $1"
}

sweep_booted() {
	local n=$1 log=$2 before=${3:-0} now
	now=$(grep -c 'smoke-boot:' "$log" 2>/dev/null)
	if [ "${now:-0}" -le "$before" ]; then
		echo "!!! $n: NEVER RAN — no smoke-boot: line from this run in $log (Electron exited before its window: a crash, a broken launch, or another Clew holding the profile)"
		sweep_failed "$n"
	fi
}

sweep_verdict() {
	[ -z "$SWEEP_FAILED" ] && return 0
	echo "$1: FAILED —$SWEEP_FAILED" | tee /dev/stderr
	exit 1
}
