/**
 * Texts for the people at the machine in the PLC's own names: the app's operands a text quotes (X001, Y002, C21,
 * DS1003, T4, CT1) become what the PLC software shows — the I/O terminal in the brand's form (%I0.0,
 * Local:1:I.Data.0, _IO_EM_DI_00) and the internal ones by their exported tag name ("Machine_DB".SP_Service_Interval,
 * Cycle_Running). CLICK keeps its own addresses (they are CLICK's).
 */
import type { ProjectSnapshot } from './collect';
import { plcTagNameOf } from './plcTagNames';
import { moduleSlots } from '../plc/core/modules';

const OPERAND = /\b(CTD|TD|CT|DS|DD|DH|DF|SC|C|T|X|Y)(\d+)\b/g;

/** The name the PLC software shows for one app address (the address itself on CLICK or when nothing is known). */
export function plcNameOf(p: ProjectSnapshot): (address: string) => string {
  if (p.profile.id === 'click') return (a) => a;
  const modules = moduleSlots(p.modules);
  const tagOf = plcTagNameOf(p);
  return (a) => {
    const up = a.toUpperCase();
    if (/^[XY]\d+$/.test(up)) return p.profile.ioTag?.(up, modules, p.cpu.id) ?? tagOf(up).io ?? a;
    return tagOf(up).name || a;
  };
}

/** A text with every app operand it quotes in the PLC's own names. */
export function inPlcNames(p: ProjectSnapshot): (text: string) => string {
  if (p.profile.id === 'click') return (t) => t;
  const name = plcNameOf(p);
  return (t) => t.replace(OPERAND, (m) => name(m));
}

/** A text with the brand's address after each I/O terminal it quotes: "Input X005 (%I0.4)". CLICK unchanged. */
export function withNativeIo(p: ProjectSnapshot): (text: string) => string {
  if (p.profile.id === 'click' || !p.profile.ioTag) return (t) => t;
  const name = plcNameOf(p);
  return (t) => t.replace(/\b([XY]\d{3})\b(?!\s*\()/g, (m) => { const n = name(m); return n && n !== m ? `${m} (${n})` : m; });
}
