/**
 * End actions of a "why stuck?" finding:
 *   setting → change the value live (Online, C / DS only, with "Allow writes" and a confirmation; logged), or the
 *             CLICK edit steps when it cannot be written from here;
 *   logic   → the exact CLICK Programming Software steps to edit the rung;
 *   wiring  → handed to the wiring-path engine (Debug 4's slice) with the PLC point.
 * The CLICK steps follow the CLICK help: PLC > Connect, PLC > Write Project into PLC (help 090); a program change
 * is written with the PLC in STOP.
 */
import type { Blocker } from './whyStuck';
import { isWritable } from '../online/clickModbus';
import { writePlc } from '../online/useOnline';

export interface SettingChange {
  address: string;
  from: number;
  to: number;
  /** The confirmation the operator answers before the write. */
  question: string;
  /** Written live from Online (C / DS), or only by editing the program (DF, DD, presets in the program). */
  live: boolean;
}

/** The setting change a finding suggests (the default the program loads on the first scan, or the operator's value). */
export function settingChange(b: Blocker, to: number): SettingChange | null {
  if (b.kind !== 'setting') return null;
  const live = isWritable(b.point);
  return {
    address: b.point, from: Number(b.actual), to, live,
    question: `Write ${to} to ${b.point}${b.description ? ` (${b.description})` : ''}? It is ${b.actual} now. The machine uses the new value at once.`,
  };
}

/** Change it on the PLC: asks `confirm` first; the write itself is logged by Online (writes list). */
export async function applySettingChange(c: SettingChange, confirm: (question: string) => boolean | Promise<boolean>, write = writePlc): Promise<'written' | 'cancelled'> {
  if (!c.live) throw new Error(`${c.address} cannot be written from here (only C bits and DS registers): change it in the program (see the edit steps).`);
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
    case 'setting': return { kind: 'setting', text: `${b.point} is a setting: change it${isWritable(b.point) ? ' live from Online (with confirmation)' : ' in the program'}.`, ...(isWritable(b.point) ? {} : { steps: clickEditSteps(b, `Change the value of ${b.point} (or the preset that reads it) to the right value.`) }) };
    case 'logic': return { kind: 'edit', text: b.explain, steps: clickEditSteps(b, /touch-panel command|Nothing in the program switches/.test(b.explain)
      ? `Replace the contact ${b.point} with the input that should start it (e.g. the pushbutton's X address), or add a rung that writes ${b.point}.`
      : `Correct the logic of rung ${b.rungNo} so ${b.point} can change: ${b.explain}`) };
    case 'operator': return { kind: 'operator', text: b.explain };
    default: return { kind: 'wait', text: b.explain };
  }
}
