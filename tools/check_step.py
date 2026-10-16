"""STEP checks with OpenCascade (OCP): file loads, every solid valid, products named and
coloured, enclosure body bounding box equals the catalog enclosure size, all parts inside the
cabinet envelope (handle / operators may stand proud of the door).
Usage: tools/.venv/bin/python tools/check_step.py [variant ...]
"""
import json
import re
import sys
from pathlib import Path

from OCP.BRepBndLib import BRepBndLib
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.Bnd import Bnd_Box
from OCP.IFSelect import IFSelect_RetDone
from OCP.Quantity import Quantity_Color
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TCollection import TCollection_ExtendedString
from OCP.collections import Sequence_TDF_Label as TDF_LabelSequence
from OCP.TDataStd import TDataStd_Name
from OCP.TDocStd import TDocStd_Document
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE, TopAbs_SOLID
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.TopExp import TopExp_Explorer
from OCP.XCAFDoc import XCAFDoc_ColorType, XCAFDoc_DocumentTool

OUT = Path(__file__).parent / 'out'
results = []


def report(level, where, msg):
    results.append((level, where, msg))


def bbox(shape):
    b = Bnd_Box()
    b.SetGap(0)
    BRepBndLib.AddOptimal_s(shape, b, False, False)
    lo, hi = b.CornerMin(), b.CornerMax()
    return lo.X(), lo.Y(), lo.Z(), hi.X(), hi.Y(), hi.Z()


def name_of(label):
    attr = TDataStd_Name()
    if label.FindAttribute(TDataStd_Name.GetID_s(), attr):
        return attr.Get().ToExtString()
    return ''


def check_variant(vdir: Path):
    v = vdir.name
    data = json.loads((vdir / 'data.json').read_text())
    steps = list((vdir / 'zip' / 'electrical' / '3d').glob('*.step'))
    if len(steps) != 1:
        report('FAIL', v, f'expected 1 STEP file in the ZIP, found {len(steps)}')
        return
    path = steps[0]
    txt = path.read_text(errors='replace')
    if not txt.startswith('ISO-10303-21;') or 'END-ISO-10303-21;' not in txt:
        report('FAIL', v, 'STEP header/trailer missing')
    for bad in ('NaN', 'undefined', 'Infinity'):
        if bad in txt:
            report('FAIL', v, f'STEP text contains "{bad}"')
    # --- SolidWorks import readiness (text level)
    if "FILE_SCHEMA(('AUTOMOTIVE_DESIGN" not in txt:
        report('FAIL', v, 'not AP214 (FILE_SCHEMA AUTOMOTIVE_DESIGN)')
    if 'SI_UNIT(.MILLI.,.METRE.)' not in txt:
        report('FAIL', v, 'length unit mm not declared')
    styled = txt.count('STYLED_ITEM(')
    if styled and 'MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION' not in txt:
        report('FAIL', v, 'colours (STYLED_ITEM) not wrapped in MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION — SolidWorks ignores them')
    nauo, prods = txt.count('NEXT_ASSEMBLY_USAGE_OCCURRENCE('), txt.count('PRODUCT(')
    if nauo == 0:
        report('FAIL', v, 'no assembly structure (NEXT_ASSEMBLY_USAGE_OCCURRENCE)')
    size_mb = path.stat().st_size / 1e6
    if size_mb > 25:
        report('WARN', v, f'STEP is {size_mb:.1f} MB')
    for m in re.finditer(r"PRODUCT\('([^']*)'", txt):
        nm = re.sub(r'\\X2\\[0-9A-F]+\\X0\\', '-', m.group(1))
        if re.search(r'[\\/:*?"<>|]', nm):
            report('FAIL', v, f'product name "{nm}" has characters Windows / SolidWorks cannot use in a part file name')
    fn = re.search(r"FILE_NAME\([^;]*", txt)
    if fn and 'ISA Auto Programmer' not in fn.group(0):
        report('WARN', v, f'FILE_NAME originating system is not "ISA Auto Programmer": {fn.group(0)[:160]}')
    print(f'{v}: {size_mb:.1f} MB, {prods} products, {nauo} occurrences, {styled} styled items')
    doc = TDocStd_Document(TCollection_ExtendedString('step'))
    reader = STEPCAFControl_Reader()
    reader.SetNameMode(True)
    reader.SetColorMode(True)
    if reader.ReadFile(str(path)) != IFSelect_RetDone:
        report('FAIL', v, 'OCP cannot read the STEP file')
        return
    if not reader.Transfer(doc):
        report('FAIL', v, 'STEP transfer failed')
        return
    st = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    ct = XCAFDoc_DocumentTool.ColorTool_s(doc.Main())
    free = TDF_LabelSequence()
    st.GetFreeShapes(free)
    if free.Length() == 0:
        report('FAIL', v, 'no shapes in STEP')
        return
    # Walk every simple shape (leaf product)
    leaves = TDF_LabelSequence()
    st.GetShapes(leaves)
    solids_total = invalid = unnamed = uncoloured = 0
    bad_geom = []
    enclosure_box = None
    names = []
    for i in range(1, leaves.Length() + 1):
        lab = leaves.Value(i)
        if not st.IsSimpleShape_s(lab):
            continue
        shape = st.GetShape_s(lab)
        nm = name_of(lab)
        names.append(nm)
        if not nm or nm.lower().startswith(('open cascade', 'shape', 'product')):
            unnamed += 1
        col = Quantity_Color()
        has_col = any(ct.GetColor(shape, t, col) for t in (XCAFDoc_ColorType.XCAFDoc_ColorSurf, XCAFDoc_ColorType.XCAFDoc_ColorGen))
        if not has_col:
            # colour may be on sub-shapes (faces / solids)
            exp = TopExp_Explorer(shape, TopAbs_SOLID)
            has_col = exp.More() and ct.GetColor(exp.Current(), XCAFDoc_ColorType.XCAFDoc_ColorSurf, col)
        if not has_col:
            uncoloured += 1
        exp = TopExp_Explorer(shape, TopAbs_SOLID)
        while exp.More():
            solids_total += 1
            sol = exp.Current()
            if not BRepCheck_Analyzer(sol).IsValid():
                invalid += 1
            gp = GProp_GProps()
            BRepGProp.VolumeProperties_s(sol, gp)
            if gp.Mass() <= 1e-6:
                bad_geom.append(f'{nm}: solid volume {gp.Mass():.3g} mm3 (inside-out or flat)')
            fx = TopExp_Explorer(sol, TopAbs_FACE)
            while fx.More():
                ga = GProp_GProps()
                BRepGProp.SurfaceProperties_s(fx.Current(), ga)
                if ga.Mass() < 1e-4:
                    bad_geom.append(f'{nm}: zero-area face ({ga.Mass():.2g} mm2)')
                fx.Next()
            ex = TopExp_Explorer(sol, TopAbs_EDGE)
            while ex.More():
                gl = GProp_GProps()
                BRepGProp.LinearProperties_s(ex.Current(), gl)
                if gl.Mass() < 2e-3:
                    bad_geom.append(f'{nm}: degenerate edge ({gl.Mass():.2g} mm, below the 0.001 mm tolerance x2)')
                ex.Next()
            exp.Next()
    # whole-model bbox
    allshape = st.GetShape_s(free.Value(1))
    x0, y0, z0, x1, y1, z1 = bbox(allshape)
    enc = data['layout']['enclosure']
    s = data.get('step') or {}
    if solids_total == 0:
        report('FAIL', v, 'no solids')
    if invalid:
        report('FAIL', v, f'{invalid} of {solids_total} solids invalid (BRepCheck)')
    if bad_geom:
        report('FAIL', v, f'{len(bad_geom)} geometry problems, e.g. {sorted(set(bad_geom))[:5]}')
    # assembly tree: root is an assembly with components (opens as an assembly, not one part)
    root = free.Value(1)
    comps = TDF_LabelSequence()
    st.GetComponents_s(root, comps, False)
    if not st.IsAssembly_s(root) or comps.Length() == 0:
        report('FAIL', v, 'top shape is not an assembly with components')
    if unnamed:
        report('WARN', v, f'{unnamed} leaf shapes without a meaningful name')
    if uncoloured:
        report('WARN', v, f'{uncoloured} leaf shapes without a colour')
    dims = sorted([x1 - x0, y1 - y0, z1 - z0])
    exp_dims = sorted([enc['w'], enc['h'], enc.get('d') or 0])
    print(f'{v}: {path.name} solids={solids_total} leaves={len(names)} bbox={x1 - x0:.1f} x {y1 - y0:.1f} x {z1 - z0:.1f} mm; enclosure {enc["w"]:.1f} x {enc["h"]:.1f} x {enc.get("d") or 0:.1f}')
    # The overall box may exceed the enclosure only by door hardware (handle, E-stop) and mounting feet.
    if dims[2] < exp_dims[2] - 0.5 or dims[1] < exp_dims[1] - 0.5:
        report('FAIL', v, f'model smaller than the enclosure: {dims} vs {exp_dims}')
    if dims[2] > exp_dims[2] + 150 or dims[1] > exp_dims[1] + 150:
        report('WARN', v, f'model much larger than the enclosure: {[round(d, 1) for d in dims]} vs {exp_dims}')
    # Enclosure body itself
    body = [lab for lab in (leaves.Value(i) for i in range(1, leaves.Length() + 1)) if st.IsSimpleShape_s(lab) and enc.get('tag') and name_of(lab).startswith(enc['tag'])]
    if body:
        # main shell = largest solid (mounting feet / brackets stand outside the catalog size)
        exp = TopExp_Explorer(st.GetShape_s(body[0]), TopAbs_SOLID)
        boxes = []
        while exp.More():
            boxes.append(bbox(exp.Current()))
            exp.Next()
        bx = max(boxes, key=lambda b: (b[3] - b[0]) * (b[4] - b[1]) * (b[5] - b[2]))
        bd = sorted([bx[3] - bx[0], bx[4] - bx[1], bx[5] - bx[2]])
        if any(abs(a - b) > 0.5 for a, b in zip(bd, exp_dims)):
            report('FAIL', v, f'enclosure body {[round(d, 2) for d in bd]} differs from catalog {[round(d, 2) for d in exp_dims]}')
    else:
        report('WARN', v, f'no product named after the enclosure tag {enc.get("tag")}')
    # Door devices in the 3D model sit on the same centres as the DXF door cutouts (x right, z up = DXF y).
    cut = {c['tag']: c for c in data['drilling']['door']['cutouts']}
    for b in s.get('bodies', []):
        if b['kind'] not in ('doorDevice', 'hmi', 'handle'):
            continue
        tag = b['tag'].replace(' HANDLE', '')
        c = cut.get(tag) or cut.get(tag + 'H')
        if not c:
            report('FAIL', v, f'3D door body {b["name"]} has no cutout in the door DXF')
            continue
        bx, bz = b['min'][0] + b['size'][0] / 2, b['min'][2] + b['size'][2] / 2
        if abs(bx - c['x']) > 1 or abs(bz - c['y']) > 1:
            report('FAIL', v, f'3D {b["name"]} centre ({bx:.1f},{bz:.1f}) vs DXF cutout {c["id"]} ({c["x"]},{c["y"]})')
    dup = [n for n in names if n.endswith(')') and ' (' in n and n.rsplit(' (', 1)[1][:-1].isdigit()]
    if dup:
        report('FAIL', v, f'duplicate product names (a part modelled twice or mis-named): {dup}')
    if s.get('warnings'):
        report('INFO', v, f'STEP summary warnings: {s["warnings"]}')
    if s.get('notModelled'):
        report('INFO', v, f'not modelled: {[(n["tag"], n["reason"]) for n in s["notModelled"]]}')


def main():
    names = sys.argv[1:] or sorted(p.name for p in OUT.iterdir() if (p / 'data.json').exists())
    for n in names:
        check_variant(OUT / n)
    for lvl, where, msg in results:
        print(f'{lvl:4} {where}: {msg}')
    fails = [r for r in results if r[0] == 'FAIL']
    print(f'STEP: {len(fails)} FAIL over {len(names)} variant(s)')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
