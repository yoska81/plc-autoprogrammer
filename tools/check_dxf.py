"""DXF machining checks (back panel drilling, door cutouts) for every variant in tools/out.

For each of mm / inch / cut-only exports:
  - units header ($INSUNITS 4 mm / 1 inch, $MEASUREMENT 1 / 0)
  - closed OUTLINE equals the catalog back-panel / enclosure size 1:1 (0.05 mm)
  - every hole / cutout inside the outline with a sensible edge distance
  - no duplicate or overlapping holes / cutouts
  - standard diameters (22.5 operators, HMI cutout from the HMI catalog)
  - cut-only file has only OUTLINE / HOLES / CUTOUTS
  - coordinates identical to the drilling plan (= the drilling sheets' hole tables)
Usage: tools/.venv/bin/python tools/check_dxf.py [variant ...]
"""
import json
import math
import sys
from pathlib import Path

import ezdxf

OUT = Path(__file__).parent / 'out'
TOL = 0.05  # mm
EDGE_MIN = 8.0  # mm, hole edge to part edge
results: list[tuple[str, str, str]] = []


def report(level: str, where: str, msg: str):
    results.append((level, where, msg))


def ents(doc, layer=None):
    return [e for e in doc.modelspace() if layer is None or e.dxf.layer == layer]


def poly_pts(e):
    if e.dxftype() == 'POLYLINE':
        return [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
    if e.dxftype() == 'LWPOLYLINE':
        return [(p[0], p[1]) for p in e.get_points()]
    return []


def bbox(pts):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def check_file(path: Path, plan: dict, expect_w: float, expect_h: float, units: str, cut: bool, hmi_cut):
    where = f'{path.parent.parent.name}/{path.name}'
    k = 25.4 if units == 'in' else 1.0  # drawing unit -> mm
    try:
        doc = ezdxf.readfile(path)
    except Exception as e:  # noqa: BLE001
        report('FAIL', where, f'ezdxf cannot read: {e}')
        return
    audit = doc.audit()
    if audit.has_errors:
        report('FAIL', where, f'audit errors: {[str(x.message) for x in audit.errors][:5]}')
    ins = doc.header.get('$INSUNITS')
    meas = doc.header.get('$MEASUREMENT')
    want = (1, 0) if units == 'in' else (4, 1)
    if (ins, meas) != want:
        report('FAIL', where, f'units header $INSUNITS={ins} $MEASUREMENT={meas}, expected {want}')
    layers = {e.dxf.layer for e in doc.modelspace()}
    if cut:
        extra = layers - {'OUTLINE', 'HOLES', 'CUTOUTS'}
        if extra:
            report('FAIL', where, f'cut-only file has extra layers {sorted(extra)}')
        if any(e.dxftype() == 'TEXT' for e in doc.modelspace()):
            report('FAIL', where, 'cut-only file contains TEXT')
    outline = [e for e in ents(doc, 'OUTLINE') if e.dxftype() in ('POLYLINE', 'LWPOLYLINE')]
    if len(outline) != 1:
        report('FAIL', where, f'expected 1 OUTLINE polyline, found {len(outline)}')
        return
    o = outline[0]
    closed = o.is_closed if o.dxftype() == 'POLYLINE' else o.closed
    if not closed:
        report('FAIL', where, 'OUTLINE not closed')
    x0, y0, x1, y1 = [v * k for v in bbox(poly_pts(o))]
    if abs(x0) > TOL or abs(y0) > TOL:
        report('FAIL', where, f'OUTLINE not at datum 0,0 (got {x0:.3f},{y0:.3f})')
    w, h = x1 - x0, y1 - y0
    if abs(w - expect_w) > TOL or abs(h - expect_h) > TOL:
        report('FAIL', where, f'OUTLINE {w:.3f} x {h:.3f} mm, expected catalog {expect_w:.3f} x {expect_h:.3f} mm')
    # Geometry to machine
    feats = []  # (kind, x, y, w, h)  in mm, w=h=dia for circles
    for e in ents(doc, 'HOLES') + ents(doc, 'CUTOUTS'):
        if e.dxftype() == 'CIRCLE':
            feats.append(('circle', e.dxf.center.x * k, e.dxf.center.y * k, 2 * e.dxf.radius * k, 2 * e.dxf.radius * k, e.dxf.layer))
        elif e.dxftype() in ('POLYLINE', 'LWPOLYLINE'):
            a, b, c, d = [v * k for v in bbox(poly_pts(e))]
            feats.append(('rect', (a + c) / 2, (b + d) / 2, c - a, d - b, e.dxf.layer))
        else:
            report('FAIL', where, f'unexpected {e.dxftype()} on {e.dxf.layer}')
    for f in feats:
        kind, cx, cy, fw, fh, layer = f
        ex = min(cx - fw / 2, cy - fh / 2, w - (cx + fw / 2), h - (cy + fh / 2))
        if ex < 0:
            report('FAIL', where, f'{layer} {kind} at ({cx:.1f},{cy:.1f}) size {fw:.1f}x{fh:.1f} is OUTSIDE the outline')
        elif ex < EDGE_MIN:
            report('WARN', where, f'{layer} {kind} at ({cx:.1f},{cy:.1f}) only {ex:.1f} mm from the edge')
    for i in range(len(feats)):
        for j in range(i + 1, len(feats)):
            a, b = feats[i], feats[j]
            if abs(a[1] - b[1]) < TOL and abs(a[2] - b[2]) < TOL:
                report('FAIL', where, f'duplicate feature at ({a[1]:.1f},{a[2]:.1f})')
                continue
            # bounding-box overlap with 2 mm web
            if abs(a[1] - b[1]) < (a[3] + b[3]) / 2 + 2 and abs(a[2] - b[2]) < (a[4] + b[4]) / 2 + 2:
                report('FAIL', where, f'features overlap / web < 2 mm: {a[0]} ({a[1]:.1f},{a[2]:.1f}) Ø/w {a[3]:.1f} and {b[0]} ({b[1]:.1f},{b[2]:.1f}) Ø/w {b[3]:.1f}')
    # Standard sizes
    for f in feats:
        kind, cx, cy, fw, fh, layer = f
        if layer == 'CUTOUTS' and kind == 'circle' and abs(fw - 22.5) > TOL:
            report('FAIL', where, f'operator cutout Ø{fw:.2f} at ({cx:.1f},{cy:.1f}) is not Ø22.5')
        if layer == 'CUTOUTS' and kind == 'rect' and hmi_cut and (abs(fw - hmi_cut[0]) > TOL or abs(fh - hmi_cut[1]) > TOL):
            report('FAIL', where, f'HMI cutout {fw:.2f}x{fh:.2f}, catalog says {hmi_cut[0]}x{hmi_cut[1]}')
        if layer == 'HOLES' and round(fw, 2) not in (4.0, 5.0, 6.35, 4.2, 3.3, 5.1):
            report('WARN', where, f'unusual hole Ø{fw:.2f}')
    # Same coordinates as the drilling plan (the sheet's hole table)
    plan_feats = [(h['x'], h['y'], h['dia']) for h in plan['holes']] + [
        (c['x'], c['y'], c['w']) for c in plan['cutouts'] if c['code'] != 'G']
    dxf_xy = sorted((round(f[1], 2), round(f[2], 2)) for f in feats)
    plan_xy = sorted((round(x, 2), round(y, 2)) for x, y, _ in plan_feats)
    if len(dxf_xy) != len(plan_xy):
        report('FAIL', where, f'{len(dxf_xy)} features in DXF vs {len(plan_xy)} in the hole table')
    else:
        bad = [(a, b) for a, b in zip(dxf_xy, plan_xy) if abs(a[0] - b[0]) > TOL or abs(a[1] - b[1]) > TOL]
        if bad:
            report('FAIL', where, f'{len(bad)} coordinates differ from the hole table, e.g. {bad[:3]}')
    return feats


def check_variant(vdir: Path):
    data = json.loads((vdir / 'data.json').read_text())
    lay = data['layout']
    bp_plan, door_plan = data['drilling']['backpanel'], data['drilling']['door']
    hmi = data.get('hmiModel')
    hmi_cut = (hmi['cutoutMm']['width'], hmi['cutoutMm']['height']) if hmi and hmi.get('cutoutMm') else None
    # Expected sizes straight from the catalog values used by the layout
    bp_w, bp_h = lay['backplate']['w'], lay['backplate']['h']
    enc_w, enc_h = lay['enclosure']['w'], lay['enclosure']['h']
    v = vdir.name
    if lay['backplate'].get('estimated'):
        report('WARN', v, 'back panel size is ESTIMATED (not from catalog)')
    if abs(bp_plan['w'] - bp_w) > TOL or abs(bp_plan['h'] - bp_h) > TOL:
        report('FAIL', v, f'drilling plan {bp_plan["w"]}x{bp_plan["h"]} differs from back panel {bp_w}x{bp_h} (rounding)')
    if abs(door_plan['w'] - enc_w) > TOL or abs(door_plan['h'] - enc_h) > TOL:
        report('FAIL', v, f'door plan {door_plan["w"]}x{door_plan["h"]} differs from enclosure {enc_w}x{enc_h}')
    for part, plan, ew, eh in (('back_panel', bp_plan, bp_w, bp_h), ('door', door_plan, enc_w, enc_h)):
        for units in ('mm', 'in'):
            for cut in (False, True):
                f = vdir / 'dxf' / f'{part}_{units}{"_cut" if cut else ""}.dxf'
                check_file(f, plan, ew, eh, units, cut, hmi_cut if part == 'door' else None)
    # ZIP copies must be byte-identical to the mm export
    for zname, part in (('back_panel_drilling.dxf', 'back_panel'), ('door_cutouts.dxf', 'door')):
        z = vdir / 'zip' / 'electrical' / 'machining' / zname
        if not z.exists():
            report('FAIL', v, f'ZIP is missing electrical/machining/{zname}')
        elif z.read_bytes() != (vdir / 'dxf' / f'{part}_mm.dxf').read_bytes():
            report('FAIL', v, f'ZIP {zname} differs from the mm export')
    # Door: disconnect handle template clearance (handle escutcheon ~ 70 mm square around the centre)
    handle = next((c for c in door_plan['cutouts'] if c['code'] == 'G'), None)
    if handle:
        for c in door_plan['cutouts']:
            if c is handle:
                continue
            half_w = c['w'] / 2
            dx, dy = abs(c['x'] - handle['x']), abs(c['y'] - handle['y'])
            if dx < 35 + half_w + 5 and dy < 35 + c['h'] / 2 + 5:
                report('FAIL', v, f'door: {c["id"]} {c["tag"]} at ({c["x"]},{c["y"]}) collides with the disconnect handle {handle["tag"]} at ({handle["x"]},{handle["y"]})')
    # Door: operators need ~ 40 mm body clearance (E-stop mushroom 40 mm), HMI bezel vs operators
    items = data['layout']['door']['items']
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            a, b = items[i], items[j]
            if abs(a['cx'] - b['cx']) < (a['w'] + b['w']) / 2 and abs(a['cy'] - b['cy']) < (a['h'] + b['h']) / 2:
                report('FAIL', v, f'door: {a["tag"]} and {b["tag"]} bodies overlap')
    for it in items:
        if it['cx'] - it['w'] / 2 < 25 or it['cx'] + it['w'] / 2 > enc_w - 25 or it['cy'] - it['h'] / 2 < 25 or it['cy'] + it['h'] / 2 > enc_h - 25:
            report('FAIL', v, f'door: {it["tag"]} body too close to the door edge / flange (<25 mm)')


def main():
    names = sys.argv[1:] or sorted(p.name for p in OUT.iterdir() if (p / 'data.json').exists())
    for n in names:
        check_variant(OUT / n)
    fails = [r for r in results if r[0] == 'FAIL']
    for lvl, where, msg in results:
        print(f'{lvl:4} {where}: {msg}')
    print(f'DXF: {len(fails)} FAIL, {len(results) - len(fails)} WARN over {len(names)} variant(s)')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
