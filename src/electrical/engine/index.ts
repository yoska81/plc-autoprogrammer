/**
 * Rule-based electrical design engine: machine model + I/O list + supply/region + vendor preference
 * in, complete ElectricalDesign out — no AI involved. The AI (src/lib/ai/machineModelAI.ts) only
 * fills the MachineModel; without it `defaultMachineModel` does, so a simple machine always gets a
 * valid, buildable design. Sizing follows the same rules the drawings and checkers use (derive.ts).
 */
import type { IOPoint } from '../../types/io';
import type { AnalogSetupRow } from '../../plc/core/analog';
import type { Region } from '../../standards/regions';
import { enclosureText, powerText, SUPPLY_INFO } from '../../standards/regions';
import { DEFAULT_PREFERENCE, type VendorPreference } from '../catalogs';
import { panelLayout, spareSpace, terminalCounts, motorFla, type DrawingContext } from '../derive';
import { DC_LOAD_A } from '../../deliverables/docs/calcs';
import { getHmi } from '../../hmi/hmiCatalog';
import type { CatalogCategory, CatalogPart, DesignComponent, DesignInputs, ElectricalDesign, MotorSpec } from '../types';
import { defaultMachineModel, type MachineModel } from './machineModel';
import { comp, controlPower, mainDisconnect, motorBranches, Tags } from './power';
import { devicesAndWiring, motorFor, OVER_TEMP_RE } from './devices';
import { processLoads } from './process';
import { num, Picker } from './select';

export { defaultMachineModel, type MachineModel } from './machineModel';

export interface EngineInput {
  model: MachineModel;
  /** Supply, enclosure rating, designer notes and required parts (motors come from the model). */
  inputs: DesignInputs;
  io: IOPoint[];
  /** I/O point id -> PLC address. */
  addresses: Map<string, string>;
  plc: DrawingContext['plc'];
  /** PLC expansion modules in slot order (part numbers). */
  modules: string[];
  region?: Region;
  pref?: VendorPreference;
  getPart: (partNumber: string) => CatalogPart | undefined;
  hmiPartNumber?: string | null;
  analog?: AnalogSetupRow[];
  projectName?: string;
  /** Timestamp for generatedAt (tests pass a fixed one). */
  now?: string;
}

export interface EngineResult {
  design: ElectricalDesign;
  explanation: string;
  /** The enclosure chosen has ≥ 25% spare panel space and everything fits. */
  layoutOk: boolean;
}

const TAG_PREFIX: Partial<Record<CatalogCategory, string>> = {
  breaker: 'CB', fuse: 'FU', powerSupply: 'PS', contactor: 'K', overload: 'OL', motorProtector: 'MP', vfd: 'VFD', relay: 'CR',
  safetyRelay: 'SR', pushbutton: 'PB', estop: 'ES', pilotLight: 'PL', selector: 'SS', stackLight: 'STK', sensor: 'PX',
  solenoidValve: 'SOL', plcModule: 'IO', hmi: 'HMI', fan: 'FAN',
};

/** Typical 24 VDC draw of the design (same figures as the calculations document). */
function dcLoad(components: DesignComponent[], getPart: EngineInput['getPart'], hmiPartNumber: string | null | undefined, fieldInputs: number): number {
  let a = 0;
  for (const c of components) {
    const p = getPart(c.partNumber);
    if (!p) continue;
    if (p.category === 'solenoidValve') a += ((num(p.ratings.watts) ?? 2) / 24) * c.quantity;
    else if (p.category === 'contactor' && !/24/.test(String(p.ratings.coilVoltage ?? ''))) continue;
    else a += (DC_LOAD_A[p.category] ?? 0) * c.quantity;
  }
  const hmi = hmiPartNumber ? getHmi(hmiPartNumber) : undefined;
  if (hmi) a += hmi.sizeIn >= 10 ? 1.0 : 0.6;
  return a + fieldInputs * 0.03;
}

function enclosureCandidates(pk: Picker, rating: DesignInputs['enclosureRating'] | undefined): CatalogPart[] {
  const stainless = rating === 'NEMA 4X';
  const n = (rating ?? 'NEMA 12').replace('NEMA ', '');
  const all = pk.candidates('enclosure').filter((p) => p.ratings.kind === 'enclosure');
  const fit = all.filter((p) => (stainless ? /stainless/i.test(String(p.ratings.material ?? '')) : !/stainless/i.test(String(p.ratings.material ?? '')))
    && (n === '1' || String(p.ratings.nema ?? '').split('/').includes(n)));
  const area = (p: CatalogPart) => (num(p.ratings.heightIn) ?? 0) * (num(p.ratings.widthIn) ?? 0) * 1000 + (num(p.ratings.depthIn) ?? 0);
  return (fit.length ? fit : all).sort((a, b) => area(a) - area(b));
}

export function generateDesign(input: EngineInput): EngineResult {
  const { model, inputs, getPart } = input;
  const supply = inputs.supply;
  const pk = new Picker(input.pref ?? DEFAULT_PREFERENCE);
  const tags = new Tags(['PLC', 'ENC1', 'SP1', 'DS1', 'SR1']);
  const notes: string[] = [];
  const askUser: string[] = [...model.assumptions];

  // Discrete PLC points with addresses (analog channels are wired by electrical/analog.ts).
  const points = input.io
    .map((point) => ({ point, address: input.addresses.get(point.id) ?? '' }))
    .filter(({ point, address }) => address && point.signal !== 'analog' && !/^DF\d+$/i.test(address));

  // VFD motors with a reverse output run both ways on the drive.
  const vfdMotors = model.motors.filter((m) => m.start === 'vfd');
  const revOutputs = points.filter(({ point }) => point.type === 'output' && /\b(rev|reverse)\b/i.test(point.description));
  const reversingByIo = new Set<string>();
  for (const { point } of revOutputs) {
    const fake = vfdMotors.map((m) => ({ motor: m, fla: 0, contactors: [], sto: false, reversing: false, vfd: 'x' }));
    const b = motorFor(point.description, fake, new Set(), 'vfd');
    if (b) reversingByIo.add(b.motor.tag);
  }

  const power = motorBranches(pk, tags, model.motors, supply, input.region, reversingByIo);
  notes.push(...power.notes);
  const overTempInput = points.some(({ point }) => point.type === 'input' && OVER_TEMP_RE.test(point.description));
  const proc = processLoads(pk, tags, model.heaters ?? [], supply, input.io, overTempInput);
  notes.push(...proc.notes);
  askUser.push(...proc.askUser);
  const dev = devicesAndWiring(pk, tags, model, power.branches, points, proc);
  notes.push(...dev.notes);
  askUser.push(...dev.askUser);

  const plc: DesignComponent[] = [comp('PLC', input.plc.cpuPartNumber, 1, 'PLC CPU')];
  input.modules.forEach((pn, i) => {
    const p = getPart(pn);
    const kind = /analog/i.test(p?.description ?? '') ? 'Analog' : 'I/O';
    plc.push(comp(`IO${i + 1}`, pn, 1, `${kind} module, slot ${i + 1}`));
  });

  // Parts the designer already chose that the rules did not pick.
  const required: DesignComponent[] = [];
  const chosen = new Set([...power.components, ...dev.components, ...plc].map((c) => c.partNumber));
  for (const r of inputs.requiredParts) {
    if (chosen.has(r.partNumber)) continue;
    const p = getPart(r.partNumber);
    required.push(comp(tags.next(TAG_PREFIX[p?.category ?? 'other'] ?? 'X'), r.partNumber, r.quantity, `Required by the designer${p ? `: ${p.description}` : ''}`));
  }

  const fieldInputs = dev.ioWiring.filter((w) => w.location && w.location !== 'Cabinet' && w.location !== 'Cabinet door' && !input.getPart(dev.components.find((c) => c.tag === w.deviceTag)?.partNumber ?? '')).length;
  const loadA = dcLoad([...power.components, ...proc.components, ...dev.components, ...plc, ...required], getPart, input.hmiPartNumber, fieldInputs);
  const ctl = controlPower(pk, tags, supply, loadA);
  notes.push(...ctl.notes);

  const motorSpecs: MotorSpec[] = power.branches.map((b) => ({
    tag: b.motor.tag, description: b.motor.description, hp: b.motor.hp, voltage: supply,
    starter: b.vfd ? 'vfd' : power.components.some((c) => c.motorTag === b.motor.tag && getPart(c.partNumber)?.category === 'motorProtector') ? 'motor-protector' : 'contactor-overload',
    reversing: b.reversing,
  }));
  if (power.branches.length) {
    const basis = SUPPLY_INFO[supply].hz === 50 ? 'IEC 60947-4-1 Annex G' : 'NEC Table 430.250 / 430.248';
    askUser.push(`Motor currents from ${basis}: ${power.branches.map((b) => `${b.motor.tag} ${powerText(b.motor.hp, input.region)} ${motorFla(b.motor.hp, supply).toFixed(1)} A`).join(', ')} — confirm the nameplates.`);
  }
  const sto = power.branches.filter((b) => b.sto).map((b) => b.vfd);
  if (sto.length) notes.push(`${sto.join(', ')}: Safe Torque Off (STO1/STO2) wired from the safety relay output, factory jumper removed — stop category 0; confirm with the risk assessment.`);

  const core = [...power.components, ...proc.components, ...ctl.components, ...plc, ...dev.components, ...required];
  const nema4 = /4/.test(inputs.enclosureRating ?? '');
  const bigIo = points.length > 48;
  const termFeed = pk.byNumber('DN-T10-A') ?? pk.pick('terminal', (p) => !/ground/i.test(p.description));
  const termGnd = pk.byNumber('DN-G10') ?? pk.pick('terminal', (p) => /ground|green/i.test(`${p.description} ${p.ratings.color ?? ''}`));
  const endStop = pk.byNumber('DN-EB35');
  const endCover = pk.byNumber('DN-EC1210');
  const rail = pk.byNumber('DN-R35S1') ?? pk.pick('dinRail');
  const duct = pk.byNumber(bigIo ? 'T1-2240G-1' : 'T1-1530G-1') ?? pk.pick('wireDuct');
  const gbar = pk.byNumber('SCE-GB10') ?? pk.pick('groundBar');

  const ctxOf = (components: DesignComponent[], design: Partial<ElectricalDesign> = {}): DrawingContext => ({
    projectName: input.projectName ?? 'Machine',
    design: {
      inputs: { ...inputs, motors: motorSpecs }, components, ioWiring: dev.ioWiring, notes: [], machine: dev.machine,
      generatedAt: input.now ?? new Date().toISOString(), ...design,
    },
    getPart, plc: input.plc,
    io: input.io.map((p) => ({ address: input.addresses.get(p.id) ?? '', description: p.description, type: p.type })),
    region: input.region, hmiPartNumber: input.hmiPartNumber, analog: input.analog,
  });

  const accessories = (counts: ReturnType<typeof terminalCounts>, railPcs: number, ductPcs: number): DesignComponent[] => {
    const a: DesignComponent[] = [];
    if (termFeed) a.push(comp('TB1', termFeed.partNumber, Math.max(1, counts.feed), 'Feed-through terminals'));
    if (termGnd) a.push(comp('TBG', termGnd.partNumber, Math.max(1, counts.ground), 'Ground terminals'));
    if (endCover) a.push(comp('TBC', endCover.partNumber, Math.max(1, counts.endPlates), 'Terminal end covers'));
    if (endStop) a.push(comp('TBE', endStop.partNumber, Math.max(2, counts.endStops), 'End brackets'));
    if (rail) a.push(comp('DIN', rail.partNumber, Math.max(1, railPcs), 'DIN rail'));
    if (duct) a.push(comp('WD', duct.partNumber, Math.max(1, ductPcs), 'Wire duct'));
    if (gbar) a.push(comp('GB1', gbar.partNumber, Math.max(1, Math.ceil((counts.ground + 4) / (num(gbar.ratings.points) ?? 10))), 'Ground bar'));
    return a;
  };

  // Terminal counts come from the terminal plan, which does not depend on the enclosure.
  const counts = terminalCounts(ctxOf([...core, ...accessories({ feed: 1, ground: 1, fused: 0, endPlates: 1, endStops: 2 }, 1, 1)]));

  let best: { components: DesignComponent[]; spare: number; ok: boolean; enc: CatalogPart } | undefined;
  for (const enc of enclosureCandidates(pk, inputs.enclosureRating)) {
    const sub = pk.byNumber(String(enc.ratings.subpanel ?? ''));
    const depth = num(enc.ratings.depthIn) ?? 8;
    const ds = mainDisconnect(pk, power.branches, supply, ctl.inputA, nema4, depth, proc.amps);
    const head = [
      comp('ENC1', enc.partNumber, 1, `Main enclosure ${enc.ratings.heightIn}x${enc.ratings.widthIn}x${enc.ratings.depthIn} ${enclosureText(inputs.enclosureRating, input.region)}`),
      ...(sub ? [comp('SP1', sub.partNumber, 1, 'Back panel')] : []),
      ...ds.components,
    ];
    // Pass 1 sizes rails and duct from the layout; pass 2 checks the panel with the real quantities.
    const trial = [...head, ...core, ...accessories(counts, 1, 1)];
    const L = panelLayout(ctxOf(trial));
    const railPcs = Math.ceil(L.rails.reduce((s, r) => s + r.w, 0) / (num(rail?.ratings.lengthMm) ?? 1000));
    const ductPcs = Math.ceil(L.ducts.reduce((s, d) => s + Math.max(d.w, d.h), 0) / ((num(duct?.ratings.lengthM) ?? 2) * 1000));
    let components = [...head, ...core, ...accessories(counts, railPcs, ductPcs)];
    const ctx = ctxOf(components);
    const L2 = panelLayout(ctx);
    const spare = spareSpace(ctx).panel;
    components = components.map((c) => (c.tag === 'ENC1' ? { ...c, function: `${c.function} — ${spare >= 0.25 ? 'smallest catalog enclosure with everything placed and' : 'everything placed, but only'} ${Math.round(spare * 100)}% spare panel space (target >= 25%)` } : c));
    const ok = !L2.overflow && !L2.notFit.length && !L2.door.overflow && spare >= 0.25;
    if (!best || ok || spare > best.spare) best = { components, spare, ok, enc };
    if (ok) { if (ds.notes.length) notes.push(...ds.notes); break; }
  }
  if (!best) throw new Error('No enclosure in the catalog.');
  if (!best.ok) notes.push(`No catalog enclosure leaves 25% spare panel space: ${best.enc.partNumber} is the largest tried (${Math.round(best.spare * 100)}% spare) — consider a larger or a second enclosure.`);

  const motorsText = power.branches.map((b) => `${b.motor.tag} ${powerText(b.motor.hp, input.region)} ${b.vfd ? `on ${getPart(best!.components.find((c) => c.tag === b.vfd)?.partNumber ?? '')?.partNumber ?? 'a VFD'}${b.sto ? ' (STO)' : ''}` : b.reversing ? 'reversing starter' : 'across the line'}`).join(', ');
  const ps = best.components.find((c) => getPart(c.partNumber)?.category === 'powerSupply');
  const explanation = `Rule-based design: ${enclosureText(inputs.enclosureRating, input.region)} ${best.enc.partNumber}, ${SUPPLY_INFO[supply].label} through ${best.components.find((c) => c.tag === 'DS1')?.function.replace('Main disconnect ', '') ?? 'a'} disconnect${motorsText ? `; motors: ${motorsText}` : ''}; 24 VDC from ${ps?.partNumber ?? '(select a supply)'} for ${loadA.toFixed(1)} A load + 25%; dual-channel E-stop${model.safety.estops > 1 ? 's' : ''} into a safety relay with monitored manual reset; ${Math.round(best.spare * 100)}% spare panel space.`;

  return {
    design: {
      inputs: { ...inputs, motors: motorSpecs, enclosureRating: inputs.enclosureRating },
      components: best.components,
      ioWiring: dev.ioWiring,
      notes: [...askUser, ...notes],
      askUser,
      machine: dev.machine,
      generatedAt: input.now ?? new Date().toISOString(),
    },
    explanation,
    layoutOk: best.ok,
  };
}

/** Design straight from the project (no AI): the default machine model, then the rules. */
export function generateDefaultDesign(input: Omit<EngineInput, 'model'> & { spec?: string }): EngineResult {
  return generateDesign({ ...input, model: defaultMachineModel(input.io, input.inputs, input.spec ?? '') });
}
