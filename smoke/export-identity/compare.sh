#!/bin/bash
# Two export-identity runs side by side (run.sh's out-dirs, before and after a
# change): whether every result line is the same, and which outputs changed,
# were added or went — each changed .tex or .html with its line counts (the
# diff itself: `diff -u <before>/vault/<path> <after>/vault/<path>`).
#
#   smoke/export-identity/compare.sh <before-out> <after-out>
#
# Exit: 0 no output changed · 1 outputs changed (listed) · 2 bad arguments.
A=${1:-}; B=${2:-}
[ -f "$A/outputs.sha" ] && [ -f "$B/outputs.sha" ] || { echo "usage: smoke/export-identity/compare.sh <before-out> <after-out> (run.sh's)" >&2; exit 2; }
if diff -q "$A/lines.txt" "$B/lines.txt" > /dev/null; then
	echo "result lines: identical ($(grep -c . "$B/lines.txt"))"
else
	echo "result lines: DIFFER"; diff "$A/lines.txt" "$B/lines.txt" | sed 's/^/  /'
fi
paths() { sed 's/^[0-9a-f]*  //' "$1/outputs.sha"; }
changed=0
while IFS= read -r p; do
	a=$(grep -F "  $p" "$A/outputs.sha" | head -1 | cut -d' ' -f1)
	b=$(grep -F "  $p" "$B/outputs.sha" | head -1 | cut -d' ' -f1)
	if [ -z "$a" ]; then echo "  added    $p"; changed=1
	elif [ -z "$b" ]; then echo "  removed  $p"; changed=1
	elif [ "$a" != "$b" ]; then
		changed=1
		case "$p" in
			*.tex|*.html) echo "  changed  $p ($(diff "$A/vault/$p" "$B/vault/$p" | grep -c '^<') lines out, $(diff "$A/vault/$p" "$B/vault/$p" | grep -c '^>') in)";;
			*) echo "  changed  $p";;
		esac
	fi
done < <( (paths "$A"; paths "$B") | LC_ALL=C sort -u)
total=$(wc -l < "$B/outputs.sha" | tr -d ' ')
[ "$changed" -eq 0 ] && echo "outputs: all $total identical" || { echo "outputs: changes above, of $total"; exit 1; }
