#!/bin/bash
# The live sweep: every live-edit scenario on a fresh fixture, printing each
# scenario's assertion lines, then the cross-reference parity verdict.
#
#   node scripts/build.js && smoke/live-sweep.sh [out-dir]   (~8 minutes, measured 2026-09-27)
#
# Each block is one scenario's README recipe; logs and screenshots land in
# out-dir (default /tmp/clew-sweep). Compare the lines with smoke/README.md.
# Each scenario runs on a fresh profile of its own, and one that never
# started fails the sweep by name, exit 1 (smoke/sweep-lib.sh: until
# 2026-10-05 an open Clew.app made every run exit at once, "0 lines", exit 0).
cd "$(dirname "$0")/.."
node scripts/stale-check.mjs || { echo "live-sweep: dist/ is not built from these sources — nothing was run" >&2; exit 3; }
. smoke/sweep-lib.sh
S=${1:-/tmp/clew-sweep}
case "$S" in /|"$HOME"|"$HOME/"|.|..) echo "live-sweep: refusing to clear $S" >&2; exit 1;; esac
E=node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
rm -rf $S; mkdir -p $S
run() { local n=$1 v=$2; shift 2; env CLEW_SMOKE_LOG=1 CLEW_USER_DATA="$(sweep_ud "$n")" CLEW_SMOKE=$S/$n.png CLEW_SMOKE_SCRIPT=smoke/$n-scenario.js CLEW_SMOKE_VAULT=$v "$@" perl -e 'alarm shift; exec @ARGV' 240 $E . 2>&1 | grep -E "smoke-[a-z-]+:|smoke-[a-z]+-frame|ERROR|smoke failed" | grep -v smoke-asset > $S/$n.log; echo "=== $n: $(wc -l < $S/$n.log) lines"; cat $S/$n.log; sweep_booted "$n" "$S/$n.log"; }
rsync -a --exclude .clew demo-vault/ $S/v-le/; run live-edit $S/v-le
node smoke/make-live-vault.mjs $S/v-ll >/dev/null; run live-lines $S/v-ll
node smoke/make-live-vault.mjs $S/v-te >/dev/null; run live-table-edit $S/v-te
node smoke/make-live-vault.mjs $S/v-hl >/dev/null; run live-headerless-table $S/v-hl
node smoke/make-live-vault.mjs $S/v-nf >/dev/null; run live-nested-fence $S/v-nf
node smoke/make-hover-vault.mjs $S/v-lp; run link-preview $S/v-lp CLEW_SMOKE_FRAME_SCRIPT=smoke/link-preview-frame.js CLEW_SMOKE_FRAME_MATCH=__clew_block__
node smoke/make-live-vault.mjs $S/v-pp >/dev/null; run preview-pane $S/v-pp CLEW_SMOKE_FRAME_SCRIPT=smoke/preview-pane-frame.js CLEW_SMOKE_FRAME_MATCH=__clew_block__
node smoke/make-crossref-vault.mjs $S/v-xr; run crossref $S/v-xr CLEW_SMOKE_FRAME_SCRIPT=smoke/crossref-frame.js CLEW_SMOKE_FRAME_MATCH=vault/
node smoke/make-live-vault.mjs $S/v-sm >/dev/null; run slash-menu $S/v-sm
mkdir -p $S/v-fdm && printf '%s\n' '# Fixes' '' '```javascript' 'let i = 10;' 'function foo() {}' '```' '' 'Consider which $10\\alpha+$ holds.' '' '' 'Last line.' > $S/v-fdm/Fixes.md; run fence-dl-math $S/v-fdm
mkdir -p $S/v-fc && printf '%s\n' '# Chords' '' 'word' '' 'Last.' > $S/v-fc/Chords.md; run format-chords $S/v-fc
mkdir -p $S/v-el && printf '%s\n' '# Empty lines' '' 'Last line.' > $S/v-el/Empty.md; run empty-line-format $S/v-el
node smoke/make-live-vault.mjs $S/v-fn >/dev/null; run live-footnotes $S/v-fn
node smoke/make-citations-vault.mjs $S/v-ci; run citations $S/v-ci
node smoke/make-live-vault.mjs $S/v-sn >/dev/null; run sidenotes $S/v-sn CLEW_SMOKE_FRAME_SCRIPT=smoke/sidenotes-frame.js CLEW_SMOKE_FRAME_MATCH=Sidenotes.md
node smoke/make-pdf-vault.mjs $S/v-pa; run pdf-annotations $S/v-pa CLEW_SMOKE_FRAME_SCRIPT=smoke/pdf-annotations-frame.js CLEW_SMOKE_FRAME_MATCH=pdf-page
node smoke/make-citations-vault.mjs $S/v-cf; mkdir -p $S/v-cf/.clew; echo '{"bibliography":"refs.bib"}' > $S/v-cf/.clew/vault-settings.json; run citations-fullcite $S/v-cf CLEW_SMOKE_FRAME_SCRIPT=smoke/citations-fullcite-frame.js CLEW_SMOKE_FRAME_MATCH=__clew_block__
mkdir -p $S/v-fh && printf '%s\n' '# Footnotes' '' 'One line[^one: a short note with /italic/ and [[Target]].] on.' '' 'Two lines[^two: a note that runs past the' 'end of the line, still one paragraph.] on.' '' 'Two paragraphs[^three: the first paragraph of the note.' '' '	the second paragraph, /italic/ and [[Target]] again.] on.' '' 'Anonymous[fn: no label at all.] and grouped[^g(asides): in a group.] on.' '' 'A real [link](https://example.org) must still be a link.' > $S/v-fh/Footnotes.md; printf '# Target\n' > $S/v-fh/Target.md; run footnote-highlight $S/v-fh
mkdir -p $S/v-mh && printf '%s\n' '# Math' '' 'Star: the notation $R^*$ is incomplete, and here we need $R_w^*(S)$ instead.' '' 'Control: this *is strong* and this **is intense** in ordinary prose.' '' 'Delimiters: $x$, $$y$$, \(z\) and \[w\] all count.' '' 'Code: the shell `$PATH` and `$HOME` are not math.' '' 'Escaped: it costs \$5 and \$10 today.' > $S/v-mh/Math.md; run math-highlight $S/v-mh
mkdir -p $S/v-tb && printf '%s\n' '# Toolbar' '' 'alpha beta gamma' '' 'delta epsilon zeta' '' 'Last line.' > $S/v-tb/Toolbar.md; run live-toolbar $S/v-tb
rsync -a --exclude .clew demo-vault/ $S/v-pf/ && node -e "const f=require('fs');const s=f.readFileSync('$S/v-pf/Features/Diagrams.md','utf8');f.writeFileSync('$S/v-pf/Big.md', s.repeat(17))"; run live-perf $S/v-pf
c=$(grep -o 'clew-refs=.*' $S/crossref.log | cut -d= -f2-); e=$(grep -o 'engine-refs=.*' $S/crossref.log | cut -d= -f2-); ct=$(grep -o 'clew-targets=.*' $S/crossref.log | cut -d= -f2-); et=$(grep -o 'engine-targets=.*' $S/crossref.log | cut -d= -f2-)
[ -n "$c" ] && [ "$c" = "$e" ] && [ "$ct" = "$et" ] && echo "crossref numbers-match=true" || echo "crossref numbers-match=false"
sweep_verdict live-sweep
