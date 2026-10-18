/**
 * End actions of a "why stuck?" finding:
 *   setting → change the value live (Online, C / DS only, with "Allow writes" and a confirmation; logged), or the
 *             CLICK edit steps when it cannot be written from here;
 *   logic   → the exact CLICK Programming Software steps to edit the rung;
 *   wiring  → handed to the wiring-path engine (Debug 4's slice) with the PLC point.
 * The CLICK steps follow the CLICK help: PLC > Connect, PLC > Write Project into PLC (help 090); a program change
 * is written with the PLC in STOP.
 */
import { declaredLimits, type Blocker } from './whyStuck';
import type { LadderProgram } from '../plc/core/ladder';
import { isWritable } from '../online/clickModbus';
import { writePlc } from '../online/useOnline';

export interface SettingChange {
  address: string;
  from: number;
  to: number;
  /** The range the program declares for the register: values outside it are refused. */
  min: number;
  max: number;
  /** The confirmation the operator answers before the write. */
  question: string;
  /** Written live from Online (DS registers), or only by editing the program (DF). */
  live: boolean;
}

/** Changes made by settingChange (from the program's declared range): the only ones applySettingChange writes. */
const ISSUED = new WeakSet<SettingChange>();

/** Only setpoint registers: DS (16-bit integer) and DF (float). Never bits (C, T, CT, X, Y, SC) or other words. */
const SETPOINT = /^(DS|DF)\d+$/;

/**
 * The setting change a finding suggests: only for a DS / DF setpoint that `program` itself declares a range for
 * (its first-scan "outside min–max → default" rung; the finding's own `limits` are not trusted); `to` defaults to
 * that rung's default. Null otherwise.
 */
export function settingChange(b: Blocker, program: LadderProgram, to?: number): SettingChange | null {
  if (b.kind !== 'setting' || !SETPOINT.test(b.point.toUpperCase())) return null;
  const limits = declaredLimits(program, b.point);
  if (!limits) return null;
  const value = to ?? limits.default;
  if (value === undefined || !valueOk(b.point, value, limits.min, limits.max)) return null;
  const live = /^DS/i.test(b.point) && isWritable(b.point);
  const c: SettingChange = Object.freeze({
    address: b.point.toUpperCase(), from: Number(b.actual), to: value, min: limits.min, max: limits.max, live,
    question: `Write ${value} to ${b.point.toUpperCase()}${b.description ? ` (${b.description})` : ''}? It is ${b.actual} now; the program allows ${limits.min}–${limits.max}. The machine uses the new value at once.`,
  });
  ISSUED.add(c);
  return c;
}

function valueOk(address: string, v: number, min: number, max: number): boolean {
  if (!Number.isFinite(v) || v < min || v > max) return false;
  if (/^DS/i.test(address)) return Number.isInteger(v) && v >= -32768 && v <= 32767;
  return true;
}

/** Change it on the PLC: checks the register and the range again, asks `confirm`, then writes (Online logs the write). */
export async function applySettingChange(c: SettingChange, confirm: (question: string) => boolean | Promise<boolean>, write = writePlc): Promise<'written' | 'cancelled'> {
  // Only a change settingChange made from the program's declared range (frozen): a hand-built or copied object is refused.
  if (!ISSUED.has(c)) throw new Error('This setting change was not made from the program\'s declared range: ask for it again from the finding.');
  if (!SETPOINT.test(c.address.toUpperCase())) throw new Error(`${c.address} is not a setpoint register: only DS / DF settings are changed here.`);
  if (!valueOk(c.address, c.to, c.min, c.max)) throw new Error(`${c.to} is outside the range the program allows for ${c.address} (${c.min}–${c.max}${/^DS/i.test(c.address) ? ', whole numbers' : ''}).`);
  if (!c.live) throw new Error(`${c.address} cannot be written from here (Online writes DS registers only): change it in the program (see the edit steps).`);
  if (!(await confirm(c.question))) return 'cancelled';
  await write(c.address, c.to);
  return 'written';
}

/** The CLICK Programming Software steps for a program change at the blocking rung. */
export function clickEditSteps(b: Blocker, change: string): string[] {
  return [
    'Make the machine safe: the PLC goes to STOP while the project is written (outputs switch off).',
    'CLICK Programming Software: PLC > Connect, then open the project that is in the PLC (or read it from the PLC).',
    `Go to rung ${b.rungNo}${b.point && b.point !== '?' ? ` (search for ${b.point})` : ''}.`,
    change,
    'Check the program (the software flags errors), then PLC > Write Project into PLC.',
    'Put the PLC back in RUN and test the step again; save the project and update the project file in this app.',
  ];
}

/** What to do about a finding, in words, with the action's kind. */
export function nextAction(b: Blocker): { kind: 'wiring' | 'setting' | 'edit' | 'operator' | 'wait'; text: string; steps?: string[] } {
  switch (b.next) {
    case 'wiring': return { kind: 'wiring', text: `Check the field wiring of ${b.point}${b.description ? ` (${b.description})` : ''}: follow it from the PLC terminal to the device.` };
    case 'setting': { const live = Boolean(b.limits) && /^DS\d+$/i.test(b.point) && isWritable(b.point); return { kind: 'setting', text: `${b.point} is a setting: change it${live ? ' live from Online (with confirmation)' : ' in the program'}${b.limits ? ` (allowed ${b.limits.min}–${b.limits.max})` : ''}.`, ...(live ? {} : { steps: clickEditSteps(b, `Change the value of ${b.point} (or the preset that reads it) to the right value.`) }) }; }
    case 'logic': return { kind: 'edit', text: b.explain, steps: clickEditSteps(b, /touch-panel command|Nothing in the program switches/.test(b.explain)
      ? `Replace the contact ${b.point} with the input that should start it (e.g. the pushbutton's X address), or add a rung that writes ${b.point}.`
      : `Correct the logic of rung ${b.rungNo} so ${b.point} can change: ${b.explain}`) };
    case 'operator': return { kind: 'operator', text: b.explain };
    default: return { kind: 'wait', text: b.explain };
  }
}
