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
import { resolveAddresses } from '../core/profile';
import { siemensAddress } from '../core/profiles/siemens';
import { modulesToFit, type Need } from '../core/fit';
import { getPart } from '../../electrical/catalog';
import { importedRange, materialize, nickOf, pretty } from './convert';
import { programFindings } from './findings';
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
  rungOrigin?: ImportedProgram['rungOrigin'];
  /** The original file, gzip + base64 (src/plc/import/gz.ts): changes are written back into it. */
  fileGz?: string;
  /** The machine's own controller is not one the app has: what the project shows instead, in plain words. */
  cpuNote?: string;
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
export function targetPlc(format: SourceFormat, currentPlcId: string, vendor = ''): PlcProfile {
  const same = format === 'plcopen' && /siemens/i.test(vendor) ? 'siemens-s7' : format === 'printout' ? printoutFamily(vendor) : SAME_FAMILY[format];
  const p = same ? PLC_PROFILES.find((x) => x.id === same && x.available) : undefined;
  if (p) return p;
  const cur = getProfile(currentPlcId);
  return cur.available && cur.language === 'ladder' ? cur : getProfile('click');
}

/** PLC family of a printout from its maker / model as printed. */
function printoutFamily(text: string): string | undefined {
  if (/click|automationdirect/i.test(text)) return 'click';
  if (/micro8[0-9]0|micro800/i.test(text)) return 'micro800';
  if (/rockwell|allen|logix|compactlogix|controllogix|1756|1769|5069/i.test(text)) return 'logix';
  if (/siemens|s7-|simatic|tia/i.test(text)) return 'siemens-s7';
  if (/unistream/i.test(text)) return 'unitronics-unistream';
  if (/unitronics|vision/i.test(text)) return 'unitronics-vision';
  return undefined;
}

export function needOf(imp: ImportedProgram): Need {
  const n = (type: 'input' | 'output', analog: boolean) => imp.io.filter((p) => p.type === type && p.analog === analog).length;
  // The signal of each analog point, so a current transmitter gets a current channel (not a 0–10 V onboard input).
  const ranges = (type: 'input' | 'output') => imp.io.filter((p) => p.type === type && p.analog).map((p) => importedRange(p.original, p.description).range);
  return { digitalInputs: n('input', false), digitalOutputs: n('output', false), analogInputs: n('input', true), analogOutputs: n('output', true), ethernetHmi: false, minHmiSizeIn: null, analogRanges: { input: ranges('input'), output: ranges('output') } };
}

/** First CPU of the profile (smallest first) that holds the I/O, with the modules it needs. */
export function chooseCpu(profile: PlcProfile, need: Need): { cpuId: string; modules: string[] } {
  for (const cpu of profile.cpuModels) {
    const mods = modulesToFit(cpu.id, [], need);
    if (mods) return { cpuId: cpu.id, modules: mods };
  }
  return { cpuId: profile.defaultCpuId, modules: [] };
}

/** "%IX1.0" / "%I1.0" / "I1.0" → byte and bit of an S7 digital address, or null. */
const s7Bit = (a: string) => { const m = /^%?([IQ])X?(\d+)\.([0-7])$/i.exec(a.trim()); return m ? { area: m[1].toUpperCase(), index: Number(m[2]) * 8 + Number(m[3]) } : null; };

/** The I/O modules of the original rack as catalog numbers, in slot order ("1769-IQ16/A" → "1769-IQ16"). */
const fileModules = (imp: ImportedProgram) => (imp.source.modules ?? []).map((m) => m.catalog.replace(/\/[A-Z]$/i, '').toUpperCase());

/** The controller a file names, as a catalog-style key ("1769-L33ER", "1214C", "6ES7214-1AG40-0XB0"), or ''. */
const cpuKey = (controller: string) => /\b(6ES7[\w-]+|\d{4}-[A-Z]\w*(?:-[A-Z0-9]+)*|1[25]\d\d[A-Z]*)\b/i.exec(controller)?.[1] ?? '';
const matchesCpu = (c: PlcProfile['cpuModels'][number], key: string) => c.id.toUpperCase() === key.toUpperCase() || new RegExp(`(^|[^\\w])${key}([^\\w]|$)`, 'i').test(c.label);

/**
 * The original program's own CPU, when it goes back on the same family: the CPU the file names ("CPU 1214C",
 * "1769-L33ER", an order number), else (S7) the smallest CPU whose onboard I/O holds every original %I / %Q bit, so
 * the addresses stay as they were. null = no such CPU in the app's list (the general choice applies).
 */
export function originalCpu(profile: PlcProfile, imp: ImportedProgram): { cpuId: string; modules: string[] } | null {
  // Order numbers the file states (CPU and modules): the CPU among them, and its modules to start from.
  // Catalog numbers in full, multi-part ones included (1769-L24ER-QBFC1B, 6ES7214-1AG40-0XB0).
  const orders = [...imp.source.controller.matchAll(/\b6ES7[\w-]+|\b\d{4}-[A-Z]\w*(?:-[A-Z0-9]+)*/gi)].map((m) => m[0].toUpperCase());
  const named = profile.cpuModels.find((c) => orders.includes(c.id.toUpperCase()));
  // The file's own modules (the L5X rack by slot, else order numbers it names); never 1769 Compact I/O after a
  // 1769-L1 (it expands with 1734 POINT I/O).
  const fromFile = fileModules(imp);
  const own = (fromFile.length ? fromFile : orders).filter((o) => !profile.cpuModels.some((c) => c.id.toUpperCase() === o) && getPart(o)?.category === 'plcModule' && !(/^1769-L1\d/i.test(named?.id ?? '') && /^1769-/i.test(o)));
  const fit = (id: string, start: string[] = []) => { const mods = modulesToFit(id, start, needOf(imp)); return mods ? { cpuId: id, modules: mods } : null; };
  if (named) {
    const r = fit(named.id, own) ?? fit(named.id);
    if (r) return r;
  }
  const key = cpuKey(imp.source.controller);
  if (key) {
    const cpu = profile.cpuModels.find((c) => matchesCpu(c, key));
    const r = cpu && fit(cpu.id);
    if (r) return r;
  }
  if (profile.id !== 'siemens-s7') return null;
  const bits = imp.io.map((p) => s7Bit(p.original)).filter((b): b is { area: string; index: number } => b !== null);
  if (!bits.length) return null;
  const maxIn = Math.max(-1, ...bits.filter((b) => b.area === 'I').map((b) => b.index));
  const maxOut = Math.max(-1, ...bits.filter((b) => b.area === 'Q').map((b) => b.index));
  // Onboard bytes only (%I0.0–%I1.7 on an S7-1200): higher bytes are module addresses, kept by the module layout.
  const onboard = (n: number) => (n < 16 ? n : -1);
  for (const c of profile.cpuModels) {
    if (c.builtInInputs <= onboard(maxIn) || c.builtInOutputs <= onboard(maxOut)) continue;
    const r = fit(c.id);
    if (r) return r;
  }
  return null;
}

/** Analog points whose signal the program does not state: asked (taken as 4–20 mA, which decides the module). */
function assumedRanges(imp: ImportedProgram): string[] {
  return imp.io.filter((p) => p.analog && importedRange(p.original, p.description).assumed).map((p) => `Analog signal of ${p.name}${p.original && p.original !== p.name ? ` (${p.original})` : ''}: the original program does not say what signal it is (4–20 mA, 0–10 V, an RTD such as a PT100, or a thermocouple). It is taken as 4–20 mA, and a current input is planned for it. Check the transmitter's or sensor's nameplate and set the signal on the I/O list (an RTD needs an RTD input module).`);
}

/** S7 → S7: original %I / %Q / %IW / %QW addresses that the chosen PLC puts elsewhere, as questions (never silent). */
function movedS7(imp: ImportedProgram, profile: PlcProfile, cpu: PlcProfile['cpuModels'][number], modules: string[], io: IOPoint[]): string[] {
  if (profile.id !== 'siemens-s7') return [];
  const slots = moduleSlots(modules);
  const addr = resolveAddresses(profile, cpu, io, slots);
  const norm = (a: string) => a.trim().toUpperCase().replace(/^%?([IQ])X(\d+\.)/, '%$1$2').replace(/^([IQ])/, '%$1');
  const out: string[] = [];
  io.forEach((p, k) => {
    const orig = imp.io[k]?.original ?? '';
    if (!/^%?[IQ][XWB]?\d+(\.\d)?$/i.test(orig)) return;
    const now = siemensAddress(addr.get(p.id) ?? '', cpu, slots)?.address;
    if (now && norm(now) !== norm(orig)) out.push(`Address changed: ${imp.io[k].name} was ${norm(orig)} in the original program and is ${now} on this PLC (${cpu.label.split(' — ')[0]}${modules.length ? ` + ${modules.join(', ')}` : ''}). Rewire it, or set its address on the I/O addressing page.`);
  });
  return out;
}

export function planUpgrade(imp: ImportedProgram, currentPlcId: string, now = new Date()): UpgradePlan {
  const profile = targetPlc(imp.source.format, currentPlcId, `${imp.source.vendor} ${imp.source.controller}`);
  const { cpuId, modules } = originalCpu(profile, imp) ?? chooseCpu(profile, needOf(imp));
  const cpu = profile.cpuModels.find((c) => c.id === cpuId) ?? profile.cpuModels[0];
  const m = materialize(imp, profile, cpu, moduleSlots(modules));
  // The file names a controller of this family the app does not have (a 1769-L33ER): never swapped silently.
  const named = cpuKey(imp.source.controller);
  const cpuText = named && SAME_FAMILY[imp.source.format] === profile.id && !matchesCpu(cpu, named)
    ? `Your machine's controller is a ${named}. The app does not have it yet, so this project shows a ${cpu.label.split(' — ')[0]} (${cpu.label.split(' — ')[1] ?? profile.name}) on the parts list, drawings and status bar. Your program keeps its names and logic${imp.source.format === 'l5x' ? ', and the download into your original .L5X keeps your controller' : ''}; the parts list and drawings do not match your machine's controller.`
    : '';
  // The machine's own I/O modules, kept when the app has them; any difference is said, never silent.
  const theirs = fileModules(imp);
  const unknown = theirs.filter((m) => getPart(m)?.category !== 'plcModule');
  const moduleText = theirs.length && theirs.join(' ') !== modules.join(' ')
    ? `Your machine's I/O modules are ${theirs.join(', ')} (slots 1–${theirs.length}). ${unknown.length ? `The app does not have ${unknown.join(', ')}, so this` : 'This'} project uses ${modules.join(', ') || 'no modules'} instead: the parts list, drawings and module addresses show those. Check them against the machine before ordering parts.`
    : '';
  const cpuNote = [cpuText, moduleText].filter(Boolean).join(' ') || undefined;
  // A 1769 controller with embedded I/O: the slot numbers after it are to check against the real project.
  const embedded = /^1769-L[12]\d/i.test(cpu.id) ? `Check in Studio 5000 (I/O Configuration) the I/O addresses of the ${cpu.id}: the app puts its embedded I/O at Local:1${/QBFC/i.test(cpu.id) ? ' (analog at Local:2, Ch<n>Data)' : ''} and ${/^1769-L1/i.test(cpu.id) ? 'does not address its 1734 POINT I/O expansion' : `the first expansion module at Local:${/QBFC/i.test(cpu.id) ? 4 : 2}`}.` : '';
  // I/O keeps its name from the original program (Start_PB, not the description).
  const have = new Set(m.program.tags.map((t) => t.address.toUpperCase()));
  const ioTags: TagDefinition[] = [];
  m.io.forEach((p, k) => {
    const address = materializedAddress(m.names, imp.io[k].name);
    if (address && !have.has(address.toUpperCase())) ioTags.push({ address, nickname: imp.io[k].name, comment: p.description });
  });
  let program: LadderProgram = { ...m.program, tags: [...ioTags, ...m.program.tags] };
  // Names stay as in the original program; CLICK nicknames are at most 24 letters, digits and _ (full name in the comment).
  if (profile.id === 'click') program = { ...program, tags: clickNicknames(program.tags) };
  const summary = programSummary(imp);
  return {
    plcId: profile.id, cpuId: cpu.id, modules,
    program,
    io: m.io.map((p, k) => ({ description: p.description || pretty(imp.io[k].name), type: p.type, category: p.category, ...(p.signal ? { signal: p.signal, analog: p.analog } : {}), ...(p.plcAddress ? { plcAddress: p.plcAddress } : {}) })),
    spec: describeProgram(imp),
    // Likely bugs (missing seal-in, interlock on another station's sensor) are asked before the general question.
    questions: withFindings([...(cpuNote ? [cpuNote] : []), ...(embedded ? [embedded] : []), ...questionsFor(imp), ...assumedRanges(imp), ...movedS7(imp, profile, cpu, modules, m.io)], programFindings(program).map((f) => f.message)),
    original: {
      importedAt: now.toISOString(), source: imp.source, report: imp.report, io: imp.io, plcId: profile.id, cpuId: cpu.id, program, summary,
      ioList: m.io.map((p, k) => ({ description: p.description || pretty(imp.io[k].name), type: p.type })),
      names: m.names, blockOrigin: imp.blockOrigin, rungOrigin: imp.rungOrigin,
      ...(cpuNote ? { cpuNote } : {}),
    },
  };
}

/** A nickname that reads like a PLC address (C1, T5, X0, M100, DS3) — misleading on a CLICK, where those are addresses. */
const ADDRESS_LIKE = /^(X|Y|C|T|CT|SC|SD|DS|DD|DH|DF|TD|CTD|TXT|XD|YD|M|D|SM|ST|L|B|W|R)\d+$/i;

/** CLICK nickname: the original name, or from the description when the name is address-like or missing. */
function clickName(t: TagDefinition): string {
  if (t.nickname && !ADDRESS_LIKE.test(nickOf(t.nickname))) return nickOf(t.nickname);
  // Whole words that fit in 24 characters.
  const all = t.comment.replace(/^Original:[^—]*—\s*/, '').match(/[A-Za-z0-9]+/g) ?? [];
  let words = '';
  for (const w of all) { const next = words ? `${words}_${w}` : w; if (next.length > 24) break; words = next; }
  return nickOf(words && !ADDRESS_LIKE.test(words) ? words : `Orig_${t.nickname || t.address}`);
}

export function clickNicknames(tags: TagDefinition[]): TagDefinition[] {
  const used = new Set<string>();
  return tags.map((t) => {
    let n = clickName(t);
    for (let i = 2; used.has(n.toLowerCase()); i++) n = `${clickName(t).slice(0, 24 - String(i).length - 1).replace(/_+$/, '')}_${i}`;
    used.add(n.toLowerCase());
    return n === t.nickname ? t : { ...t, nickname: n, comment: [`Original: ${t.nickname}`, t.comment].filter(Boolean).join(' — ') };
  });
}

function withFindings(questions: string[], findings: string[]): string[] {
  const last = questions.length - 1; // "What problems does the machine have today…" stays last
  return [...questions.slice(0, last), ...findings, ...questions.slice(last)];
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
  for (const d of imp.report.notes.filter((x) => /^Double coil:/.test(x))) q.push(`${d} Which rung should control it (or should both, through an OR)?`);
  for (const d of imp.report.notes.filter((x) => /^Hard to read:/.test(x))) q.push(`${d.replace(/\.$/, '')}. Please check it against the printout: is it right as read?`);
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
