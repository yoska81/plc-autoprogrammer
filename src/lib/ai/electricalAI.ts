import type { Effort } from '../../store/useSettingsStore';
import type { CpuModel, PlcProfile } from '../../plc/profile';
import type { IOPoint } from '../../types/io';
import type { DesignInputs, ElectricalDesign, FieldDeviceType } from '../../electrical/types';
import { CATALOG } from '../../electrical/catalog';
import { callClaude } from './anthropic';

const DEVICE_TYPES: FieldDeviceType[] = ['pushbutton-no', 'pushbutton-nc', 'selector', 'estop-contact', 'sensor-pnp', 'sensor-npn', 'limit-switch', 'pressure-switch', 'safety-relay-output', 'contactor-coil', 'relay-coil', 'solenoid', 'pilot-light', 'stack-light', 'vfd-input', 'other'];

const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

/** Part numbers and I/O addresses are enums, so the AI cannot invent either. */
function designSchema(addresses: string[]) {
  return obj({
    explanation: { type: 'string' },
    components: {
      type: 'array',
      items: obj({
        tag: { type: 'string' },
        partNumber: { type: 'string', enum: CATALOG.map((p) => p.partNumber) },
        quantity: { type: 'integer' },
        function: { type: 'string' },
        motorTag: { type: ['string', 'null'] },
      }),
    },
    ioWiring: {
      type: 'array',
      items: obj({
        address: addresses.length ? { type: 'string', enum: addresses } : { type: 'string' },
        deviceTag: { type: 'string' },
        deviceType: { type: 'string', enum: DEVICE_TYPES },
        description: { type: 'string' },
      }),
    },
    notes: { type: 'array', items: { type: 'string' } },
  });
}

function catalogText(): string {
  return CATALOG.map((p) => {
    const r = Object.entries(p.ratings).map(([k, v]) => `${k}=${v}`).join(', ');
    return `${p.partNumber} | ${p.category} | ${p.description}${r ? ` | ${r}` : ''}${p.verified ? '' : ' | (ratings unverified)'}`;
  }).join('\n');
}

const SYSTEM = `You are a senior electrical controls engineer designing an industrial control panel for a machine in North America. Your design is turned directly into the schematic drawings, panel layout, terminal plan and bill of materials, so it must be complete and buildable.

Design practice to follow:
- NFPA 79 and UL 508A practice: main disconnect with lockable handle, branch-circuit protection for every motor and for the control power supply, 24VDC control voltage, ground bar, and every field device wired through terminal blocks.
- Size motor branch protection and starters from the motor's full-load current (NEC Table 430.250 values for 3-phase motors) and the parts' ratings in the catalog. Size the 24VDC power supply for the PLC, I/O, sensors, solenoids, pilot lights, relay and contactor coils, with at least 25% margin.
- Choose PLC expansion modules so all I/O fits with about 20% spare points.
- E-stop: dual-channel E-stop into a safety relay that removes power from the motion outputs (contactor coils / VFD enable). PLC monitors the safety relay status.
- Choose the enclosure and back panel so the layout fits with about 25% spare space, and include DIN rail, wire duct, terminal blocks (feed-through, ground, end plates/stops), operator devices for each pushbutton/selector/pilot light input or output, and the field devices (sensors, solenoid valves) for the I/O list.
- Use the designer's required parts exactly as given.
- Use only part numbers from the catalog. If something needed is not in the catalog, leave it out and say so in "notes".
- Tags: CB (breakers), DS (disconnect), PS (power supply), K (contactors), OL (overloads), MP (motor protectors), VFD, CR (relays), SR (safety relay), TB (terminal strips), PB (pushbuttons), ES (E-stop), SS (selectors), PL (pilot lights), LS/PRS (sensors), SOL (solenoids), M (motors), PLC, ENC (enclosure).
- ioWiring: one entry for every PLC I/O point in the I/O list, with the field device tag and type.
- "notes": every assumption the engineer must confirm (motor FLA, cable lengths, sensor types, SCCR, local codes).
- "explanation": a short plain-language summary of the panel for the customer.`;

export async function generateElectricalDesign(opts: {
  apiKey: string; model: string; effort: Effort;
  profile: PlcProfile; cpu: CpuModel;
  io: IOPoint[]; addresses: Map<string, string>;
  machineDescription: string;
  inputs: DesignInputs;
}): Promise<{ design: ElectricalDesign; explanation: string; reasoning: string | null }> {
  const ioAddrs = opts.io.map((p) => opts.addresses.get(p.id) || '').filter(Boolean);
  const ioText = opts.io.map((p) => `${opts.addresses.get(p.id) || '(unassigned)'}\t${p.type}\t${p.category}\t${p.description || '(no description)'}`).join('\n') || '(no I/O yet)';
  const motors = opts.inputs.motors.map((m) => `${m.tag}: ${m.description}, ${m.hp} HP, ${m.voltage}, ${m.starter}${m.reversing ? ', reversing' : ''}`).join('\n') || '(none)';
  const required = opts.inputs.requiredParts.map((r) => `${r.partNumber} x${r.quantity}`).join('\n') || '(none)';

  const content = `Machine description:
${opts.machineDescription || '(not given)'}

PLC: ${opts.profile.vendor} ${opts.profile.name}, CPU ${opts.cpu.label}

Supply: ${opts.inputs.supply}. Enclosure: ${opts.inputs.enclosureRating}.
Designer notes: ${opts.inputs.notes || '(none)'}

Motors:
${motors}

Parts the designer already chose (must be used):
${required}

I/O list (address, type, category, description):
${ioText}

Catalog (part number | category | description | ratings):
${catalogText()}

Design the complete control panel.`;

  const { text, reasoning } = await callClaude({
    apiKey: opts.apiKey, model: opts.model, effort: opts.effort,
    system: SYSTEM, messages: [{ role: 'user', content }], schema: designSchema(ioAddrs),
  });

  let parsed: { explanation: string } & Pick<ElectricalDesign, 'components' | 'ioWiring' | 'notes'>;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error('The AI returned a design the app could not read. Please try again.', { cause: err });
  }
  return {
    design: { inputs: opts.inputs, components: parsed.components, ioWiring: parsed.ioWiring, notes: parsed.notes, generatedAt: new Date().toISOString() },
    explanation: parsed.explanation,
    reasoning,
  };
}
