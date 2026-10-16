import type { Effort } from '../../store/useSettingsStore';
import type { CpuModel, PlcProfile } from '../../plc/core/profile';
import type { IOPoint } from '../../types/io';
import type { DesignInputs, ElectricalDesign, FieldDeviceType, MotorSpec } from '../../electrical/types';
import type { Region } from '../../store/useProjectStore';
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
        location: { type: 'string' },
      }),
    },
    machine: obj({
      zones: { type: 'array', items: { type: 'string' } },
      junctionBoxes: { type: 'array', items: obj({ tag: { type: 'string' }, location: { type: 'string' }, partNumber: { anyOf: [{ type: 'string', enum: CATALOG.filter((c) => c.category === 'enclosure' && c.ratings.kind !== 'subpanel').map((c) => c.partNumber) }, { type: 'null' }] } }) },
      motorLocations: { type: 'array', items: obj({ motorTag: { type: 'string' }, location: { type: 'string' } }) },
      routing: { type: 'array', items: obj({ deviceTag: { type: 'string' }, junctionBox: { type: ['string', 'null'] } }) },
    }),
    notes: { type: 'array', items: { type: 'string' } },
    motors: {
      type: 'array',
      items: obj({
        tag: { type: 'string' },
        description: { type: 'string' },
        hp: { type: 'number' },
        voltage: { type: 'string', enum: ['120VAC-1PH', '208VAC-3PH', '240VAC-3PH', '480VAC-3PH', '600VAC-3PH'] },
        starter: { type: 'string', enum: ['contactor-overload', 'motor-protector', 'vfd'] },
        reversing: { type: 'boolean' },
      }),
    },
  });
}

function catalogText(): string {
  return CATALOG.map((p) => {
    const r = Object.entries(p.ratings).map(([k, v]) => `${k}=${v}`).join(', ');
    return `${p.partNumber} | ${p.category} | ${p.description}${r ? ` | ${r}` : ''}${p.verified ? '' : ' | (ratings unverified)'}`;
  }).join('\n');
}

const REGION_RULES: Record<Region, string> = {
  US: 'United States: NEC (NFPA 70), NFPA 79 and UL 508A. Protect branch circuits with UL 489 circuit breakers (or UL 489 motor protectors / manual motor controllers listed for group installation); control circuits with UL 489 breakers or Class CC fuses. Mark the panel SCCR per UL 508A Supplement SB.',
  Canada: 'Canada: CEC (CSA C22.1) and CSA C22.2 No. 14, CSA C22.2 No. 286 panel practice. Protect branch circuits and the control transformer with HRC fuses (Class J or CC in fuse holders / fused disconnect) rather than breakers. Typical supply is 600 V 3-phase (347/600 V); size parts for 600 V. Use CSA-certified parts.',
};

const SYSTEM = `You are a senior electrical controls engineer designing an industrial control panel for a machine in North America. Your design is turned directly into the schematic drawings, panel layout, terminal plan and bill of materials, so it must be complete and buildable.

Design practice to follow:
- Follow the electrical code given in the request (see "Electrical code" below for the region's rules).
- NFPA 79 / UL 508A (US) or CSA C22.2 No. 14 / CEC (Canada) practice: main disconnect with lockable handle, branch-circuit protection for every motor and for the control power supply, 24VDC control voltage, ground bar, and every field device wired through terminal blocks.
- Size motor branch protection and starters from the motor's full-load current (NEC Table 430.250 values for 3-phase motors) and the parts' ratings in the catalog. Size the 24VDC power supply for the PLC, I/O, sensors, solenoids, pilot lights, relay and contactor coils, with at least 25% margin.
- Choose PLC expansion modules so all I/O fits with about 20% spare points.
- E-stop: dual-channel E-stop into a safety relay that removes power from the motion outputs (contactor coils / VFD enable). PLC monitors the safety relay status.
- Safety relay reset: use manual (monitored) reset for the E-stop circuit, so releasing the E-stop never restarts anything. Whenever the safety relay has a manual / monitored reset input (e.g. S33–S34), add a dedicated momentary reset pushbutton — blue (GCX1104), on the cabinet door, tag PB…, function "Safety reset" — wired to that reset input in series with the NC feedback (EDM) contacts of the contactors the relay switches. Never leave the reset input unconnected, never reuse the Start button for it, and list the button in the components even though it is not a PLC I/O point.
- Choose the enclosure and back panel so the layout fits with about 25% spare space, and include DIN rail, wire duct, terminal blocks (feed-through, ground, end plates/stops), operator devices for each pushbutton/selector/pilot light input or output, and the field devices (sensors, solenoid valves) for the I/O list.
- Check every part's input voltage against what feeds it. The 24VDC power supplies take single-phase ~90–276 VAC: on a 208/240 V supply feed one from two phases or line-neutral; on a 480 V or 600 V supply use a control power transformer (480/600→120 VAC, sized for the load with margin, with primary fuses) or a 3-phase power supply rated for that voltage if the catalog has one. Most catalog breakers and motor protectors are not rated for 600 V: on 600 V use fuses and parts whose catalog voltage rating is 600 V. Never connect a part to a voltage above its rating; if the catalog has no suitable part, say so in "notes".
- Use the designer's required parts exactly as given.
- Catalog specifics: an enclosure needs its matching subpanel (enclosure category, ratings kind=subpanel). The rotary disconnect needs its switch, a handle and a shaft. A reversing starter is two contactors plus SZ-RM, SZ-ERW1A and SZ-ERW1B. For a dual-channel E-stop into a safety relay, add an ECX1030-2 contact block to the E-stop. Order terminal end covers/brackets and markers with the terminal blocks.
- Use only part numbers from the catalog. If something needed is not in the catalog, leave it out and say so in "notes".
- Tags: CB (breakers), DS (disconnect), PS (power supply), K (contactors), OL (overloads), MP (motor protectors), VFD, CR (relays), SR (safety relay), TB (terminal strips), PB (pushbuttons), ES (E-stop), SS (selectors), PL (pilot lights), LS/PRS (sensors), SOL (solenoids), M (motors), PLC, ENC (enclosure).
- ioWiring: one entry for every PLC I/O point in the I/O list, with the field device tag, type, and "location": "Cabinet door" for pushbuttons, selectors, pilot lights and the E-stop on the panel; "Cabinet" for devices inside it (safety relay status, overload contacts); otherwise the machine zone where the device is mounted (e.g. "Infeed conveyor", "Pusher station").
- machine: the field (machine) wiring outside the cabinet. "zones" = the machine areas from the specification in order. Put a junction box (tags JB1, JB2…) in each zone that has 4 or more field devices, so one multi-core trunk cable runs from the cabinet to the box; other devices get a home-run cable straight to the cabinet terminals. "routing" gives every field device tag its junction box tag or null. "motorLocations" gives each motor's zone. A junction box partNumber may be a small catalog enclosure, else null.
- "notes": every assumption the engineer must confirm (motor FLA, cable lengths, sensor types, SCCR, local codes).
- "motors": every motor the panel drives: the designer's motor list exactly as given, plus any other motor the specification mentions (estimate HP from the description when not stated and say so in "notes").
- "explanation": a short plain-language summary of the panel for the customer.`;

export async function generateElectricalDesign(opts: {
  apiKey: string; model: string; effort: Effort;
  profile: PlcProfile; cpu: CpuModel;
  io: IOPoint[]; addresses: Map<string, string>;
  machineDescription: string;
  inputs: DesignInputs;
  /** Electrical code region; default US. */
  region?: Region;
}): Promise<{ design: ElectricalDesign; explanation: string; reasoning: string | null }> {
  const ioAddrs = opts.io.map((p) => opts.addresses.get(p.id) || '').filter(Boolean);
  const ioText = opts.io.map((p) => `${opts.addresses.get(p.id) || '(unassigned)'}\t${p.type}\t${p.category}\t${p.description || '(no description)'}`).join('\n') || '(no I/O yet)';
  const motors = opts.inputs.motors.map((m) => `${m.tag}: ${m.description}, ${m.hp} HP, ${m.voltage}, ${m.starter}${m.reversing ? ', reversing' : ''}`).join('\n') || '(none)';
  const required = opts.inputs.requiredParts.map((r) => `${r.partNumber} x${r.quantity}`).join('\n') || '(none)';

  const content = `Machine description:
${opts.machineDescription || '(not given)'}

PLC: ${opts.profile.vendor} ${opts.profile.name}, CPU ${opts.cpu.label}

Electrical code: ${REGION_RULES[opts.region ?? 'US']}

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

  let parsed: { explanation: string; motors: MotorSpec[]; machine: {
    zones: string[];
    junctionBoxes: { tag: string; location: string; partNumber: string | null }[];
    motorLocations: { motorTag: string; location: string }[];
    routing: { deviceTag: string; junctionBox: string | null }[];
  } } & Pick<ElectricalDesign, 'components' | 'ioWiring' | 'notes'>;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error('The AI returned a design the app could not read. Please try again.', { cause: err });
  }
  return {
    design: {
      inputs: { ...opts.inputs, motors: parsed.motors },
      components: parsed.components,
      ioWiring: parsed.ioWiring,
      notes: parsed.notes,
      machine: {
        zones: parsed.machine.zones,
        junctionBoxes: parsed.machine.junctionBoxes,
        motorLocations: Object.fromEntries(parsed.machine.motorLocations.map((m) => [m.motorTag, m.location])),
        routing: Object.fromEntries(parsed.machine.routing.map((r) => [r.deviceTag, r.junctionBox])),
      },
      generatedAt: new Date().toISOString(),
    },
    explanation: parsed.explanation,
    reasoning,
  };
}
