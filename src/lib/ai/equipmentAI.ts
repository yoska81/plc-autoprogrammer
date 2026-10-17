import type { Effort } from '../../store/useSettingsStore';
import { PLC_PROFILES } from '../../plc/core/profiles';
import { partsIn } from '../../electrical/catalog';
import { HMI_MODELS } from '../../hmi/hmiCatalog';
import { specToText, type SpecSections } from '../../spec/types';
import { callClaude } from './anthropic';

export interface EquipmentRecommendation {
  summary: string;
  estimatedIO: { digitalInputs: number; digitalOutputs: number; analogInputs: number; analogOutputs: number; motionAxes: number };
  plc: { profileId: string; cpuId: string; why: string };
  modules: { partNumber: string; quantity: number; why: string }[];
  hmi: { partNumber: string; why: string } | null;
  alternatives: { label: string; cpuId: string; hmiPartNumber: string | null; tradeoff: string }[];
  cautions: string[];
}

const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

function choices() {
  const profiles = PLC_PROFILES.filter((p) => p.available && p.language === 'ladder' && p.autoChoose !== false);
  const cpus = profiles.flatMap((p) => p.cpuModels.map((c) => ({ profile: p, cpu: c })));
  const modules = partsIn('plcModule');
  const hmis = HMI_MODELS.filter((h) => h.touch);
  return { profiles, cpus, modules, hmis };
}

function schema() {
  const { profiles, cpus, modules, hmis } = choices();
  return obj({
    summary: { type: 'string' },
    estimatedIO: obj({
      digitalInputs: { type: 'integer' }, digitalOutputs: { type: 'integer' },
      analogInputs: { type: 'integer' }, analogOutputs: { type: 'integer' }, motionAxes: { type: 'integer' },
    }),
    plc: obj({
      profileId: { type: 'string', enum: profiles.map((p) => p.id) },
      cpuId: { type: 'string', enum: cpus.map((c) => c.cpu.id) },
      why: { type: 'string' },
    }),
    modules: { type: 'array', items: obj({ partNumber: { type: 'string', enum: modules.map((m) => m.partNumber) }, quantity: { type: 'integer' }, why: { type: 'string' } }) },
    hmi: { anyOf: [obj({ partNumber: { type: 'string', enum: hmis.map((h) => h.partNumber) }, why: { type: 'string' } }), { type: 'null' }] },
    alternatives: {
      type: 'array',
      items: obj({
        label: { type: 'string' },
        cpuId: { type: 'string', enum: cpus.map((c) => c.cpu.id) },
        hmiPartNumber: { anyOf: [{ type: 'string', enum: hmis.map((h) => h.partNumber) }, { type: 'null' }] },
        tradeoff: { type: 'string' },
      }),
    },
    cautions: { type: 'array', items: { type: 'string' } },
  });
}

function system(): string {
  const { cpus, modules, hmis } = choices();
  return `You are a senior controls engineer choosing the control equipment for a machine. The customer is not an equipment expert: explain choices in plain words.

Available PLCs (only these can be programmed by this tool today):
${cpus.map(({ profile, cpu }) => `- ${cpu.id} (${profile.vendor} ${profile.name}): ${cpu.builtInInputs} DC inputs, ${cpu.builtInOutputs} outputs built in. ${cpu.label}${cpu.notes ? ` ${cpu.notes}` : ''}`).join('\n')}
CLICK CPUs take up to 8 expansion modules. Model families: C0-0x = basic/standard without Ethernet, C0-1x = with Ethernet (needed for an Ethernet HMI), C0-x2 / C0-12 = with built-in analog. CLICK PLUS (C2-xx) has no built-in I/O.

Expansion modules (verified catalog):
${modules.map((m) => `- ${m.partNumber}: ${m.description}`).join('\n')}

Operator panels (C-more):
${hmis.map((h) => `- ${h.partNumber}: ${h.sizeIn}" ${h.widthPx}x${h.heightPx}${h.ethernet ? ', Ethernet' : ', no Ethernet'}${h.supportsClickEthernet ? '' : ' (no built-in Ethernet link to CLICK)'}`).join('\n')}

How to choose:
1. Estimate the I/O from the specification: count every sensor, switch, pushbutton, selector position, safety relay status, motor starter/VFD command and feedback, solenoid coil, pilot light and stack light color.
2. Add about 20% spare discrete points, rounded up to whole modules.
3. Pick the smallest suitable CPU. Prefer an Ethernet CPU (C0-1x) when there is an HMI, other machines on a network, or remote support is useful. Match output type to the loads: DC sinking/sourcing outputs for 24 VDC solenoids and pilot lights; relay outputs or modules when the spec has AC loads or mixed voltages.
4. Add analog modules only if the spec needs analog signals.
5. Recommend an HMI when the spec mentions screens, setpoints, recipes, alarms display, or manual jog; choose the size from the number of screens and how much the operator must see. Use null if the machine only needs pushbuttons and lights.
6. Give 1–2 alternatives (e.g. a cheaper option and one with more room for growth) with the trade-off.
7. "cautions": anything CLICK cannot do well or that needs other equipment (servo motion, safety PLC / safety-rated logic, high-speed counting beyond the CPU, more than 8 modules, special networks). Say what the customer would need instead. Also note information missing from the spec that changes the choice.
8. "modules" are in slot order (slot 1 first). quantity ≥ 1.`;
}

export async function recommendEquipment(opts: { apiKey: string; model: string; effort: Effort; signal?: AbortSignal; cache?: boolean; spec: SpecSections }): Promise<{ rec: EquipmentRecommendation; reasoning: string | null }> {
  const { text, reasoning } = await callClaude({
    apiKey: opts.apiKey, model: opts.model, effort: opts.effort, signal: opts.signal, cache: opts.cache, task: 'equipment',
    system: system(),
    messages: [{ role: 'user', content: `Machine specification:\n${specToText(opts.spec) || '(empty)'}\n\nRecommend the control equipment.` }],
    schema: schema(),
  });
  try {
    return { rec: JSON.parse(text) as EquipmentRecommendation, reasoning };
  } catch (err) {
    throw new Error('The AI returned a recommendation the app could not read. Please try again.', { cause: err });
  }
}

/** Expand module quantities into slot order. */
export function modulesInSlotOrder(rec: EquipmentRecommendation): string[] {
  return rec.modules.flatMap((m) => Array.from({ length: Math.max(1, m.quantity) }, () => m.partNumber)).slice(0, 8);
}
