import type { ProjectSnapshot } from '../collect';
import { getHmi, isCmore } from '../../hmi/hmiCatalog';
import type { LadderElement, LadderOutput, Rung } from '../../plc/core/ladder';
import { elementAddresses, rungWrites } from '../../plc/core/ladder';
import { describeOutput } from '../../plc/core/clickExport';
import { buildModel, naturalCompare } from '../../electrical/derive';
import { getPart } from '../../electrical/catalog';
import { makeTable, specLines, pad, type DocRow, type DocTable } from './table';
import { projectPlcNames } from '../plcTagNames';

/**
 * Program analysis for the documents: plain-word names for addresses, the
 * conditions that gate each output (interlocks), alarms with cause and
 * reset, memory map and I/O cross reference. Everything is read from the
 * ladder program, the I/O list, the HMI design and the electrical design.
 */

type Kind = 'input' | 'output' | 'bit' | 'system' | 'timer' | 'counter' | 'register' | 'timerValue' | 'counterValue' | 'constant' | 'unknown';

const KIND_TEXT: Record<Kind, string> = {
  input: 'Discrete input', output: 'Discrete output', bit: 'Internal bit', system: 'System bit', timer: 'Timer', counter: 'Counter',
  register: 'Data register', timerValue: 'Timer value', counterValue: 'Counter value', constant: 'Constant', unknown: '',
};

export interface ProgramInfo {
  /** Plain name of an address, e.g. "Start PB". Empty when unknown. */
  name: (a: string) => string;
  /** "Start PB (X002)" */
  ref: (a: string) => string;
  kind: (a: string) => Kind;
  /** Device tag driving / read by an I/O address (from the electrical design). */
  device: (a: string) => string;
  rungNo: (r: Rung) => number;
  reads: Map<string, number[]>;
  writes: Map<string, number[]>;
  /** Plain words for one contact / compare. */
  element: (el: LadderElement, self?: string) => string;
  /** Plain words for a rung's logic: permissives (in every path) and initiators (any one path). */
  logic: (r: Rung, self?: string) => { permissives: string[]; initiators: string[] };
  conditionText: (r: Rung, self?: string) => string;
}

const NC_DEVICES = new Set(['pushbutton-nc', 'estop-contact']);

export function programInfo(p: ProjectSnapshot): ProgramInfo {
  const names = new Map<string, string>();
  for (const t of p.hmi?.tags ?? []) if (t.name) names.set(t.address.toUpperCase(), t.name.replace(/_/g, ' '));
  for (const t of p.ladder.tags) if (t.nickname) names.set(t.address.toUpperCase(), t.nickname.replace(/_/g, ' '));
  for (const x of p.io) {
    const a = p.addresses.get(x.id);
    if (a && x.description) names.set(a.toUpperCase(), x.description);
  }
  const wiring = new Map((p.electrical?.ioWiring ?? []).map((w) => [w.address.toUpperCase(), w] as const));
  const name = (a: string) => names.get(a.trim().toUpperCase()) ?? '';
  const ref = (a: string) => (name(a) ? `${name(a)} (${a})` : a);
  const kind = (a: string): Kind => (p.profile.parseAddress(a)?.kind as Kind | undefined) ?? (/^-?\d+(\.\d+)?$/.test(a.trim()) ? 'constant' : 'unknown');
  const device = (a: string) => wiring.get(a.toUpperCase())?.deviceTag ?? '';
  const idx = new Map(p.ladder.rungs.map((r, i) => [r.id, i + 1] as const));
  const rungNo = (r: Rung) => idx.get(r.id) ?? 0;

  const reads = new Map<string, number[]>();
  const writes = new Map<string, number[]>();
  const push = (m: Map<string, number[]>, a: string, n: number) => {
    const k = a.trim().toUpperCase();
    if (!k || kind(k) === 'constant') return;
    const l = m.get(k) ?? [];
    if (!l.includes(n)) l.push(n);
    m.set(k, l);
  };
  p.ladder.rungs.forEach((r, i) => {
    const n = i + 1;
    for (const b of r.branches) for (const el of b) {
      for (const a of elementAddresses(el)) push(reads, a, n);
    }
    for (const o of r.outputs) {
      if (o.type === 'TMR' || o.type === 'CNT') { push(reads, o.preset, n); if (o.resetAddress) push(reads, o.resetAddress, n); }
      if (o.type === 'COPY') push(reads, o.source, n);
      if (o.type === 'MATH') for (const tok of o.expression.match(/[A-Za-z]+\d+/g) ?? []) push(reads, tok, n);
    }
    for (const a of rungWrites(r)) push(writes, a, n);
  });

  const element = (el: LadderElement, self?: string): string => {
    if (el.type === 'CMP') {
      const side = (s: string) => (kind(s) === 'constant' ? s : ref(s));
      return `${side(el.left)} ${el.op} ${side(el.right)}`;
    }
    if (el.type === 'RAW') return `${el.text} (not converted; check by hand)`;
    const a = el.address;
    const k = kind(a);
    const r = ref(a);
    if (self && a.toUpperCase() === self.toUpperCase() && el.type === 'NO') return `${r} already ON (seal-in)`;
    const nc = NC_DEVICES.has(wiring.get(a.toUpperCase())?.deviceType ?? '');
    switch (el.type) {
      case 'NO':
        if (nc) return `${r} not pressed (NC circuit closed)`;
        if (k === 'timer') return `${r} timed out`;
        if (k === 'counter') return `${r} count reached`;
        return `${r} ON`;
      case 'NC':
        if (nc) return `${r} pressed (NC circuit open)`;
        if (k === 'timer') return `${r} not timed out`;
        if (k === 'counter') return `${r} count not reached`;
        return `${r} OFF`;
      case 'RISE': return `${r} turns ON (one-shot)`;
      case 'FALL': return `${r} turns OFF (one-shot)`;
    }
  };
  const key = (el: LadderElement) => (el.type === 'CMP' ? `CMP:${el.left}${el.op}${el.right}` : el.type === 'RAW' ? `RAW:${el.text}` : `${el.type}:${el.address.toUpperCase()}`);
  const logic = (r: Rung, self?: string) => {
    if (!r.branches.length) return { permissives: ['always (no conditions)'], initiators: [] };
    if (r.branches.length === 1) {
      const b = r.branches[0];
      return {
        permissives: b.filter((el) => el.type !== 'RISE' && el.type !== 'FALL').map((el) => element(el, self)),
        initiators: b.filter((el) => el.type === 'RISE' || el.type === 'FALL').map((el) => element(el, self)),
      };
    }
    const common = r.branches[0].filter((el) => r.branches.every((b) => b.some((x) => key(x) === key(el))));
    const ck = new Set(common.map(key));
    const initiators = r.branches.map((b) => b.filter((el) => !ck.has(key(el))).map((el) => element(el, self)).join(' AND ') || '(no further condition)');
    return { permissives: common.map((el) => element(el, self)), initiators };
  };
  const conditionText = (r: Rung, self?: string) => {
    const { permissives, initiators } = logic(r, self);
    const parts: string[] = [];
    if (initiators.length) parts.push(initiators.length > 1 ? `any of: ${initiators.map((t) => `(${t})`).join(' OR ')}` : initiators[0]);
    if (permissives.length) parts.push(permissives.join(' AND '));
    return parts.join(', with ');
  };
  return { name, ref, kind, device, rungNo, reads, writes, element, logic, conditionText };
}

const ACTION: Record<'OUT' | 'SET' | 'RST', string> = { OUT: 'Energized while', SET: 'Latched ON (SET) when', RST: 'Unlatched (RST) when' };

/** Software interlocks (from the ladder) and hardwired interlocks (from the electrical design). */
export function interlockTable(p: ProjectSnapshot, info = programInfo(p)): DocTable {
  const rows: DocRow[] = [];
  let n = 0;
  const outs: { r: Rung; o: Extract<LadderOutput, { type: 'OUT' | 'SET' | 'RST' }> }[] = [];
  for (const r of p.ladder.rungs) for (const o of r.outputs) if (o.type === 'OUT' || o.type === 'SET' || o.type === 'RST') outs.push({ r, o });
  // Physical outputs first, then internal states.
  outs.sort((a, b) => Number(info.kind(b.o.address) === 'output') - Number(info.kind(a.o.address) === 'output'));
  if (outs.length) rows.push({ group: 'PLC program interlocks and permissives' });
  for (const { r, o } of outs) {
    const { permissives, initiators } = info.logic(r, o.address);
    const dev = info.device(o.address);
    rows.push([
      `IL-${pad(++n, 2)}`,
      `${info.ref(o.address)}${dev ? ` — ${dev}` : ''}`,
      ACTION[o.type],
      permissives.join(';\n') || '—',
      initiators.length ? initiators.join(';\nOR ') : '—',
      String(info.rungNo(r)),
    ]);
  }
  // Hardwired interlocks.
  const hw: string[][] = [];
  if (p.drawingCtx) {
    const m = buildModel(p.drawingCtx);
    let h = 0;
    for (const pt of m.io) {
      if (!pt.coilChain?.devices.length) continue;
      for (const d of pt.coilChain.devices) {
        hw.push([`HW-${pad(++h, 2)}`, `${pt.deviceTag || pt.address} coil (${pt.address})`, 'Hardwired in series with the coil',
          `${d.tag} ${d.terminals} ${d.nc ? '(NC)' : ''} closed — ${d.kind === 'ol' ? 'motor overload not tripped' : 'opposite-direction contactor de-energized (electrical interlock)'}`, '—', 'Dwg']);
      }
    }
    if (m.safety.outputSupply === '24+S') {
      const via = m.safety.mcr ? `${m.safety.mcr.tag} (MCR) driven by ${m.safety.relay?.tag ?? 'the E-stop chain'}` : m.safety.relay ? m.safety.relay.tag : `E-stop chain ${m.safety.estops.join(', ')}`;
      const fed = m.groups.filter((g) => g.type === 'output' && g.outputStyle !== 'sinking').map((g) => g.devTag);
      const loads = m.io.filter((x) => x.type === 'output').map((x) => `${x.address}${x.deviceTag ? ` ${x.deviceTag}` : ''}`);
      hw.push([`HW-${pad(++h, 2)}`, `Safety-switched supply 24+S${fed.length ? ` (${fed.join(', ')} output supply)` : ''}`, 'Removed by the safety circuit',
        `${via} healthy and reset — E-stop released`, '—', 'Dwg']);
      if (loads.length) hw.push([`HW-${pad(h + 1, 2)}`, `PLC outputs ${loads.join(', ')}`, 'Cannot energize without 24+S',
        'Safety circuit healthy (see SF table). The PLC program does not perform the safety function.', '—', 'Dwg']);
    }
  }
  if (hw.length) { rows.push({ group: 'Hardwired interlocks (electrical design)' }); rows.push(...hw); }
  return makeTable([['ID', 7], ['Output / function', 30], ['Action', 16], ['Permissives (all required)', 46], ['Initiated by (any one)', 34], ['Rung', 6, 'center']], rows);
}

export interface AlarmRow { id: string; address: string; message: string; cause: string; action: string; severity: string; effect: string }

function significant(t: string): Set<string> {
  return new Set(t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !['when', 'with', 'from', 'that', 'this', 'then', 'alarm', 'fault'].includes(w)));
}

/** Alarm list: HMI alarms plus ALM_ bits in the ladder, with cause and reset taken from the program. */
export function alarmRows(p: ProjectSnapshot, info = programInfo(p)): AlarmRow[] {
  const list = new Map<string, { message: string; severity: 'alarm' | 'warning' }>();
  for (const a of p.hmi?.alarms ?? []) list.set(a.address.toUpperCase(), { message: a.message, severity: a.severity });
  for (const t of p.ladder.tags) {
    if (/^(ALM|ALARM|FLT|FAULT)_/i.test(t.nickname) && !list.has(t.address.toUpperCase())) list.set(t.address.toUpperCase(), { message: t.comment || t.nickname.replace(/_/g, ' '), severity: 'alarm' });
  }
  const specAlarms = specLines(p.spec.alarms);
  const rows: AlarmRow[] = [];
  let n = 0;
  for (const [addr, a] of list) {
    const setRungs = p.ladder.rungs.filter((r) => r.outputs.some((o) => (o.type === 'SET' || o.type === 'OUT') && o.address.toUpperCase() === addr));
    const rstRungs = p.ladder.rungs.filter((r) => r.outputs.some((o) => o.type === 'RST' && o.address.toUpperCase() === addr));
    const causes: string[] = [];
    for (const r of setRungs) {
      causes.push(`Set when ${info.conditionText(r, addr)} (rung ${info.rungNo(r)}).`);
      // Expand timers / counters that trigger it.
      for (const b of r.branches) for (const el of b) {
        if (el.type === 'CMP' || el.type === 'RAW' || info.kind(el.address) !== 'timer') continue;
        for (const tr of p.ladder.rungs) for (const o of tr.outputs) {
          if (o.type === 'TMR' && o.address.toUpperCase() === el.address.toUpperCase()) causes.push(`${o.address} times ${o.preset} ${o.unit} while ${info.conditionText(tr)} (rung ${info.rungNo(tr)}).`);
        }
      }
    }
    const words = significant(a.message);
    let best = '', score = 1;
    for (const l of specAlarms) {
      const s = [...significant(l)].filter((w) => words.has(w)).length;
      if (s > score) { score = s; best = l; }
    }
    if (best) causes.push(`Specification: ${best}`);
    const devices = new Set<string>();
    for (const r of setRungs) for (const b of r.branches) for (const el of b) if (el.type !== 'CMP' && el.type !== 'RAW' && info.device(el.address)) devices.add(info.device(el.address));
    // Devices behind a timer's enabling rung, e.g. the sensor that never came on.
    for (const r of p.ladder.rungs) if (r.outputs.some((o) => o.type === 'TMR') && causes.some((c) => c.includes(`(rung ${info.rungNo(r)})`))) {
      for (const b of r.branches) for (const el of b) if (el.type !== 'CMP' && el.type !== 'RAW' && info.device(el.address)) devices.add(info.device(el.address));
    }
    const actions: string[] = [];
    if (devices.size) actions.push(`Check ${[...devices].join(', ')} and the mechanism they monitor; remove the cause.`);
    else actions.push('Find and remove the cause.');
    if (rstRungs.length) actions.push(`Reset: ${rstRungs.map((r) => info.conditionText(r)).join('; or ')}.`);
    else if (setRungs.some((r) => r.outputs.some((o) => o.type === 'OUT' && o.address.toUpperCase() === addr))) actions.push('Clears automatically when the condition is gone.');
    else actions.push('No reset rung found in the program — add one.');
    const stops = p.ladder.rungs.filter((r) => r.branches.some((b) => b.some((el) => el.type === 'NC' && el.address.toUpperCase() === addr)) && !r.outputs.some((o) => o.type !== 'TMR' && o.type !== 'CNT' && 'address' in o && o.address.toUpperCase() === addr));
    const effect = stops.length
      ? `Blocks ${stops.flatMap((r) => r.outputs.filter((o): o is Extract<LadderOutput, { address: string }> => 'address' in o).map((o) => info.ref(o.address))).join(', ')}`
      : 'Indication only';
    rows.push({
      id: `ALM-${pad(++n, 3)}`, address: addr, message: a.message,
      cause: causes.join('\n') || 'Not found in the program — confirm the alarm source.',
      action: actions.join(' '),
      severity: a.severity === 'warning' ? 'Warning' : stops.length ? 'High — stops the machine' : 'Alarm',
      effect,
    });
  }
  return rows;
}

export function alarmTable(p: ProjectSnapshot, info = programInfo(p)): DocTable {
  return makeTable([['ID', 9], ['PLC address', 9], [p.hmi ? 'Message (HMI)' : 'Message', 26], ['Probable cause', 46], ['Operator action', 38], ['Severity', 14], ['Effect', 22]],
    alarmRows(p, info).map((a) => [a.id, a.address, a.message, a.cause, a.action, a.severity, a.effect]));
}

/** Program blocks (machine sections) with their rung ranges. */
export function blockTable(p: ProjectSnapshot): DocTable {
  const blocks = [...(p.ladder.blocks ?? [])];
  const rows: string[][] = [];
  const range = (nums: number[]) => (nums.length ? (nums.length === 1 ? String(nums[0]) : nums.every((x, i) => i === 0 || x === nums[i - 1] + 1) ? `${nums[0]}–${nums[nums.length - 1]}` : nums.join(', ')) : '—');
  for (const b of blocks) {
    const nums = p.ladder.rungs.map((r, i) => (r.block === b.id ? i + 1 : 0)).filter(Boolean);
    rows.push([b.name, b.description, range(nums), String(nums.length)]);
  }
  const loose = p.ladder.rungs.map((r, i) => (!r.block || !blocks.some((b) => b.id === r.block) ? i + 1 : 0)).filter(Boolean);
  if (loose.length) rows.push(['General', 'Rungs not assigned to a machine block', range(loose), String(loose.length)]);
  return makeTable([['Block', 20], ['Description', 60], ['Rungs', 14, 'center'], ['Count', 8, 'center']], rows);
}

/** Every rung in words. */
export function rungTable(p: ProjectSnapshot, info = programInfo(p)): DocTable {
  const blockName = new Map((p.ladder.blocks ?? []).map((b) => [b.id, b.name] as const));
  const label = (a: string) => (info.name(a) ? ` (${info.name(a)})` : '');
  return makeTable([['Rung', 6, 'center'], ['Block', 14], ['Comment', 36], ['Logic (plain words)', 56], ['Outputs', 40]],
    p.ladder.rungs.map((r, i) => [String(i + 1), blockName.get(r.block ?? '') ?? 'General', r.comment, info.conditionText(r) || 'always', r.outputs.map((o) => describeOutput(o, label).replace('→', '->')).join('\n')]));
}

/** Memory map / tag table: every address the project uses. */
export function tagTable(p: ProjectSnapshot, info = programInfo(p)): DocTable {
  const all = new Map<string, { nick: string; comment: string }>();
  const add = (a: string, nick = '', comment = '') => {
    const k = a.trim().toUpperCase();
    if (!k || info.kind(k) === 'constant') return;
    const cur = all.get(k) ?? { nick: '', comment: '' };
    all.set(k, { nick: cur.nick || nick, comment: cur.comment || comment });
  };
  for (const x of p.io) { const a = p.addresses.get(x.id); if (a) add(a, '', x.description); }
  for (const t of p.ladder.tags) add(t.address, t.nickname, t.comment);
  for (const t of p.hmi?.tags ?? []) add(t.address, t.name, t.description);
  for (const k of [...info.reads.keys(), ...info.writes.keys()]) add(k);
  const hmiUse = new Map<string, string[]>();
  for (const s of p.hmi?.screens ?? []) for (const e of s.elements) if (e.address) {
    const k = e.address.toUpperCase();
    const l = hmiUse.get(k) ?? [];
    if (!l.includes(s.name)) l.push(s.name);
    hmiUse.set(k, l);
  }
  const order: Kind[] = ['input', 'output', 'bit', 'timer', 'counter', 'register', 'timerValue', 'counterValue', 'system', 'unknown', 'constant'];
  // The "HMI screens" column only when there are screens.
  // Siemens / Logix: the PLC's tag name and address first (the app operand last, for cross-checking).
  const names = projectPlcNames(p);
  const rows = [...all].sort(([a], [b]) => order.indexOf(info.kind(a)) - order.indexOf(info.kind(b)) || naturalCompare(a, b)).map(([a, v]) => [
    ...(names ? [names(a)?.name ?? a, names(a)?.io ?? ''] : [a, v.nick]), v.comment || info.name(a), KIND_TEXT[info.kind(a)], (info.reads.get(a) ?? []).join(', ') || '—', (info.writes.get(a) ?? []).join(', ') || '—',
    ...(p.hmi ? [(hmiUse.get(a) ?? []).join(', ') || '—'] : []),
    ...(names ? [a] : []),
  ]);
  return makeTable([...(names ? [['PLC tag', 22], ['PLC address', 10]] as [string, number][] : [['Address', 9], ['Nickname', 20]] as [string, number][]), ['Description / comment', 40], ['Type', 14], ['Read in rungs', 14], ['Written in rungs', 12], ...(p.hmi ? [['HMI screens', 20] as [string, number]] : []), ...(names ? [['App operand', 9] as [string, number]] : [])], rows);
}

/** I/O cross reference: each physical I/O address -> rungs that read / write it. */
export function ioCrossRefTable(p: ProjectSnapshot, info = programInfo(p)): DocTable {
  const rows: string[][] = [];
  const pts = p.io.map((x) => ({ x, a: p.addresses.get(x.id) ?? '' })).filter((v) => v.a).sort((a, b) => (a.x.type === b.x.type ? naturalCompare(a.a, b.a) : a.x.type === 'input' ? -1 : 1));
  for (const { x, a } of pts) {
    const k = a.toUpperCase();
    const r = info.reads.get(k) ?? [], w = info.writes.get(k) ?? [];
    rows.push([a, info.device(a), x.description, r.join(', ') || '—', w.join(', ') || '—', !r.length && !w.length ? 'Not used in the program' : x.type === 'output' && !w.length ? 'Output never written' : '']);
  }
  return makeTable([['Address', 9], ['Device', 9], ['Description', 40], ['Read in rungs', 16], ['Written in rungs', 16], ['Remark', 26]], rows);
}

/** Controller and module summary. */
export function controllerTable(p: ProjectSnapshot): DocTable {
  const rows: string[][] = [];
  const cpuPart = getPart(p.cpu.id);
  rows.push(['CPU', `${p.profile.vendor} ${p.profile.name} ${p.cpu.id}`, cpuPart?.description ?? p.cpu.label]);
  const mods = p.equipment?.modules ?? [];
  mods.forEach((pn, i) => rows.push([`Slot ${i + 1}`, pn, getPart(pn)?.description ?? '']));
  if (!mods.length) rows.push(['Expansion', 'none', 'All I/O on the CPU']);
  const nIn = p.io.filter((x) => x.type === 'input').length, nOut = p.io.filter((x) => x.type === 'output').length;
  rows.push(['I/O used', `${nIn} DI / ${nOut} DO`, `Built-in capacity ${p.cpu.builtInInputs} DI / ${p.cpu.builtInOutputs} DO`]);
  if (p.hmi) rows.push(['HMI link', 'Ethernet', `${p.hmi.hmiPartNumber} to the CPU Ethernet port (${(isCmore(getHmi(p.hmi.hmiPartNumber)) ? 'CLICK Ethernet driver / Modbus TCP' : `the panel maker's ${p.profile.vendor} driver`)}); fixed IP addresses to be assigned on site`]);
  rows.push(['Programming', p.profile.language === 'ladder' ? 'Ladder diagram' : 'Structured Text', p.profile.language === 'ladder' ? `${p.ladder.rungs.length} rungs, ${(p.ladder.blocks ?? []).length} blocks` : '']);
  return makeTable([['Item', 16], ['Value', 34], ['Notes', 60]], rows);
}

/** PLC program checker result. */
export function checkerTable(p: ProjectSnapshot): DocTable {
  const idx = new Map(p.ladder.rungs.map((r, i) => [r.id, i + 1] as const));
  return makeTable([['Rung', 8, 'center'], ['Severity', 12], ['Finding', 100]],
    p.issues.map((i) => [i.rungId ? String(idx.get(i.rungId) ?? '') : '—', i.severity === 'error' ? 'Error' : 'Warning', i.message]));
}
