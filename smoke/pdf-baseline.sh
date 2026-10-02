#!/bin/bash
# smoke/pdf-baseline.sh <out-dir>
# Every existing PDF surface, plus canvas, the caller token and the protocol
# tour, in one run: pdf-flush, pdf-flush-close (a real close, then a reopen),
# pdf-annotations, pdf-pen, pdf-scene (close, reopen), canvas-engage,
# canvas-esc, caller-token, then protocol-tour.sh. Prints the observation
# lines (timings masked) to stdout and the tour's to <out-dir>/tour-lines.txt.
# Run before and after a change and diff: `diff <(grep -v '^===' a.txt)
# <(grep -v '^===' b.txt)` and the two tour-lines.txt files.
set -u
R=$(cd "$(dirname "$0")/.." && pwd); O=$1; rm -rf "$O"; mkdir -p "$O"; cd "$R"
E=node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
run() { local n=$1 v=$2 ud=$3; shift 3; env CLEW_SMOKE_LOG=1 CLEW_USER_DATA=$ud CLEW_SMOKE=$O/$n.png CLEW_SMOKE_SCRIPT=$R/smoke/$n-scenario.js CLEW_SMOKE_VAULT=$v "$@" perl -e 'alarm shift; exec @ARGV' 300 $E . > $O/$n.log 2>&1; grep -E "smoke-[a-z]+(-frame)?( [0-9a-zA-Z%.?=]+)?:|smoke failed|smoke-windows|smoke-pdf-leak" $O/$n.log | grep -v "smoke-asset\|smoke-boot" | sed -E "s/^\[smoke:[a-z]+\] //; s/^/$n: /" | sed -E 's/(shown-ms|gone-ms)=[0-9]+/\1=N/g' | cut -c1-200; }
node smoke/make-pdf-vault.mjs $O/v1 >/dev/null; run pdf-flush $O/v1 $O/ud1
node smoke/make-pdf-vault.mjs $O/v2 >/dev/null; run pdf-flush-close $O/v2 $O/ud2 CLEW_SMOKE_CLOSE_WINDOW=1; run pdf-flush-close $O/v2 $O/ud2
node smoke/make-pdf-vault.mjs $O/v3 >/dev/null; run pdf-annotations $O/v3 $O/ud3 CLEW_SMOKE_FRAME_SCRIPT=$R/smoke/pdf-annotations-frame.js CLEW_SMOKE_FRAME_MATCH=pdf-page
node smoke/make-pdf-vault.mjs $O/v4 >/dev/null; printf '# Embed\n\n![[Paper.pdf]]\n' > $O/v4/Embed.md; run pdf-pen $O/v4 $O/ud4 CLEW_SMOKE_FRAME_SCRIPT=$R/smoke/pdf-pen-frame.js CLEW_SMOKE_FRAME_MATCH=vault/
node smoke/make-pdf-vault.mjs $O/v5 >/dev/null; node -e "require('fs').writeFileSync('$O/v5/Board.canvas', JSON.stringify({nodes:[{id:'p',type:'file',file:'Paper.pdf',x:0,y:0,width:520,height:640}],edges:[]}))"; printf '# Host\n\n![[Board.canvas]]\n' > $O/v5/Host.md; run pdf-scene $O/v5 $O/ud5 CLEW_SMOKE_CLOSE_WINDOW=1; rm -f $O/v5/.clew/workspace.json; run pdf-scene $O/v5 $O/ud5
node smoke/make-canvas-vault.mjs $O/v6 >/dev/null; run canvas-engage $O/v6 $O/ud6
# canvas-esc's "owner" card consumes Esc with its note's OWN script, which
# runs only in a vault the device trusts (frame-bridge.md §4): the fixture is
# opened as a KNOWN vault (recentVaults — the first-launch migration).
node smoke/make-canvas-vault.mjs $O/v7 >/dev/null; mkdir -p $O/ud7; printf '{ "recentVaults": ["%s"] }\n' "$O/v7" > $O/ud7/clew-settings.json; run canvas-esc $O/v7 $O/ud7 CLEW_SMOKE_FRAME_SCRIPT=$R/smoke/canvas-esc-frame.js CLEW_SMOKE_FRAME_MATCH=vault/
node smoke/make-token-vault.mjs $O/v8 >/dev/null; run caller-token $O/v8 $O/ud8 CLEW_SMOKE_FRAME_SCRIPT=$R/smoke/caller-token-frame.js CLEW_SMOKE_FRAME_MATCH=vault/
echo "=== tour"; smoke/protocol-tour.sh $O/tour > $O/tour.txt 2>&1; grep -h "smoke-tour" $O/tour.txt | grep -v smoke-boot | sort > $O/tour-lines.txt; wc -l < $O/tour-lines.txt; grep -rhi "smoke-pdf-leak" $O 2>/dev/null | head -3
echo "=== done"
