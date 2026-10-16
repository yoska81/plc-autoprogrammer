import type { Effort } from '../../store/useSettingsStore';
import type { CpuModel, PlcProfile } from '../../plc/profile';
import type { IOPoint } from '../../types/io';
import type { HmiDesign, HmiElementKind } from '../../hmi/types';
import type { HmiModel } from '../../hmi/hmiCatalog';
import { specToText, type SpecSections } from '../../spec/types';
import { callClaude } from './anthropic';

const KINDS: HmiElementKind[] = ['button', 'nav', 'indicator', 'numeric', 'numeric-entry', 'text', 'alarm-banner', 'bar'];
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const ns = { type: ['string', 'null'] };
const nn = { type: ['number', 'null'] };

const SCHEMA = obj({
  explanation: { type: 'string' },
  screens: {
    type: 'array',
    items: obj({
      id: { type: 'string' },
      name: { type: 'string' },
      purpose: { type: 'string' },
      elements: {
        type: 'array',
        items: obj({
          id: { type: 'string' },
          kind: { type: 'string', enum: KINDS },
          label: { type: 'string' },
          x: { type: 'integer' }, y: { type: 'integer' }, w: { type: 'integer' }, h: { type: 'integer' },
          address: ns,
          action: { anyOf: [{ type: 'string', enum: ['momentary', 'set', 'reset', 'toggle'] }, { type: 'null' }] },
          targetScreenId: ns,
          onText: ns, offText: ns,
          style: { type: 'string', enum: ['normal', 'ok', 'warning', 'alarm'] },
          units: ns, min: nn, max: nn,
          note: ns,
        }),
      },
    }),
  },
  alarms: { type: 'array', items: obj({ address: { type: 'string' }, message: { type: 'string' }, severity: { type: 'string', enum: ['alarm', 'warning'] } }) },
  tags: {
    type: 'array',
    items: obj({
      name: { type: 'string' }, address: { type: 'string' },
      dataType: { type: 'string', enum: ['BIT', 'INT', 'INT2', 'FLOAT'] },
      access: { type: 'string', enum: ['read', 'write', 'read-write'] },
      description: { type: 'string' },
    }),
  },
  notes: { type: 'array', items: { type: 'string' } },
});

function system(hmi: HmiModel, guidelines: string, comms: string) {
  return `You are a senior HMI designer and controls engineer. Design the operator screens for an AutomationDirect ${hmi.partNumber} (${hmi.sizeIn}" ${hmi.widthPx}x${hmi.heightPx} px touch panel) connected to the machine's PLC.

Screen set (adapt to the machine): Main/Auto overview with machine state, mode, cycle start/stop and key counts; Manual with hold-to-run jog buttons per motion, interlocked; Homing/Start-up; Alarms (active list + reset); I/O status (inputs and outputs lamps); Setup/setpoints (timers, speeds, counts) behind a password note. Every screen has the same navigation bar and an alarm banner.

Layout rules:
- Coordinates in the panel's native pixels: 0 ≤ x, x+w ≤ ${hmi.widthPx}; 0 ≤ y, y+h ≤ ${hmi.heightPx}. No overlapping elements. Leave 8 px gaps.
- Touch targets at least 60x48 px; nav bar along the bottom or top on every screen, identical position.
- Visual style: modern minimal dark UI (in the spirit of Tesla / SpaceX consoles), rendered by the app: near-black background, generous spacing, few large elements rather than many small ones. Colour only carries meaning (style "ok" green for running, "warning" amber, "alarm" red; "normal" for everything else) — this also satisfies ISA-101 high-performance practice.
- Give each screen a clear hierarchy: a short title "text" element top-left (h about 40), the key machine state as large indicators/numerics, then actions. Keep labels short (1–3 words, they are shown in capitals). Align elements on a grid with consistent widths.

PLC addressing (the PLC program will be written to match these tags exactly):
- HMI commands (buttons) write C bits in the range C1001–C1100 (never X inputs or Y outputs directly).
- Setpoints entered on the HMI are DS registers DS1001–DS1100; displayed values may read any DS/DD/TD/CTD.
- Alarm bits the PLC sets are C1101–C1200; status bits the PLC sets for display are C1201–C1300. Indicators may also read X/Y directly.
- Every element that reads or writes the PLC has an address; text and nav elements have address null. Every address used appears once in "tags" with a clear name and description of what the PLC must do with it.
- "alarms": one entry per alarm bit with the operator message.

${guidelines ? `Guidelines:\n${guidelines}\n` : ''}${comms ? `PLC communication notes:\n${comms}\n` : ''}
"notes": what the engineer must confirm (passwords, recipe needs, missing information). "explanation": a short summary of the screens for the customer.`;
}

export async function generateHmiDesign(opts: {
  apiKey: string; model: string; effort: Effort;
  hmi: HmiModel; guidelines: string; comms: string;
  spec: SpecSections; io: IOPoint[]; addresses: Map<string, string>;
  profile: PlcProfile; cpu: CpuModel;
}): Promise<{ design: HmiDesign; explanation: string; reasoning: string | null }> {
  const io = opts.io.map((p) => `${opts.addresses.get(p.id) || '(unassigned)'}\t${p.type}\t${p.description}`).join('\n') || '(none)';
  const content = `PLC: ${opts.profile.vendor} ${opts.profile.name} ${opts.cpu.id}

Machine specification:
${specToText(opts.spec) || '(empty)'}

Physical I/O (address, type, description):
${io}

Design the HMI.`;
  const { text, reasoning } = await callClaude({
    apiKey: opts.apiKey, model: opts.model, effort: opts.effort,
    system: system(opts.hmi, opts.guidelines, opts.comms), messages: [{ role: 'user', content }], schema: SCHEMA,
  });
  let parsed: Omit<HmiDesign, 'hmiPartNumber' | 'generatedAt'> & { explanation: string };
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error('The AI returned an HMI design the app could not read. Please try again.', { cause: err });
  }
  // Keep every element on the panel even if the model drifted past the edges.
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const screens = parsed.screens.map((sc) => ({
    ...sc,
    elements: sc.elements.map((e) => {
      const w = clamp(e.w, 20, opts.hmi.widthPx);
      const h = clamp(e.h, 16, opts.hmi.heightPx);
      return { ...e, w, h, x: clamp(e.x, 0, opts.hmi.widthPx - w), y: clamp(e.y, 0, opts.hmi.heightPx - h) };
    }),
  }));
  return {
    design: { hmiPartNumber: opts.hmi.partNumber, screens, alarms: parsed.alarms, tags: parsed.tags, notes: parsed.notes, generatedAt: new Date().toISOString() },
    explanation: parsed.explanation,
    reasoning,
  };
}
