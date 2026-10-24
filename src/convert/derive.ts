/**
 * The shared first step of "Convert existing drawings" and "Upgrade existing program": read the upload
 * (PDF, images, DXF) and have the AI build the machine from it: inventory, I/O, motors, supply as drawn,
 * interlocks, the safety circuit, and the machine description itself (the user types nothing; what the
 * drawings don't tell becomes questions on the Machine description page).
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { Effort } from '../store/useSettingsStore';
import { callClaude } from '../lib/ai/anthropic';
import { parallelCached } from '../lib/ai/parallelCached';
import { CATEGORIES, DEVICE_TYPES, IO_CATEGORIES, fileToBlock } from '../lib/ai/importAI';
import { SPEC_SECTIONS, type SpecSectionId } from '../spec/types';
import { cadToText, dwgToEntities, dxfToText } from './dxf';
import { dxfText } from '../lib/parseWorker';
import { desktopBridge } from '../desktop/bridge';
import { checkUploadFiles } from './uploadCheck';
import type { DrawnRatings, ExistingMachine, PathContact, PathEl } from './types';

export const MAX_UPLOAD_FILES = 20;

/** DWG in the browser (and the claude.ai preview): the Windows app opens it. */
export const DWG_IN_BROWSER = 'DWG opens in the Windows app; here use DXF or PDF (in AutoCAD: File → Save As → DXF, or print to PDF).';
/** The Windows app without its DWG converter (e.g. removed from the installation). */
export const DWG_NOT_AVAILABLE = 'DWG reading is not available in this installation: save the drawings as DXF in AutoCAD (File → Save As → DXF), or install the app again.';

/**
 * A DWG as text: the Windows app converts it to DXF (GNU LibreDWG, shipped with the installer); else a
 * plugged-in reader; else what to do. What the converter could not read goes to `notes` (and to the AI).
 */
async function dwgText(f: File, notes: string[]): Promise<string> {
  const dwg = desktopBridge()?.dwg;
  if (dwg) {
    const r = await dwg.read([{ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }]);
    if (r.ok) {
      const w = r.files[0].warnings ?? [];
      notes.push(...w);
      return `${dxfToText(r.files[0].text, f.name)}${w.length ? `\n(Note from the DWG converter: ${w.join(' ')})` : ''}`;
    }
    if (!r.notConfigured) throw new Error(`${f.name}: ${r.error}`);
  }
  const entities = await dwgToEntities(await f.arrayBuffer());
  if (entities) return cadToText(entities, f.name);
  throw new Error(`${f.name}: ${dwg ? DWG_NOT_AVAILABLE : DWG_IN_BROWSER}`);
}

/** File types the upload takes (the file picker's accept list). */
// PLC program files are listed too, so a user who picks one here is sent to the Program tab (uploadCheck.ts).
export const UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.dxf,.dwg,application/pdf,image/*,.ymw7,.YMW7,.emtp,.l5x,.L5X,.l5k,.L5K';

/** One upload as content blocks for the AI: PDFs and images as they are, DXF as its text. */
/** `notes`: warnings collected while reading (DWG); `onFile`: called before each file is read (progress: "Reading 3 of 8: …"). */
export async function readUpload(files: File[], notes: string[] = [], onFile?: (i: number, name: string) => void): Promise<Anthropic.Beta.Messages.BetaContentBlockParam[]> {
  if (files.length > MAX_UPLOAD_FILES) throw new Error(`At most ${MAX_UPLOAD_FILES} files at once.`);
  // an empty or damaged file never goes to the AI
  const bad = await checkUploadFiles(files);
  if (bad.length) throw new Error(bad.join(' '));
  const out: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  for (const [i, f] of files.entries()) {
    onFile?.(i, f.name);
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'dwg') out.push({ type: 'text', text: await dwgText(f, notes) }); else if (ext === 'dxf') out.push({ type: 'text', text: await dxfText(f) });
    else out.push(await fileToBlock(f));
  }
  // Drawing text past this is more than one reading can take in (about 150 k tokens): say so instead of failing at the AI.
  const chars = out.reduce((n, b) => n + (b.type === 'text' ? b.text.length : 0), 0);
  if (chars > MAX_DRAWING_TEXT) throw new Error(`The CAD drawings hold ${Math.round(chars / 1000)} k characters of text, more than one reading can take (${MAX_DRAWING_TEXT / 1000} k). Read them in parts (fewer DXF/DWG files at a time), or upload the drawings as PDF.`);
  return out;
}

export const MAX_DRAWING_TEXT = 600_000;

const str = { type: 'string' } as const;
const num = { type: ['number', 'null'] } as const;
const nstr = { type: ['string', 'null'] } as const;
const en = (values: readonly string[]) => ({ type: 'string', enum: values });
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const confidence = en(['high', 'medium', 'low']);
const SECTION_IDS = SPEC_SECTIONS.map((s) => s.id);

const CONTACT_KINDS = ['pb', 'relay', 'timer', 'limit', 'ol', 'selector', 'safety', 'other'];
const CONTACT = obj({ tag: str, nc: { type: 'boolean' }, terms: nstr, kind: en(CONTACT_KINDS) });
/** A path element: a contact, the coil (or drive input) at the end, or a parallel branch of contact paths (flat: one schema for all three). */
const PATH_EL = obj({
  t: en(['contact', 'coil', 'branch']), tag: str, nc: { type: 'boolean' }, terms: nstr,
  kind: en([...CONTACT_KINDS, 'contactor', 'timer-on', 'timer-off', 'counter', 'solenoid', 'light', 'drive-input']), preset: nstr,
  paths: { type: 'array', items: { type: 'array', items: CONTACT } },
});

const EXISTING_PROPS = {
  summary: str,
  drawingStandard: en(['IEC', 'GB', 'JIS', 'NFPA', 'other']),
  language: str,
  plc: { anyOf: [obj({ vendor: str, model: str, cpuPartNumber: nstr }), { type: 'null' }] },
  modules: { type: 'array', items: obj({ slot: { type: ['integer', 'null'] }, partNumber: str, description: str }) },
  supplyDrawn: obj({ volts: num, hz: num, phases: num, text: str }),
  io: {
    type: 'array',
    items: obj({
      address: str, description: str, type: en(['input', 'output']), category: en(IO_CATEGORIES),
      deviceTag: nstr, deviceType: en(DEVICE_TYPES), confidence, source: str,
    }),
  },
  components: {
    type: 'array',
    items: obj({
      tag: str, partNumber: nstr, manufacturer: nstr, description: str, category: en(CATEGORIES), confidence, source: str,
      ratings: obj({ amps: num, poles: num, coilVoltage: nstr, kA: num, curve: nstr, minAmps: num, maxAmps: num, kw: num, outputVolts: num, outputAmps: num }),
    }),
  },
  motors: { type: 'array', items: obj({ tag: str, description: str, kw: num, hp: num, starter: { anyOf: [en(['contactor-overload', 'motor-protector', 'vfd']), { type: 'null' }] }, reversing: { type: 'boolean' }, kind: en(['induction', 'servo']), confidence, source: str }) },
  axes: { type: 'array', items: obj({ tag: str, description: str, driveTag: str, drivePart: nstr, motorTag: str, motorKw: num, encoder: nstr, brakingResistor: nstr, signals: { type: 'array', items: str }, confidence, source: str }) },
  controller: en(['plc', 'servo-drive', 'relays', 'other']),
  circuits: { type: 'array', items: obj({ output: str, function: str, kind: en(['start-stop', 'interlock', 'timer', 'counter', 'length', 'sequence', 'drive-logic', 'other']), conditions: { type: 'array', items: str }, sealIn: nstr, path: { type: 'array', items: PATH_EL }, devices: { type: 'array', items: str }, setting: nstr, logicIn: en(['relays', 'drive', 'controller']), confidence, source: str }) },
  interlocks: { type: 'array', items: obj({ description: str, devices: { type: 'array', items: str } }) },
  safety: obj({ estops: { type: 'array', items: str }, guards: { type: 'array', items: str }, safetyRelay: nstr, category: nstr, kind: en(['safety-relay', 'hardwired', 'control-only']), description: str, drives: { type: 'array', items: obj({ tag: str, sto: en(['wired', 'not-wired', 'none', 'unknown']), stopsBy: str }) } }),
  spec: obj(Object.fromEntries(SECTION_IDS.map((id) => [id, str]))),
  questions: { type: 'array', items: obj({ text: str, section: en(SECTION_IDS), assumption: nstr }) },
  uncertainties: { type: 'array', items: str },
};
/** The whole reading in one answer. */
export const EXISTING_SCHEMA = obj(EXISTING_PROPS);

export const DERIVE_SYSTEM = `You are a senior controls and electrical engineer taking over an existing machine from its electrical drawings. The drawings may follow IEC or Chinese GB conventions (device letters QF, QS, KM, KA, FR, SB, SA, SQ, SP, HL, YV, FU, TC, XT, M), use Chinese text, metric wire sizes (mm²) and a 380 V / 400 V 50 Hz supply. You read PDF pages, scans, photos and the text of DXF exports. Build an exact picture of the machine so it can be redesigned for another standard while it keeps doing exactly the same thing.

Read and report only what the drawings show. Never invent a part number, address, wire number or rating. Every I/O point, component and motor carries a confidence: "high" = clearly printed, "medium" = readable but inferred from context, "low" = partly legible or guessed (the user confirms those).

- io: one entry per PLC input/output with the address exactly as printed (X0, Y3, %I0.0, I0.0…), the function in plain English (translate Chinese text; keep the original in brackets when it helps, e.g. "Start conveyor (启动)"), the field device's tag as drawn, and where you read it in "source" (sheet / page and column).
- components: every device with its drawing tag as printed, where you read it in "source" (sheet and column, or the parts-list row), part number and manufacturer when shown (e.g. CHINT NXC-12, Delixi CDJX2-1210, Schneider LC1D12), and the ratings printed on the drawing or the legend: amps, poles, coil voltage, breaking capacity kA, curve, overload range, kW, power supply output. null when not shown.
- motors: each motor with its tag, where you read it ("source"), what it drives, power in kW as printed (hp only if printed in hp), starter type and whether it is reversing.
- supplyDrawn: the incoming supply as drawn (volts, Hz, phases) and the text you read it from.
- interlocks: what the wiring enforces: e.g. "KM1 and KM2 cross-interlocked (forward/reverse)", "Pump runs only when level switch SL1 is made", "Heater off when door open". List the device tags involved.
- axes: each servo axis (drive tag and model, servo motor tag and kW, extra encoder such as a line-length encoder, braking resistor, the drive I/O used). A servo motor is listed in motors too, with kind "servo".
- circuits: every control circuit as a function: what it drives (the coil, valve, lamp or drive input), the function in plain words, the kind (start-stop with a seal-in, interlock, timer, counter, length controller, sequence, or drive-logic for what a drive or controller does with its own built-in logic, e.g. a servo drive's flying shear or a VFD's preset speeds), the contacts in the coil's path in the order drawn, in plain words with terminals and NO/NC, parallel branches joined with ∥ (e.g. "SB1 stop (NC)", "SB2 start (NO) ∥ KM1 13-14 self-hold", "FR1 95-96 overload (NC)"), the seal-in (self-hold) contact if any, the same path structured ("path": contacts in series from the left rail, a "branch" holding the parallel contact paths such as the start button and its seal-in, ending with the coil: relay, contactor, timer-on/off with its preset, counter, solenoid, light, or a drive input with its terminal; tag, NO/NC and terminals as drawn; for a contact element leave preset null and paths [], for a coil nc false), every device tag involved, the timer / counter / length setting as printed, where the logic is (relays, drive, controller), confidence and source. On a machine without a PLC this is its whole logic: list every relay and contactor coil.
- io: on a machine without a PLC, list every field device as the I/O it would be (inputs: buttons, switches, sensors; outputs: motor contactor coils, valves, lamps, drive run inputs), with "address" saying where it connects now (e.g. "KM1 coil", "VFD DI1", "Servo CN1-17").
- controller: what runs the logic: "plc", "servo-drive" (a servo drive's built-in controller, often with a touch panel), "relays", or "other". plc is null when there is no PLC.
- safety: E-stop devices (tags), guard switches, the safety relay (tag and part number) and the category / PL if printed (or inferred from dual-channel wiring), the kind ("safety-relay": a monitored safety relay; "hardwired": the E-stop itself opens the power or control circuit; "control-only": the E-stop is only an input of a PLC, drive or controller, which is not a safety circuit), a short description of what removes power on a stop, and for every drive (VFD and servo drive) how it stops: "wired" when its Safe Torque Off (STO) inputs are wired to the safety circuit, "not-wired" when the drive has STO but it is bridged or unused, "none" when the drive has no STO, "unknown" when the drawings don't show it, and what stops it now (e.g. "single KA1 contact on the run input"). A drive stopped only by a run command or a single relay contact is not a two-channel stop.
- spec: write the machine description yourself, section by section, in plain English for someone who has never seen the machine: what it does, the automatic cycle as far as the I/O and interlocks show it, safety, guarding, start-up, modes (from selector switches), each motor, pneumatics (from valves YV), sensors, the operator station (buttons, lights), alarms (from fault inputs and lamps), and power. Write "" for a section the drawings say nothing about.
- questions: what a designer must still know that the drawings cannot tell (e.g. "What is the conveyor speed?", "Is the product detected before the pusher or after?"), each with the spec section it belongs to and your assumption if you have one. Do not ask what the drawings already show.
- summary: two sentences on the machine and its control system.`;

/**
 * The reading split into three answers that can run at the same time on the same files (sent once as a
 * cached prefix): what the machine is built from, its logic, its safety and description. Each part fills
 * its own fields; all of them may list uncertainties.
 */
export const DERIVE_PARTS = [
  { id: 'hardware', fields: ['drawingStandard', 'language', 'plc', 'modules', 'supplyDrawn', 'components', 'motors', 'axes'],
    instruction: 'PART 1 of 3 — HARDWARE. Fill only: drawingStandard, language, plc, modules, supplyDrawn, components (every device with its ratings), motors and axes, plus uncertainties; leave every other field empty ([], "" or null). Another reader does the I/O, circuits and description at the same time: use every device tag exactly as printed.' },
  { id: 'logic', fields: ['io', 'circuits', 'interlocks', 'controller'],
    instruction: 'PART 2 of 3 — LOGIC. Fill only: io (every I/O point, or on a machine without a PLC every field device as the I/O it would be), circuits (every control circuit with its structured path), interlocks and controller, plus uncertainties; leave every other field empty ([], "" or null). Another reader does the parts list and the description at the same time: use every device tag exactly as printed.' },
  { id: 'safety', fields: ['safety', 'spec', 'questions', 'summary'],
    instruction: 'PART 3 of 3 — SAFETY AND DESCRIPTION. Fill only: safety (E-stops, guards, safety relay, category, kind, and how every drive stops, STO), spec (the machine description, section by section), questions and summary, plus uncertainties; leave every other field empty ([], "" or null). Another reader does the parts list and the I/O at the same time: use every device tag exactly as printed.' },
] as const;

/**
 * A part's answer: the whole reading's schema, the same for all three (the output format is part of what the
 * prompt cache keys on, so a schema per part would stop parts 2 and 3 reading part 1's cache). The part's
 * instruction says which fields to fill; mergeParts takes only those.
 */
export const partSchema = (): Record<string, unknown> => EXISTING_SCHEMA;

/**
 * The three answers as one reading: each part's own fields, uncertainties from all (once each), and what the
 * parts don't agree on as more uncertainties: a tag in the circuits or the safety circuit that neither the
 * parts list nor the I/O has, a tag listed twice in the parts, a PLC but "no PLC" logic (or the reverse).
 */
export function mergeParts(answers: Partial<ExistingMachine>[]): Partial<ExistingMachine> {
  const out: Record<string, unknown> = {};
  answers.forEach((a, i) => { for (const k of DERIVE_PARTS[i].fields) if ((a as Record<string, unknown>)[k] !== undefined) out[k] = (a as Record<string, unknown>)[k]; });
  const m = out as Partial<ExistingMachine>;
  const checks: string[] = [];
  const parts = (m.components ?? []).map((c) => c.tag);
  // a tag is the first word, cut at a terminal ("X1:3" → X1); PLC addresses and wiring points (Y0, X1:3) are known through the I/O
  const tagOf = (t: string) => t.trim().split(/[\s:]+/)[0];
  const known = new Set([...parts, ...(m.io ?? []).flatMap((p) => [p.deviceTag ?? '', ...p.address.split(/[\s/,]+/).map(tagOf)]).filter(Boolean), ...(m.motors ?? []).map((x) => x.tag)]);
  const used = new Map<string, string>();
  for (const c of m.circuits ?? []) for (const t of [tagOf(c.output), ...c.devices.map(tagOf)]) if (t && !used.has(t)) used.set(t, `circuit ${c.output}`);
  const sf = m.safety;
  for (const t of [...(sf?.estops ?? []), ...(sf?.guards ?? []), ...(sf?.safetyRelay ? [tagOf(sf.safetyRelay)] : []), ...(sf?.drives ?? []).map((d) => d.tag)]) if (t && !used.has(tagOf(t))) used.set(tagOf(t), 'the safety circuit');
  // terminal strips and PLC addresses (X1, XT2, TB1, Y0) are wiring points, not devices of the parts list
  const unknown = [...used].filter(([t]) => /^[A-Z][A-Z0-9-]*\d/.test(t) && !/^(X|XT|Y|TB)\d/.test(t) && !known.has(t));
  if (unknown.length) checks.push(`Not in the parts list or the I/O read from the drawings: ${unknown.map(([t, where]) => `${t} (${where})`).join(', ')}. Check these tags on the drawings.`);
  const twice = [...new Set(parts.filter((t, i) => parts.indexOf(t) !== i))];
  if (twice.length) checks.push(`Listed twice in the parts: ${twice.join(', ')}. Check whether these are two devices.`);
  if (m.plc && m.controller && m.controller !== 'plc') checks.push(`A PLC (${m.plc.vendor} ${m.plc.model}) was read, but the logic was read as run by ${m.controller}. Check which one runs the machine.`);
  if (m.plc === null && m.controller === 'plc') checks.push('The logic was read as run by a PLC, but no PLC was found on the drawings. Check the controller.');
  return { ...m, uncertainties: [...new Set([...answers.flatMap((a) => a.uncertainties ?? []), ...checks])] };
}

/** split: the three parts (hardware first; the other two once its answer starts, on the cached files); default one request. */
export interface DeriveOptions { apiKey: string; model: string; effort: Effort; signal?: AbortSignal; split?: boolean }

const NO_RATINGS: DrawnRatings = { amps: null, poles: null, coilVoltage: null, kA: null, curve: null, minAmps: null, maxAmps: null, kw: null, outputVolts: null, outputAmps: null };

/** A path as the schema returns it (flat elements) in the typed form; empty when the AI gave none. */
function cleanPath(raw: unknown): PathEl[] {
  if (!Array.isArray(raw)) return [];
  type Flat = { t?: string; tag?: string; nc?: boolean; terms?: string | null; kind?: string; preset?: string | null; paths?: Flat[][] };
  const contact = (e: Flat): PathContact => ({ t: 'contact', tag: e.tag ?? '', nc: Boolean(e.nc), terms: e.terms ?? null, kind: (e.kind ?? 'other') as PathContact['kind'] });
  return (raw as Flat[]).filter((e) => e && (e.tag || e.t === 'branch')).map((e): PathEl => (e.t === 'branch'
    ? { t: 'branch', paths: (e.paths ?? []).map((p) => p.filter((x) => x?.tag).map(contact)).filter((p) => p.length) }
    : e.t === 'coil' ? { t: 'coil', tag: e.tag!, kind: (e.kind ?? 'relay') as Extract<PathEl, { t: 'coil' }>['kind'], preset: e.preset ?? null, terms: e.terms ?? null }
      : contact(e)));
}

/** Fill what the AI may leave out, so the rest of the app can rely on the shape. */
export function normalizeMachine(raw: Partial<ExistingMachine>): ExistingMachine {
  const spec = Object.fromEntries(SECTION_IDS.map((id) => [id, (raw.spec?.[id] ?? '').trim()])) as Record<SpecSectionId, string>;
  return {
    summary: raw.summary ?? '',
    drawingStandard: raw.drawingStandard ?? 'other',
    language: raw.language ?? '',
    plc: raw.plc ?? null,
    modules: raw.modules ?? [],
    supply: null,
    supplyDrawn: raw.supplyDrawn ?? { volts: null, hz: null, phases: null, text: '' },
    io: (raw.io ?? []).map((p, i) => ({ ...p, id: p.id ?? `io${i + 1}` })),
    components: (raw.components ?? []).map((c) => ({ ...c, source: c.source ?? '', ratings: { ...NO_RATINGS, ...(c.ratings as Partial<DrawnRatings> | undefined) } })),
    motors: (raw.motors ?? []).map((m) => ({ ...m, reversing: Boolean(m.reversing), kind: m.kind ?? 'induction', confidence: m.confidence ?? 'medium', source: m.source ?? '' })),
    axes: raw.axes ?? [],
    controller: raw.controller ?? (raw.plc ? 'plc' : 'other'),
    interlocks: raw.interlocks ?? [],
    circuits: (raw.circuits ?? []).map((c, i) => ({ ...c, id: c.id ?? `C${i + 1}`, conditions: c.conditions ?? [], sealIn: c.sealIn ?? null, path: cleanPath(c.path), devices: c.devices ?? [], setting: c.setting ?? null, logicIn: c.logicIn ?? 'relays', confidence: c.confidence ?? 'medium', source: c.source ?? '' })),
    safety: { estops: [], guards: [], safetyRelay: null, category: null, description: '', ...raw.safety, drives: raw.safety?.drives ?? [], kind: raw.safety?.kind ?? (raw.safety?.safetyRelay ? 'safety-relay' : 'hardwired') },
    spec,
    questions: (raw.questions ?? []).filter((q) => q.text?.trim()),
    uncertainties: raw.uncertainties ?? [],
    ...(raw.terminals?.length ? { terminals: raw.terminals } : {}),
    ...(raw.wiring?.length ? { wiring: raw.wiring } : {}),
  };
}

/**
 * Read the upload and build the existing machine: one AI request, or with `split` three parts (DERIVE_PARTS)
 * on the same files: the first writes them to the prompt cache, the other two start as its answer begins. `extra`:
 * more content for the same request, e.g. a PLC program's symbol table or rung listing from the program
 * reader (src/plc/import/).
 */
export async function deriveFromUpload(opts: DeriveOptions, files: File[], note = '', extra: Anthropic.Beta.Messages.BetaContentBlockParam[] = [], onStage?: (text: string) => void): Promise<{ machine: ExistingMachine; reasoning: string | null; notes: string[] }> {
  const notes: string[] = [];
  const blocks = [...(await readUpload(files, notes, (i, name) => onStage?.(`Reading the files (${i + 1}/${files.length}): ${name}`))), ...extra];
  onStage?.('Reading the drawings (AI)');
  const names = files.map((f, i) => `${i + 1}. ${f.name}`).join('\n') || '(none: program data only)';
  const ask = `Files (in the order attached):\n${names}\n\n${note ? `Notes from the engineer:\n${note}\n\n` : ''}Read this machine from its drawings and write its description.`;
  const base = { apiKey: opts.apiKey, model: opts.model, effort: opts.effort, signal: opts.signal, task: 'import' as const, system: DERIVE_SYSTEM };
  const read = (text: string) => {
    try { return JSON.parse(text) as Partial<ExistingMachine>; } catch (err) { throw new Error('The AI returned a result the app could not read. Please try again.', { cause: err }); }
  };
  if (!opts.split) {
    const { text, reasoning } = await callClaude({ ...base, schema: EXISTING_SCHEMA, messages: [{ role: 'user', content: [...blocks, { type: 'text', text: ask }] }] });
    return { machine: normalizeMachine(read(text)), reasoning, notes };
  }
  // the files once as the prompt-cached prefix, then each part's own instruction (last); one schema for all
  // (a different output format per part would miss the cache); hardware first, the other two once its answer
  // starts (they read the cached files); one part failing stops the others
  const answers = await parallelCached({ ...base, prefix: blocks },
    DERIVE_PARTS.map((p) => ({ instruction: `${ask}\n\n${p.instruction}`, schema: partSchema() })));
  const reasoning = answers.map((a) => a.reasoning).filter(Boolean).join('\n\n') || null;
  return { machine: normalizeMachine(mergeParts(answers.map((a) => read(a.text)))), reasoning, notes };
}
