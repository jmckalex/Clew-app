#!/bin/bash
# smoke/render-dump.sh <out-dir> [known]
# Every note of demo-vault and study-vault rendered through the real preview
# (render-dump-scenario.js), one sorted `smoke-rd: <path> <sha1>` file per
# vault: <out-dir>/demo-vault.txt, <out-dir>/study-vault.txt. Run it before
# and after an ENGINE (or rendering) change and diff the two dirs — a change
# must alter no note it does not name. Copies each vault (renders fill its
# .clew/cache) into <out-dir>; `known` lists the copy under recentVaults in
# a fresh userData first, so the vault opens as one this device already
# trusts (the vault-trust guard) — without it the copy opens restricted.
set -u
R=$(cd "$(dirname "$0")/.." && pwd); O=$1; KNOWN=${2:-}
E=$R/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
mkdir -p "$O"
for v in demo-vault study-vault; do
	W=$O/work-$v; rm -rf "$W"; mkdir -p "$W"
	rsync -a --exclude .clew "$R/$v/" "$W/vault/"
	if [ -n "$KNOWN" ]; then mkdir -p "$W/ud"; printf '{ "recentVaults": ["%s"] }\n' "$W/vault" > "$W/ud/clew-settings.json"; fi
	(cd "$R" && env CLEW_SMOKE_LOG=1 CLEW_USER_DATA="$W/ud" CLEW_SMOKE="$W/shot.png" \
		CLEW_SMOKE_SCRIPT="$R/smoke/render-dump-scenario.js" CLEW_SMOKE_VAULT="$W/vault" \
		perl -e 'alarm shift; exec @ARGV' 600 "$E" . > "$W/run.log" 2>&1)
	grep -h "smoke-rd:" "$W/run.log" | sed -E 's/^\[smoke:[a-z]+\] //' | sort > "$O/$v.txt"
	printf '%s: %s lines, errors %s\n' "$v" "$(wc -l < "$O/$v.txt" | tr -d ' ')" "$(grep -c ERROR "$O/$v.txt")"
done
