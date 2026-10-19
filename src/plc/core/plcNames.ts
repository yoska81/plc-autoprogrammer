/**
 * The PLC's own names for the app's operands: what the engineer sees in TIA Portal / Studio 5000 after the
 * export. Siemens: an I/O tag "E_Stop_OK" (at %I0.0) and the program block's members #Safety_OK,
 * #Push_Timeout.Q, #FirstScan; Logix: Start_PB, Push_Timeout.DN, S:FS. Built with the exporters' own naming
 * (tagNames.ts), so the Program page, the Simulator, the printout and the exported files all agree. CLICK and
 * PLCs programmed in their own text get none: their operands are shown as they are.
 */
import type { LadderProgram } from './ladder';
import type { ExportContext, PlcProfile } from './profile';
import { plcTagNames } from './tagNames';

/** The PLC's own name for an app operand (and its I/O address); null = show the operand. */
export type PlcNameOf = (address: string) => { name: string; io?: string } | null;

/** System bits as each PLC writes them (the exporters translate SC1 / SC2 / SC7 the same way). */
const SYSTEM: Record<string, Record<string, string>> = {
  'siemens-s7': { SC1: 'TRUE', SC2: '#FirstScan', SC7: '1 s clock' },
  logix: { SC1: 'always on', SC2: 'S:FS', SC7: '1 s clock' },
};

/** The lookup for a program on a PLC (undefined: show the app's operands — CLICK, or no ladder export). */
export function plcNameLookup(profile: PlcProfile, program: LadderProgram, ctx: ExportContext): PlcNameOf | undefined {
  if (profile.id === 'click' || profile.language !== 'ladder') return undefined;
  let names: ReturnType<typeof plcTagNames>;
  try { names = plcTagNames(profile, program, ctx); } catch { return undefined; }
  const system = SYSTEM[profile.id] ?? {};
  return (address) => {
    const a = address.trim().toUpperCase();
    if (!a) return null;
    if (system[a]) return { name: system[a] };
    const t = names.get(a);
    if (!t?.name) return t?.io ? { name: t.io } : null;
    if (profile.id === 'siemens-s7') {
      // TIA Portal: an I/O point is its PLC tag "Name" at %I / %Q; anything else a member of the program block, #Name.
      const member = t.name.replace(/^"Machine_DB"\./, '');
      return t.io ? { name: `"${member}"`, io: t.io } : { name: `#${member}` };
    }
    return { name: t.name, ...(t.io ? { io: t.io } : {}) };
  };
}

/** A text with operands in it ("Contact NO X001", "DS1001 < 1"): each operand shown by its PLC name (and I/O address). */
export function withPlcNamesAndIo(text: string, of: PlcNameOf | undefined): string {
  if (!of) return text;
  return text.replace(/\b[A-Z]{1,3}\d+(\.\d+)?\b/gi, (a) => { const n = of(a); return n ? `${n.name}${n.io ? ` ${n.io}` : ''}` : a; });
}
