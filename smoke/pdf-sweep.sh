#!/bin/bash
# smoke/pdf-sweep.sh <out-dir> — phase 4's zero-leak sweep (docs/dev/
# pdf-unification.md §6 "As built"). protocol.js redirects a vault PDF that
# is asked for as a DOCUMENT to EmbedPDF and logs `smoke-pdf-leak:`; every
# Clew surface reaches the viewer before that, so a leak line anywhere but
# the deliberate one is a surface to fix. Runs pdf-baseline.sh (every PDF
# and canvas scenario plus the protocol tour), the §3 and §4 fixtures
# (pdf-rewrite, pdf-remote), the portal's two runs and the live sweep, then
# the deliberate leak, which must log exactly THREE (iframe at #page=3,
# embed, object), each ending in a loaded EmbedPDF.
#
#   node scripts/build.js && smoke/pdf-sweep.sh <out-dir>   (~25 minutes)
set -u
R=$(cd "$(dirname "$0")/.." && pwd); O=${1:?usage: pdf-sweep.sh <out-dir>}
case "$O" in /|"$HOME"|"$HOME/"|.|..) echo "pdf-sweep: refusing to clear $O" >&2; exit 1;; esac
rm -rf "$O"; mkdir -p "$O"; cd "$R"
E=node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
run() { local n=$1 v=$2 ud=$3; shift 3; env CLEW_SMOKE_LOG=1 CLEW_USER_DATA=$ud CLEW_SMOKE=$O/$n.png CLEW_SMOKE_SCRIPT=$R/smoke/$n-scenario.js CLEW_SMOKE_VAULT=$v "$@" perl -e 'alarm shift; exec @ARGV' 300 $E . >> $O/$n.log 2>&1; grep -hE "smoke-[a-z-]+:|smoke-[a-z]+-frame|smoke failed" $O/$n.log | grep -v "smoke-asset\|smoke-boot" | sed -E "s/^\[smoke:[a-z]+\] //; s/^/$n: /" | cut -c1-200; }

echo "=== baseline"; smoke/pdf-baseline.sh $O/baseline > $O/baseline.txt 2>&1; grep -v "^===" $O/baseline.txt | wc -l

echo "=== rewrite"
node smoke/make-pdf-vault.mjs $O/v-pr >/dev/null && mkdir -p "$O/v-pr/Notes/Week 1" && cp $O/v-pr/Paper.pdf "$O/v-pr/Notes/Week 1/local.pdf" && printf 'plain\n' > "$O/v-pr/Notes/Week 1/notes.txt" && cp smoke/pdf-rewrite-note.md "$O/v-pr/Notes/Week 1/Reading.md"
run pdf-rewrite $O/v-pr $O/ud-pr CLEW_SMOKE_FRAME_SCRIPT=$R/smoke/pdf-rewrite-frame.js CLEW_SMOKE_FRAME_MATCH=vault/

echo "=== remote"
node smoke/make-remote-pdf-vault.mjs $O/v-rp $O/ud-rp >/dev/null
run pdf-remote $O/v-rp $O/ud-rp CLEW_SMOKE_FRAME_SCRIPT=$R/smoke/pdf-remote-frame.js CLEW_SMOKE_FRAME_MATCH=pdf-page

echo "=== portal"
node smoke/make-pdf-vault.mjs $O/v-po >/dev/null && node -e "const fs=require('fs');
fs.writeFileSync('$O/v-po/Board.canvas', JSON.stringify({nodes:[{id:'p',type:'file',file:'Paper.pdf',x:0,y:0,width:400,height:520}],edges:[]}));
fs.writeFileSync('$O/v-po/Wall.canvas', JSON.stringify({nodes:[{id:'w',type:'file',file:'Board.canvas',x:0,y:0,width:600,height:700}],edges:[]}))"
run pdf-portal $O/v-po $O/ud-po; rm -f $O/v-po/.clew/workspace.json; run pdf-portal $O/v-po $O/ud-po

echo "=== live"; smoke/live-sweep.sh $O/live > $O/live.txt 2>&1; grep -c "^===" $O/live.txt

echo "=== leak"
node smoke/make-pdf-vault.mjs $O/v-lk >/dev/null && cp smoke/pdf-leak-note.md $O/v-lk/Leak.md
run pdf-leak $O/v-lk $O/ud-lk CLEW_SMOKE_FRAME_SCRIPT=$R/smoke/pdf-leak-frame.js CLEW_SMOKE_FRAME_MATCH=clewpdf/pdf-page

echo "=== verdict"
stray=$(grep -rh "smoke-pdf-leak" $O --include='*.log' --include='*.txt' --exclude=pdf-leak.log | grep -v "^pdf-leak: " | sort -u)
caught=$(grep -c "smoke-pdf-leak" $O/pdf-leak.log)
viewers=$(grep -c "smoke-leak-frame: .*loaded=true" $O/pdf-leak.log)
echo "stray leaks: $(printf '%s' "$stray" | grep -c .)"; [ -n "$stray" ] && printf '%s\n' "$stray" | head -5
echo "deliberate: caught=$caught viewers=$viewers (want 3 and 3)"
