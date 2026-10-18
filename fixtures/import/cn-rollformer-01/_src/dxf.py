"""Write drawings.dxf from the geometry.json that build.mjs exports (sheets 2, 3, 5, 6:
power distribution, motor/servo power, relay control 1 and 2). Each sheet sits in model
space at x offset (index * 450 mm), y up, same mm coordinates as the PDF. Text uses a
Chinese CAD style (gbenor.shx + gbcbig.shx), entities are on layers by meaning.

Usage: python -I dxf.py <geometry.json> <out.dxf>
Needs ezdxf (tools/.venv).
"""
import json
import math
import sys

import ezdxf
from ezdxf.enums import TextEntityAlignment

H = 297.0
GAP = 450.0
LAYERS = {
    'FRAME': (8, 50), 'TITLE': (8, 25), 'WIRE': (1, 30), 'SYM': (7, 25), 'TEXT': (7, 18), 'TAG': (3, 25),
    'PIN': (8, 13), 'XREF': (5, 13), 'WIRENO': (4, 13), 'TERM': (6, 18), 'NOTE': (7, 18), 'TABLE': (8, 18),
}
ALIGN = {'start': TextEntityAlignment.LEFT, 'middle': TextEntityAlignment.CENTER, 'end': TextEntityAlignment.RIGHT}


def main():
    src, out = sys.argv[1:3]
    geo = json.load(open(src, encoding='utf-8'))
    doc = ezdxf.new('R2018', setup=True, units=ezdxf.units.MM)
    doc.header['$LTSCALE'] = 0.25
    doc.header['$INSUNITS'] = 4
    doc.styles.add('GB', font='gbenor.shx').dxf.bigfont = 'gbcbig.shx'
    for name, (color, lw) in LAYERS.items():
        doc.layers.add(name, color=color, lineweight=lw)
    msp = doc.modelspace()
    for i, sh in enumerate(geo['sheets']):
        ox = i * GAP
        P = lambda x, y: (ox + x, H - y)  # noqa: E731
        for it in sh['items']:
            layer = it.get('layer', 'SYM')
            attrs = {'layer': layer}
            if it.get('dash'):
                attrs['linetype'] = 'DASHED'
            t = it['t']
            if t == 'line':
                msp.add_line(P(it['x1'], it['y1']), P(it['x2'], it['y2']), dxfattribs=attrs)
            elif t == 'poly':
                msp.add_lwpolyline([P(*p) for p in it['pts']], close=it.get('closed', False), dxfattribs=attrs)
                if it.get('fill') == '#000':
                    h = msp.add_hatch(color=7, dxfattribs={'layer': layer})
                    h.paths.add_polyline_path([P(*p) for p in it['pts']], is_closed=True)
            elif t == 'rect':
                x, y, w, hh = it['x'], it['y'], it['wd'], it['ht']
                pts = [P(x, y), P(x + w, y), P(x + w, y + hh), P(x, y + hh)]
                if it.get('w', 1) > 0.05:
                    msp.add_lwpolyline(pts, close=True, dxfattribs=attrs)
                if it.get('fill') == '#000':
                    h = msp.add_hatch(color=7, dxfattribs={'layer': layer})
                    h.paths.add_polyline_path(pts, is_closed=True)
            elif t == 'circle':
                c = P(it['cx'], it['cy'])
                msp.add_circle(c, it['r'], dxfattribs=attrs)
                if it.get('fill') == '#000':
                    h = msp.add_hatch(color=7, dxfattribs={'layer': layer})
                    ep = h.paths.add_edge_path()
                    ep.add_arc(c, it['r'], 0, 360)
            elif t == 'arc':
                # SVG angles are clockwise (y down); DXF arcs run counter-clockwise (y up)
                msp.add_arc(P(it['cx'], it['cy']), it['r'], -it['a2'], -it['a1'], dxfattribs=attrs)
            elif t == 'text':
                s = it.get('s') or ''
                if not s:
                    continue
                txt = msp.add_text(s, height=round(it['size'] * 0.72, 3),
                                   dxfattribs={'layer': layer, 'style': 'GB', 'rotation': -it.get('rot', 0), 'width': 0.9})
                txt.set_placement(P(it['x'], it['y']), align=ALIGN[it.get('anchor', 'start')])
        # sheet label outside the frame, handy when browsing model space
        lbl = msp.add_text(f"SHEET {sh['no']}  {sh['cn']}  {sh['en']}", height=5,
                           dxfattribs={'layer': 'TITLE', 'style': 'GB'})
        lbl.set_placement((ox + 25, H + 6), align=TextEntityAlignment.LEFT)
    doc.set_modelspace_vport(height=H * 1.2, center=(len(geo['sheets']) * GAP / 2, H / 2))
    auditor = doc.audit()
    doc.saveas(out, encoding='utf-8')
    n = sum(1 for _ in msp)
    print(f'{out}: {len(geo["sheets"])} sheets, {n} entities, audit errors {len(auditor.errors)}, fixes {len(auditor.fixes)}')
    if math.isnan(n):
        sys.exit(1)


if __name__ == '__main__':
    main()
