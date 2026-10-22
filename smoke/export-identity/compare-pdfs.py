# Whether the .tex files that changed between two export-identity runs still
# PRINT alike: each is compiled from both runs' copies by LuaLaTeX (latexmk),
# and the PDFs compared — their text (pdftotext -layout), every page's pixels
# (pdftoppm at 60 dpi, PIL) and the fonts they embed (pdffonts). How C4
# (Garamond-Math only with maths, 2026-10-22) showed 61 notes printing
# identically, and found the four whose footnote marks moved before it.
#
#   python3 -I smoke/export-identity/compare-pdfs.py <before-out> <after-out> <work-dir>
#
# Needs latexmk and LuaLaTeX, poppler's tools and Pillow. The work dir is
# made fresh (refused if it holds anything); the runs' out/ folders are
# copied into it, never compiled in place. A note that makes no PDF either
# way (a document of no pages) is said so apart; one that makes a PDF only one
# way differs. Exit: 0 every changed .tex prints alike (or fails alike) · 1
# one differs.
import concurrent.futures as cf
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageChops

if len(sys.argv) != 4:
    sys.exit('usage: compare-pdfs.py <before-out> <after-out> <work-dir>')
before, after, work = sys.argv[1:4]
if os.path.exists(work) and os.listdir(work):
    sys.exit(f'compare-pdfs: {work} is not empty')


def shas(out):
    rows = (line.rstrip('\n').split('  ', 1) for line in open(os.path.join(out, 'outputs.sha'), encoding='utf-8'))
    return {p: h for h, p in rows}


a, b = shas(before), shas(after)
changed = sorted(p for p in a.keys() & b.keys() if p.startswith('out/') and p.endswith('.tex') and a[p] != b[p])
print(f'compare-pdfs: {len(changed)} .tex changed')
env = dict(os.environ, PATH='/Library/TeX/texbin:/opt/homebrew/bin:/usr/local/bin:' + os.environ.get('PATH', ''))
for side, src in (('a', before), ('b', after)):
    shutil.copytree(os.path.join(src, 'vault', 'out'), os.path.join(work, side))


def build(side, name):
    d = os.path.join(work, side)
    base = name[:-4]
    subprocess.run(['latexmk', '-norc', '-lualatex', '-g', '-interaction=nonstopmode', '-quiet', name], cwd=d, env=env, capture_output=True, timeout=300)
    pdf = os.path.join(d, base + '.pdf')
    if not os.path.exists(pdf) or os.path.getsize(pdf) == 0:
        return None
    text = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, env=env).stdout
    fonts = sorted({ln.split()[0].split('+')[-1] for ln in subprocess.run(['pdffonts', pdf], capture_output=True, text=True, env=env).stdout.split('\n')[2:] if ln.strip()})
    stem = os.path.join(d, base + '-page')
    subprocess.run(['pdftoppm', '-r', '60', '-png', pdf, stem], env=env, capture_output=True)
    pages = sorted(os.path.join(d, f) for f in os.listdir(d) if f.startswith(os.path.basename(stem)) and f.endswith('.png'))
    return dict(text=text, fonts=fonts, pages=pages)


def one(path):
    name = path[len('out/'):]
    x, y = build('a', name), build('b', name)
    if x is None and y is None:
        return f'{name}: no PDF either way (the same failure both ways)'
    if x is None or y is None:
        return f'{name}: PDF made before={x is not None} after={y is not None}'
    same_px = len(x['pages']) == len(y['pages']) and all(
        ImageChops.difference(Image.open(p).convert('RGB'), Image.open(q).convert('RGB')).getbbox() is None for p, q in zip(x['pages'], y['pages']))
    fonts = sorted(set(x['fonts']) ^ set(y['fonts']))
    return f"{name}: text={'same' if x['text'] == y['text'] else 'DIFFERS'} pixels={'same' if same_px else 'DIFFER'} pages={len(x['pages'])} fonts-differ={fonts}"


with cf.ThreadPoolExecutor(3) as pool:
    rows = list(pool.map(one, changed))
for r in rows:
    print(r)
alike = sum('text=same pixels=same' in r and 'fonts-differ=[]' in r for r in rows)
neither = sum('no PDF either way' in r for r in rows)
print(f'compare-pdfs: {alike} of {len(rows)} print alike (text, pixels and fonts); {neither} make no PDF either way; {len(rows) - alike - neither} differ')
sys.exit(0 if alike + neither == len(rows) else 1)
