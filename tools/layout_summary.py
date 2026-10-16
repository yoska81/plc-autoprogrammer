"""Back-panel layout summary per variant (rails, parts placed / not fitting, lowest used point).
Usage: tools/.venv/bin/python tools/layout_summary.py [variant ...]"""
import json
import sys
from pathlib import Path

OUT = Path(__file__).parent / 'out'
names = sys.argv[1:] or sorted(p.name for p in OUT.iterdir() if (p / 'data.json').exists())
for n in names:
    d = json.loads((OUT / n / 'data.json').read_text())
    L = d['layout']
    bp = L['backplate']
    placed = [i for i in L['items'] if i['category'] not in ('groundBar',)]
    low = max((i['y'] + i['h'] for i in L['items']), default=0) - bp['y']
    used = sum(i['w'] * i['h'] for i in placed) / (bp['w'] * bp['h'])
    sp = d.get('spare') or {}
    sps = f"  spare {sp.get('panel', 0):.0%} (rails {', '.join(f'{r['spare']:.0%}' for r in sp.get('rails', []))}; +{sp.get('extraRails', 0)} rails)" if sp else ''
    print(f"{n:6} panel {bp['w']:.0f}x{bp['h']:.0f}  rails {len(L['rails'])}  placed {len(placed)}  not fit {len(L['notFit'])} {[x['tag'] for x in L['notFit']]}  lowest {low:.0f} mm  device area {used:.0%}{sps}")

# ---- geometry checks: parts inside the back panel, no part overlaps another part or a duct
fails = 0
for n in names:
    d = json.loads((OUT / n / 'data.json').read_text())
    L = d['layout']
    bp = L['backplate']
    its = L['items']
    def ov(a, b, tol=0.05):
        return a['x'] < b['x'] + b['w'] - tol and b['x'] < a['x'] + a['w'] - tol and a['y'] < b['y'] + b['h'] - tol and b['y'] < a['y'] + a['h'] - tol
    for i, a in enumerate(its):
        if a['x'] < bp['x'] - 0.05 or a['y'] < bp['y'] - 0.05 or a['x'] + a['w'] > bp['x'] + bp['w'] + 0.05 or a['y'] + a['h'] > bp['y'] + bp['h'] + 0.05:
            print(f'FAIL {n}: {a["label"]} outside the back panel'); fails += 1
        for b in its[i + 1:]:
            if ov(a, b):
                print(f'FAIL {n}: {a["label"]} overlaps {b["label"]}'); fails += 1
        for dct in L['ducts']:
            if ov(a, dct):
                print(f'FAIL {n}: {a["label"]} overlaps a wire duct at y={dct["y"]:.0f}'); fails += 1
print(f'LAYOUT: {fails} FAIL')
sys.exit(1 if fails else 0)
