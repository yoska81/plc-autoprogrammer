import type Anthropic from '@anthropic-ai/sdk';
import type { Effort } from '../../store/useSettingsStore';
import type { IOCategory } from '../../types/io';
import type { CatalogCategory, FieldDeviceType, StarterType, SupplyVoltage } from '../../electrical/types';
import { callClaude } from './anthropic';
import { SUPPLY_INFO } from '../../standards/regions';

export type Confidence = 'high' | 'medium' | 'low';

export interface ImportedIO {
  address: string;
  description: string;
  type: 'input' | 'output';
  category: IOCategory;
  deviceTag: string | null;
  deviceType: FieldDeviceType;
  confidence: Confidence;
  /** Where it was read, e.g. "sheet 4, line 412" or "photo 2, terminal strip TB2". */
  source: string;
}

export interface ImportedComponent {
  tag: string;
  partNumber: string | null;
  description: string;
  category: CatalogCategory;
  confidence: Confidence;
}

export interface ImportResult {
  summary: string;
  plc: { vendor: string; model: string; cpuPartNumber: string | null } | null;
  modules: { slot: number | null; partNumber: string; description: string }[];
  supply: SupplyVoltage | null;
  io: ImportedIO[];
  components: ImportedComponent[];
  motors: { tag: string; description: string; hp: number | null; starter: StarterType | null }[];
  /** Things the AI could not read or is unsure about — for the user to check. */
  uncertainties: string[];
}

const IO_CATEGORIES: IOCategory[] = ['Safety', 'Operator/HMI', 'External Machine', 'Product Detection', 'Conveyor', 'Pneumatic', 'Vacuum', 'Servo/Axis', 'Station 1', 'Station 2', 'Analog/Process', 'Spare'];
const DEVICE_TYPES: FieldDeviceType[] = ['pushbutton-no', 'pushbutton-nc', 'selector', 'estop-contact', 'sensor-pnp', 'sensor-npn', 'limit-switch', 'pressure-switch', 'safety-relay-output', 'contactor-coil', 'relay-coil', 'solenoid', 'pilot-light', 'stack-light', 'vfd-input', 'other'];
const CATEGORIES: CatalogCategory[] = ['enclosure', 'disconnect', 'breaker', 'fuse', 'powerSupply', 'contactor', 'overload', 'motorProtector', 'vfd', 'relay', 'safetyRelay', 'terminal', 'terminalAccessory', 'pushbutton', 'estop', 'pilotLight', 'selector', 'stackLight', 'plc', 'plcModule', 'hmi', 'sensor', 'solenoidValve', 'dinRail', 'wireDuct', 'groundBar', 'fan', 'other'];

const str = { type: 'string' } as const;
const nullable = (t: string) => ({ type: [t, 'null'] });
const en = (values: string[]) => ({ type: 'string', enum: values });
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const confidence = en(['high', 'medium', 'low']);

const IMPORT_SCHEMA = obj({
  summary: str,
  plc: { anyOf: [obj({ vendor: str, model: str, cpuPartNumber: nullable('string') }), { type: 'null' }] },
  modules: { type: 'array', items: obj({ slot: nullable('integer'), partNumber: str, description: str }) },
  supply: { anyOf: [en(Object.keys(SUPPLY_INFO)), { type: 'null' }] },
  io: {
    type: 'array',
    items: obj({
      address: str, description: str, type: en(['input', 'output']), category: en(IO_CATEGORIES),
      deviceTag: nullable('string'), deviceType: en(DEVICE_TYPES), confidence, source: str,
    }),
  },
  components: { type: 'array', items: obj({ tag: str, partNumber: nullable('string'), description: str, category: en(CATEGORIES), confidence }) },
  motors: { type: 'array', items: obj({ tag: str, description: str, hp: nullable('number'), starter: { anyOf: [en(['contactor-overload', 'motor-protector', 'vfd']), { type: 'null' }] } }) },
  uncertainties: { type: 'array', items: str },
});

const SYSTEM = `You are a senior controls and electrical engineer taking over an existing machine. You are given its electrical schematics (PDF or images) and/or photos of the built control cabinet. Build an accurate inventory so the PLC program can be written for this exact machine.

Rules:
- Report only what you can actually read or clearly see. Never invent a PLC address, part number or wire number. If something is partly legible, give your best reading with confidence "low" and add it to "uncertainties".
- I/O: one entry per PLC input/output point, with the address exactly as printed (e.g. X001, Y003, %I0.0, I:1/0). The description comes from the schematic text, wire labels, device labels or legend plates. Say where you read it in "source".
- confidence: "high" = clearly printed; "medium" = readable but inferred from context; "low" = guessed from a partial view.
- Components: list the devices you can identify (breakers, power supplies, contactors, overloads, VFDs, relays, safety relays, terminal strips, operator devices, enclosure) with their drawing tags and part numbers when visible.
- From photos alone, wiring usually can't be traced fully. Use wire markers, terminal labels and device labels, and say clearly in "uncertainties" what must be confirmed on the machine.
- "summary": a short plain-language description of the machine and its control system as you understand it.`;

/** Read a File into a Claude content block; images are downscaled to keep detail but stay under API limits. */
export async function fileToBlock(file: File): Promise<Anthropic.Beta.Messages.BetaContentBlockParam> {
  if (file.type === 'application/pdf') {
    if (file.size > 30 * 1024 * 1024) throw new Error(`${file.name} is larger than 30 MB. Split the PDF and try again.`);
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await toBase64(file) }, title: file.name };
  }
  if (!file.type.startsWith('image/')) throw new Error(`${file.name}: only PDF and image files are supported.`);
  const data = await downscaleImage(file, 3000);
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } };
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function downscaleImage(file: File, maxEdge: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  // Shrink further until the JPEG fits the API's 5 MB per-image limit.
  for (let attempt = 0; attempt < 5; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Image conversion failed'))), 'image/jpeg', 0.9));
    if (blob.size < 4.5 * 1024 * 1024) return toBase64(blob);
    scale *= 0.75;
  }
  throw new Error(`${file.name} is too large to send.`);
}

export async function analyzeExistingSystem(opts: {
  apiKey: string;
  model: string;
  effort: Effort;
  signal?: AbortSignal;
  files: File[];
  /** Optional context from the user, e.g. "This is the palletizer on line 3". */
  note: string;
}): Promise<{ result: ImportResult; reasoning: string | null }> {
  const blocks = await Promise.all(opts.files.map(fileToBlock));
  const names = opts.files.map((f, i) => `${i + 1}. ${f.name}`).join('\n');
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [
    ...blocks,
    { type: 'text', text: `Files (in the order attached):\n${names}\n\n${opts.note ? `Notes from the engineer:\n${opts.note}\n\n` : ''}Build the inventory of this machine's control system.` },
  ];
  const { text, reasoning } = await callClaude({
    apiKey: opts.apiKey, model: opts.model, effort: opts.effort, signal: opts.signal,
    system: SYSTEM, messages: [{ role: 'user', content }], schema: IMPORT_SCHEMA,
  });
  try {
    return { result: JSON.parse(text) as ImportResult, reasoning };
  } catch (err) {
    throw new Error('The AI returned a result the app could not read. Please try again.', { cause: err });
  }
}
