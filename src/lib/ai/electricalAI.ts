import type { Effort } from '../../store/useSettingsStore';
import type { CpuModel, PlcProfile } from '../../plc/core/profile';
import type { IOPoint } from '../../types/io';
import type { DesignInputs, ElectricalDesign, FieldDeviceType, MotorSpec } from '../../electrical/types';
import type { Region } from '../../store/useProjectStore';
import { catalogFor, VENDORS } from '../../electrical/catalogs';
import { vendorPreference } from '../../store/useProjectStore';
import type { CatalogPart } from '../../electrical/types';
import { SUPPLY_INFO } from '../../standards/regions';
import { callClaude } from './anthropic';
import { NOTE_KINDS_RULE, NOTE_SCHEMA, normalizeNotes } from '../../components/questions/classify';
import { getPart } from '../../electrical/catalog';
import { smallestEnclosure, withEnclosure, type DrawingContext } from '../../electrical/derive';

const DEVICE_TYPES: FieldDeviceType[] = ['pushbutton-no', 'pushbutton-nc', 'selector', 'estop-contact', 'sensor-pnp', 'sensor-npn', 'limit-switch', 'pressure-switch', 'safety-relay-output', 'contactor-coil', 'relay-coil', 'solenoid', 'pilot-light', 'stack-light', 'vfd-input', 'other'];

const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

/** Part numbers and I/O addresses are enums, so the AI cannot invent either. */
function designSchema(addresses: string[], CATALOG: CatalogPart[]) {
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
    notes: { type: 'array', items: NOTE_SCHEMA },
    motors: {
      type: 'array',
      items: obj({
        tag: { type: 'string' },
        description: { type: 'string' },
        hp: { type: 'number' },
        voltage: { type: 'string', enum: Object.keys(SUPPLY_INFO) },
        starter: { type: 'string', enum: ['contactor-overload', 'motor-protector', 'vfd'] },
        reversing: { type: 'boolean' },
      }),
    },
  });
}

/** Notes of the vendors whose parts are in the catalog given to the AI. */
function vendorNotes(parts: CatalogPart[]): string {
  const ids = new Set(parts.map((p) => p.vendor ?? 'automationdirect'));
  return VENDORS.filter((v) => ids.has(v.id)).map((v) => `- ${v.name}: ${v.notes}`).join('\n');
}

function catalogText(CATALOG: CatalogPart[]): string {
  return CATALOG.map((p) => {
    // Source URLs (ratingsSource / footprintSource) are for people checking the data, not for the AI.
    const r = Object.entries(p.ratings).filter(([k]) => !k.endsWith('Source')).map(([k, v]) => `${k}=${v}`).join(', ');
    return `${p.partNumber} | ${p.category} | ${p.manufacturer ? `${p.manufacturer} ` : ''}${p.description}${r ? ` | ${r}` : ''}${p.verified ? '' : ' | (ratings unverified)'}`;
  }).join('\n');
}

const IEC_RULE = (where: string) => `${where}: IEC 60204-1 (electrical equipment of machines) and IEC 61439-1/-2 (the panel as a low-voltage assembly) instead of NFPA 79 / UL 508A / NEC. Supply is 50 Hz (typically 400/230 V 3-phase + N, TN system; 230 V single-phase or 690 V for large drives). Main switch per IEC 60204-1 §5.3 (lockable, red handle on yellow when it is also the emergency switching-off device). Protect circuits with IEC 60898-1 / IEC 60947-2 MCBs — curve B for resistive loads, C for power supplies, control transformers and general use, D for high inrush — and motors with IEC 60947-2/-4-1 motor circuit breakers (motor protectors, set to the motor's rated current from IEC 60947-4-1 Annex G at the supply voltage) or contactor + overload with fuses/MCB. Size conductors in mm² per IEC 60204-1 Table 6 (copper, 40 °C; 1.5 mm² minimum for power in the enclosure, 0.75 mm² for control) and use the IEC 60204-1 §13.2 colours: black power, red AC control, blue DC control, orange for interlock circuits supplied from outside, light blue neutral, green-yellow PE. Control voltage 24 V DC (PELV). Functional safety per EN ISO 13849-1 (PL) or IEC 62061 (SIL): state the required PLr in "notes". Enclosure: give the IP rating (IEC 60529, e.g. IP54) in notes. Prefer catalog parts that carry IEC ratings (Fuji SC-E/SZ, IEC-rated breakers); say in "notes" which parts must be replaced by IEC-certified (CE-marked) equivalents.`;

const REGION_RULES: Record<Region, string> = {
  US: 'United States: NEC (NFPA 70), NFPA 79 and UL 508A. Protect branch circuits with UL 489 circuit breakers (or UL 489 motor protectors / manual motor controllers listed for group installation); control circuits with UL 489 breakers or Class CC fuses. Mark the panel SCCR per UL 508A Supplement SB.',
  Canada: 'Canada: CEC (CSA C22.1) and CSA C22.2 No. 14, CSA C22.2 No. 286 panel practice. Protect branch circuits and the control transformer with HRC fuses (Class J or CC in fuse holders / fused disconnect) rather than breakers. Typical supply is 600 V 3-phase (347/600 V); size parts for 600 V. Use CSA-certified parts.',
  EU: IEC_RULE('Europe (CE / UKCA)') + ' The machine needs CE marking (Machinery Directive 2006/42/EC, Machinery Regulation (EU) 2023/1230 from 20 January 2027; Low Voltage and EMC directives) or UKCA in Great Britain: note that the risk assessment (EN ISO 12100), technical file and declaration of conformity are needed.',
  Israel: IEC_RULE('Israel') + ' Israel adopts IEC 60204-1 as SI 60204 part 1; supply 400/230 V 50 Hz. Note in "notes" that the site earthing system (TN-C-S/TN-S or TT under the Electricity Regulations) must be confirmed and that installation is by a licensed electrician.',
  IEC: IEC_RULE('IEC country') + ' Note in "notes" that local wiring rules and the marking/approval the destination country requires must be confirmed.',
};

const SYSTEM = `You are a senior electrical controls engineer designing an industrial control panel for a machine (North America or an IEC country, see "Electrical code"). Your design is turned directly into the schematic drawings, panel layout, terminal plan and bill of materials, so it must be complete and buildable.

Design practice to follow:
- Follow the electrical code given in the request (see "Electrical code" below for the region's rules).
- NFPA 79 / UL 508A (US), CSA C22.2 No. 14 / CEC (Canada) or IEC 60204-1 / IEC 61439 (IEC regions) practice: main disconnect with lockable handle, branch-circuit protection for every motor and for the control power supply, 24VDC control voltage, ground bar, and every field device wired through terminal blocks.
- Size motor branch protection and starters from the motor's full-load current (NEC Table 430.250 values for 3-phase motors; IEC regions: IEC 60947-4-1 Annex G rated currents) and the parts' ratings in the catalog. Size the 24VDC power supply for the PLC, I/O, sensors, solenoids, pilot lights, relay and contactor coils, with at least 25% margin.
- Choose PLC expansion modules so all I/O fits with about 20% spare points.
- E-stop: dual-channel E-stop into a safety relay that removes power from the motion outputs (contactor coils / VFD enable). PLC monitors the safety relay status.
- VFD motors that must stop on E-stop: dropping the PLC run signal is NOT a safety function. DURApulse GS20 (GS2x part numbers): wire Safe Torque Off STO1/STO2 from the safety relay output — put "STO from safety relay" in the VFD component's function (the factory jumper is removed; stop category 0). GS10 (GS1x) has no STO: add a contactor in that motor's branch (motorTag set) whose coil is on the safety relay output.
- Safety relay reset: use manual (monitored) reset for the E-stop circuit, so releasing the E-stop never restarts anything. Whenever the safety relay has a manual / monitored reset input (e.g. S33–S34), add a dedicated momentary reset pushbutton — blue (GCX1104), on the cabinet door, tag PB…, function "Safety reset" — wired to that reset input in series with the NC feedback (EDM) contacts of the contactors the relay switches. Never leave the reset input unconnected, never reuse the Start button for it, and list the button in the components even though it is not a PLC I/O point.
- Guarding: light curtains (two OSSD outputs), safety mats and interlocked guard doors go into a safety relay channel, the same way as the E-stop. Use one safety relay per independent safety zone when the spec says a zone stops only part of the machine (e.g. one per pallet position), and give each its own reset and PLC status input. Muting, robot-zone and similar functions the catalog's relays can't do: say so in "notes" and recommend a safety controller.
- Other equipment (robot, other machines): handshake outputs go through interposing relays (category relay, dry contacts to the other controller); never wire PLC outputs straight into another manufacturer's controller. The other machine's E-stop and safety must be linked through the safety relays (state this in "notes" when the spec does not say how).
- Contactor feedback (EDM): every contactor switched by a safety relay feeds back through one of its N.C. auxiliary contacts. Fuji SC-E02(G)…SC-E4(G) contactors have NO built-in auxiliary contact, so add an SZ-A11T front auxiliary block (N.O. 53-54 / N.C. 61-62) for each such contactor: tag <contactor>-AUX (e.g. K1-AUX), function "<contactor> aux contact", motorTag = that contactor's motor, quantity 1. Reversing interlocks need the same blocks.
- Choose the enclosure and back panel so the layout fits with about 25% spare space, and include DIN rail, wire duct, terminal blocks (feed-through, ground, end plates/stops), operator devices for each pushbutton/selector/pilot light input or output, and the field devices (sensors, solenoid valves) for the I/O list.
- Check every part's input voltage against what feeds it. The 24VDC power supplies take single-phase ~90–276 VAC: on a 208/240 V supply feed one from two phases or line-neutral; on a 480 V or 600 V supply use a control power transformer (480/600→120 VAC, sized for the load with margin, with primary fuses) or a 3-phase power supply rated for that voltage if the catalog has one. Most catalog breakers and motor protectors are not rated for 600 V: on 600 V use fuses and parts whose catalog voltage rating is 600 V. Never connect a part to a voltage above its rating; if the catalog has no suitable part, say so in "notes".
- 24VDC distribution protection: a supply that can deliver more current than the 24VDC wiring is rated for needs branch protection on its outputs (fused terminal blocks or DC-rated miniature breakers from the catalog). Rule of thumb: 18 AWG control wiring max 7 A, 16 AWG max 10 A, 14 AWG max 15 A — protect each 24VDC branch at or below its wire rating, and say in "notes" which branches you protected.
- Use the designer's required parts exactly as given.
- Catalog specifics: follow the per-brand notes given with the catalog.
- Every E-stop operator gets a yellow "EMERGENCY STOP" legend plate behind it (red on yellow, NFPA 79 10.7.2 / IEC 60204-1 10.7.2) when the catalog has one.
- Use only part numbers from the catalog. If something needed is not in the catalog, leave it out and say so in "notes".
- Tags: CB (breakers), DS (disconnect), PS (power supply), K (contactors), OL (overloads), MP (motor protectors), VFD, CR (relays), SR (safety relay), TB (terminal strips), PB (pushbuttons), ES (E-stop), SS (selectors), PL (pilot lights), LS/PRS (sensors), SOL (solenoids), M (motors), PLC, ENC (enclosure).
- ioWiring: one entry for every PLC I/O point in the I/O list, with the field device tag, type, and "location": "Cabinet door" for pushbuttons, selectors, pilot lights and the E-stop on the panel; "Cabinet" for devices inside it (safety relay status, overload contacts); otherwise the machine zone where the device is mounted (e.g. "Infeed conveyor", "Pusher station").
- machine: the field (machine) wiring outside the cabinet. "zones" = the machine areas from the specification in order. Put a junction box (tags JB1, JB2…) in each zone that has 4 or more field devices, so one multi-core trunk cable runs from the cabinet to the box; other devices get a home-run cable straight to the cabinet terminals. "routing" gives every field device tag its junction box tag or null. "motorLocations" gives each motor's zone. A junction box partNumber may be a small catalog enclosure, else null.
- "notes": every assumption that must be confirmed (motor FLA, cable lengths, sensor types, SCCR, local codes).
${NOTE_KINDS_RULE}
- "motors": every motor the panel drives: the designer's motor list exactly as given, plus any other motor the specification mentions (estimate HP from the description when not stated and say so in "notes").
- "explanation": a short plain-language summary of the panel for the customer.`;

export async function generateElectricalDesign(opts: {
  apiKey: string; model: string; effort: Effort; signal?: AbortSignal;
  profile: PlcProfile; cpu: CpuModel;
  io: IOPoint[]; addresses: Map<string, string>;
  machineDescription: string;
  inputs: DesignInputs;
  /** Electrical code region; default US. */
  region?: Region;
  /** Parts the AI may use; default: the project's preferred vendors. */
  catalog?: CatalogPart[];
}): Promise<{ design: ElectricalDesign; explanation: string; reasoning: string | null }> {
  // Only the project's preferred brands (AutomationDirect where they offer nothing in a category).
  const catalog = opts.catalog ?? catalogFor(vendorPreference());
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

Design the complete control panel from the catalog above.`;
  // The catalog goes first, as its own block marked for prompt caching: it is the same for every
  // design with the same preferred brands, so a regeneration / Update all / retry reuses it.
  const catalogBlock = `Catalog (part number | category | manufacturer description | ratings):
${catalogText(catalog)}

Catalog specifics per brand:
${vendorNotes(catalog)}`;

  const { text, reasoning } = await callClaude({
    apiKey: opts.apiKey, model: opts.model, effort: opts.effort, signal: opts.signal,
    system: SYSTEM,
    messages: [{ role: 'user', content: [{ type: 'text', text: catalogBlock, cache_control: { type: 'ephemeral' } }, { type: 'text', text: content }] }],
    schema: designSchema(ioAddrs, catalog),
  });

  let parsed: { explanation: string; motors: MotorSpec[]; machine: {
    zones: string[];
    junctionBoxes: { tag: string; location: string; partNumber: string | null }[];
    motorLocations: { motorTag: string; location: string }[];
    routing: { deviceTag: string; junctionBox: string | null }[];
  } } & Pick<ElectricalDesign, 'components' | 'ioWiring'> & { notes: unknown };
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error('The AI returned a design the app could not read. Please try again.', { cause: err });
  }
  const notes = normalizeNotes(parsed.notes);
  const design: ElectricalDesign = {
      inputs: { ...opts.inputs, motors: parsed.motors },
      components: parsed.components,
      ioWiring: parsed.ioWiring,
      notes: notes.map((n) => n.text),
      askUser: notes.filter((n) => n.kind !== 'issue').map((n) => n.text),
      machine: {
        zones: parsed.machine.zones,
        junctionBoxes: parsed.machine.junctionBoxes,
        motorLocations: Object.fromEntries(parsed.machine.motorLocations.map((m) => [m.motorTag, m.location])),
        routing: Object.fromEntries(parsed.machine.routing.map((r) => [r.deviceTag, r.junctionBox])),
      },
      generatedAt: new Date().toISOString(),
  };
  return { design: sizeEnclosure(design, opts), explanation: parsed.explanation, reasoning };
}

/**
 * The AI can't lay out the back panel, so its enclosure choice is checked against the real part
 * footprints: when the parts don't fit with 25 % spare space, the smallest catalog enclosure (and
 * subpanel) that does replaces it, with a note saying so.
 */
function sizeEnclosure(design: ElectricalDesign, opts: { profile: PlcProfile; cpu: CpuModel; io: IOPoint[]; addresses: Map<string, string>; region?: Region }): ElectricalDesign {
  const ctx: DrawingContext = {
    projectName: '', design, getPart, region: opts.region,
    plc: { vendor: opts.profile.vendor, name: opts.profile.name, cpuPartNumber: opts.cpu.id, cpuLabel: opts.cpu.label },
    io: opts.io.map((p) => ({ address: opts.addresses.get(p.id) ?? '', description: p.description, type: p.type })),
  };
  let fit;
  try { fit = smallestEnclosure(ctx); } catch { return design; } // sizing is advice: never lose the design over it
  if (!fit || fit.current) return design;
  const enc = design.components.find((c) => getPart(c.partNumber)?.category === 'enclosure' && String(getPart(c.partNumber)?.ratings.kind ?? '') !== 'subpanel');
  const { components } = withEnclosure(design, getPart, fit.enclosure, fit.subpanel);
  const note = `Enclosure sized from the part footprints: ${enc ? `${enc.partNumber} was too small; ` : ''}using ${fit.enclosure}${fit.subpanel ? ` with back panel ${fit.subpanel}` : ''} (${Math.round(fit.spare * 100)} % spare space).`;
  return { ...design, components, notes: [...design.notes, note] };
}
