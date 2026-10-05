#!/bin/bash
# smoke/render-dump.sh <out-dir> [known] [clew]
# Every note of demo-vault and study-vault rendered through the real preview
# (render-dump-scenario.js), one sorted `smoke-rd: <path> <sha1>` file per
# vault: <out-dir>/demo-vault.txt, <out-dir>/study-vault.txt (and each
# note whose build warned, `<vault>-warnings.txt`: path, count, lint codes). Run it before
# and after an ENGINE (or rendering) change and diff the two dirs — a change
# must alter no note it does not name. Copies each vault (renders fill its
# .clew/cache) into <out-dir>; `known` lists the copy under recentVaults in
# a fresh userData first, so the vault opens as one this device already
# trusts (the vault-trust guard) — without it the copy opens restricted.
# `clew` also copies the vault's own .clew/vault-settings.json, plugins and
# scripts, so the dump covers what a vault's code adds to its documents
# (plugin engine surfaces and injected script tags) — the copy is otherwise
# made WITHOUT .clew. Pass `-` for `known` to keep it restricted. Each vault
# runs on a fresh profile (smoke/sweep-lib.sh); one that never started fails
# the dump by name (exit 1).
set -u
R=$(cd "$(dirname "$0")/.." && pwd); O=$1; KNOWN=${2:-}; CLEW=${3:-}
[ "$KNOWN" = "-" ] && KNOWN=""
(cd "$R" && node scripts/stale-check.mjs) || { echo "render-dump: dist/ is not built from these sources — nothing was run" >&2; exit 3; }
. "$R/smoke/sweep-lib.sh"
E=$R/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
mkdir -p "$O"
for v in demo-vault study-vault; do
	W=$O/work-$v; rm -rf "$W"; mkdir -p "$W"
	rsync -a --exclude .clew "$R/$v/" "$W/vault/"
	if [ -n "$CLEW" ]; then
		mkdir -p "$W/vault/.clew"
		for f in vault-settings.json plugins scripts; do
			[ -e "$R/$v/.clew/$f" ] && cp -R "$R/$v/.clew/$f" "$W/vault/.clew/"
		done
	fi
	U=$(sweep_ud "$v")
	if [ -n "$KNOWN" ]; then printf '{ "recentVaults": ["%s"] }\n' "$W/vault" > "$U/clew-settings.json"; fi
	(cd "$R" && env CLEW_SMOKE_LOG=1 CLEW_USER_DATA="$U" CLEW_SMOKE="$W/shot.png" \
		CLEW_SMOKE_SCRIPT="$R/smoke/render-dump-scenario.js" CLEW_SMOKE_VAULT="$W/vault" \
		perl -e 'alarm shift; exec @ARGV' 600 "$E" . > "$W/run.log" 2>&1)
	sweep_booted "$v" "$W/run.log"
	grep -h "smoke-rd:" "$W/run.log" | sed -E 's/^\[smoke:[a-z]+\] //' | sort > "$O/$v.txt"
	grep -h "smoke-rdw:" "$W/run.log" | sed -E 's/^\[smoke:[a-z]+\] //' | sort > "$O/$v-warnings.txt"
	printf '%s: %s lines, errors %s\n' "$v" "$(wc -l < "$O/$v.txt" | tr -d ' ')" "$(grep -c ERROR "$O/$v.txt")"
done
sweep_verdict render-dump
