import type { LadderProgram, Rung } from './ladder';
import type { PlcProfile } from './profile';

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
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const outCoils = new Map<string, number>();

  const check = (rung: Rung, address: string, role: string, opts: { bit?: boolean; write?: boolean; valueOk?: boolean } = {}) => {
    const add = (severity: ValidationIssue['severity'], message: string) =>
      issues.push({ rungId: rung.id, severity, message });
    const a = address.trim();
    if (!a) return add('error', `${role} has no address.`);
    const info = profile.parseAddress(a);
    if (!info) return add('error', `${role} "${a}" is not a valid ${profile.name} address.`);
    if (info.kind === 'constant' && !opts.valueOk) return add('error', `${role} cannot be a constant (${a}).`);
    if (opts.bit && !info.isBit) add('error', `${role} "${a}" is not a bit address.`);
    if (opts.write && (info.kind === 'input' || info.kind === 'system')) add('error', `${role} writes to read-only ${info.kind} "${a}".`);
    if ((info.kind === 'input' || info.kind === 'output') && !ioAddresses.has(a)) {
      add('warning', `${a} is not assigned to any point in the I/O list.`);
    }
  };

  for (const rung of program.rungs) {
    for (const extra of profile.checkRung?.(rung) ?? []) issues.push({ rungId: rung.id, ...extra });
    if (rung.outputs.length === 0) issues.push({ rungId: rung.id, severity: 'error', message: 'Rung has no output instruction.' });

    for (const branch of rung.branches) {
      for (const el of branch) {
        if (el.type === 'CMP') {
          check(rung, el.left, 'Compare left side', { valueOk: true });
          check(rung, el.right, 'Compare right side', { valueOk: true });
        } else {
          check(rung, el.address, 'Contact', { bit: true });
        }
      }
    }

    for (const o of rung.outputs) {
      switch (o.type) {
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

  for (const [address, count] of outCoils) {
    if (count > 1) {
      issues.push({ rungId: null, severity: 'warning', message: `${address} is driven by OUT coils in ${count} rungs; only the last one wins (double coil).` });
    }
  }
  return issues;
}
