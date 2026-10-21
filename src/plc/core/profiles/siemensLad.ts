/**
 * Siemens TIA Portal ladder (LAD): the program as SimaticML blocks (the XML TIA Portal Openness and the Version
 * control interface read and write), one file per block, so the technician gets real ladder networks instead of
 * an SCL text:
 *   Machine_DB.xml            global DB with every variable of the program (the names the SCL export and the HMI
 *                             tag list use: "Machine_DB".Safety_OK …), retentive where CLICK keeps memory
 *   <block>.xml               one FC per block of the program (or "Machine"), one LAD network per rung: Contact
 *                             (Negated), PContact / NContact (with an edge bit), Coil / SCoil / RCoil, TON / TOF /
 *                             TONR, CTU / CTD, compare boxes, Move; parallel branches are wires joined at a node
 *   Main.xml                  OB 1, calling the FCs in scan order
 *   <base>_tia_helpers.scl    what LAD cannot hold, as SCL functions the LAD networks call where the rung was:
 *                             MATH rungs, rungs kept from another program, the first-scan bit, the 1 s clock,
 *                             analog scaling and timer presets from a register
 * The PLC I/O tags stay in the tag table export (.sdf). Format (TIA Portal V17 Openness, "SimaticML"): Document ›
 * Engineering version › SW.Blocks.FC / OB / GlobalDB › AttributeList (Interface › Sections › Member) and ObjectList ›
 * SW.Blocks.CompileUnit (one per network) › NetworkSource › FlgNet › Parts (Access, Part, Call) and Wires (Powerrail,
 * NameCon, IdentCon); network titles as MultilingualText. src/plc/import/tiaXml.ts reads the same format back.
 */
import type { ExportContext } from '../profile';
import type { LadderElement, LadderOutput, LadderProgram, Rung } from '../ladder';
import { buildScl, unusedIoTags } from './siemens';
import type { StVariable } from './iecSt';

export interface TiaFile { name: string; content: string }

const DB = 'Machine_DB';

/** The TIA Portal versions the export writes for. */
export const TIA_VERSIONS = ['V16', 'V17', 'V18', 'V19', 'V20'] as const;
export type TiaVersion = (typeof TIA_VERSIONS)[number];

/**
 * SimaticML per TIA Portal version: the Engineering version and the namespace versions of the block interface and
 * of a LAD network. Import rule (TIA Portal Openness, "Version-specific SimaticML import"): up to V18 a version
 * imports files of its own and older versions; from V19 on, files of its last three versions (V20: V17–V20). So no
 * one file serves V16–V20: the export writes one folder per version.
 * Confirmed: Interface v5 in Siemens' V18 example. The other namespace versions are the ones this table writes until
 * a real TIA Portal export of that version confirms or corrects them (one place to change).
 */
const FORMAT: Record<TiaVersion, { iface: string; flg: string }> = {
  V16: { iface: 'v4', flg: 'v4' },
  V17: { iface: 'v5', flg: 'v4' },
  V18: { iface: 'v5', flg: 'v4' },
  V19: { iface: 'v5', flg: 'v5' },
  V20: { iface: 'v5', flg: 'v5' },
};
/** The version the blocks being written are for (set by buildTiaLad). */
let target: TiaVersion = 'V17';
const RETAIN_RE = /^(DS|DD|DH|DF|CT|CTD)\d+$/i;
const NUM = /^-?\d+(\.\d+)?$/;
/** Milliseconds per timer unit (as the SCL export reads them). */
const UNIT_MS: Record<string, number> = { ms: 1, sec: 1000, min: 60_000, hour: 3_600_000, day: 86_400_000 };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A block / member name TIA Portal accepts (letters, digits, underscores). */
const ident = (s: string) => s.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'B_$1') || 'Block';

/** Where an operand lives: a PLC tag ("Start_Button"), a member of the DB (Machine_DB.Safety_OK), or a constant. */
type Operand =
  | { kind: 'global'; path: string[]; type: string }
  | { kind: 'const'; value: string; type: string };

/** The program's names (from the SCL export, so all exports agree) and what each operand is in LAD. */
interface Names {
  vars: Map<string, StVariable>;
  of(address: string): Operand | null;
  /** ms per count of a TD operand (its timer's unit); 1 for anything else. */
  unitOf(address: string): number;
}

function namesOf(variables: StVariable[], program: LadderProgram): Names {
  const vars = new Map(variables.map((v) => [v.base.toUpperCase(), v]));
  const units = new Map<string, number>();
  for (const r of program.rungs) for (const o of r.outputs) if (o.type === 'TMR') units.set(`TD${o.address.toUpperCase().slice(1)}`, UNIT_MS[o.unit] ?? 1000);
  const unitOf = (a: string) => units.get(a.trim().toUpperCase()) ?? 1;
  const sys = (n: string) => vars.get(n);
  const of = (address: string): Operand | null => {
    const a = address.trim().toUpperCase();
    if (!a) return null;
    if (NUM.test(a)) return { kind: 'const', value: a, type: /\./.test(a) ? 'Real' : 'DInt' };
    if (a === 'SC2') return { kind: 'global', path: [DB, 'FirstScan'], type: 'Bool' };
    const t = /^(TD|CTD)(\d+)$/.exec(a);
    if (t) {
      const v = vars.get(`${t[1] === 'TD' ? 'T' : 'CT'}${t[2]}`);
      return v ? { kind: 'global', path: [DB, v.name, t[1] === 'TD' ? 'ET' : 'CV'], type: t[1] === 'TD' ? 'Time' : 'DInt' } : null;
    }
    const v = vars.get(a) ?? sys(a);
    if (!v) return null;
    if (v.io) return { kind: 'global', path: [v.io.replace(/^"|"$/g, '')], type: v.type };
    if (/^(TON|TOF|TONR)_TIME$|^CT[UD]_DINT$/.test(v.type)) return { kind: 'global', path: [DB, v.name, 'Q'], type: 'Bool' };
    return { kind: 'global', path: [DB, v.name], type: v.type };
  };
  return { vars, of, unitOf };
}

// ── What LAD holds ──

/** Why a rung goes to an SCL helper instead (null: it is LAD). */
function notLad(r: Rung, n: Names): string | null {
  for (const e of r.branches.flat()) {
    if (e.type === 'RAW') return 'an instruction kept from the original program';
    if (e.type === 'CMP') {
      const l = n.of(e.left), rt = n.of(e.right);
      if (!l || !rt) return `compare ${e.left} ${e.op} ${e.right}`;
      if ((l.type === 'Time') !== (rt.type === 'Time')) return `compare of a timer value with ${e.right}`;
    } else if (!/^SC[17]$/i.test(e.address) && !n.of(e.address)) return `operand ${e.address}`;
  }
  for (const o of r.outputs) {
    if (o.type === 'RAW') return 'an instruction kept from the original program';
    if (o.type === 'MATH') return `math (${o.dest} = ${o.expression})`;
    if (o.type === 'COPY' && (!n.of(o.source) || !n.of(o.dest))) return `copy ${o.source} → ${o.dest}`;
    if ((o.type === 'OUT' || o.type === 'SET' || o.type === 'RST') && !n.of(o.address)) return `coil ${o.address}`;
  }
  return null;
}

// ── FlgNet ──

class Flg {
  private uid = 21;
  readonly parts: string[] = [];
  readonly wires: string[] = [];
  next() { return this.uid++; }
  access(op: Operand): number {
    const id = this.next();
    if (op.kind === 'const') {
      const typed = op.type === 'Time';
      this.parts.push(typed
        ? `<Access Scope="TypedConstant" UId="${id}"><Constant><ConstantValue>${esc(op.value)}</ConstantValue></Constant></Access>`
        : `<Access Scope="LiteralConstant" UId="${id}"><Constant><ConstantType>${op.type}</ConstantType><ConstantValue>${esc(op.value)}</ConstantValue></Constant></Access>`);
    } else {
      this.parts.push(`<Access Scope="GlobalVariable" UId="${id}"><Symbol>${op.path.map((c) => `<Component Name="${esc(c)}" />`).join('')}</Symbol></Access>`);
    }
    return id;
  }
  part(name: string, inner = '', attrs = ''): number {
    const id = this.next();
    this.parts.push(`<Part Name="${name}" UId="${id}"${attrs}>${inner}</Part>`);
    return id;
  }
  /** An operand on a pin. */
  bind(op: Operand, uid: number, pin: string) {
    const a = this.access(op);
    this.wires.push(`<Wire UId="${this.next()}"><IdentCon UId="${a}" /><NameCon UId="${uid}" Name="${pin}" /></Wire>`);
  }
  /** One node: the rail or the outputs of other parts, into input pins. */
  join(from: 'rail' | { uid: number; pin: string }[], to: { uid: number; pin: string }[]) {
    if (!to.length) return;
    const head = from === 'rail' ? '<Powerrail />' : from.map((f) => `<NameCon UId="${f.uid}" Name="${f.pin}" />`).join('');
    this.wires.push(`<Wire UId="${this.next()}">${head}${to.map((t) => `<NameCon UId="${t.uid}" Name="${t.pin}" />`).join('')}</Wire>`);
  }
  xml(): string {
    return `<FlgNet xmlns="http://www.siemens.com/automation/Openness/SW/NetworkSource/FlgNet/${FORMAT[target].flg}"><Parts>${this.parts.join('')}</Parts><Wires>${this.wires.join('')}</Wires></FlgNet>`;
  }
}

const CMP_PART: Record<string, string> = { '==': 'Eq', '<>': 'Ne', '>': 'Gt', '>=': 'Ge', '<': 'Lt', '<=': 'Le' };
const timeConst = (ms: number): Operand => ({ kind: 'const', value: `T#${Math.round(ms)}MS`, type: 'Time' });

/** One rung → one LAD network. */
function ladNetwork(r: Rung, n: Names, edge: () => string[], presetOf: (o: Extract<LadderOutput, { type: 'TMR' }>) => Operand): string {
  const f = new Flg();
  // The rail feeds the first element of each branch; each branch ends in an out pin (or the rail itself).
  const railTo: { uid: number; pin: string }[] = [];
  const ends: { uid: number; pin: string }[] = [];
  let railEnd = false;
  for (const branch of r.branches.length ? r.branches : [[]]) {
    let prev: { uid: number; pin: string } | 'rail' = 'rail';
    const feed = (uid: number, pin: string) => { if (prev === 'rail') railTo.push({ uid, pin }); else f.join([prev], [{ uid, pin }]); };
    for (const e of branch as LadderElement[]) {
      if (e.type === 'RAW') continue;
      if (e.type === 'CMP') {
        const l = n.of(e.left)!, rt = n.of(e.right)!;
        const type = l.type === 'Time' || rt.type === 'Time' ? 'Time' : l.type === 'Real' || rt.type === 'Real' ? 'Real' : 'DInt';
        const id = f.part(CMP_PART[e.op], `<TemplateValue Name="SrcType" Type="Type">${type}</TemplateValue>`);
        feed(id, 'pre');
        // A number against a timer value is in that timer's unit (TD1 > 5 on a seconds timer: T#5000MS).
        f.bind(l.kind === 'const' && type === 'Time' ? timeConst(Number(l.value) * n.unitOf(e.right)) : l, id, 'in1');
        f.bind(rt.kind === 'const' && type === 'Time' ? timeConst(Number(rt.value) * n.unitOf(e.left)) : rt, id, 'in2');
        prev = { uid: id, pin: 'out' };
        continue;
      }
      // SC1 (always ON) is the wire itself.
      if (/^SC1$/i.test(e.address)) { if (e.type === 'NC') { /* never: an open contact */ } else continue; }
      const op = n.of(/^SC7$/i.test(e.address) ? 'SC7' : e.address)!;
      if (e.type === 'RISE' || e.type === 'FALL') {
        const id = f.part(e.type === 'RISE' ? 'PContact' : 'NContact');
        feed(id, 'in');
        f.bind(op, id, 'operand');
        f.bind({ kind: 'global', path: edge(), type: 'Bool' }, id, 'bit');
        prev = { uid: id, pin: 'out' };
      } else {
        const id = f.part('Contact', e.type === 'NC' ? '<Negated Name="operand" />' : '');
        feed(id, 'in');
        f.bind(op, id, 'operand');
        prev = { uid: id, pin: 'out' };
      }
    }
    if (prev === 'rail') railEnd = true; else ends.push(prev);
  }
  // The outputs, in parallel off the node.
  const outs: { uid: number; pin: string }[] = [];
  for (const o of r.outputs) {
    switch (o.type) {
      case 'OUT': case 'SET': case 'RST': {
        const id = f.part(o.type === 'OUT' ? 'Coil' : o.type === 'SET' ? 'SCoil' : 'RCoil');
        f.bind(n.of(o.address)!, id, 'operand');
        outs.push({ uid: id, pin: 'in' });
        break;
      }
      case 'TMR': {
        const v = n.vars.get(o.address.toUpperCase())!;
        const kind = o.accumulate ? 'TONR' : o.mode === 'OFF_DELAY' ? 'TOF' : 'TON';
        const id = f.part(kind, `<Instance Scope="GlobalVariable" UId="${f.next()}"><Component Name="${DB}" /><Component Name="${esc(v.name)}" /></Instance><TemplateValue Name="time_type" Type="Type">Time</TemplateValue>`, ' Version="1.0"');
        outs.push({ uid: id, pin: 'IN' });
        f.bind(presetOf(o), id, 'PT');
        if (o.accumulate && o.resetAddress && n.of(o.resetAddress)) f.bind(n.of(o.resetAddress)!, id, 'R');
        break;
      }
      case 'CNT': {
        const v = n.vars.get(o.address.toUpperCase())!;
        const up = o.direction !== 'DOWN';
        const id = f.part(up ? 'CTU' : 'CTD', `<Instance Scope="GlobalVariable" UId="${f.next()}"><Component Name="${DB}" /><Component Name="${esc(v.name)}" /></Instance><TemplateValue Name="value_type" Type="Type">DInt</TemplateValue>`, ' Version="1.0"');
        outs.push({ uid: id, pin: up ? 'CU' : 'CD' });
        const pv = n.of(o.preset);
        if (pv) f.bind(pv, id, 'PV');
        if (o.resetAddress && n.of(o.resetAddress)) f.bind(n.of(o.resetAddress)!, id, up ? 'R' : 'LD');
        break;
      }
      case 'COPY': {
        const id = f.part('Move', '<TemplateValue Name="Card" Type="Cardinality">1</TemplateValue>');
        outs.push({ uid: id, pin: 'en' });
        f.bind(n.of(o.source)!, id, 'in');
        f.bind(n.of(o.dest)!, id, 'out1');
        break;
      }
      default: break;
    }
  }
  if (railEnd) f.join('rail', [...railTo, ...outs]);
  else { f.join('rail', railTo); f.join(ends, outs); }
  return f.xml();
}

// ── SCL helpers ──

/** SCL of the FB form (#Name, "Tag") → global form ("Machine_DB".Name); `rename` maps a name of a partial export to the full one. */
function globalScl(body: string, rename: Map<string, string> = new Map()): string {
  return body.replace(/(^|[^\w"#])#([A-Za-z_]\w*)/g, (_m, pre: string, name: string) => `${pre}"${DB}".${rename.get(name) ?? name}`);
}

/** The body of FB "Machine" of an SCL export (between BEGIN and END_FUNCTION_BLOCK). */
function fbBody(scl: string): string[] {
  const m = /FUNCTION_BLOCK "Machine"[\s\S]*?\nBEGIN\n([\s\S]*?)\nEND_FUNCTION_BLOCK/.exec(scl);
  return (m?.[1] ?? '').split('\n').map((l) => l.replace(/^ {3}/, ''));
}

const fc = (name: string, title: string, body: string[]) => `FUNCTION "${name}" : Void
TITLE = '${title.replace(/'/g, '')}'
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
BEGIN
${body.map((l) => `   ${l}`).join('\n')}
END_FUNCTION
`;

// ── Blocks as SimaticML ──

const head = () => `<?xml version="1.0" encoding="utf-8"?>\n<Document>\n  <Engineering version="${target}" />\n`;

function text(id: () => string, composition: string, value: string): string {
  return `<MultilingualText ID="${id()}" CompositionName="${composition}"><ObjectList><MultilingualTextItem ID="${id()}" CompositionName="Items"><AttributeList><Culture>en-US</Culture><Text>${esc(value)}</Text></AttributeList></MultilingualTextItem></ObjectList></MultilingualText>`;
}

function compileUnit(id: () => string, title: string, source: string, comment = '', lang = 'LAD'): string {
  return `<SW.Blocks.CompileUnit ID="${id()}" CompositionName="CompileUnits"><AttributeList><NetworkSource>${source}</NetworkSource><ProgrammingLanguage>${lang}</ProgrammingLanguage></AttributeList><ObjectList>${text(id, 'Comment', comment)}${text(id, 'Title', title)}</ObjectList></SW.Blocks.CompileUnit>`;
}

const ids = () => { let n = 0; return () => (++n).toString(16).toUpperCase(); };
const sections = () => `http://www.siemens.com/automation/Openness/SW/Interface/${FORMAT[target].iface}`;

function fcXml(name: string, number: number, title: string, networks: { title: string; flg: string; comment: string }[]): string {
  const id = ids();
  const blockId = id();
  return `${head()}  <SW.Blocks.FC ID="${blockId}">
    <AttributeList>
      <Interface><Sections xmlns="${sections()}"><Section Name="Input" /><Section Name="Output" /><Section Name="InOut" /><Section Name="Temp" /><Section Name="Constant" /><Section Name="Return"><Member Name="Ret_Val" Datatype="Void" /></Section></Sections></Interface>
      <MemoryLayout>Optimized</MemoryLayout>
      <Name>${esc(name)}</Name>
      <Number>${number}</Number>
      <ProgrammingLanguage>LAD</ProgrammingLanguage>
    </AttributeList>
    <ObjectList>
      ${text(id, 'Comment', '')}
      ${networks.map((w) => compileUnit(id, w.title, w.flg, w.comment)).join('\n      ')}
      ${text(id, 'Title', title)}
    </ObjectList>
  </SW.Blocks.FC>
</Document>
`;
}

/** A LAD network that calls an FC (an SCL helper, or a block from OB 1). */
function callNetwork(name: string): string {
  const f = new Flg();
  const id = f.next();
  f.parts.push(`<Call UId="${id}"><CallInfo Name="${esc(name)}" BlockType="FC" /></Call>`);
  f.join('rail', [{ uid: id, pin: 'en' }]);
  return f.xml();
}

function dbXml(members: { name: string; type: string; comment: string; retain: boolean }[]): string {
  const id = ids();
  const m = members.map((x) => `<Member Name="${esc(x.name)}" Datatype="${x.type}"${/_TIME$|_DINT$|_TRIG$/.test(x.type) ? ' Version="1.0"' : ''} Remanence="${x.retain ? 'Retain' : 'NonRetain'}" Accessibility="Public"><Comment><MultiLanguageText Lang="en-US">${esc(x.comment)}</MultiLanguageText></Comment></Member>`).join('');
  return `${head()}  <SW.Blocks.GlobalDB ID="${id()}">
    <AttributeList>
      <Interface><Sections xmlns="${sections()}"><Section Name="Static">${m}</Section></Sections></Interface>
      <MemoryLayout>Optimized</MemoryLayout>
      <MemoryReserve>100</MemoryReserve>
      <Name>${DB}</Name>
      <Number>1</Number>
      <ProgrammingLanguage>DB</ProgrammingLanguage>
    </AttributeList>
    <ObjectList>${text(id, 'Comment', 'The program\'s variables (the same names as the SCL export and the HMI tags).')}${text(id, 'Title', '')}</ObjectList>
  </SW.Blocks.GlobalDB>
</Document>
`;
}

function obXml(calls: string[]): string {
  const id = ids();
  return `${head()}  <SW.Blocks.OB ID="${id()}">
    <AttributeList>
      <Interface><Sections xmlns="${sections()}"><Section Name="Input"><Member Name="Initial_Call" Datatype="Bool" Informative="true" /><Member Name="Remanence" Datatype="Bool" Informative="true" /></Section><Section Name="Temp" /><Section Name="Constant" /></Sections></Interface>
      <MemoryLayout>Optimized</MemoryLayout>
      <Name>Main</Name>
      <Number>1</Number>
      <ProgrammingLanguage>LAD</ProgrammingLanguage>
      <SecondaryType>ProgramCycle</SecondaryType>
    </AttributeList>
    <ObjectList>
      ${text(id, 'Comment', '')}
      ${calls.map((c) => compileUnit(id, `Call ${c}`, callNetwork(c))).join('\n      ')}
      ${text(id, 'Title', 'Main Program Sweep (Cycle)')}
    </ObjectList>
  </SW.Blocks.OB>
</Document>
`;
}

export interface TiaLadExport {
  files: TiaFile[];
  /** Rungs written as LAD networks, and the ones given to an SCL helper (with why). */
  lad: number;
  viaScl: { block: string; rung: number; why: string }[];
  /** The neutral operand → the name the LAD files use ("Start_Button", "Machine_DB.Safety_OK.Q"): for checks. */
  nameOf(address: string): string | null;
}

/** The program as TIA Portal ladder blocks. */
export function buildTiaLad(program: LadderProgram, ctx: ExportContext, base = 'Machine', version: TiaVersion = 'V17'): TiaLadExport {
  target = version;
  const full = buildScl(program, ctx);
  const vars = full.st.variables;
  // Timer presets held in a register: a Time member each, set by the start helper.
  const presetMember = new Map<string, string>();
  const names = namesOf(vars, program);
  const ptLines: string[] = [];
  const presetOf = (o: Extract<LadderOutput, { type: 'TMR' }>): Operand => {
    const unit = UNIT_MS[o.unit] ?? 1000;
    if (NUM.test(o.preset.trim())) return timeConst(Number(o.preset) * unit);
    const v = names.vars.get(o.address.toUpperCase())!;
    const m = `${v.name}_PT`;
    if (!presetMember.has(m)) {
      presetMember.set(m, o.preset);
      const src = names.of(o.preset);
      const ref = src ? src.kind === 'const' ? src.value : src.path.length === 1 ? `"${src.path[0]}"` : `"${src.path[0]}".${src.path.slice(1).join('.')}` : o.preset;
      ptLines.push(`"${DB}".${m} := DINT_TO_TIME(${ref} * ${unit});`);
    }
    return { kind: 'global', path: [DB, m], type: 'Time' };
  };
  let edges = 0;
  const edgeMembers: string[] = [];
  const edge = () => { const m = `Edge_${++edges}`; edgeMembers.push(m); return [DB, m]; };

  // Blocks in program order: one FC per block (the program's own blocks), else "Machine".
  const order = [...new Set(program.rungs.map((r) => r.block ?? ''))];
  const blockName = (b: string) => (b ? ident(program.blocks?.find((x) => x.id === b)?.name ?? b) : ident(base));
  const files: TiaFile[] = [];
  const helpers: string[] = [];
  const viaScl: TiaLadExport['viaScl'] = [];
  let lad = 0;
  let fcNo = 1;
  const calls: string[] = [];

  // Start: first scan, the 1 s clock, analog inputs scaled (from the SCL export's own statements), timer presets.
  const body = fbBody(full.scl);
  const startLines = [
    `"${DB}".FirstScan := NOT "${DB}".Initialized;`,
    `"${DB}".Initialized := TRUE;`,
    ...globalScl(body.filter((l) => /CLOCK_TMR/.test(l) || /^#\w+ := SCALE_X\(/.test(l)).join('\n')).split('\n').filter(Boolean),
  ];
  const endLines = globalScl(body.filter((l) => /^"\w+" := REAL_TO_INT\(SCALE_X/.test(l)).join('\n')).split('\n').filter(Boolean);

  for (const b of order) {
    const rungs = program.rungs.filter((r) => (r.block ?? '') === b);
    const name = blockName(b);
    // The network comment names the rung (TIA reports compile errors by block and network: back to the rung).
    const networks: { title: string; flg: string; comment: string }[] = [];
    rungs.forEach((r, i) => {
      const why = notLad(r, names);
      if (!why) { networks.push({ title: r.comment.split('\n')[0] ?? '', flg: ladNetwork(r, names, edge, presetOf), comment: `rung ${r.id}` }); lad++; return; }
      // An SCL helper for this rung: its SCL as the SCL export writes it, in the global names.
      const part = buildScl({ ...program, rungs: [r] }, ctx);
      const rename = new Map(part.st.variables.map((v) => [v.name, names.vars.get(v.base.toUpperCase())?.name ?? v.name]));
      const lines = fbBody(part.scl).filter((l) => l && !/FirstScan|Initialized|^\(\* (Conveyor|TIA Portal|First scan after|=====)/.test(l) && !/^#\w+ := "\w+";$|^"\w+" := #\w+;$/.test(l) && !/CLOCK_TMR/.test(l));
      const helper = `${name}_R${i + 1}`;
      helpers.push(fc(helper, `${name} rung ${i + 1}: ${why}`, globalScl(lines.join('\n'), rename).split('\n')));
      networks.push({ title: `${r.comment.split('\n')[0] ?? ''} (SCL: ${helper})`, flg: callNetwork(helper), comment: `rung ${r.id}` });
      viaScl.push({ block: name, rung: i + 1, why });
    });
    files.push({ name: `${name}.xml`, content: fcXml(name, ++fcNo, name, networks) });
    calls.push(name);
  }
  const start = `${ident(base)}_Start`, end = `${ident(base)}_End`;
  helpers.unshift(fc(start, 'First scan, 1 s clock, analog inputs, timer presets', [...startLines, ...ptLines]));
  if (endLines.length) helpers.push(fc(end, 'Analog outputs', endLines));

  const members = [
    { name: 'Initialized', type: 'Bool', comment: 'set after the first scan', retain: false },
    { name: 'FirstScan', type: 'Bool', comment: 'TRUE on the first scan after a start', retain: false },
    ...vars.filter((v) => !v.io).map((v) => ({ name: v.name, type: v.type, comment: v.comment, retain: RETAIN_RE.test(v.base) })),
    ...[...presetMember].map(([m, src]) => ({ name: m, type: 'Time', comment: `timer preset from ${src}`, retain: false })),
    ...edgeMembers.map((m) => ({ name: m, type: 'Bool', comment: 'edge memory of a P / N contact', retain: false })),
  ];
  const nameOf = (a: string) => { const o = names.of(a); return o && o.kind === 'global' ? o.path.join('.') : o?.kind === 'const' ? o.value : null; };
  return {
    files: [
      { name: `${DB}.xml`, content: dbXml(members) },
      ...files,
      { name: 'Main.xml', content: obXml([start, ...calls, ...(endLines.length ? [end] : [])]) },
      { name: `${base}_tia_helpers.scl`, content: `\uFEFF${helpers.join('\n')}` },
    ],
    lad, viaScl, nameOf,
  };
}

/** The PLC tags (I/O) the blocks use, as the tag table (.sdf) has them: for an Openness import that creates them by API. */
export function tiaPlcTags(program: LadderProgram, ctx: ExportContext): { name: string; dataType: string; logicalAddress: string; comment: string }[] {
  const have = buildScl(program, ctx).tags;
  return [...have, ...unusedIoTags(program, ctx, have)].map((t) => ({ name: t.name, dataType: t.type, logicalAddress: t.address, comment: t.comment }));
}

/** How a block file gets into a TIA Portal version, and what to do when that way is not there. */
function importRoute(v: TiaVersion): string[] {
  return [
    `3. The ladder blocks: in the Project tree, Version control interface > Add new workspace, point it at this ${v} folder, then drag the blocks from the workspace into the PLC's Program blocks (no scripting needed).`,
    `   If the Version control interface is not installed in your ${v}: import the block files with TIA Portal Openness (PlcBlockGroup.Blocks.Import, one file per block, the DB first), or use the SCL source (text) from the download instead.`,
  ];
}

/**
 * The LAD export as one folder per TIA Portal version (V16 … V20), each with its README: the technician takes the
 * folder of the TIA Portal on the PC (a version imports its own files, and from V19 on its last three versions').
 */
export function tiaLadFiles(program: LadderProgram, ctx: ExportContext, base: string): TiaFile[] {
  const root = `${base}_TIA_LAD/`;
  const out: TiaFile[] = [];
  let first: TiaLadExport | null = null;
  for (const v of TIA_VERSIONS) {
    const x = buildTiaLad(program, ctx, 'Machine', v);
    first ??= x;
    const blocks = x.files.filter((f) => f.name.endsWith('.xml')).map((f) => f.name.replace(/\.xml$/, ''));
    const readme = [
      `${ctx.header}`,
      '',
      `PLC program for TIA Portal ${v} as ladder (LAD) blocks: one SimaticML file per block (Engineering version ${v}).`,
      '',
      'Get it into the project:',
      '1. PLC tags first: in the PLC, PLC tags > Import, choose the tag table (.sdf) from the download.',
      `2. The SCL helpers: External source files > Add new external file, choose Machine_tia_helpers.scl, then right-click it > Generate blocks from source (${x.viaScl.length + 1} small FC${x.viaScl.length ? 's' : ''}, list below).`,
      ...importRoute(v),
      `   Blocks: ${blocks.join(', ')}.`,
      '4. Compile the PLC (software, rebuild all), then download to the device. Keep the machine safe while testing.',
      '',
      `Ladder networks: ${x.lad} of ${program.rungs.length} rungs. Each network's comment names its rung ("rung r_…").`,
      x.viaScl.length ? 'In SCL, called from their place in the ladder (LAD has no form for them):' : 'Every rung is a ladder network.',
      ...x.viaScl.map((w) => `- ${w.block} network ${w.rung}: ${w.why}`),
      'Also SCL (Machine_Start, called first from Main): the first-scan bit, the 1 s clock, analog input scaling and timer presets held in a register.',
      '',
      'The variables are in the global DB "Machine_DB" with the names the SCL source and the HMI tag list use.',
    ].join('\r\n');
    out.push(...x.files.map((f) => ({ name: `${root}${v}/${f.name}`, content: f.content })), { name: `${root}${v}/README.txt`, content: readme });
  }
  out.unshift({ name: `${root}README.txt`, content: [
    `${ctx.header}`,
    '',
    'The PLC program as TIA Portal ladder (LAD) blocks. Take the folder of YOUR TIA Portal version (Help > Installed software):',
    ...TIA_VERSIONS.map((v) => `- ${v}/  for TIA Portal ${v}`),
    'A TIA Portal version imports block files of its own version (V19 and V20 also of their two previous versions), so use the folder that matches.',
    'Each folder has its own README with the steps. Nothing to choose in the app; the SCL source (text) in the download works on every version as a fallback.',
    '',
    `Ladder networks: ${first!.lad} of ${program.rungs.length} rungs; ${first!.viaScl.length} rung${first!.viaScl.length === 1 ? '' : 's'} as SCL helpers (see a version's README).`,
  ].join('\r\n') });
  return out;
}
