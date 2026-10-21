/**
 * A made-up Yaskawa MP project the size of a real line (182 drawings, ~3900 rungs, 249 I/O, 8 servo axes, a
 * touch panel), for the AI prompt-size tests. Every name and comment is generated here; nothing comes from a
 * customer's project.
 */
import { EMPTY_SECTIONS, type SpecSections } from '../../../spec/types';
import { describeProgram } from '../../../plc/import/upgrade';
import type { ImportedProgram } from '../../../plc/import/types';
import type { LadderElement, LadderOutput, Rung } from '../../../plc/core/ladder';

const AREAS = ['Infeed', 'Indexer', 'Filler', 'Capper', 'Labeler', 'Reject', 'Outfeed', 'Palletizer', 'Wrapper'];
const DEVICES = ['photo-eye', 'prox sensor', 'cylinder extended', 'cylinder retracted', 'vacuum ok', 'gripper closed', 'motor running', 'jam sensor', 'door closed', 'level high', 'pressure ok', 'start pushbutton'];
const OUTS = ['solenoid valve', 'motor contactor', 'gripper close', 'vacuum on', 'stack light', 'horn', 'brake release', 'diverter', 'clamp', 'lamp'];

const hex = (n: number, w: number) => n.toString(16).toUpperCase().padStart(w, '0');

export function bigYaskawaImport(): ImportedProgram {
  const io: ImportedProgram['io'] = [];
  for (let i = 0; i < 249; i++) {
    const input = i < 150;
    const area = AREAS[i % AREAS.length];
    const what = input ? DEVICES[i % DEVICES.length] : OUTS[i % OUTS.length];
    const n = input ? i : i - 150;
    io.push({ name: `${area}_${what.replace(/\W+/g, '_')}_${i}`, description: `${area} ${what} ${Math.floor(i / 9) + 1}`, type: input ? 'input' : 'output', original: `${input ? 'IB' : 'OB'}${hex(Math.floor(n / 16), 4)}${hex(n % 16, 1)}`, analog: false, confidence: 'high' });
  }
  const blocks = Array.from({ length: 182 }, (_, b) => ({ id: `H${hex(b + 1, 2)}`, name: `H${hex(b + 1, 2)} ${AREAS[b % AREAS.length]} ${['sequence', 'manual', 'alarms', 'motion', 'interlocks', 'counters'][b % 6]} ${Math.floor(b / 6) + 1}` }));
  const rungs: Rung[] = [];
  const tags: ImportedProgram['program']['tags'] = [];
  for (let r = 0; r < 3938; r++) {
    const b = blocks[r % blocks.length];
    const contact = (k: number): LadderElement => ({ type: k % 3 ? 'NO' : 'NC', address: `MB${String(1000 + ((r + k) % 4000)).padStart(5, '0')}${hex(k % 16, 1)}` });
    const timer = r % 6 === 0;
    const out: LadderOutput = timer
      ? { type: 'TMR', address: `T${r}`, preset: String(50 + (r % 40) * 10), unit: 'ms', mode: r % 12 === 0 ? 'OFF_DELAY' : 'ON_DELAY', accumulate: false, resetAddress: null }
      : { type: 'OUT', address: `MB${String(5000 + r).padStart(5, '0')}0` };
    if (timer) tags.push({ address: `T${r}`, nickname: `${b.name.split(' ')[1]}_step_timeout_${r}` } as ImportedProgram['program']['tags'][number]);
    rungs.push({ id: `r${r}`, block: b.id, comment: r % 2 ? `${b.name.split(' ')[1]}: wait for ${DEVICES[r % DEVICES.length]} then step ${r % 20}` : '', branches: [[contact(1), contact(2), contact(3)], [contact(4)]], outputs: [out] });
  }
  return {
    source: {
      format: 'yaskawa-mpe720', vendor: 'Yaskawa', controller: 'CPU-301(16axes)', projectName: 'Demo bottling line', fileName: 'demo_line.YMW7',
      modules: [{ slot: 0, catalog: 'CPU-301' }, { slot: 1, catalog: 'LIO-01' }, { slot: 2, catalog: 'LIO-02' }, { slot: 3, catalog: '218IFD' }],
      axes: Array.from({ length: 8 }, (_, a) => ({ line: 1, axis: a + 1, drive: 'SGD7S-2R8A20A', motor: 'SGM7J-04AFC6S', kind: a < 7 ? 'servo' : 'virtual' })),
      panel: { vendor: 'weintek', software: 'EasyBuilder Pro', screens: Array.from({ length: 40 }, (_, s) => `${s + 1} ${AREAS[s % AREAS.length]} screen`) },
    },
    program: { rungs, tags, blocks } as ImportedProgram['program'],
    io,
    names: {},
    report: { rungs: rungs.length, converted: rungs.length, notConverted: Array.from({ length: 12 }, (_, k) => ({ where: `H${hex(k + 1, 2)} motion program`, text: `MOVJ [A1]${k * 100} [A2]${k * 50};\nMVS [A1]0;\nEND;` })), notes: [], outside: [] },
    blockOrigin: {},
    rungOrigin: {},
  };
}

/** The machine description the upgrade writes for that project, with a page of the user's own text and answers. */
export function bigYaskawaSpec(): SpecSections {
  const d = describeProgram(bigYaskawaImport());
  const spec: SpecSections = { ...EMPTY_SECTIONS };
  for (const [k, v] of Object.entries(d)) spec[k as keyof typeof d] = v ?? '';
  spec.overview = `Bottling line: bottles are filled, capped, labelled and palletized, 120 bottles a minute.\n${spec.overview}`;
  spec.safety = `Two E-stops per area on a safety relay; guard doors on the filler and the palletizer.\n${spec.safety}`;
  spec.qa = Array.from({ length: 25 }, (_, i) => `Q: Question ${i + 1} about the ${AREAS[i % AREAS.length]}?\nA: The ${AREAS[i % AREAS.length]} runs in auto after homing; a jam stops it and the operator clears it and presses reset.`).join('\n');
  return spec;
}
