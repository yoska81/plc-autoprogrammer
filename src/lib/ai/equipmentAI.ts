import type { Effort } from '../../store/useSettingsStore';
import { PLC_PROFILES } from '../../plc/core/profiles';
import { getPart, partsIn } from '../../electrical/catalog';
import { hmiFit, platformOf, type Need } from '../../plc/core/fit';
import { allPanelRows } from '../../hmi/panelRows';
import type { HmiModel } from '../../hmi/hmiCatalog';
import { specToText, type SpecSections } from '../../spec/types';
import { choosableProfiles, namesSlio, plcPreference, requestedProfiles, unsupportedBrands } from '../../spec/brand';
import { callClaude } from './anthropic';
import { specForAI } from './specForAI';

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

const NO_NEED: Need = { digitalInputs: 0, digitalOutputs: 0, analogInputs: 0, analogOutputs: 0, ethernetHmi: true, minHmiSizeIn: null };

export function equipmentChoices(specText: string, preferredPlcVendors: string[]) {
  // No brand asked for: the PLCs the tool picks on its own (CLICK; every brand's CPUs, modules and panels would make
  // each suggestion several times the cost). A machine no CLICK can hold is said, and the page offers a bigger brand.
  const asked = requestedProfiles(specText, preferredPlcVendors);
  const profiles = choosableProfiles(specText, preferredPlcVendors);
  // a Yaskawa SLIO CPU sits in the Siemens profile (TIA Portal programs it as an S7-300): offered only when named,
  // and then alone (a description naming Siemens S7 is not answered with a Yaskawa CPU)
  const slio = namesSlio(specText);
  const cpus = profiles.flatMap((p) => p.cpuModels.filter((c) => (platformOf(c.id)?.id === 'yaskawa-slio') === (slio && p.id === 'siemens-s7') || p.id !== 'siemens-s7').map((c) => ({ profile: p, cpu: c })));
  // Expansion modules of the chosen brands' platforms; CLICK's own modules for CLICK.
  const pns = new Set(cpus.flatMap(({ cpu }) => platformOf(cpu.id)?.modules ?? []));
  const modules = [
    ...(profiles.some((p) => p.id === 'click') ? partsIn('plcModule').filter((m) => /^C0-/.test(m.partNumber)) : []),
    ...[...pns].map((pn) => getPart(pn)).filter((m): m is NonNullable<typeof m> => Boolean(m)),
  ];
  // Touch panels that talk to at least one of these PLCs (the same check as the Equipment page), current ones only.
  // The screen of an all-in-one PLC comes with that CPU, not from this list.
  const firstCpus = [...new Set(cpus.map(({ cpu }) => platformOf(cpu.id)?.id ?? 'click'))].map((id) => cpus.find(({ cpu }) => (platformOf(cpu.id)?.id ?? 'click') === id)!.cpu.id);
  const hmis: HmiModel[] = allPanelRows()
    .filter((r) => r.model && !r.legacy && !r.builtIn && firstCpus.some((id) => hmiFit(r.model!, NO_NEED, id).ok))
    .map((r) => r.model!);
  return { profiles, cpus, modules, hmis, open: !asked.length };
}

function choices(spec?: SpecSections) {
  return equipmentChoices(spec ? specToText(spec) : '', plcPreference());
}

function schema(spec: SpecSections) {
  const { profiles, cpus, modules, hmis } = choices(spec);
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

/** The equipment prompt for a specification (exported for tests). */
export function equipmentSystemPrompt(spec: SpecSections | string): string {
  return system(typeof spec === 'string' ? ({ overview: spec } as SpecSections) : spec);
}

function system(spec: SpecSections): string {
  const { profiles, cpus, modules, hmis, open } = choices(spec);
  const click = profiles.some((p) => p.id === 'click');
  const brands = [...new Set(profiles.map((p) => p.vendor))].join(' / ');
  const notHere = unsupportedBrands(specToText(spec));
  return `You are a senior controls engineer choosing the control equipment for a machine. The customer is not an equipment expert: explain choices in plain words.

Available PLCs (${brands}; only these can be programmed by this tool${profiles.length < PLC_PROFILES.filter((p) => p.available).length ? ', and the customer asked for this brand or prefers it' : ' today'}):
${cpus.map(({ profile, cpu }) => `- ${cpu.id} (${profile.vendor} ${profile.name}): ${cpu.builtInInputs} DC inputs, ${cpu.builtInOutputs} outputs built in. ${cpu.label}${cpu.notes ? ` ${cpu.notes}` : ''}`).join('\n')}
${click ? `CLICK CPUs take up to 8 expansion modules. Model families: C0-0x = basic/standard without Ethernet, C0-1x = with Ethernet (needed for an Ethernet HMI), C0-x2 / C0-12 = with built-in analog. CLICK PLUS (C2-xx) has no built-in I/O.\n` : ''}
Expansion modules (verified catalog; use only modules of the chosen CPU's family):
${modules.map((m) => `- ${m.partNumber}: ${m.description}`).join('\n')}

Operator panels that talk to these PLCs:
${hmis.map((h) => `- ${h.partNumber}${h.manufacturer ? ` (${h.manufacturer})` : ''}: ${h.sizeIn}" ${h.widthPx}x${h.heightPx}${h.ethernet ? ', Ethernet' : ', no Ethernet'}${!h.catalog && click && !h.supportsClickEthernet ? ' (no built-in Ethernet link to CLICK)' : ''}`).join('\n')}

How to choose:
1. Estimate the I/O from the specification: count every sensor, switch, pushbutton, selector position, safety relay status, motor starter/VFD command and feedback, solenoid coil, pilot light and stack light color.
2. Add about 20% spare discrete points, rounded up to whole modules.
3. Pick the smallest suitable CPU from the list. If the specification names a PLC brand or family, choose only from that brand.${open ? ' No brand was asked for, so only CLICK is offered here. If no CLICK can do the job (more I/O than a fully expanded CLICK holds, servo axes on a motion network), still give the closest CLICK, but start the summary with "Needs a bigger PLC than a CLICK:" and say why in one sentence (the customer then chooses a bigger brand).' : ''} Prefer a CPU with Ethernet when there is an HMI, other machines on a network, or remote support is useful. Match output type to the loads: DC sinking/sourcing outputs for 24 VDC solenoids and pilot lights; relay outputs or modules when the spec has AC loads or mixed voltages.
4. Add analog modules only if the spec needs analog signals.
5. Recommend an HMI when the spec mentions screens, setpoints, recipes, alarms display, or manual jog; choose the size from the number of screens and how much the operator must see. Use null if the machine only needs pushbuttons and lights, or when the chosen PLC has its own touch screen.
6. Give 1–2 alternatives (e.g. a cheaper option and one with more room for growth) with the trade-off.
7. "cautions": anything the chosen PLC cannot do well or that needs other equipment (servo motion, safety PLC / safety-rated logic, high-speed counting beyond the CPU, more modules than the CPU takes, special networks). Say what the customer would need instead. Also note information missing from the spec that changes the choice.
8. "modules" are in slot order (slot 1 first). quantity ≥ 1.${notHere.length ? `
9. The specification names a ${notHere.join(' / ')} PLC, which this tool cannot program yet. Choose from the list above, and make the first caution say so in plain words: "${notHere.join(' / ')} PLC isn't supported yet — using <the CPU you chose>."` : ''}`;
}

export async function recommendEquipment(opts: { apiKey: string; model: string; effort: Effort; signal?: AbortSignal; cache?: boolean; spec: SpecSections }): Promise<{ rec: EquipmentRecommendation; reasoning: string | null }> {
  const { text, reasoning } = await callClaude({
    apiKey: opts.apiKey, model: opts.model, effort: opts.effort, signal: opts.signal, cache: opts.cache, task: 'equipment',
    system: system(opts.spec),
    messages: [{ role: 'user', content: `Machine specification:\n${specForAI(opts.spec, 'equipment') || '(empty)'}\n\nRecommend the control equipment.` }],
    schema: schema(opts.spec),
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
