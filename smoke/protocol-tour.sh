#!/bin/bash
# The protocol tour: every demo note that reads clew-preview:// — maps,
# canvas scenes, drawings, PDFs, figures, maths, plugins, the note API — one
# run each over a scratch copy of the demo vault, plus the demo canvas as a
# canvas tab (its text cards POST fragments from the app page). Prints each
# run's lines and any console error that smells of CORS or a failed load.
#
#   node scripts/build.js && smoke/protocol-tour.sh [out-dir]
cd "$(dirname "$0")/.."
S=${1:-/tmp/clew-tour}
case "$S" in /|"$HOME"|"$HOME/"|.|..) echo "protocol-tour: refusing to clear $S" >&2; exit 1;; esac
E=node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
rm -rf "$S"; mkdir -p "$S"
rsync -a --exclude .clew/cache --exclude .clew/history --exclude .clew/workspace.json demo-vault/ "$S/v/"
for target in "Welcome.md" "Guide/Canvas.md" "Guide/Drawings.md" "Guide/Attachments and Files.md" \
	"Guide/Links and Embeds.md" "Guide/Dashboards.md" "Features/Maps.md" "Features/Diagrams.md" \
	"Features/Math and Theorems.md" "Features/Media Gallery.md" "Features/API Playground.md" \
	"Features/Citations.md" "Projects/Demo Canvas.canvas"; do
	printf '%s' "$target" > "$S/v/tour-target.txt"
	rm -f "$S/v/.clew/workspace.json"; rm -rf "$S/ud"
	match=$(basename "$target"); match=${match// /%20}
	env CLEW_SMOKE_LOG=1 CLEW_USER_DATA="$S/ud" CLEW_SMOKE="$S/shot.png" CLEW_SMOKE_SCRIPT="$PWD/smoke/protocol-tour-scenario.js" \
		CLEW_SMOKE_VAULT="$S/v" CLEW_SMOKE_FRAME_SCRIPT="$PWD/smoke/protocol-tour-frame.js" CLEW_SMOKE_FRAME_MATCH="$match" \
		perl -e 'alarm shift; exec @ARGV' 120 "$E" . > "$S/run.log" 2>&1
	grep -E "smoke-tour(-frame)?[ :]" "$S/run.log" | sed -E 's/^\[smoke:[a-z]+\] //'
	grep -iE "CORS|blocked by|Failed to load|net::ERR|Access-Control" "$S/run.log" | grep -v smoke-asset | sed -E 's/^/  ! /' | cut -c1-220 | sort -u | head -5
done
git -C "$(dirname "$0")/.." status --short demo-vault | head -3
