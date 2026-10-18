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
import { dxfToText } from './dxf';
import type { DrawnRatings, ExistingMachine } from './types';

export const MAX_UPLOAD_FILES = 20;

/** File types the upload takes (the file picker's accept list). */
export const UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.dxf,.dwg,application/pdf,image/*';

/** One upload as content blocks for the AI: PDFs and images as they are, DXF as its text. */
export async function readUpload(files: File[]): Promise<Anthropic.Beta.Messages.BetaContentBlockParam[]> {
  if (files.length > MAX_UPLOAD_FILES) throw new Error(`At most ${MAX_UPLOAD_FILES} files at once.`);
  const out: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  for (const f of files) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'dwg') throw new Error(`${f.name}: DWG files can't be read here. In the CAD program, export the drawings to DXF (File → Save As → DXF) or print them to PDF, and upload that.`);
    if (ext === 'dxf') out.push({ type: 'text', text: dxfToText(await f.text(), f.name) });
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
  motors: { type: 'array', items: obj({ tag: str, description: str, kw: num, hp: num, starter: { anyOf: [en(['contactor-overload', 'motor-protector', 'vfd']), { type: 'null' }] }, reversing: { type: 'boolean' }, confidence, source: str }) },
  interlocks: { type: 'array', items: obj({ description: str, devices: { type: 'array', items: str } }) },
  safety: obj({ estops: { type: 'array', items: str }, guards: { type: 'array', items: str }, safetyRelay: nstr, category: nstr, description: str }),
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
- safety: E-stop devices (tags), guard switches, the safety relay (tag and part number) and the category / PL if printed (or inferred from dual-channel wiring), and a short description of what removes power on a stop.
- spec: write the machine description yourself, section by section, in plain English for someone who has never seen the machine: what it does, the automatic cycle as far as the I/O and interlocks show it, safety, guarding, start-up, modes (from selector switches), each motor, pneumatics (from valves YV), sensors, the operator station (buttons, lights), alarms (from fault inputs and lamps), and power. Write "" for a section the drawings say nothing about.
- questions: what a designer must still know that the drawings cannot tell (e.g. "What is the conveyor speed?", "Is the product detected before the pusher or after?"), each with the spec section it belongs to and your assumption if you have one. Do not ask what the drawings already show.
- summary: two sentences on the machine and its control system.`;

export interface DeriveOptions { apiKey: string; model: string; effort: Effort; signal?: AbortSignal }

const NO_RATINGS: DrawnRatings = { amps: null, poles: null, coilVoltage: null, kA: null, curve: null, minAmps: null, maxAmps: null, kw: null, outputVolts: null, outputAmps: null };

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
    io: raw.io ?? [],
    components: (raw.components ?? []).map((c) => ({ ...c, source: c.source ?? '', ratings: { ...NO_RATINGS, ...(c.ratings as Partial<DrawnRatings> | undefined) } })),
    motors: (raw.motors ?? []).map((m) => ({ ...m, reversing: Boolean(m.reversing), confidence: m.confidence ?? 'medium', source: m.source ?? '' })),
    interlocks: raw.interlocks ?? [],
    safety: raw.safety ?? { estops: [], guards: [], safetyRelay: null, category: null, description: '' },
    spec,
    questions: (raw.questions ?? []).filter((q) => q.text?.trim()),
    uncertainties: raw.uncertainties ?? [],
  };
}

/** Read the upload and build the existing machine (one AI request). */
export async function deriveFromUpload(opts: DeriveOptions, files: File[], note = ''): Promise<{ machine: ExistingMachine; reasoning: string | null }> {
  const blocks = await readUpload(files);
  const names = files.map((f, i) => `${i + 1}. ${f.name}`).join('\n');
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
