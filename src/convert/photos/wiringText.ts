import type { ExistingMachine } from '../types';

/**
 * The terminal strips and traced wires of a machine read from cabinet photos, as text for the
 * machine description ("Power and utilities"), so they show where the description is read. '' when
 * the reading has none (drawings and programs carry their wiring elsewhere).
 */
export function wiringText(m: Pick<ExistingMachine, 'terminals' | 'wiring'>): string {
  const strips = new Map<string, string[]>();
  for (const t of m.terminals ?? []) strips.set(t.strip, [...(strips.get(t.strip) ?? []), `${t.terminal} = wire ${t.wire}`]);
  return [
    strips.size ? `Terminal strips as photographed:\n${[...strips].map(([s, ts]) => `${s}: ${ts.join(', ')}`).join('\n')}` : '',
    m.wiring?.length ? `Wires traced by their numbers:\n${m.wiring.map((w) => `${w.wire}: ${w.ends.join(' – ')}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');
}
