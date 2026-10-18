/**
 * The shared first step of "Convert existing drawings" and "Upgrade existing program": read the upload
 * (PDF, images, DXF) and have the AI build the machine from it: inventory, I/O, motors, supply as drawn,
 * interlocks, the safety circuit, and the machine description itself (the user types nothing; what the
 * drawings don't tell becomes questions on the Machine description page).
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { Effort } from '../store/useSettingsStore';
import { callClaude } from '../lib/ai/anthropic';
import { CATEGORIES, DEVICE_TYPES, IO_CATEGORIES, fileToBlock } from '../lib/ai/importAI';
import { SPEC_SECTIONS, type SpecSectionId } from '../spec/types';
import { cadToText, dwgToEntities, dxfToText } from './dxf';
import { desktopBridge } from '../desktop/bridge';
import type { DrawnRatings, ExistingMachine, PathContact, PathEl } from './types';

export const MAX_UPLOAD_FILES = 20;

/** Where the free ODA File Converter is downloaded (Open Design Alliance). */
export const ODA_DOWNLOAD = 'https://www.opendesign.com/guestfiles/oda_file_converter';

/** A DWG as text: the Windows app converts it with the ODA File Converter; else a plugged-in reader; else how to export it. */
async function dwgText(f: File): Promise<string> {
  const oda = desktopBridge()?.oda;
  if (oda?.toDxf) {
    const r = await oda.toDxf([{ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }]);
    if (r.ok) return dxfToText(r.files[0].text, f.name);
    if (!('notInstalled' in r && r.notInstalled)) throw new Error(`${f.name}: ${r.error}`);
  }
  const entities = await dwgToEntities(await f.arrayBuffer());
  if (entities) return cadToText(entities, f.name);
  throw new Error(oda
    ? `${f.name}: reading DWG needs the free ODA File Converter (${ODA_DOWNLOAD}). Install it and read again, or export the drawings to DXF or PDF in the CAD program.`
    : `${f.name}: DWG files can't be read in the browser. In the CAD program, export the drawings to DXF (File → Save As → DXF) or print them to PDF, or use the Windows app with the free ODA File Converter.`);
}

/** File types the upload takes (the file picker's accept list). */
export const UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.dxf,.dwg,application/pdf,image/*';

/** One upload as content blocks for the AI: PDFs and images as they are, DXF as its text. */
export async function readUpload(files: File[]): Promise<Anthropic.Beta.Messages.BetaContentBlockParam[]> {
  if (files.length > MAX_UPLOAD_FILES) throw new Error(`At most ${MAX_UPLOAD_FILES} files at once.`);
  const out: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  for (const f of files) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'dwg') out.push({ type: 'text', text: await dwgText(f) }); else if (ext === 'dxf') out.push({ type: 'text', text: dxfToText(await f.text(), f.name) });
    else out.push(await fileToBlock(f));
  }
  return out;
}

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

export const EXISTING_SCHEMA = obj({
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
});

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

export interface DeriveOptions { apiKey: string; model: string; effort: Effort; signal?: AbortSignal }

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
  };
}

/**
 * Read the upload and build the existing machine (one AI request). `extra`: more content for the same
 * request, e.g. a PLC program's symbol table or rung listing from the program reader (src/plc/import/).
 */
export async function deriveFromUpload(opts: DeriveOptions, files: File[], note = '', extra: Anthropic.Beta.Messages.BetaContentBlockParam[] = []): Promise<{ machine: ExistingMachine; reasoning: string | null }> {
  const blocks = [...(await readUpload(files)), ...extra];
  const names = files.map((f, i) => `${i + 1}. ${f.name}`).join('\n') || '(none: program data only)';
  const { text, reasoning } = await callClaude({
    apiKey: opts.apiKey, model: opts.model, effort: opts.effort, signal: opts.signal, task: 'import',
    system: DERIVE_SYSTEM, schema: EXISTING_SCHEMA,
    messages: [{ role: 'user', content: [...blocks, { type: 'text', text: `Files (in the order attached):\n${names}\n\n${note ? `Notes from the engineer:\n${note}\n\n` : ''}Read this machine from its drawings and write its description.` }] }],
  });
  try {
    return { machine: normalizeMachine(JSON.parse(text) as Partial<ExistingMachine>), reasoning };
  } catch (err) {
    throw new Error('The AI returned a result the app could not read. Please try again.', { cause: err });
  }
}
