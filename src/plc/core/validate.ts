import { elementAddresses, motionWrites, rungAddresses, rungWrites, type LadderProgram, type RawInstruction, type Rung } from './ladder';
import type { PlcProfile } from './profile';
import { deletedAddress, isDeletedOperand } from './remapProgram';

export interface ValidationIssue {
  rungId: string | null;
  severity: 'error' | 'warning';
  message: string;
}

/**
 * Check a ladder program against the PLC's address rules and the project's
 * I/O map. Run on every AI result and every manual edit, and the issues are
 * fed back to the AI when asked to fix them.
 */
export function validateProgram(
  program: LadderProgram,
  profile: PlcProfile,
  ioAddresses: Set<string>,
  /** The project's HMI: a tag the HMI shows that no rung writes, or a command no rung reads, is an error. */
  hmi?: { tags: { address: string; name: string; access: string }[] },
  /** noPanel: the machine has no touch panel, so nothing writes the panel ranges C1001–C1300 / DS1001–DS1200 / DF101–DF200. */
  opts: { noPanel?: boolean } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const outCoils = new Map<string, number>();

  const check = (rung: Rung, address: string, role: string, opts: { bit?: boolean; write?: boolean; valueOk?: boolean } = {}) => {
    const add = (severity: ValidationIssue['severity'], message: string) =>
      issues.push({ rungId: rung.id, severity, message });
    const a = address.trim();
    if (!a) return add('error', `${role} has no address.`);
    if (isDeletedOperand(a)) return add('error', `${role} used ${deletedAddress(a)}, whose I/O point was deleted — pick its new input / output (or delete the rung).`);
    const info = profile.parseAddress(a);
    if (!info) return add('error', `${role} "${a}" is not a valid ${profile.name} address.`);
    if (info.kind === 'constant' && !opts.valueOk) return add('error', `${role} cannot be a constant (${a}).`);
    if (opts.bit && !info.isBit) add('error', `${role} "${a}" is not a bit address.`);
    if (opts.write && (info.kind === 'input' || info.kind === 'system')) add('error', `${role} writes to read-only ${info.kind} "${a}".`);
    if ((info.kind === 'input' || info.kind === 'output') && !ioAddresses.has(a)) {
      // An error: an I/O address with no point behind it reads / drives whatever gets that address next.
      add('error', `${a} is not assigned to any point in the I/O list.`);
    }
  };

  for (const rung of program.rungs) {
    for (const extra of profile.checkRung?.(rung, { ioAddresses }) ?? []) issues.push({ rungId: rung.id, ...extra });
    if (rung.outputs.length === 0) issues.push({ rungId: rung.id, severity: 'error', message: 'Rung has no output instruction.' });

    for (const branch of rung.branches) {
      for (const el of branch) {
        if (el.type === 'CMP') {
          check(rung, el.left, 'Compare left side', { valueOk: true });
          check(rung, el.right, 'Compare right side', { valueOk: true });
        } else if (el.type === 'RAW') {
          issues.push(...rawIssues(rung.id, el, profile));
        } else {
          check(rung, el.address, 'Contact', { bit: true });
        }
      }
    }

    for (const o of rung.outputs) {
      switch (o.type) {
        case 'RAW':
          issues.push(...rawIssues(rung.id, o, profile));
          break;
        case 'OUT':
          check(rung, o.address, 'Coil', { bit: true, write: true });
          outCoils.set(o.address, (outCoils.get(o.address) ?? 0) + 1);
          break;
        case 'SET': case 'RST':
          check(rung, o.address, `${o.type} coil`, { bit: true, write: true });
          break;
        case 'TMR': {
          check(rung, o.address, 'Timer', { write: true });
          if (profile.parseAddress(o.address)?.kind !== 'timer') issues.push({ rungId: rung.id, severity: 'error', message: `Timer must use a timer address, not "${o.address}".` });
          check(rung, o.preset, 'Timer setpoint', { valueOk: true });
          if (o.accumulate && !o.resetAddress) issues.push({ rungId: rung.id, severity: 'warning', message: `Accumulating timer ${o.address} has no reset.` });
          if (o.resetAddress) check(rung, o.resetAddress, 'Timer reset', { bit: true });
          break;
        }
        case 'CNT':
          check(rung, o.address, 'Counter', { write: true });
          if (profile.parseAddress(o.address)?.kind !== 'counter') issues.push({ rungId: rung.id, severity: 'error', message: `Counter must use a counter address, not "${o.address}".` });
          check(rung, o.preset, 'Counter setpoint', { valueOk: true });
          if (!o.resetAddress) issues.push({ rungId: rung.id, severity: 'warning', message: `Counter ${o.address} has no reset.` });
          else check(rung, o.resetAddress, 'Counter reset', { bit: true });
          break;
        case 'COPY':
          check(rung, o.source, 'Copy source', { valueOk: true });
          check(rung, o.dest, 'Copy destination', { write: true });
          break;
        case 'MATH':
          check(rung, o.dest, 'Math result', { write: true });
          break;
      }
    }
  }

  if (hmi && program.rungs.length) {
    const writes = new Set<string>(), reads = new Set<string>();
    for (const r of program.rungs) {
      for (const w of rungWrites(r)) writes.add(w.trim().toUpperCase());
      for (const o of r.outputs) {
        if (o.type === 'TMR') writes.add(`TD${o.address.trim().toUpperCase().slice(1)}`);
        if (o.type === 'CNT') writes.add(`CTD${o.address.trim().toUpperCase().slice(2)}`);
      }
      for (const a of rungAddresses(r)) reads.add(a.trim().toUpperCase());
      for (const o of r.outputs) if (o.type === 'MATH') for (const m of o.expression.toUpperCase().match(/[A-Z]+\d+/g) ?? []) reads.add(m);
    }
    for (const t of hmi.tags) {
      const a = t.address.trim().toUpperCase();
      if (/^[XY]\d/.test(a) || /^DF\d+$/.test(a) && t.access === 'read') continue;
      if (t.access === 'read' && !writes.has(a)) issues.push({ rungId: null, severity: 'error', message: `HMI tag ${a} ${t.name} is shown on the HMI but no rung writes it.` });
      else if (t.access !== 'read' && !reads.has(a)) issues.push({ rungId: null, severity: 'error', message: `HMI command / setpoint ${a} ${t.name} is never read by the program, so it does nothing.` });
    }
  }

  // Dead logic in internal memory: bits / registers read but never written (always 0 / OFF), or written but never
  // read (logic that does nothing). Physical I/O, system bits, HMI tags, timer / counter values and constants are
  // left out; so are the standard HMI ranges C1001–C1300 / DS1001–DS1200 / DF101–DF200 (a panel, SCADA or a later
  // HMI reads and writes them; the HMI check above covers the project's own HMI) and counters (their count is shown online).
  if (program.rungs.length) {
    const reads = new Map<string, string>(), writes = new Map<string, string>();
    const note = (m: Map<string, string>, a: string, rung: string) => { const k = a.trim().toUpperCase(); if (k && !m.has(k)) m.set(k, rung); };
    for (const r of program.rungs) {
      for (const b of r.branches) for (const e of b) for (const a of elementAddresses(e)) note(reads, a, r.id);
      for (const o of r.outputs) {
        if (o.type === 'COPY') note(reads, o.source, r.id);
        if (o.type === 'MATH') for (const a of o.expression.toUpperCase().match(/[A-Z]+\d+/g) ?? []) note(reads, a, r.id);
        if (o.type === 'TMR' || o.type === 'CNT') { note(reads, o.preset, r.id); if (o.resetAddress) note(reads, o.resetAddress, r.id); }
      }
      for (const w of rungWrites(r)) note(writes, w, r.id);
    }
    // The PLC's motion (instructions, axes, counters) writes its status bits and registers and reads its request
    // bits and targets: set up in the PLC software, not in the rungs.
    for (const w of motionWrites(program.motion)) note(writes, w, 'motion');
    for (const i of program.motion?.instructions ?? []) for (const a of [i.enable, i.target, i.velocity].filter((x): x is string => !!x)) note(reads, a, 'motion');
    const hmiAddr = new Set((hmi?.tags ?? []).map((t) => t.address.trim().toUpperCase()));
    const hmiRange = (a: string) => /^(C1(0\d\d|1\d\d|2\d\d|300)|DS1(0\d\d|1\d\d|200)|DF(1\d\d|200))$/.test(a);
    const skip = (a: string) => {
      const info = profile.parseAddress(a);
      if (!info || info.kind === 'constant' || info.kind === 'input' || info.kind === 'output' || info.kind === 'system') return true;
      if (/^(TD|CTD)\d+$/.test(a) || hmiAddr.has(a) || ioAddresses.has(a)) return true;
      return hmiRange(a);
    };
    const timerRead = (a: string) => /^CT\d+$/.test(a) || reads.has(a) || hmiAddr.has(a.replace(/^T(\d+)$/, 'TD$1')) || reads.has(a.replace(/^T(\d+)$/, 'TD$1'));
    for (const [a, rung] of reads) if (!writes.has(a) && !skip(a) && !/^(T|CT)\d+$/.test(a)) issues.push({ rungId: rung, severity: 'warning', message: `${a} is read but never written: it is always 0 / OFF.` });
    for (const [a, rung] of writes) if (!timerRead(a) && !skip(a)) issues.push({ rungId: rung, severity: 'warning', message: `${a} is written but never read: this logic does nothing.` });
  }

  // A coil that can never turn on: every branch that could switch it on (its own seal-in aside) needs a contact on a
  // bit nothing writes — e.g. Cycle running started only from a panel Start bit on a machine with no touch panel.
  if (program.rungs.length) {
    const written = new Set([...program.rungs.flatMap((r) => rungWrites(r)), ...motionWrites(program.motion)].map((a) => a.trim().toUpperCase()));
    for (const t of hmi?.tags ?? []) if (t.access !== 'read') written.add(t.address.trim().toUpperCase());
    const panelRange = (a: string) => /^(C1(0\d\d|1\d\d|2\d\d|300)|DS1(0\d\d|1\d\d|200)|DF(1\d\d|200))$/.test(a);
    const dead = (a: string) => {
      const info = profile.parseAddress(a);
      if (!info || info.kind === 'constant' || info.kind === 'input' || info.kind === 'output' || info.kind === 'system' || ioAddresses.has(a) || written.has(a)) return false;
      if (/^(T|TD|CT|CTD)\d+$/.test(a)) return false;
      return !panelRange(a) || Boolean(opts.noPanel);
    };
    const coils = new Map<string, Rung[]>();
    for (const r of program.rungs) for (const o of r.outputs) if (o.type === 'OUT' || o.type === 'SET') { const k = o.address.trim().toUpperCase(); coils.set(k, [...(coils.get(k) ?? []), r]); }
    for (const [a, rs] of coils) {
      const blockers = new Set<string>();
      const live = rs.some((r) => r.branches.some((b) => {
        const contacts = b.filter((e): e is Extract<typeof e, { address: string }> => (e.type === 'NO' || e.type === 'RISE') && 'address' in e).map((e) => e.address.trim().toUpperCase());
        if (contacts.includes(a)) return false; // its own seal-in
        const d = contacts.filter(dead);
        d.forEach((x) => blockers.add(x));
        return !d.length;
      }) || !r.branches.length);
      if (live || !blockers.size) continue;
      const panelOnly = [...blockers].some(panelRange);
      issues.push({ rungId: rs[0].id, severity: panelOnly && opts.noPanel ? 'error' : 'warning',
        message: `${a} can never turn on: every way to switch it on needs ${[...blockers].join(' / ')}, which nothing writes${panelOnly && opts.noPanel ? ' (a touch-panel command, and this machine has no touch panel — use a pushbutton input)' : ''}.` });
    }
  }

  for (const [address, count] of outCoils) {
    if (count > 1) {
      issues.push({ rungId: null, severity: 'warning', message: `${address} is driven by OUT coils in ${count} rungs; only the last one wins (double coil).` });
    }
  }
  return issues;
}

/** PLC families imported instructions come from (profile ids, plus brands the app reads but has no profile for). */
const VENDOR_NAME: Record<string, string> = {
  logix: 'Logix', click: 'CLICK', micro800: 'Micro800', 'siemens-s7': 'Siemens S7', 'unitronics-unistream': 'UniStream', 'unitronics-vision': 'Vision',
  'mitsubishi-fx': 'Mitsubishi', codesys: 'CODESYS', 'siemens-stl': 'Siemens STL', 'siemens-lad': 'a TIA Portal LAD network', delta: 'Delta', inovance: 'Inovance', xinje: 'Xinje',
};

/**
 * An imported instruction kept as written: on its own PLC a warning (it is not checked or simulated);
 * on another PLC an error, because the rung cannot work there.
 */
function rawIssues(rungId: string, r: RawInstruction, profile: PlcProfile): ValidationIssue[] {
  const short = r.text.length > 80 ? `${r.text.slice(0, 77).replace(/\s+/g, ' ')}…` : r.text;
  if (r.vendor !== profile.id) {
    const what = /^\s*(?:FUNCTION_BLOCK|FUNCTION)\s+"?(\w+)/i.exec(r.text)?.[1] ?? /^(\w+)\(/.exec(r.text)?.[1] ?? short;
    return [{ rungId, severity: 'error', message: `${what} from ${VENDOR_NAME[r.vendor] ?? r.vendor} cannot run on ${profile.name}: this rung will not work (${short}).` }];
  }
  return [{ rungId, severity: 'warning', message: `Not understood: check by hand (${short}).` }, ...rawRules(rungId, r)];
}

/** Known mistakes found in instructions kept as written. */
function rawRules(rungId: string, r: RawInstruction): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (r.vendor === 'siemens-s7') {
    // S7-1200 / 1500 current and voltage inputs: nominal range 0..27648 (not 32767).
    for (const m of r.text.matchAll(/NORM_X\s*\(([^;]*?)\bMAX\s*:=\s*(\d+)/gi)) {
      if (m[2] !== '27648' && /\b(INT|WORD)\b|Raw|IW\d/i.test(`${m[1]} ${r.text}`)) {
        const pct = ((1 - 27648 / Number(m[2])) * 100).toFixed(1);
        out.push({ rungId, severity: 'error', message: `NORM_X MAX := ${m[2]} on a raw analog word: S7-1200 / 1500 current and voltage inputs read 0..27648, so every scaled value is ${pct} % low (20 mA shows ${(27648 / Number(m[2]) * 100).toFixed(1)} %). Use MAX := 27648.` });
      }
    }
  }
  return out;
}
