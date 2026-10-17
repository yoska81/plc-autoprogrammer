"""CAD export checks ("Save as AutoCAD" / "Save as EPLAN") for every variant in tools/out (cad/*.zip).

AutoCAD package (cad/autocad.zip):
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


def bom_parts(data) -> dict[str, tuple[str, str]]:
    """tag → (part number, manufacturer) from the BOM."""
    out = {}
    for sec in data['bom']:
        for line in sec['lines']:
            for t in line.get('tags') or []:
                out[t] = (line.get('partNumber') or '', line.get('manufacturer') or '')
    return out


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
    for n in dxfs:
        where = f'{v} {n}'
        try:
            doc = read_dxf(n, z.read(n))
        except Exception as e:  # noqa: BLE001
            report('FAIL', where, f'does not read: {e}')
            continue
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
                if w not in wires:
                    report('WARN', where, f'wire number {w} is not in the wire list')
    if not n_dev:
        report('FAIL', v, 'autocad: no ISA_DEVICE blocks')
    if not n_wn:
        report('FAIL', v, 'autocad: no ISA_WIRENO blocks')
    # accessories (DS1S shaft, ES1C contact block, K1-AUX) are drawn with their device
    accessory = lambda t: any(t != s and t.startswith(s) for s in seen_tags)  # noqa: E731
    missing = sorted(t for t, (pn, _) in parts.items() if pn and t not in seen_tags and not accessory(t) and not t.startswith(('ENC', 'SP', 'DIN', 'WD', 'GB', 'TB')))
    if missing:
        report('WARN', v, f'autocad: BOM devices without an ISA_DEVICE block: {", ".join(missing[:12])}')
    print(f'{v}: autocad {len(dxfs)} sheets, {n_dev} device blocks ({len(seen_tags)} tags), {n_wn} wire numbers')
    return dxfs


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
    addrs = sorted(t.findtext('c:Attribute[@Name="LogicalAddress"]/c:Value', namespaces=NS) for t in tags)
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
