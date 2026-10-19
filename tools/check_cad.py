"""CAD export checks ("Save as AutoCAD" / "Save as EPLAN") for every variant in tools/out (cad/*.zip).

AutoCAD package (cad/autocad.zip):
  - the whole set in ONE <project>_drawings.dxf ("Save as AutoCAD"): reads and audits clean, text styles ISA_SANS /
    ISA_SANS_BOLD / ISA_MONO, one sheet frame per sheet, five per row in sheet order, frames apart, nothing outside
    them, each cell with the same device tags and wire numbers as that sheet's own DXF, text heights 0.3–20 mm
  - README.txt and one DXF per sheet under dxf/; every DXF reads and audits clean in ezdxf
  - mm units ($INSUNITS 4), layers BORDER / SYMS / WIRES / WIRENO / TAGS / TEXT / GRAPHICS,
    text styles ISA_SANS / ISA_MONO
  - blocks ISA_DEVICE (attdefs TAG1 DESC1 MFG CAT) and ISA_WIRENO (WIRENO); every insert carries its
    attributes; device tags with a part number in the BOM carry that part (CAT) and manufacturer (MFG);
    wire numbers are the design's wire numbers; every tagged BOM device appears on some sheet
EPLAN package (cad/eplan.zip):
  - the AML is well-formed and valid against the CAEX 3.0 schema (tools/schemas/CAEX_ClassModel_V.3.0.xsd);
    unique IDs; every InternalLink partner is an interface ID in the file; every role / interface class
    path resolves to a class in the file's libraries; one tag per I/O point (digital + analog)
  - every CSV parses with one column count per file; the PLC assignment list has one row per I/O point,
    the connection list one row per wire
  - parts_eplan.xml parses (root partsmanagement), one <part> per BOM part number, required attributes
  - the same DXF sheets as the AutoCAD package; README present
Usage: tools/.venv/bin/python tools/check_cad.py [variant ...]
"""
import csv
import io
import json
import sys
import tempfile
import zipfile
from pathlib import Path

import ezdxf
from lxml import etree

OUT = Path(__file__).parent / 'out'
XSD = etree.XMLSchema(etree.parse(str(Path(__file__).parent / 'schemas' / 'CAEX_ClassModel_V.3.0.xsd')))
NS = {'c': 'http://www.dke.de/CAEX'}
LAYERS = ['BORDER', 'SYMS', 'WIRES', 'WIRENO', 'TAGS', 'TEXT', 'GRAPHICS']
DEVICE_ATTRS = ['TAG1', 'DESC1', 'MFG', 'CAT']
results: list[tuple[str, str, str]] = []


def report(level: str, where: str, msg: str):
    results.append((level, where, msg))


# parts that are not drawn as a tagged device (enclosure, back panel, rails, duct, terminals, ground bar)
NOT_DRAWN = {'enclosure', 'dinRail', 'wireDuct', 'terminal', 'terminalAccessory', 'groundBar'}


def bom_parts(data) -> dict[str, tuple[str, str]]:
    """tag → (part number, manufacturer) from the BOM."""
    out = {}
    for sec in data['bom']:
        for line in sec['lines']:
            for t in line.get('tags') or []:
                out[t] = (line.get('partNumber') or '', line.get('manufacturer') or '')
    return out


def bom_categories(data) -> dict[str, str]:
    return {t: line.get('category') or sec.get('category') or '' for sec in data['bom'] for line in sec['lines'] for t in line.get('tags') or []}


def read_dxf(name: str, text: bytes):
    with tempfile.NamedTemporaryFile(suffix='.dxf') as f:
        f.write(text)
        f.flush()
        return ezdxf.readfile(f.name)


def check_autocad(v: str, z: zipfile.ZipFile, data) -> list[str]:
    names = z.namelist()
    dxfs = sorted(n for n in names if n.startswith('dxf/') and n.endswith('.dxf'))
    if 'README.txt' not in names:
        report('FAIL', v, 'autocad: README.txt missing')
    if len(dxfs) < 5:
        report('FAIL', v, f'autocad: only {len(dxfs)} DXF sheets')
    wires = {w['wire'] for w in data['wires']}
    parts = bom_parts(data)
    seen_tags: set[str] = set()
    n_dev = n_wn = 0
    sheets: list[dict] = []  # per sheet: frame size, device tags and wire numbers (for the one-file DXF)
    for n in dxfs:
        where = f'{v} {n}'
        try:
            doc = read_dxf(n, z.read(n))
        except Exception as e:  # noqa: BLE001
            report('FAIL', where, f'does not read: {e}')
            continue
        frames = border_rects(doc.modelspace())
        sheets.append({'name': n, 'frame': max(frames, key=lambda r: r[2] * r[3])[2:] if frames else None, **sheet_content(doc.modelspace())})
        aud = doc.audit()
        if aud.has_errors or aud.has_fixes:
            report('FAIL', where, f'audit: {len(aud.errors)} errors, {len(aud.fixes)} fixes ({"; ".join(str(e.message) for e in aud.errors[:3])})')
        if doc.header.get('$INSUNITS') != 4:
            report('FAIL', where, f'$INSUNITS {doc.header.get("$INSUNITS")} (want 4 = mm)')
        for l in LAYERS:
            if l not in doc.layers:
                report('FAIL', where, f'layer {l} missing')
        for s in ['ISA_SANS', 'ISA_MONO']:
            if s not in doc.styles:
                report('FAIL', where, f'text style {s} missing')
        for b, want in [('ISA_DEVICE', DEVICE_ATTRS), ('ISA_WIRENO', ['WIRENO'])]:
            blk = doc.blocks.get(b)
            if blk is None:
                report('FAIL', where, f'block {b} missing')
                continue
            got = [a.dxf.tag for a in blk.query('ATTDEF')]
            if got != want:
                report('FAIL', where, f'block {b} attdefs {got} (want {want})')
        msp = doc.modelspace()
        if not len(msp):
            report('FAIL', where, 'empty model space')
        for ins in msp.query('INSERT'):
            at = {a.dxf.tag: a.dxf.text for a in ins.attribs}
            if ins.dxf.name == 'ISA_DEVICE':
                n_dev += 1
                if list(at) != DEVICE_ATTRS:
                    report('FAIL', where, f'ISA_DEVICE attributes {list(at)}')
                    continue
                tag = at['TAG1']
                seen_tags.add(tag)
                if ins.dxf.layer != 'TAGS':
                    report('FAIL', where, f'device {tag} on layer {ins.dxf.layer}')
                pn, mfr = parts.get(tag, ('', ''))
                if pn and at['CAT'] != pn:
                    report('FAIL', where, f'device {tag}: CAT "{at["CAT"]}" but the BOM has {pn}')
                if pn and mfr and at['MFG'] != mfr:
                    report('FAIL', where, f'device {tag}: MFG "{at["MFG"]}" but the BOM has {mfr}')
            elif ins.dxf.name == 'ISA_WIRENO':
                n_wn += 1
                w = at.get('WIRENO', '')
                if ins.dxf.layer != 'WIRENO':
                    report('FAIL', where, f'wire number {w} on layer {ins.dxf.layer}')
                # the symbols / abbreviations sheet shows example wire numbers (the numbering convention)
                if w not in wires and 'SYMBOLS' not in n.upper():
                    report('FAIL', where, f'wire number {w} is drawn but not in the wire list')
    if not n_dev:
        report('FAIL', v, 'autocad: no ISA_DEVICE blocks')
    if not n_wn:
        report('FAIL', v, 'autocad: no ISA_WIRENO blocks')
    # accessories (DS1S shaft, ES1C contact block, K1-AUX) are drawn with their device
    accessory = lambda t: any(t != s and t.startswith(s) for s in seen_tags)  # noqa: E731
    cats = bom_categories(data)
    missing = sorted(t for t, (pn, _) in parts.items() if pn and t not in seen_tags and not accessory(t) and cats.get(t) not in NOT_DRAWN and not t.startswith(('ENC', 'SP', 'DIN', 'WD', 'GB', 'TB')))
    if missing:
        report('FAIL', v, f'autocad: BOM devices drawn nowhere with their tag: {", ".join(missing[:12])}')
    print(f'{v}: autocad {len(dxfs)} sheets, {n_dev} device blocks ({len(seen_tags)} tags), {n_wn} wire numbers')
    check_one_dxf(v, z, sheets)
    return dxfs


def border_rects(msp) -> list[tuple[float, float, float, float]]:
    """Closed rectangles on layer BORDER as (x0, y0, w, h)."""
    out = []
    for e in msp.query('LWPOLYLINE[layer=="BORDER"]'):
        pts = [(p[0], p[1]) for p in e.get_points()]
        if len(pts) < 4 or not (e.closed or (abs(pts[0][0] - pts[-1][0]) < 0.01 and abs(pts[0][1] - pts[-1][1]) < 0.01)):
            continue
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        if all(min(abs(x - min(xs)), abs(x - max(xs))) < 0.05 for x in xs) and all(min(abs(y - min(ys)), abs(y - max(ys))) < 0.05 for y in ys):
            out.append((min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)))
    return out


def sheet_content(msp, box=None) -> dict:
    """Device tags and wire numbers (as sorted lists with repeats) of the inserts in a model space, or inside `box`."""
    tags, wns = [], []
    for ins in msp.query('INSERT'):
        if box and not inside(box, ins.dxf.insert.x, ins.dxf.insert.y):
            continue
        at = {a.dxf.tag: a.dxf.text for a in ins.attribs}
        if ins.dxf.name == 'ISA_DEVICE':
            tags.append(at.get('TAG1', ''))
        elif ins.dxf.name == 'ISA_WIRENO':
            wns.append(at.get('WIRENO', ''))
    return {'tags': sorted(tags), 'wns': sorted(wns)}


def inside(box, x, y, tol=0.5) -> bool:
    x0, y0, w, h = box
    return x0 - tol <= x <= x0 + w + tol and y0 - tol <= y <= y0 + h + tol


def check_one_dxf(v: str, z: zipfile.ZipFile, sheets: list[dict]):
    """The whole drawing set in ONE DXF ("Save as AutoCAD"): one frame per sheet, five per row in sheet order, cells apart,
    and each cell holding the same device tags and wire numbers as that sheet's own DXF."""
    names = [n for n in z.namelist() if '/' not in n and n.endswith('_drawings.dxf')]
    where = f'{v} one-file DXF'
    if len(names) != 1:
        report('FAIL', where, f'{len(names)} *_drawings.dxf files in the AutoCAD package (want 1)')
        return
    try:
        doc = read_dxf(names[0], z.read(names[0]))
    except Exception as e:  # noqa: BLE001
        report('FAIL', where, f'does not read: {e}')
        return
    aud = doc.audit()
    if aud.has_errors or aud.has_fixes:
        report('FAIL', where, f'audit: {len(aud.errors)} errors, {len(aud.fixes)} fixes')
    for st in ['ISA_SANS', 'ISA_SANS_BOLD', 'ISA_MONO']:
        if st not in doc.styles:
            report('FAIL', where, f'text style {st} missing')
    msp = doc.modelspace()
    sizes = [s['frame'] for s in sheets if s['frame']]
    rects = [r for r in border_rects(msp) if any(abs(r[2] - w) < 0.5 and abs(r[3] - h) < 0.5 for w, h in sizes)]
    # the sheet frames: the outermost such rectangles (a title block or inner border is inside one)
    frames = [r for r in rects if not any(o is not r and o[2] * o[3] > r[2] * r[3] and inside(o, r[0], r[1]) and inside(o, r[0] + r[2], r[1] + r[3]) for o in rects)]
    frames.sort(key=lambda r: (-round(r[1] + r[3]), r[0]))
    if len(frames) != len(sheets):
        report('FAIL', where, f'{len(frames)} sheet frames for {len(sheets)} sheets')
        return
    for i, a in enumerate(frames):
        for b in frames[i + 1:]:
            if a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]:
                report('FAIL', where, f'sheet frames overlap at ({a[0]:.0f}, {a[1]:.0f}) and ({b[0]:.0f}, {b[1]:.0f})')
    # five per row, sheet order left to right, rows top to bottom
    rows: list[list] = []
    for f in frames:
        if rows and abs((rows[-1][0][1] + rows[-1][0][3]) - (f[1] + f[3])) < 1:
            rows[-1].append(f)
        else:
            rows.append([f])
    if any(len(r) != 5 for r in rows[:-1]) or len(rows[-1]) > 5:
        report('FAIL', where, f'rows of {[len(r) for r in rows]} sheets (want 5 per row)')
    # every entity in some cell (nothing between the sheets), and each cell's tags / wire numbers = its sheet's DXF
    stray = 0
    for e in msp:
        try:
            p = e.dxf.insert if e.dxf.hasattr('insert') else e.dxf.start if e.dxf.hasattr('start') else e.dxf.center if e.dxf.hasattr('center') else None
            if p is None and e.dxftype() == 'LWPOLYLINE':
                pt = next(iter(e.get_points()))
                p = type('P', (), {'x': pt[0], 'y': pt[1]})
        except StopIteration:
            continue
        if p is not None and e.dxftype() != 'ATTRIB' and not any(inside(f, p.x, p.y, 2) for f in frames):
            stray += 1
    if stray:
        report('FAIL', where, f'{stray} entities outside every sheet frame')
    for k, (f, s) in enumerate(zip(frames, sheets)):
        got = sheet_content(msp, f)
        if got['tags'] != s['tags'] or got['wns'] != s['wns']:
            report('FAIL', where, f'cell {k + 1} ({s["name"]}): {len(got["tags"])} tags / {len(got["wns"])} wire numbers, its sheet DXF has {len(s["tags"])} / {len(s["wns"])}')
    hs = [t.dxf.height for t in msp.query('TEXT')]
    # cap heights (the writer converts the drawing's em sizes): the smallest sheet text (~0.6 mm em) is ~0.43 mm
    bad = [h for h in hs if not 0.3 <= h <= 20]
    if bad:
        report('FAIL', where, f'{len(bad)} text heights outside 0.3–20 mm (e.g. {bad[0]:.2f})')
    print(f'{v}: one-file DXF {len(frames)} sheets in rows of {[len(r) for r in rows]}, {sum(len(s["tags"]) for s in sheets)} device tags, {sum(len(s["wns"]) for s in sheets)} wire numbers')


def check_aml(v: str, xml: bytes, data):
    where = f'{v} aml'
    try:
        doc = etree.fromstring(xml)
    except etree.XMLSyntaxError as e:
        report('FAIL', where, f'not well-formed: {e}')
        return
    if not XSD.validate(doc):
        for e in list(XSD.error_log)[:5]:
            report('FAIL', where, f'CAEX 3.0 schema: line {e.line}: {e.message}')
    ids = [e.get('ID') for e in doc.iter() if e.get('ID')]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        report('FAIL', where, f'{len(dup)} duplicate IDs')
    ifaces = {e.get('ID') for e in doc.iterfind('.//c:ExternalInterface', NS)}
    links = doc.findall('.//c:InternalLink', NS)
    bad = [l.get('Name') for l in links if l.get('RefPartnerSideA') not in ifaces or l.get('RefPartnerSideB') not in ifaces]
    if bad:
        report('FAIL', where, f'{len(bad)} InternalLinks with an unknown partner ({", ".join(bad[:5])})')

    def class_paths(lib: str, cls: str) -> set[str]:
        out = set()
        for l in doc.iterfind(f'c:{lib}', NS):
            def walk(e, prefix):
                for c in e.iterfind(f'c:{cls}', NS):
                    p = f'{prefix}/{c.get("Name")}'
                    out.add(p)
                    walk(c, p)
            walk(l, l.get('Name'))
        return out
    roles, ifcls = class_paths('RoleClassLib', 'RoleClass'), class_paths('InterfaceClassLib', 'InterfaceClass')
    for e in doc.iterfind('.//c:RoleRequirements', NS):
        if e.get('RefBaseRoleClassPath') not in roles:
            report('FAIL', where, f'role class {e.get("RefBaseRoleClassPath")} not in the file')
    for tagname, attr, known in [('RoleClass', 'RefBaseClassPath', roles), ('ExternalInterface', 'RefBaseClassPath', ifcls), ('InterfaceClass', 'RefBaseClassPath', ifcls)]:
        for p in {e.get(attr) for e in doc.iterfind(f'.//c:{tagname}', NS) if e.get(attr)}:
            if p not in known:
                report('FAIL', where, f'{tagname} base class {p} not in the file')
    tags = doc.findall('.//c:ExternalInterface[@RefBaseClassPath="AutomationProjectConfigurationInterfaceClassLib/Tag"]', NS)
    addrs = sorted(t.findtext('c:Attribute[@Name="LogicalAddress"]/c:Value', namespaces=NS) or '' for t in tags)
    want = sorted(x['address'] for x in data['io'] if x['address'])
    if addrs != want:
        report('FAIL', where, f'tags {len(addrs)} vs {len(want)} I/O points; missing {sorted(set(want) - set(addrs))[:8]}, extra {sorted(set(addrs) - set(want))[:8]}')
    if len({t.get('Name') for t in tags}) != len(tags):
        report('FAIL', where, 'duplicate tag (symbolic address) names')
    print(f'{v}: aml {len(tags)} tags, {len(ifaces)} interfaces, {len(links)} links, schema {"ok" if XSD.validate(doc) else "INVALID"}')


def read_csv(v: str, z: zipfile.ZipFile, name: str):
    where = f'{v} {name}'
    try:
        rows = list(csv.reader(io.StringIO(z.read(name).decode('utf-8'))))
    except Exception as e:  # noqa: BLE001
        report('FAIL', where, f'does not parse: {e}')
        return None
    if not rows:
        report('FAIL', where, 'empty')
        return None
    widths = {len(r) for r in rows}
    if len(widths) != 1:
        report('FAIL', where, f'rows with different column counts {sorted(widths)}')
    return rows


def check_eplan(v: str, z: zipfile.ZipFile, data, autocad_dxfs: list[str]):
    names = z.namelist()
    for n in ['README.txt', 'plc_assignment_list.csv', 'parts_eplan.xml', 'device_list.csv', 'terminal_plan.csv', 'cable_schedule.csv', 'connection_list.csv']:
        if n not in names:
            report('FAIL', v, f'eplan: {n} missing')
    aml = [n for n in names if n.endswith('.aml')]
    if len(aml) != 1:
        report('FAIL', v, f'eplan: {len(aml)} .aml files')
    else:
        check_aml(v, z.read(aml[0]), data)
    for n in [n for n in names if n.endswith('.csv')]:
        rows = read_csv(v, z, n)
        if rows is None:
            continue
        if n == 'plc_assignment_list.csv' and len(rows) - 1 != len(data['io']):
            report('FAIL', f'{v} {n}', f'{len(rows) - 1} rows for {len(data["io"])} I/O points')
        if n == 'connection_list.csv' and len(rows) - 1 != len(data['wires']):
            report('FAIL', f'{v} {n}', f'{len(rows) - 1} rows for {len(data["wires"])} wires')
    if 'parts_eplan.xml' in names:
        try:
            px = etree.fromstring(z.read('parts_eplan.xml'))
            parts = px.findall('part')
            if px.tag != 'partsmanagement':
                report('FAIL', f'{v} parts_eplan.xml', f'root <{px.tag}>')
            for p in parts:
                for a in ['P_ARTICLE_PARTNR', 'P_ARTICLE_MANUFACTURER', 'P_ARTICLE_DESCR1']:
                    if not p.get(a):
                        report('WARN' if a != 'P_ARTICLE_PARTNR' else 'FAIL', f'{v} parts_eplan.xml', f'part {p.get("P_ARTICLE_PARTNR")}: {a} empty')
                if len(p.get('P_ARTICLE_MANUFACTURER') or '') > 30:
                    report('FAIL', f'{v} parts_eplan.xml', f'part {p.get("P_ARTICLE_PARTNR")}: manufacturer over 30 characters')
            got = {p.get('P_ARTICLE_PARTNR') for p in parts}
            want = {l['partNumber'] for s in data['bom'] for l in s['lines'] if l.get('partNumber')}
            if got != want:
                report('FAIL', f'{v} parts_eplan.xml', f'{len(got)} parts vs {len(want)} BOM part numbers; missing {sorted(want - got)[:6]}, extra {sorted(got - want)[:6]}')
        except etree.XMLSyntaxError as e:
            report('FAIL', f'{v} parts_eplan.xml', f'not well-formed: {e}')
    dxfs = sorted(n for n in names if n.startswith('dxf/') and n.endswith('.dxf'))
    if dxfs != autocad_dxfs:
        report('FAIL', v, f'eplan: {len(dxfs)} DXF sheets vs {len(autocad_dxfs)} in the AutoCAD package')


def check_variant(d: Path):
    v = d.name
    data = json.loads((d / 'data.json').read_text())
    a, e = d / 'cad' / 'autocad.zip', d / 'cad' / 'eplan.zip'
    if not a.exists() or not e.exists():
        report('FAIL', v, 'cad/autocad.zip or cad/eplan.zip missing')
        return
    with zipfile.ZipFile(a) as z:
        dxfs = check_autocad(v, z, data)
    with zipfile.ZipFile(e) as z:
        check_eplan(v, z, data, dxfs)


def main():
    names = sys.argv[1:] or sorted(p.name for p in OUT.iterdir() if (p / 'data.json').exists())
    for n in names:
        check_variant(OUT / n)
    fails = [r for r in results if r[0] == 'FAIL']
    for lvl, where, msg in results:
        print(f'{lvl:4} {where}: {msg}')
    print(f'CAD: {len(fails)} FAIL, {len(results) - len(fails)} WARN over {len(names)} variant(s)')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
