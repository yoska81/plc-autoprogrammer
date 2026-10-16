"""PDF checks for every variant: page sizes (drawings ANSI B 17x11 landscape, documents Letter),
text free of undefined / NaN / [object Object] / replacement glyphs, 'Page x of y' numbering
consistent, table of contents page numbers pointing at the right pages, and a 60 dpi render of
every page into tools/out/<variant>/pages/ for a visual pass (pdftoppm).
Usage: tools/.venv/bin/python tools/check_pdf.py [--no-render] [variant ...]
"""
import re
import subprocess
import sys
from pathlib import Path

from pypdf import PdfReader

OUT = Path(__file__).parent / 'out'
PT = 72 / 25.4
results = []
BAD = [r'\bundefined\b', r'\bNaN\b', r'\[object Object\]', r'\bnull\b', r'Infinity', '�', r'\$\{']


def report(level, where, msg):
    results.append((level, where, msg))


def size_name(w, h):
    w_in, h_in = w / 72, h / 72
    for name, (a, b) in {'ANSI B': (17, 11), 'Letter': (11, 8.5), 'Letter portrait': (8.5, 11), 'ANSI B portrait': (11, 17), 'A4': (297 / 25.4, 210 / 25.4), 'A4 portrait': (210 / 25.4, 297 / 25.4)}.items():
        if abs(w_in - a) < 0.02 and abs(h_in - b) < 0.02:
            return name
    return f'{w_in:.2f}x{h_in:.2f}in'


def check_pdf(path: Path, kind: str, render: bool, vname: str):
    where = f'{vname}/{path.name}'
    try:
        r = PdfReader(path)
    except Exception as e:  # noqa: BLE001
        report('FAIL', where, f'cannot open: {e}')
        return
    n = len(r.pages)
    sizes = {}
    texts = []
    for i, pg in enumerate(r.pages):
        w, h = float(pg.mediabox.width), float(pg.mediabox.height)
        rot = (pg.get('/Rotate') or 0) % 180
        if rot:
            w, h = h, w
        sizes.setdefault(size_name(w, h), []).append(i + 1)
        try:
            t = pg.extract_text() or ''
        except Exception as e:  # noqa: BLE001
            t = ''
            report('WARN', where, f'p{i + 1}: text extraction failed {e}')
        texts.append(t)
        for pat in BAD:
            for m in re.finditer(pat, t):
                ctx = t[max(0, m.start() - 40):m.end() + 40].replace('\n', ' ')
                report('FAIL', where, f'p{i + 1}: "{m.group(0)}" in "…{ctx}…"')
        if len(t.strip()) < 20 and kind not in ('hmi', 'labels'):
            report('WARN', where, f'p{i + 1}: almost no text ({len(t.strip())} chars)')
    want = {'drawings': {'ANSI B'}, 'doc': {'Letter portrait', 'Letter'}, 'hmi': {'Letter'},
            'bundle': {'Letter portrait', 'Letter', 'ANSI B'}, 'labels': None}[kind]
    for s, pages in sizes.items():
        if want is not None and s not in want:
            report('FAIL', where, f'pages {pages[:8]} are {s}, expected {sorted(want)}')
    print(f'{where}: {n} pages, sizes {{{", ".join(f"{k}: {len(v)}" for k, v in sizes.items())}}}')
    # Page x of y / Sheet x of y
    for i, t in enumerate(texts):
        for m in re.finditer(r'(?:Page|Sheet|SHEET)\s+(\d+)\s+(?:of|OF)\s+(\d+)' if kind == 'drawings' else r'(?:Page|PAGE)\s+(\d+)\s+(?:of|OF)\s+(\d+)', t):
            a, b = int(m.group(1)), int(m.group(2))
            if kind in ('bundle', 'labels'):
                continue  # merged documents keep their own numbering
            if kind != 'drawings' and (a != i + 1 or b != n):
                report('FAIL', where, f'p{i + 1}: says "{m.group(0)}" (document has {n} pages)')
            if kind == 'drawings' and (b != n or a < 1 or a > n):
                report('FAIL', where, f'p{i + 1}: says "{m.group(0)}" (set has {n} sheets)')
    # Table of contents: lines "<title> ....... <page>" on the first pages
    if kind == 'doc':
        toc = []
        for i, t in enumerate(texts[:4]):
            if re.search(r'contents', t, re.I):
                for line in t.splitlines():
                    m = (re.match(r'^\s*(.{3,90}?)\s+(\d{1,3})\s*\.{3,}\s*$', line)
                         or re.match(r'^\s*(.{3,90}?)\s*\.{3,}\s*(\d{1,3})\s*$', line))
                    if m and int(m.group(2)) <= n:
                        toc.append((m.group(1).strip(), int(m.group(2))))
        bad = 0
        for title, pg in toc:
            key = re.sub(r'^\d+(\.\d+)*\.?\s+', '', title)[:28].lower()
            norm = lambda s: re.sub(r'\s+', ' ', s).lower()  # noqa: E731
            if key and key not in norm(texts[pg - 1]):
                found = [j + 1 for j, t in enumerate(texts) if key in norm(t) and j > 1]
                if found and pg not in found:
                    bad += 1
                    report('FAIL', where, f'TOC "{title}" -> p{pg}, but heading found on p{found[:3]}')
        print(f'  TOC entries checked: {len(toc)}, wrong: {bad}')
    if render:
        d = path.parent.parent / 'pages' if path.parent.name != vname else path.parent / 'pages'
        d = OUT / vname / 'pages' / path.stem
        d.mkdir(parents=True, exist_ok=True)
        subprocess.run(['pdftoppm', '-r', '60', '-png', str(path), str(d / 'p')], check=False)
    # fonts: glyphs outside WinAnsi drawn with the standard fonts become garbage
    return texts


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    render = '--no-render' not in sys.argv
    names = args or sorted(p.name for p in OUT.iterdir() if (p / 'data.json').exists())
    for v in names:
        z = OUT / v / 'zip'
        for p in sorted(z.rglob('*.pdf')):
            kind = ('drawings' if p.name.endswith('_drawings.pdf') else 'hmi' if 'hmi' in p.name
                    else 'bundle' if p.name.endswith('_full_package.pdf') else 'labels' if 'labels' in p.name else 'doc')
            check_pdf(p, kind, render, v)
    for lvl, where, msg in results:
        print(f'{lvl:4} {where}: {msg}')
    fails = [r for r in results if r[0] == 'FAIL']
    print(f'PDF: {len(fails)} FAIL, {len(results) - len(fails)} WARN')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
