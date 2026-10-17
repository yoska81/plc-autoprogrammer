"""Excel report checks: every sheet non-empty with a header row, no NaN / undefined / null /
[object Object] text, numeric-looking cells stored as numbers (not text), no formula errors.
Usage: tools/.venv/bin/python tools/check_xlsx.py [variant ...]
"""
import re
import sys
from pathlib import Path

import openpyxl

OUT = Path(__file__).parent / 'out'
results = []
BAD = re.compile(r'\bundefined\b|\bNaN\b|\[object Object\]|^null$|Infinity|#(?:REF|VALUE|DIV/0|NAME|N/A)!?')
# Text that is a plain number (allow thousands separators); addresses like X001 or wire 101 in
# ID-like columns are legitimately text, so only flag columns whose header says qty / amps / etc.
NUMERIC_HDR = re.compile(r'\b(qty|quantity|count|amps?|current|fla|hp|watts?|heat|load|cores|rung|preset|spares?|length \(|size \(mm\)|value)\b', re.I)
NUM = re.compile(r'^-?\d+(?:\.\d+)?$')


def report(level, where, msg):
    results.append((level, where, msg))


def check(path: Path, v: str):
    wb = openpyxl.load_workbook(path)
    print(f'{v}/{path.name}: sheets {wb.sheetnames}')
    for ws in wb.worksheets:
        where = f'{v}/{ws.title}'
        rows = list(ws.iter_rows(values_only=True))
        nonempty = [r for r in rows if any(c not in (None, '') for c in r)]
        if len(nonempty) < 2:
            report('FAIL', where, f'sheet has {len(nonempty)} non-empty row(s)')
            continue
        # header row = first row with >= 2 text cells
        hdr_i = next((i for i, r in enumerate(rows) if sum(isinstance(c, str) and c.strip() != '' for c in r) >= min(2, max(1, ws.max_column))), None)
        if hdr_i is None:
            report('FAIL', where, 'no header row')
            continue
        hdr = [str(c or '') for c in rows[hdr_i]]
        for ri, r in enumerate(rows, start=1):
            for ci, c in enumerate(r):
                if isinstance(c, str) and BAD.search(c):
                    report('FAIL', where, f'{openpyxl.utils.get_column_letter(ci + 1)}{ri}: "{c[:80]}"')
                if isinstance(c, float) and (c != c):
                    report('FAIL', where, f'{openpyxl.utils.get_column_letter(ci + 1)}{ri}: NaN number')
        # numbers stored as text under numeric headers
        for ci, h in enumerate(hdr):
            if not NUMERIC_HDR.search(h):
                continue
            as_text = [(ri, r[ci]) for ri, r in enumerate(rows[hdr_i + 1:], start=hdr_i + 2) if ci < len(r) and isinstance(r[ci], str) and NUM.match(r[ci].strip())]
            if as_text:
                report('FAIL', where, f'column "{h}": {len(as_text)} number(s) stored as text, e.g. row {as_text[0][0]} "{as_text[0][1]}"')


def main():
    names = sys.argv[1:] or sorted(p.name for p in OUT.iterdir() if (p / 'data.json').exists())
    for v in names:
        for p in (OUT / v / 'zip').glob('*.xlsx'):
            check(p, v)
    for lvl, where, msg in results:
        print(f'{lvl:4} {where}: {msg}')
    fails = [r for r in results if r[0] == 'FAIL']
    print(f'XLSX: {len(fails)} FAIL')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
