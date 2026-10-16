import type { ProjectSnapshot } from '../collect';
import { buildModel, billOfMaterials, isFuseCartridge } from '../../electrical/derive';
import { getHmi } from '../../hmi/hmiCatalog';
import type { CatalogCategory } from '../../electrical/types';
import { makeTable, type DocTable } from './table';

/**
 * Preventive maintenance schedule and recommended spare parts. Intervals are
 * typical industry starting points (labelled so) to be adjusted by the site;
 * spare parts are drawn only from the BOM, never invented.
 */

export function pmSchedule(p: ProjectSnapshot): DocTable {
  const rows: string[][] = [];
  const m = p.drawingCtx ? buildModel(p.drawingCtx) : null;
  const has = (...cats: CatalogCategory[]) => !!m?.rc.some((c) => cats.includes(c.category));
  const tags = (...cats: CatalogCategory[]) => (m?.rc.filter((c) => cats.includes(c.category)).map((c) => c.tag) ?? []).join(', ');
  const ca = p.info.region === 'Canada';
  if (m?.safety.estops.length) rows.push(['E-stop devices ' + m.safety.estops.join(', '), 'Functional test of every E-stop (machine stops, cannot restart without reset)', 'Weekly, or as set by the risk assessment']);
  if (m?.safety.relay) rows.push([`Safety relay ${m.safety.relay.tag}`, 'Full safety-function test incl. channel fault and EDM test (repeat FAT section 4)', 'Every 12 months (proof test) or after any change']);
  rows.push(['Control panel enclosure', 'Inspect gasket, latches, cable glands and cleanliness; no moisture or dust inside', 'Every 6 months']);
  if (has('fan')) rows.push([`Cooling fan / filters ${tags('fan')}`, 'Clean or replace filter mats; check fan runs', 'Every 3 months (dusty areas: monthly)']);
  rows.push(['Power terminations', 'Infrared (thermographic) scan under load; re-torque any hot connection after LOTO', `Every 12 months (${ca ? 'CSA Z463' : 'NFPA 70B'})`]);
  if (has('contactor', 'overload')) rows.push([`Motor starters ${tags('contactor', 'overload')}`, 'Check contactor for noise / chatter and contact wear; check overload setting = motor FLA', 'Every 12 months']);
  if (has('breaker', 'motorProtector', 'fuse')) rows.push([`Protective devices ${tags('breaker', 'motorProtector')}`, 'Visual check; operate breakers manually (de-energized) to keep mechanisms free', 'Every 12 months']);
  if (has('powerSupply')) rows.push([`24 VDC supply ${tags('powerSupply')}`, 'Measure output voltage under load (24 VDC ±5%)', 'Every 12 months']);
  rows.push([`PLC ${p.cpu.id}`, 'Check for errors; save a program backup and compare with the archived version', 'Every 6 months and after any change']);
  if (p.hmi) rows.push([`HMI ${p.hmi.hmiPartNumber}`, 'Clean the screen with a soft cloth; check touch response; back up the project', 'Monthly / after any change']);
  if (has('sensor')) rows.push([`Sensors ${tags('sensor')}`, 'Clean photo-eye lenses / reflectors; check mounting and switching distance', 'Monthly']);
  if (has('solenoidValve') || (p.spec.pneumatics ?? '').trim()) rows.push([`Pneumatics ${tags('solenoidValve')}`.trim(), 'Drain filter bowl, check regulator pressure, listen for leaks, check cylinder cushions', 'Weekly (drain) / every 3 months']);
  for (const mm of m?.motors ?? []) rows.push([`Motor ${mm.motor.tag} ${mm.motor.description}`, 'Check temperature, vibration and noise; lubricate bearings per the motor nameplate', 'Every 3 months / per manufacturer']);
  if (m?.motors.some((x) => x.vfd)) rows.push([`VFD ${m.motors.filter((x) => x.vfd).map((x) => x.vfd!.tag).join(', ')}`, 'Clean heatsink and fan; check DC bus capacitors per drive manual', 'Every 12 months']);
  rows.push(['Field cables', 'Inspect for damage, chafing and strain relief at moving parts', 'Every 6 months']);
  rows.push(['Documentation', 'Keep drawings and program backups up to date with every change (management of change)', 'After every change']);
  return makeTable([['Item', 34], ['Task', 70], ['Interval (typical, adjust to site)', 30]], rows);
}

interface SpareRule { qty: (installed: number) => number; reason: string }

const SPARE_RULES: Partial<Record<CatalogCategory, SpareRule>> = {
  plc: { qty: () => 1, reason: 'Critical, single point of failure' },
  plcModule: { qty: () => 1, reason: 'Critical I/O' },
  powerSupply: { qty: () => 1, reason: 'Critical — loss stops the machine' },
  safetyRelay: { qty: () => 1, reason: 'Critical safety component' },
  contactor: { qty: () => 1, reason: 'Wear item (contacts / coil)' },
  overload: { qty: () => 1, reason: 'Long lead time risk' },
  motorProtector: { qty: () => 1, reason: 'Protective device' },
  breaker: { qty: () => 1, reason: 'Protective device — one per rating' },
  fuse: { qty: (n) => Math.max(n, 3), reason: 'Consumable — full set per rating' },
  relay: { qty: (n) => (n >= 5 ? 2 : 1), reason: 'Wear item' },
  vfd: { qty: () => 1, reason: 'Critical, long lead time' },
  sensor: { qty: () => 1, reason: 'Exposed field device — wear / damage' },
  solenoidValve: { qty: () => 1, reason: 'Wear item' },
  pushbutton: { qty: () => 1, reason: 'Operator wear' },
  estop: { qty: () => 1, reason: 'Safety device — operator wear' },
  pilotLight: { qty: () => 1, reason: 'Lamp / LED failure' },
  selector: { qty: () => 1, reason: 'Operator wear' },
  stackLight: { qty: () => 1, reason: 'Lamp / LED failure' },
  fan: { qty: () => 1, reason: 'Wear item (plus filter mats)' },
};

export function sparePartsTable(p: ProjectSnapshot): DocTable {
  const rows: string[][] = [];
  if (p.drawingCtx) {
    const m = buildModel(p.drawingCtx);
    const carts = new Set(m.rc.filter(isFuseCartridge).map((c) => c.partNumber));
    for (const g of billOfMaterials(p.drawingCtx)) for (const l of g.lines) {
      if (l.note || !l.partNumber) continue;
      const rule = l.category === 'note' ? undefined : SPARE_RULES[l.category];
      if (!rule) continue;
      if (l.category === 'fuse' && !carts.has(l.partNumber)) continue; // holders are not spares
      rows.push([l.partNumber, l.manufacturer, l.description, l.tags.join(', '), String(l.qty), String(rule.qty(l.qty)), rule.reason]);
    }
  }
  if (p.hmi) rows.push([p.hmi.hmiPartNumber, 'AutomationDirect', getHmi(p.hmi.hmiPartNumber)?.description ?? 'Operator touch panel', 'HMI1', '1', '1', 'Critical — operator interface (or keep a loaded backup project)']);
  return makeTable([['Part number', 18], ['Manufacturer', 14], ['Description', 50], ['Tags', 14], ['Qty installed', 9, 'center'], ['Recommended spares', 11, 'center'], ['Reason', 30]], rows);
}
