import type { ProjectSnapshot } from '../collect';
import { getPart } from '../../electrical/catalog';
import { getHmi } from '../../hmi/hmiCatalog';
import { awgFor, motorFla } from '../../electrical/derive';
import type { CatalogCategory } from '../../electrical/types';

/**
 * Engineering calculations: 24 VDC load, motor branch circuits, cabinet heat.
 * Values not published for a part are typical figures and are flagged
 * `estimate`.
 */

export interface CalcLine { item: string; value: string; basis: string; estimate: boolean }
export interface CalcSection { title: string; lines: CalcLine[]; result: string; ok: boolean }

// Typical values used when the catalog doesn't publish one (labelled as estimates).
export const DC_LOAD_A: Partial<Record<CatalogCategory, number>> = {
  plc: 0.3, plcModule: 0.05, safetyRelay: 0.1, relay: 0.03, pilotLight: 0.02, stackLight: 0.1, sensor: 0.03, contactor: 0.1,
};
export const HEAT_W: Partial<Record<CatalogCategory, number>> = {
  plc: 5, plcModule: 2, safetyRelay: 2, relay: 0.6, contactor: 2.5, overload: 2, motorProtector: 3, breaker: 1.5, terminal: 0.1,
};

export function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
}

export function calculations(p: ProjectSnapshot): CalcSection[] {
  const d = p.electrical;
  if (!d) return [];
  const canada = p.info.region === 'Canada';
  const sections: CalcSection[] = [];
  const parts = d.components.map((c) => ({ c, part: getPart(c.partNumber) }));

  // 1. 24 VDC power supply load
  const lines: CalcLine[] = [];
  let loadA = 0;
  for (const { c, part } of parts) {
    if (!part) continue;
    let a: number | null = null;
    let basis = '';
    if (part.category === 'solenoidValve' && num(part.ratings.watts)) {
      a = (num(part.ratings.watts)! / 24) * c.quantity;
      basis = `${part.ratings.watts} W coil (catalog)`;
    } else if (part.category === 'contactor' && !String(part.ratings.coilVoltage ?? part.ratings.coil ?? '').includes('24')) {
      continue; // AC coil, not on the 24 VDC supply
    } else if (DC_LOAD_A[part.category] !== undefined) {
      a = DC_LOAD_A[part.category]! * c.quantity;
      basis = `${DC_LOAD_A[part.category]} A each (typical)`;
    }
    if (a === null) continue;
    loadA += a;
    lines.push({ item: `${c.tag} ${part.partNumber}${c.quantity > 1 ? ` x${c.quantity}` : ''}`, value: `${a.toFixed(2)} A`, basis, estimate: !basis.includes('catalog') });
  }
  const hmi = p.hmi ? getHmi(p.hmi.hmiPartNumber) : undefined;
  if (hmi) {
    const a = hmi.sizeIn >= 10 ? 1.0 : 0.6;
    loadA += a;
    lines.push({ item: `HMI ${hmi.partNumber}`, value: `${a.toFixed(2)} A`, basis: 'typical for this screen size', estimate: true });
  }
  const supplies = parts.filter(({ part }) => part?.category === 'powerSupply');
  const capA = supplies.reduce((s, { c, part }) => s + (num(part!.ratings.outputAmps) ?? 0) * c.quantity, 0);
  const needA = loadA * 1.25;
  sections.push({
    title: '24 VDC power supply sizing',
    lines,
    result: `Load ${loadA.toFixed(2)} A + 25% margin = ${needA.toFixed(2)} A; supply rated ${capA.toFixed(1)} A (${supplies.map(({ part }) => part!.partNumber).join(', ') || 'none'}).`,
    ok: capA >= needA,
  });

  // 2. Motor branch circuits
  for (const m of d.inputs.motors) {
    const fla = motorFla(m.hp, m.voltage);
    const mine = parts.filter(({ c }) => c.motorTag === m.tag);
    // Fuse holders carry the holder rating; the protection is the fuse fitted in it.
    const isCartridge = (pt: typeof parts[number]['part']) => pt?.category === 'fuse' && num(pt.ratings.poles) === null;
    const prot = mine.find(({ part }) => part && ['breaker', 'motorProtector', 'fuse'].includes(part.category) && !isCartridge(part));
    const cartridge = prot?.part?.category === 'fuse' ? mine.find(({ part }) => isCartridge(part)) : undefined;
    const protPart = cartridge?.part ?? prot?.part;
    const ol = mine.find(({ part }) => part?.category === 'overload');
    const protA = protPart ? num(protPart.ratings.amps ?? protPart.ratings.maxAmps) : null;
    // NEC 430.52 / CEC 28-200 maximum: inverse-time breaker 250% FLA, time-delay fuse 175%, other fuse 300%,
    // rounded up to the next standard size (NEC 240.6). Not checked for manual motor protectors and VFD branches
    // (drive manufacturer's rating applies).
    const pct = protPart?.category === 'breaker' ? 2.5 : protPart?.category === 'fuse' ? (/time.?delay|dual/i.test(`${protPart.ratings.type ?? ''} ${protPart.description}`) ? 1.75 : 3) : null;
    const STD = [...(protPart?.category === 'fuse' ? [1, 3, 6, 10] : []), 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250];
    const maxA = pct !== null && m.starter !== 'vfd' ? STD.find((x) => x >= fla * pct - 1e-9) ?? fla * pct : null;
    const protOk = maxA === null || protA === null || protA <= maxA;
    const olMin = ol?.part ? num(ol.part.ratings.minAmps) : null;
    const olMax = ol?.part ? num(ol.part.ratings.maxAmps) : null;
    const olOk = olMin !== null && olMax !== null ? fla >= olMin && fla <= olMax : true;
    sections.push({
      title: `Motor ${m.tag} — ${m.description || 'motor'} (${m.hp} HP, ${m.voltage})`,
      lines: [
        { item: 'Full-load current', value: `${fla} A`, basis: canada ? 'CEC Table 44/45 (same values as NEC 430.250)' : 'NEC Table 430.250 / 430.248', estimate: false },
        { item: `Conductors (125% FLA, ${canada ? 'CEC 28-106' : 'NEC 430.22'})`, value: awgFor(fla * 1.25), basis: `${(fla * 1.25).toFixed(1)} A`, estimate: false },
        { item: 'Branch protection', value: protPart ? `${prot!.part!.partNumber}${cartridge?.part ? ` with ${cartridge.part.partNumber}` : ''}${protA ? ` (${protA} A)` : ''}` : 'not assigned', basis: `${canada ? 'CEC 28-200' : 'NEC 430.52'} limits${maxA !== null ? `: max ${maxA} A` : ''}`, estimate: false },
        { item: 'Overload setting', value: ol?.part ? `${ol.part.partNumber}, set to ${fla} A` : m.starter === 'vfd' ? 'VFD electronic overload, set to FLA' : 'not assigned', basis: olMin !== null ? `range ${olMin}–${olMax} A` : '', estimate: false },
      ],
      result: [olOk ? 'Overload range covers the motor FLA.' : `Overload range ${olMin}–${olMax} A does not include FLA ${fla} A.`,
        protOk ? '' : `Branch protection ${protA} A is above the ${maxA} A maximum — use a smaller device.`].filter(Boolean).join(' '),
      ok: olOk && protOk && Boolean(prot),
    });
  }

  // 3. Cabinet heat
  const heatLines: CalcLine[] = [];
  let heat = 0;
  for (const { c, part } of parts) {
    if (!part || part.mount !== 'backplate') continue;
    let w: number | null = null;
    let basis = '';
    if (part.category === 'powerSupply' && num(part.ratings.watts)) { w = num(part.ratings.watts)! * 0.12; basis = '~12% loss of rated output'; }
    else if (part.category === 'vfd') { const hp = num(part.ratings.hp480 ?? part.ratings.hp230 ?? part.ratings.hp) ?? 1; w = hp * 746 * 0.04; basis = '~4% of drive rating'; }
    else if (part.ratings.kind === 'transformer' && num(part.ratings.va)) { w = num(part.ratings.va)! * 0.05; basis = '~5% of VA'; }
    else if (HEAT_W[part.category] !== undefined) { w = HEAT_W[part.category]!; basis = 'typical'; }
    if (w === null) continue;
    w *= c.quantity;
    heat += w;
    heatLines.push({ item: `${c.tag} ${part.partNumber}${c.quantity > 1 ? ` x${c.quantity}` : ''}`, value: `${w.toFixed(1)} W`, basis, estimate: true });
  }
  if (hmi) {
    // The HMI electronics sit inside the door: its power ends up as heat in the cabinet.
    const w = (hmi.sizeIn >= 10 ? 1.0 : 0.6) * 24;
    heat += w;
    heatLines.push({ item: `HMI ${hmi.partNumber} (door)`, value: `${w.toFixed(1)} W`, basis: 'supply current x 24 V (typical)', estimate: true });
  }
  const enc = parts.find(({ part }) => part?.category === 'enclosure' && part.ratings.kind === 'enclosure')?.part;
  if (enc) {
    const h = (num(enc.ratings.heightIn) ?? 24) * 0.0254, w = (num(enc.ratings.widthIn) ?? 20) * 0.0254, dd = (num(enc.ratings.depthIn) ?? 8) * 0.0254;
    // Wall-mounted: back not counted (IEC/TR 60890 style effective area, simplified).
    const area = h * w + 2 * h * dd + 2 * w * dd;
    const rise = heat / (5.5 * area);
    sections.push({
      title: 'Cabinet temperature rise',
      lines: [...heatLines, { item: 'Effective surface area', value: `${area.toFixed(2)} m²`, basis: `${enc.partNumber}, wall mounted`, estimate: false }],
      result: `${heat.toFixed(0)} W in ${area.toFixed(2)} m² -> about ${rise.toFixed(1)} °C above room temperature (painted steel, k ~ 5.5 W/m²K). ${rise > 15 ? 'Above 15 °C: add a filter fan or a larger enclosure.' : 'Natural cooling is enough at normal room temperatures (<= 40 °C).'}`,
      ok: rise <= 15,
    });
  }

  sections.push({
    title: 'Short-circuit current rating (SCCR)',
    lines: [],
    result: canada
      ? 'Preliminary panel SCCR is determined in the SCCR table (UL 508A Supplement SB method, lowest component rating). Confirm the available fault current at the site and mark the panel per CSA C22.2 No. 14.'
      : 'Preliminary panel SCCR is determined in the SCCR table (UL 508A Supplement SB, lowest component rating). Confirm the available fault current at the site (NEC 409.22) and mark the panel nameplate.',
    ok: true,
  });
  return sections;
}

/** Failed calculation checks (overheating, undersized supply, overload / branch protection), for the design review lists. */
export function calcWarnings(p: ProjectSnapshot, calcs: CalcSection[] = calculations(p)): string[] {
  return calcs.filter((s) => !s.ok).map((s) => `${s.title}: ${s.result}`);
}
