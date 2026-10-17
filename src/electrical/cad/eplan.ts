/**
 * EPLAN Electric P8 import package. Native EPLAN projects (.elk / .zw1) cannot be written; what EPLAN
 * imports from outside is:
 *  - PLC data in AutomationML AR APC (PLC > Data exchange > Import, format "AutomationML AR APC"):
 *    the PLC, its modules with channels and the symbolic addresses (tags) — CAEX 3.0 here;
 *  - parts in the parts-management XML (<partsmanagement> / <part P_ARTICLE_...>);
 *  - devices from a text / Excel file (Project data > Devices > Import, with a field assignment);
 *  - drawings as DXF / DWG (Insert > Graphic > DXF/DWG file).
 * The AML also carries the cabinet devices, terminal strips, cables and the connections (wire numbers) in
 * its own instance hierarchy (generic AutomationML roles): EPLAN's AR APC import ignores it, other
 * AutomationML tools read it. Lists for the rest (terminals, cables, connections) are CSV.
 */
import { billOfMaterials, buildModel, cableScheduleCsv, terminalPlanCsv, type DrawingContext, type ElectricalModel } from '../derive';

export interface EplanOptions {
  /** PLC address → symbolic name (program nicknames); else a name from the I/O description. */
  symbols?: Map<string, string>;
  /** ISO time stamp for the file headers (fixed in tests and the harness). */
  now?: string;
}

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const csvCell = (s: unknown) => { const v = String(s ?? ''); return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
const csv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

/** Deterministic UUID from a key (stable across exports, so EPLAN's re-import matches the same objects). */
export function uuidOf(key: string): string {
  const h = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
  for (let i = 0; i < key.length; i++) for (let k = 0; k < 4; k++) h[k] = Math.imul(h[k] ^ key.charCodeAt(i), 0x01000193 + k * 0x9e37) >>> 0;
  const hex = h.map((x) => x.toString(16).padStart(8, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** A symbolic name EPLAN / the PLC accepts: letters, digits, underscore, max 24 characters. */
export function symbolOf(address: string, description: string, symbols?: Map<string, string>): string {
  const s = symbols?.get(address) ?? description;
  return s.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, '_$1').slice(0, 24) || address;
}

/** "K1:A1" → K1 / A1; "TB2-4" → TB2 / 4; "TB1 24+" → TB1 / 24+; anything else is a device with point 1. */
export function endpointOf(s: string): { device: string; point: string } {
  const c = /^([^:\s]+):(.+)$/.exec(s);
  if (c) return { device: c[1], point: c[2].trim() };
  const t = /^([A-Z]+\d*)-(\d+[A-Z]?)$/i.exec(s);
  if (t) return { device: t[1], point: t[2] };
  const sp = /^(\S+)\s+(.+)$/.exec(s);
  if (sp) return { device: sp[1], point: sp[2].replace(/\s*\(.*$/, '').trim() || '1' };
  return { device: s, point: '1' };
}

/** Device tag of the module an analog point is on (the component with its part number), else the CPU. */
function analogCard(ctx: DrawingContext, a: NonNullable<DrawingContext['analog']>[number], plcTag: string): string {
  return (a.partNumber && a.partNumber !== ctx.plc.cpuPartNumber && ctx.design.components.find((c) => c.partNumber === a.partNumber)?.tag) || plcTag;
}

// ---------------------------------------------------------------------------------------------------
// AutomationML (CAEX 3.0)
// ---------------------------------------------------------------------------------------------------

const attr = (name: string, value: unknown, type = 'xs:string') => (value === undefined || value === '' ? '' : `<Attribute Name="${esc(name)}" AttributeDataType="${type}"><Value>${esc(value)}</Value></Attribute>`);
const role = (path: string) => `<RoleRequirements RefBaseRoleClassPath="${esc(path)}" />`;

/** The role / interface classes the file references (AR APC 1.4.0 classes and their AutomationML bases, plus the electrical ones). */
const LIBRARIES = `
  <InterfaceClassLib Name="AutomationMLInterfaceClassLib">
    <Version>2.2.2</Version>
    <InterfaceClass Name="AutomationMLBaseInterface">
      <InterfaceClass Name="ExternalDataConnector" RefBaseClassPath="AutomationMLInterfaceClassLib/AutomationMLBaseInterface">
        <InterfaceClass Name="PLCopenXMLInterface" RefBaseClassPath="AutomationMLInterfaceClassLib/AutomationMLBaseInterface/ExternalDataConnector">
          <InterfaceClass Name="VariableInterface" RefBaseClassPath="AutomationMLInterfaceClassLib/AutomationMLBaseInterface/ExternalDataConnector/PLCopenXMLInterface" />
        </InterfaceClass>
      </InterfaceClass>
      <InterfaceClass Name="Communication" RefBaseClassPath="AutomationMLInterfaceClassLib/AutomationMLBaseInterface">
        <InterfaceClass Name="SignalInterface" RefBaseClassPath="AutomationMLInterfaceClassLib/AutomationMLBaseInterface/Communication" />
      </InterfaceClass>
    </InterfaceClass>
  </InterfaceClassLib>
  <InterfaceClassLib Name="AutomationProjectConfigurationInterfaceClassLib">
    <Version>1.4.0</Version>
    <InterfaceClass Name="Tag" RefBaseClassPath="AutomationMLInterfaceClassLib/AutomationMLBaseInterface/ExternalDataConnector/PLCopenXMLInterface/VariableInterface">
      <Attribute Name="DataType" AttributeDataType="xs:string" /><Attribute Name="IoType" AttributeDataType="xs:string" /><Attribute Name="LogicalAddress" AttributeDataType="xs:string" /><Attribute Name="Comment" AttributeDataType="xs:string" />
    </InterfaceClass>
    <InterfaceClass Name="Channel" RefBaseClassPath="AutomationMLInterfaceClassLib/AutomationMLBaseInterface/Communication/SignalInterface">
      <Attribute Name="Type" AttributeDataType="xs:string" /><Attribute Name="IoType" AttributeDataType="xs:string" /><Attribute Name="Number" AttributeDataType="xs:int" /><Attribute Name="Length" AttributeDataType="xs:int" />
    </InterfaceClass>
  </InterfaceClassLib>
  <InterfaceClassLib Name="ISAElectricalInterfaceClassLib">
    <Description>Connection points of cabinet and field devices (ISA Auto Programmer).</Description>
    <Version>1.0.0</Version>
    <InterfaceClass Name="ElectricalConnectionPoint" RefBaseClassPath="AutomationMLInterfaceClassLib/AutomationMLBaseInterface">
      <Attribute Name="ConnectionPointDesignation" AttributeDataType="xs:string" />
    </InterfaceClass>
  </InterfaceClassLib>
  <RoleClassLib Name="AutomationMLBaseRoleClassLib">
    <Version>2.2.2</Version>
    <RoleClass Name="AutomationMLBaseRole">
      <RoleClass Name="Structure" RefBaseClassPath="AutomationMLBaseRoleClassLib/AutomationMLBaseRole">
        <RoleClass Name="ResourceStructure" RefBaseClassPath="AutomationMLBaseRoleClassLib/AutomationMLBaseRole/Structure" />
      </RoleClass>
      <RoleClass Name="Resource" RefBaseClassPath="AutomationMLBaseRoleClassLib/AutomationMLBaseRole" />
    </RoleClass>
  </RoleClassLib>
  <RoleClassLib Name="CommunicationRoleClassLib">
    <Version>2.2.0</Version>
    <RoleClass Name="PhysicalDevice" RefBaseClassPath="AutomationMLBaseRoleClassLib/AutomationMLBaseRole/Resource">
      <RoleClass Name="VariableList" RefBaseClassPath="CommunicationRoleClassLib/PhysicalDevice" />
    </RoleClass>
  </RoleClassLib>
  <RoleClassLib Name="AutomationProjectConfigurationRoleClassLib">
    <Version>1.4.0</Version>
    <RoleClass Name="AutomationProject" RefBaseClassPath="AutomationMLBaseRoleClassLib/AutomationMLBaseRole/Structure" />
    <RoleClass Name="Device" RefBaseClassPath="CommunicationRoleClassLib/PhysicalDevice" />
    <RoleClass Name="DeviceItem" RefBaseClassPath="CommunicationRoleClassLib/PhysicalDevice" />
    <RoleClass Name="TagTable" RefBaseClassPath="CommunicationRoleClassLib/PhysicalDevice/VariableList" />
  </RoleClassLib>
  <RoleClassLib Name="ISAElectricalRoleClassLib">
    <Description>Cabinet / field devices, terminal strips and cables (ISA Auto Programmer).</Description>
    <Version>1.0.0</Version>
    <RoleClass Name="ElectricalDevice" RefBaseClassPath="AutomationMLBaseRoleClassLib/AutomationMLBaseRole/Resource" />
    <RoleClass Name="TerminalStrip" RefBaseClassPath="AutomationMLBaseRoleClassLib/AutomationMLBaseRole/Resource" />
    <RoleClass Name="Cable" RefBaseClassPath="AutomationMLBaseRoleClassLib/AutomationMLBaseRole/Resource" />
  </RoleClassLib>`;

export interface AmlStats { devices: number; plcModules: number; tags: number; channels: number; connectionPoints: number; connections: number; cables: number }

/** AutomationML (CAEX 3.0): AR APC PLC configuration + the electrical design. */
export function amlDocument(ctx: DrawingContext, opts: EplanOptions = {}, model: ElectricalModel = buildModel(ctx)): { xml: string; stats: AmlStats } {
  const now = opts.now ?? new Date().toISOString();
  const project = ctx.projectName || 'Project';
  const stats: AmlStats = { devices: 0, plcModules: 0, tags: 0, channels: 0, connectionPoints: 0, connections: 0, cables: 0 };
  const partOf = (pn?: string) => (pn ? ctx.getPart(pn) : undefined);

  // ---- PLC configuration (AR APC): Device → DeviceItems (CPU slot 0, modules 1..n) with Channels; tags at the CPU.
  const plcTag = model.plcTag || 'PLC';
  const modules: { tag: string; partNumber?: string; groups: ElectricalModel['groups']; analog: NonNullable<DrawingContext['analog']> }[] = [];
  const moduleOf = (tag: string, partNumber?: string) => {
    let mm = modules.find((x) => x.tag === tag);
    if (!mm) { mm = { tag, partNumber, groups: [], analog: [] }; modules.push(mm); }
    return mm;
  };
  for (const g of model.groups) moduleOf(g.devTag, g.partNumber).groups.push(g);
  for (const a of ctx.analog ?? []) moduleOf(analogCard(ctx, a, plcTag), a.partNumber || undefined).analog.push(a);
  modules.sort((a, b) => (a.tag === plcTag ? -1 : b.tag === plcTag ? 1 : 0));
  const links: string[] = [];
  const tagIf: string[] = [];
  const cpuPart = ctx.plc.cpuPartNumber;
  const items = modules.map((mod, pos) => {
    const pn = mod.tag === plcTag ? cpuPart : mod.partNumber;
    const part = partOf(pn);
    const id = uuidOf(`plc/${mod.tag}`);
    const chans: string[] = [];
    for (const g of mod.groups) {
      g.points.forEach((p, k) => {
        const ioType = p.type === 'input' ? 'Input' : 'Output';
        const chId = uuidOf(`ch/${p.address}`), tId = uuidOf(`tag/${p.address}`);
        chans.push(`<ExternalInterface Name="${esc(`${ioType}_${k}`)}" ID="${chId}" RefBaseClassPath="AutomationProjectConfigurationInterfaceClassLib/Channel">${attr('Type', 'Digital')}${attr('IoType', ioType)}${attr('Number', k, 'xs:int')}${attr('Length', 1, 'xs:int')}</ExternalInterface>`);
        tagIf.push(`<ExternalInterface Name="${esc(symbolOf(p.address, p.description, opts.symbols))}" ID="${tId}" RefBaseClassPath="AutomationProjectConfigurationInterfaceClassLib/Tag">${attr('DataType', 'BOOL')}${attr('IoType', ioType)}${attr('LogicalAddress', p.address)}${attr('Comment', p.description)}</ExternalInterface>`);
        links.push(`<InternalLink Name="${esc(`LinkToTag_${p.address}`)}" ID="${uuidOf(`link/${p.address}`)}" RefPartnerSideA="${chId}" RefPartnerSideB="${tId}" />`);
        stats.channels++; stats.tags++;
      });
    }
    mod.analog.forEach((a, k) => {
      const ioType = a.kind === 'output' ? 'Output' : 'Input';
      const chId = uuidOf(`ch/${a.address}`), tId = uuidOf(`tag/${a.address}`);
      chans.push(`<ExternalInterface Name="${esc(`Analog${ioType}_${a.channel || k}`)}" ID="${chId}" RefBaseClassPath="AutomationProjectConfigurationInterfaceClassLib/Channel">${attr('Type', 'Analog')}${attr('IoType', ioType)}${attr('Number', k, 'xs:int')}${attr('Length', 16, 'xs:int')}</ExternalInterface>`);
      tagIf.push(`<ExternalInterface Name="${esc(symbolOf(a.address, a.description, opts.symbols))}" ID="${tId}" RefBaseClassPath="AutomationProjectConfigurationInterfaceClassLib/Tag">${attr('DataType', 'REAL')}${attr('IoType', ioType)}${attr('LogicalAddress', a.address)}${attr('Comment', `${a.description} (${a.range}, ${a.scaleMin}..${a.scaleMax} ${a.units})`.trim())}</ExternalInterface>`);
      links.push(`<InternalLink Name="${esc(`LinkToTag_${a.address}`)}" ID="${uuidOf(`link/${a.address}`)}" RefPartnerSideA="${chId}" RefPartnerSideB="${tId}" />`);
      stats.channels++; stats.tags++;
    });
    stats.plcModules++;
    const cpu = mod.tag === plcTag;
    return `<InternalElement Name="${esc(mod.tag)}" ID="${id}">${attr('TypeName', part?.description ?? pn)}${attr('DeviceItemType', cpu ? 'CPU' : 'IO')}${attr('PositionNumber', pos, 'xs:int')}${attr('BuiltIn', 'false', 'xs:boolean')}${attr('TypeIdentifier', pn ? `OrderNumber:${pn}` : '')}${attr('Manufacturer', part?.manufacturer ?? ctx.plc.vendor)}${attr('ProductDesignation IEC', mod.tag)}${chans.join('')}${
      cpu ? TAG_TABLE : ''
    }${role('AutomationProjectConfigurationRoleClassLib/DeviceItem')}</InternalElement>`;
  });
  // every module's tags in the CPU's tag table (filled in once all modules are done)
  const tagTable = `<InternalElement Name="Tags" ID="${uuidOf('plc/tagtable')}">${attr('AssignToDefault', 'true', 'xs:boolean')}${tagIf.join('')}${role('AutomationProjectConfigurationRoleClassLib/TagTable')}</InternalElement>`;
  if (items.length) items[0] = items[0].replace(TAG_TABLE, tagTable);
  const plcDevice = `<InternalElement Name="${esc(plcTag)}" ID="${uuidOf('plc')}">${attr('TypeIdentifier', `OrderNumber:${cpuPart}`)}${attr('Manufacturer', partOf(cpuPart)?.manufacturer ?? ctx.plc.vendor)}${attr('Comment', `${ctx.plc.name} ${ctx.plc.cpuLabel}`.trim())}${items.join('')}${role('AutomationProjectConfigurationRoleClassLib/Device')}</InternalElement>`;
  const apc = `<InstanceHierarchy Name="AutomationProjectConfiguration"><Version>1.4.0</Version><InternalElement Name="${esc(project)}" ID="${uuidOf('project')}">${attr('ProjectManufacturer', ctx.doc?.company ?? '')}${attr('ProjectSign', ctx.doc?.projectNumber ?? '')}${attr('ProjectRevision', ctx.doc?.revisions?.at(-1)?.rev ?? '')}${attr('ProjectInformation', 'Exported by ISA Auto Programmer')}${plcDevice}${links.join('')}${role('AutomationProjectConfigurationRoleClassLib/AutomationProject')}</InternalElement></InstanceHierarchy>`;

  // ---- Electrical design: devices with connection points, terminal strips, cables, wires as links.
  const points = new Map<string, Map<string, string>>(); // device → point → interface ID
  const pointId = (device: string, point: string) => {
    let m = points.get(device);
    if (!m) { m = new Map(); points.set(device, m); }
    let id = m.get(point);
    if (!id) { id = uuidOf(`cp/${device}/${point}`); m.set(point, id); stats.connectionPoints++; }
    return id;
  };
  const wireLinks: string[] = [];
  model.wires.forEach((w, i) => {
    const a = endpointOf(w.from), b = endpointOf(w.to);
    if (!a.device || !b.device) return;
    wireLinks.push(`<InternalLink Name="${esc(`${w.wire || 'W'}_${i + 1}`)}" ID="${uuidOf(`wire/${i}/${w.wire}/${w.from}/${w.to}`)}" RefPartnerSideA="${pointId(a.device, a.point)}" RefPartnerSideB="${pointId(b.device, b.point)}" />`);
    stats.connections++;
  });
  for (const s of model.strips) for (const t of s.terminals) pointId(s.tag, String(t.number));
  const devs = new Map<string, { function: string; partNumber: string; kind: string }>();
  for (const c of model.rc) if (c.tag && !devs.has(c.tag)) devs.set(c.tag, { function: c.comp.function ?? '', partNumber: c.partNumber ?? '', kind: c.category });
  for (const p of model.io) if (p.deviceTag && !devs.has(p.deviceTag)) devs.set(p.deviceTag, { function: p.description, partNumber: '', kind: p.deviceType });
  const strips = new Set(model.strips.map((s) => s.tag));
  const ifaces = (tag: string) => [...(points.get(tag) ?? new Map()).entries()].map(([pt, id]) => `<ExternalInterface Name="${esc(pt)}" ID="${id}" RefBaseClassPath="ISAElectricalInterfaceClassLib/ElectricalConnectionPoint">${attr('ConnectionPointDesignation', pt)}</ExternalInterface>`).join('');
  const deviceEls: string[] = [];
  for (const [tag, d] of devs) {
    if (strips.has(tag)) continue;
    const part = partOf(d.partNumber);
    deviceEls.push(`<InternalElement Name="${esc(tag)}" ID="${uuidOf(`dev/${tag}`)}">${attr('DeviceTag', tag)}${attr('FunctionText', d.function)}${attr('PartNumber', d.partNumber)}${attr('Manufacturer', part?.manufacturer ?? '')}${attr('Category', d.kind)}${ifaces(tag)}${role('ISAElectricalRoleClassLib/ElectricalDevice')}</InternalElement>`);
    stats.devices++;
  }
  // endpoints on tags that are not devices (bus references, PE bar names…): keep them as plain devices
  for (const tag of points.keys()) {
    if (devs.has(tag) || strips.has(tag)) continue;
    deviceEls.push(`<InternalElement Name="${esc(tag)}" ID="${uuidOf(`dev/${tag}`)}">${attr('DeviceTag', tag)}${ifaces(tag)}${role('ISAElectricalRoleClassLib/ElectricalDevice')}</InternalElement>`);
  }
  const stripEls = model.strips.map((s) => `<InternalElement Name="${esc(s.tag)}" ID="${uuidOf(`strip/${s.tag}`)}">${attr('DeviceTag', s.tag)}${attr('FunctionText', s.title)}${attr('Terminals', s.terminals.length, 'xs:int')}${ifaces(s.tag)}${role('ISAElectricalRoleClassLib/TerminalStrip')}</InternalElement>`);
  const cableEls = (model.machine.cables ?? []).map((c) => {
    stats.cables++;
    return `<InternalElement Name="${esc(c.tag)}" ID="${uuidOf(`cable/${c.tag}`)}">${attr('DeviceTag', c.tag)}${attr('CableType', c.type)}${attr('PartNumber', c.partNumber ?? '')}${attr('From', c.from)}${attr('To', c.to)}${attr('Cores', c.cores.length, 'xs:int')}${attr('Length', c.length)}${role('ISAElectricalRoleClassLib/Cable')}</InternalElement>`;
  });
  const elec = `<InstanceHierarchy Name="ElectricalDesign"><Version>1.0.0</Version><InternalElement Name="${esc(project)} cabinet" ID="${uuidOf('elec')}">${deviceEls.join('')}${stripEls.join('')}${cableEls.join('')}${wireLinks.join('')}${role('AutomationMLBaseRoleClassLib/AutomationMLBaseRole/Structure/ResourceStructure')}</InternalElement></InstanceHierarchy>`;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<CAEXFile SchemaVersion="3.0" FileName="${esc(fileSafe(project))}.aml" xmlns="http://www.dke.de/CAEX" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.dke.de/CAEX CAEX_ClassModel_V.3.0.xsd">
  <SuperiorStandardVersion>AutomationML 2.10</SuperiorStandardVersion>
  <SourceDocumentInformation OriginName="ISA Auto Programmer" OriginID="${uuidOf('origin/isa')}" OriginVersion="1.0" LastWritingDateTime="${esc(now)}" OriginProjectTitle="${esc(project)}" OriginProjectID="${esc(ctx.doc?.projectNumber ?? '')}" OriginVendor="ISA Auto Programmer" />
  ${apc}
  ${elec}${LIBRARIES}
</CAEXFile>
`;
  return { xml, stats };
}

const TAG_TABLE = '\u0000TAGS\u0000';
const fileSafe = (s: string) => s.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'project';

// ---------------------------------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------------------------------

/** PLC assignment list: one row per I/O point, with EPLAN's property names as column headers. */
export function plcAssignmentCsv(model: ElectricalModel, ctx: DrawingContext, symbols?: Map<string, string>): string {
  const rows: unknown[][] = [['PLC card', 'Part number (PLC card)', 'Connection point', 'Address', 'Symbolic address', 'Data type', 'Function text', 'Device tag (field device)', 'Signal type']];
  for (const g of model.groups) g.points.forEach((p, k) => rows.push([g.devTag, g.devTag === model.plcTag ? ctx.plc.cpuPartNumber : g.partNumber ?? '', k, p.address, symbolOf(p.address, p.description, symbols), 'BOOL', p.description, p.deviceTag, p.type === 'input' ? 'Digital input' : 'Digital output']));
  for (const a of ctx.analog ?? []) rows.push([analogCard(ctx, a, model.plcTag), a.partNumber, a.terminal || a.channel, a.address, symbolOf(a.address, a.description, symbols), 'REAL', a.description, '', `Analog ${a.kind === 'output' ? 'output' : 'input'}`]);
  return csv(rows);
}

/** EPLAN parts-management XML (one <part> per catalog part used by the design). */
/** Outer size in mm (enclosures: the catalogue's inch size; their widthMm / heightMm is the usable panel area). */
function dims(p: ReturnType<DrawingContext['getPart']>): [string, unknown][] {
  const r = p?.ratings as { kind?: string; widthIn?: number; heightIn?: number; depthIn?: number } | undefined;
  const mm = (inch?: number) => (inch ? Math.round(inch * 25.4) : undefined);
  const [w, h, d] = r?.kind === 'enclosure' ? [mm(r.widthIn), mm(r.heightIn), mm(r.depthIn)] : [p?.widthMm, p?.heightMm, undefined];
  return [['P_ARTICLE_WIDTH', w], ['P_ARTICLE_HEIGHT', h], ['P_ARTICLE_DEPTH', d]].filter(([, v]) => v) as [string, unknown][];
}

export function partsXml(ctx: DrawingContext): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  const ml = (s: string) => `en_US@${s};`;
  for (const line of billOfMaterials(ctx).flatMap((g) => g.lines)) {
    if (!line.partNumber || seen.has(line.partNumber)) continue;
    seen.add(line.partNumber);
    const p = ctx.getPart(line.partNumber);
    const use = ctx.design.components.find((c) => c.partNumber === line.partNumber)?.function ?? '';
    const a: [string, unknown][] = [
      ['P_ARTICLE_PARTTYPE', 1], ['P_ARTICLE_PARTNR', line.partNumber], ['P_ARTICLE_TYPENR', line.partNumber], ['P_ARTICLE_ORDERNR', line.partNumber],
      ['P_ARTICLE_MANUFACTURER', (line.manufacturer || p?.manufacturer || '').slice(0, 30)], ['P_ARTICLE_SUPPLIER', (p?.vendor ?? 'automationdirect').slice(0, 30)],
      ['P_ARTICLE_DESCR1', ml((line.description || p?.description || use).slice(0, 250))], ...(use ? [['P_ARTICLE_NOTE', ml(use)] as [string, unknown]] : []),
      ['P_ARTICLE_CRAFT_ELECTRICAL', 1], ...dims(p),
    ];
    parts.push(`  <part ${a.map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}>\n    <variant P_ARTICLE_VARIANT="0" />\n  </part>`);
  }
  return `<?xml version="1.0" encoding="utf-8"?>\n<partsmanagement type="EPLAN.PartsManagement" length-unit="mm">\n${parts.join('\n')}\n</partsmanagement>\n`;
}

/** Device list for Project data > Devices > Import (field names to assign in EPLAN's field assignment). */
export function deviceListCsv(ctx: DrawingContext, model: ElectricalModel = buildModel(ctx)): string {
  const rows: unknown[][] = [['Device tag', 'Part number', 'Manufacturer', 'Function text', 'Category', 'Mounting location', 'Quantity']];
  for (const c of ctx.design.components) rows.push([c.tag, c.partNumber, ctx.getPart(c.partNumber)?.manufacturer ?? '', c.function, ctx.getPart(c.partNumber)?.category ?? '', ctx.getPart(c.partNumber)?.mount ?? '', c.quantity]);
  const have = new Set(ctx.design.components.map((c) => c.tag));
  for (const p of model.io) if (p.deviceTag && !have.has(p.deviceTag)) { have.add(p.deviceTag); rows.push([p.deviceTag, '', '', p.description, p.deviceType, p.location, 1]); }
  return csv(rows);
}

/** Connection list (from-to with wire numbers, colours and cross-sections). */
export function connectionListCsv(model: ElectricalModel): string {
  const rows: unknown[][] = [['Connection designation (wire number)', 'Source device tag', 'Source connection point', 'Target device tag', 'Target connection point', 'Color', 'Cross-section', 'Function text']];
  for (const w of model.wires) { const a = endpointOf(w.from), b = endpointOf(w.to); rows.push([w.wire, a.device, a.point, b.device, b.point, w.color, w.size, w.function]); }
  return csv(rows);
}

export function eplanReadme(project: string, stats: AmlStats, sheets: number): string {
  return `${project} — EPLAN Electric P8 import package
${'='.repeat(project.length + 34)}

EPLAN's own project formats (.elk / .zw1 / .zw9) cannot be written by another program. This package
holds everything in the formats EPLAN imports; build the EPLAN project from it like this.

1. PLC configuration and symbolic addresses — ${fileSafe(project)}.aml (AutomationML, CAEX 3.0, AR APC 1.4.0 classes)
   ${stats.plcModules} PLC device item(s), ${stats.channels} channels, ${stats.tags} tags (symbolic address, address, data type, comment).
   Project data > PLC > Data exchange > Import (or Import PLC data), format "AutomationML AR APC",
   select the .aml file. EPLAN creates / updates the PLC boxes, cards and PLC connection points.
   The same file has an "ElectricalDesign" instance hierarchy: ${stats.devices} devices, terminal strips,
   ${stats.cables} cables and ${stats.connections} connections between ${stats.connectionPoints} connection points (wire numbers as
   link names). EPLAN's AR APC import is for PLC data and skips it; other AutomationML tools read it.
   Note: the AR APC 1.4.0 class libraries are published for AutomationML Edition 1 (CAEX 2.15). If your EPLAN
   version rejects a CAEX 3.0 file, open it in the AutomationML Editor and save it as CAEX 2.15.

2. PLC assignment list — plc_assignment_list.csv
   One row per I/O point: PLC card, connection point, address, symbolic address, data type, function text.
   For checking the import, or for an assignment-list import with your own CSV scheme (the column layout of
   EPLAN's CSV assignment lists is set by the scheme, it is not fixed).

3. Parts — parts_eplan.xml (EPLAN parts-management XML)
   Utilities > Parts > Management > Extras > Import, file type XML. Part number, type number, order number,
   manufacturer, supplier, designation, dimensions. Complete the function templates / macros in EPLAN.

4. Devices — device_list.csv
   Project data > Devices > Import, type of data source "Text", then the field assignment:
   Device tag → Device tag (displayed DT), Part number → Part number, Function text → Function text.

5. Terminals, cables, connections — terminal_plan.csv, cable_schedule.csv, connection_list.csv
   Reference lists for the terminal-strip and cable definitions and the wiring (from-to with wire numbers).
   EPLAN builds terminals, cables and connections from the schematic pages: place the devices with the
   lists, or use them to check the EPLAN reports against this design.

6. Drawings — dxf/ (${sheets} sheets, mm, 1:1)
   Insert > Graphic > DXF/DWG file on an EPLAN page (or Utilities > DXF/DWG import) to bring a sheet in
   as graphics, e.g. for the panel layout and door cutouts.
`;
}

export interface EplanPackage { files: Record<string, string>; stats: AmlStats }

/** All files of the EPLAN package (paths relative to the package root); the DXF sheets are added by the caller. */
export function eplanPackage(ctx: DrawingContext, opts: EplanOptions = {}, dxfSheets = 0): EplanPackage {
  const model = buildModel(ctx);
  const { xml, stats } = amlDocument(ctx, opts, model);
  const base = fileSafe(ctx.projectName || 'project');
  return {
    stats,
    files: {
      [`${base}.aml`]: xml,
      'plc_assignment_list.csv': plcAssignmentCsv(model, ctx, opts.symbols),
      'parts_eplan.xml': partsXml(ctx),
      'device_list.csv': deviceListCsv(ctx, model),
      'terminal_plan.csv': terminalPlanCsv(ctx),
      'cable_schedule.csv': cableScheduleCsv(ctx),
      'connection_list.csv': connectionListCsv(model),
      'README.txt': eplanReadme(ctx.projectName || 'Project', stats, dxfSheets),
    },
  };
}
