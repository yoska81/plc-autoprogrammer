/**
 * "Upgrade existing program": an imported program becomes the open project. Picks the PLC (the
 * same family as the original when the app supports it), the CPU and modules that hold its I/O,
 * places the I/O, keeps the original names as tag nicknames (so the exported files and the editor
 * use them), writes a first machine description from the program and lists what to ask the user.
 * Pure: the page (ui/ProgramImport.tsx) writes the result into the stores.
 */
import type { LadderProgram, TagDefinition } from '../core/ladder';
import type { PlcProfile } from '../core/profile';
import type { IOPoint } from '../../types/io';
import type { SpecSectionId } from '../../spec/types';
import { PLC_PROFILES, getProfile } from '../core/profiles';
import { moduleSlots } from '../core/modules';
import { modulesToFit, type Need } from '../core/fit';
import { materialize, nickOf, pretty } from './convert';
import type { ImportedProgram, SourceFormat } from './types';

/** Draft key (stored with the project) of the original program. */
export const UPGRADE_KEY = 'upgrade.original';

/** The original program as it was imported, kept with the project for "Original vs now". */
export interface UpgradeOriginal {
  importedAt: string;
  source: ImportedProgram['source'];
  report: ImportedProgram['report'];
  io: ImportedProgram['io'];
  plcId: string;
  cpuId: string;
  /** Original program on the chosen PLC's addresses: the base of the diff. */
  program: LadderProgram;
  summary: string;
  /** The I/O list as imported (descriptions, in order) for "Original vs now". */
  ioList: { description: string; type: 'input' | 'output' }[];
  /** App address → original tag name; block id → its routine in the original file. */
  names: Record<string, string>;
  blockOrigin: ImportedProgram['blockOrigin'];
  /** The original file, gzip + base64 (src/plc/import/gz.ts): changes are written back into it. */
  fileGz?: string;
}

export interface UpgradePlan {
  plcId: string;
  cpuId: string;
  modules: string[];
  program: LadderProgram;
  io: Omit<IOPoint, 'id'>[];
  /** Machine description written from the program (only sections it says something about). */
  spec: Partial<Record<SpecSectionId, string>>;
  questions: string[];
  original: UpgradeOriginal;
}

/** PLC of the app that a source format comes from. */
const SAME_FAMILY: Partial<Record<SourceFormat, string>> = { l5x: 'logix', l5k: 'logix', 'click-csv': 'click', 'siemens-scl': 'siemens-s7', 'siemens-stl': 'siemens-s7', 'siemens-xml': 'siemens-s7', 'siemens-tags': 'siemens-s7' };

/** PLC the program goes on: the original's family, else the current PLC when it draws ladder, else CLICK. */
export function targetPlc(format: SourceFormat, currentPlcId: string): PlcProfile {
  const same = SAME_FAMILY[format];
  const p = same ? PLC_PROFILES.find((x) => x.id === same && x.available) : undefined;
  if (p) return p;
  const cur = getProfile(currentPlcId);
  return cur.available && cur.language === 'ladder' ? cur : getProfile('click');
}

export function needOf(imp: ImportedProgram): Need {
  const n = (type: 'input' | 'output', analog: boolean) => imp.io.filter((p) => p.type === type && p.analog === analog).length;
  return { digitalInputs: n('input', false), digitalOutputs: n('output', false), analogInputs: n('input', true), analogOutputs: n('output', true), ethernetHmi: false, minHmiSizeIn: null };
}

/** First CPU of the profile (smallest first) that holds the I/O, with the modules it needs. */
export function chooseCpu(profile: PlcProfile, need: Need): { cpuId: string; modules: string[] } {
  for (const cpu of profile.cpuModels) {
    const mods = modulesToFit(cpu.id, [], need);
    if (mods) return { cpuId: cpu.id, modules: mods };
  }
  return { cpuId: profile.defaultCpuId, modules: [] };
}

export function planUpgrade(imp: ImportedProgram, currentPlcId: string, now = new Date()): UpgradePlan {
  const profile = targetPlc(imp.source.format, currentPlcId);
  const { cpuId, modules } = chooseCpu(profile, needOf(imp));
  const cpu = profile.cpuModels.find((c) => c.id === cpuId) ?? profile.cpuModels[0];
  const m = materialize(imp, profile, cpu, moduleSlots(modules));
  // I/O keeps its name from the original program (Start_PB, not the description).
  const have = new Set(m.program.tags.map((t) => t.address.toUpperCase()));
  const ioTags: TagDefinition[] = [];
  m.io.forEach((p, k) => {
    const address = materializedAddress(m.names, imp.io[k].name);
    if (address && !have.has(address.toUpperCase())) ioTags.push({ address, nickname: nickOf(imp.io[k].name), comment: p.description });
  });
  const program: LadderProgram = { ...m.program, tags: [...ioTags, ...m.program.tags] };
  const summary = programSummary(imp);
  return {
    plcId: profile.id, cpuId: cpu.id, modules,
    program,
    io: m.io.map((p, k) => ({ description: p.description || pretty(imp.io[k].name), type: p.type, category: p.category, ...(p.signal ? { signal: p.signal, analog: p.analog } : {}) })),
    spec: describeProgram(imp),
    questions: questionsFor(imp),
    original: {
      importedAt: now.toISOString(), source: imp.source, report: imp.report, io: imp.io, plcId: profile.id, cpuId: cpu.id, program, summary,
      ioList: m.io.map((p, k) => ({ description: p.description || pretty(imp.io[k].name), type: p.type })),
      names: m.names, blockOrigin: imp.blockOrigin,
    },
  };
}

const materializedAddress = (names: Record<string, string>, name: string) => Object.entries(names).find(([a, n]) => n === name && !a.startsWith('@'))?.[0];

// ── Description written from the program ──

const KIND: { section: SpecSectionId; re: RegExp }[] = [
  { section: 'safety', re: /e-?stop|emergency|safety|light curtain|guard|interlock/i },
  { section: 'operator', re: /push ?button|\bpb\b|selector|switch.*(auto|manual)|\bhmi\b|lamp|light|beacon|horn|buzzer|reset/i },
  { section: 'motion', re: /motor|conveyor|vfd|drive|pump|fan|agitator|spindle|contactor/i },
  { section: 'pneumatics', re: /valve|solenoid|cylinder|gripper|vacuum|air/i },
  { section: 'sensing', re: /sensor|photo|\bpe\b|prox|reed|limit|level|pressure|temperature|flow|present|detect|encoder/i },
];

const ioLine = (p: ImportedProgram['io'][number]) => `- ${p.name}${p.description ? `: ${p.description}` : ''} (${p.type}${p.analog ? ', analog' : ''}, ${p.original || 'no address'})`;

/** A first machine description, in plain words, from what the program shows. */
export function describeProgram(imp: ImportedProgram): Partial<Record<SpecSectionId, string>> {
  const out: Partial<Record<SpecSectionId, string>> = {};
  const s = imp.source;
  const blocks = imp.program.blocks ?? [];
  const where = [s.vendor, s.controller].filter(Boolean).join(' ');
  out.overview = [
    `Existing machine program "${s.projectName}" read from ${s.fileName}${where ? ` (${where})` : ''}.`,
    `It has ${imp.program.rungs.length} rungs in ${blocks.length} part${blocks.length === 1 ? '' : 's'}: ${blocks.map((b) => b.name).join(', ')}.`,
    `${imp.io.filter((p) => p.type === 'input').length} inputs and ${imp.io.filter((p) => p.type === 'output').length} outputs are wired to the PLC.`,
    'Written from the program: check it and add what the program cannot show (the product, the speed, the line).',
  ].join('\n');

  // Rung comments, part by part, are the sequence the original programmer described.
  const seq: string[] = [];
  for (const b of blocks) {
    const comments = imp.program.rungs.filter((r) => r.block === b.id && r.comment.trim()).map((r) => `  - ${r.comment.trim()}`);
    if (comments.length) seq.push(`${b.name}:`, ...comments);
  }
  const timers = imp.program.rungs.flatMap((r) => r.outputs).flatMap((o) => (o.type === 'TMR' ? [o] : []));
  const nick = new Map(imp.program.tags.map((t) => [t.address, t.nickname]));
  if (timers.length) seq.push('Timers:', ...timers.map((t) => `  - ${nick.get(t.address) ?? t.address}: ${t.preset} ${t.unit}${t.mode === 'OFF_DELAY' ? ' off-delay' : ''}${t.accumulate ? ' (retentive)' : ''}`));
  const counters = imp.program.rungs.flatMap((r) => r.outputs).flatMap((o) => (o.type === 'CNT' ? [o] : []));
  if (counters.length) seq.push('Counters:', ...counters.map((c) => `  - ${nick.get(c.address) ?? c.address}: counts to ${c.preset}`));
  if (seq.length) out.sequence = seq.join('\n');

  for (const k of KIND) {
    const pts = imp.io.filter((p) => k.re.test(`${p.name} ${p.description}`) && KIND.find((x) => x.re.test(`${p.name} ${p.description}`)) === k);
    if (pts.length) out[k.section] = pts.map(ioLine).join('\n');
  }
  const rest = imp.io.filter((p) => !KIND.some((k) => k.re.test(`${p.name} ${p.description}`)));
  if (rest.length) out.other = `Other I/O:\n${rest.map(ioLine).join('\n')}`;

  const alarms = imp.program.rungs.filter((r) => /alarm|fault|jam|timeout|overload/i.test(`${r.comment} ${(imp.program.blocks ?? []).find((b) => b.id === r.block)?.name ?? ''}`));
  if (alarms.length) out.alarms = alarms.map((r) => `- ${r.comment.trim() || 'Alarm rung'}`).filter((l, i, a) => a.indexOf(l) === i).join('\n');
  return out;
}

/** What the program cannot tell: asked on the Machine description page. */
export function questionsFor(imp: ImportedProgram): string[] {
  const q: string[] = [];
  const unsure = imp.io.filter((p) => p.confidence !== 'high');
  if (unsure.length) q.push(`Are these wired to the PLC's terminals? ${unsure.map((p) => p.name).join(', ')} (the program does not say).`);
  const noText = imp.io.filter((p) => !p.description);
  if (noText.length) q.push(`What are these I/O points connected to? ${noText.map((p) => p.name).join(', ')}`);
  for (const n of imp.report.notConverted.slice(0, 8)) {
    q.push(n.kept
      ? `The original program has "${n.text}" (${n.where}). It is kept as it was and goes back into the PLC, but the simulator can't run it. What does it do on the machine?`
      : `The original program has "${n.text}" (${n.where}) that could not be brought in. What does it do on the machine?`);
  }
  q.push('What problems does the machine have today, and what should the upgrade fix?');
  return q;
}

/** Short plain-text summary of the import (shown on the page and given to the AI that writes the description). */
export function programSummary(imp: ImportedProgram): string {
  const s = imp.source;
  const r = imp.report;
  const lines = [
    `Program: ${s.projectName} (${s.fileName}; ${[s.vendor, s.controller].filter(Boolean).join(' ')})`,
    `Rungs: ${r.converted} of ${r.rungs} converted${r.notConverted.length ? `; not converted: ${r.notConverted.map((n) => `${n.text} (${n.where})`).join('; ')}` : ''}`,
    `Parts: ${(imp.program.blocks ?? []).map((b) => `${b.name} (${imp.program.rungs.filter((x) => x.block === b.id).length} rungs)`).join(', ')}`,
    'I/O:',
    ...imp.io.map(ioLine),
    ...(r.notes.length ? ['Notes:', ...r.notes.map((n) => `- ${n}`)] : []),
  ];
  return lines.join('\n');
}
