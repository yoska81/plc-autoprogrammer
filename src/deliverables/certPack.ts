import type { ProjectSnapshot } from './collect';
import { buildModel, designWarnings, panelNameplate, type ResolvedComponent } from '../electrical/derive';
import { panelSccr, type PanelSccr } from '../electrical/sccr';
import { byRegion, isIec, NEMA_TO_IP, powerText, regionSpec } from '../standards/regions';
import { calculations } from './docs/calcs';
import { hazardTable, residualRisks, riskStatement, safetyFunctions } from './docs/safety';
import { standardsTable } from './docs/codes';
import { docMeta } from './docs/meta';
import { makeTable, type DocRow, type DocTable } from './docs/table';
import { BRAND, INFO_FILL, RED, WARN_FILL } from './docs/pdfWriter';
import { simpleDoc } from './programListingPdf';

/**
 * Certification pack: the documents a UL 508A file (US / Canada) or a CE technical file (IEC projects)
 * needs, read from the design. Nothing is assumed: a value the design or the catalog cannot back up is
 * marked "to confirm" and listed at the top of the pack.
 */

export const TO_CONFIRM = 'to confirm';

export interface CertItem {
  label: string;
  value: string;
  /** Where the value comes from. */
  source: string;
  /** True when the value is not backed by the design / catalog and must be checked. */
  confirm: boolean;
}

export interface CertSafety {
  id: string; name: string; initiating: string; logic: string; stopCategory: string;
  /** Required PL (risk assessment). */
  plr: string;
  /** Category / PL the logic and input devices are rated for (catalog). */
  deviceRating: string;
  /** PL the function reaches (ISO 13849-1 calculation). */
  achieved: string;
  architecture: string;
}

export interface CertComponent {
  tag: string; partNumber: string; manufacturer: string; description: string; where: string;
  ul: string; csa: string; ce: string;
  /** True when no listing could be read from the catalog. */
  confirm: boolean;
}

export interface CertStatement { topic: string; text: string; status: 'OK' | 'Check' | 'To confirm' }

export interface CertPack {
  kind: 'ul508a' | 'ce';
  title: string;
  /** Scheme in plain words ("UL 508A listing (US)"). */
  scheme: string;
  plate: CertItem[];
  sccr: PanelSccr | null;
  /** "K1, OL1 at 5 kA" or a to-confirm note. */
  weakest: string;
  safety: CertSafety[];
  components: CertComponent[];
  statements: CertStatement[];
  enclosure: CertItem[];
  /** CE only. */
  declaration: CertItem[] | null;
  /** Everything marked to confirm, in plain words. */
  toConfirm: string[];
}

const ok = (label: string, value: string, source: string): CertItem => ({ label, value, source, confirm: false });
const tbc = (label: string, value: string, source: string): CertItem => ({ label, value: value || TO_CONFIRM, source, confirm: true });

/** Listings the catalog shows for a part (UL standard number, cULus / CSA / CE in the description). */
export function listingsOf(c: ResolvedComponent): Pick<CertComponent, 'ul' | 'csa' | 'ce' | 'confirm'> {
  // Mounting hardware (rail, end stops, plates) carries no listing of its own.
  if (c.category === 'dinRail' || c.category === 'terminalAccessory') return { ul: 'n/a (hardware)', csa: 'n/a', ce: 'n/a', confirm: false };
  const r = c.part?.ratings ?? {};
  const text = `${c.part?.description ?? ''} ${String(r.listing ?? '')} ${String(r.approvals ?? '')} ${String(r.certifications ?? '')}`;
  let ul = '', csa = '', ce = '';
  if (r.ul) ul = `UL ${String(r.ul).replace(/^UL\s*/i, '')}`;
  if (/\bc-?UL-?us\b/i.test(text)) { ul ||= 'cULus'; csa = 'cULus (Canada)'; }
  else if (/\bUL\s*(listed|recognized)\b/i.test(text)) ul ||= 'UL';
  const std = /\bUL\s*(\d{2,4}[A-Z]?)\b/.exec(text);
  if (std) ul ||= `UL ${std[1]}`;
  if (/\bCSA\b/.test(text)) csa ||= 'CSA';
  if (/\bCE\b/.test(text)) ce = 'CE';
  const confirm = !ul && !csa && !ce;
  return { ul: ul || TO_CONFIRM, csa: csa || TO_CONFIRM, ce: ce || TO_CONFIRM, confirm };
}

const AWG_ORDER = ['22 AWG', '20 AWG', '18 AWG', '16 AWG', '14 AWG', '12 AWG', '10 AWG', '8 AWG', '6 AWG', '4 AWG', '2 AWG', '1/0 AWG', '2/0 AWG', '4/0 AWG'];
const awgRank = (s: string) => AWG_ORDER.indexOf(s.trim());

export function certPack(p: ProjectSnapshot): CertPack {
  const region = p.info.region;
  const iec = isIec(region);
  const canada = region === 'Canada';
  const meta = docMeta(p);
  const kind: CertPack['kind'] = iec ? 'ce' : 'ul508a';
  const title = iec ? 'CE technical file' : canada ? 'UL 508A / CSA certification pack' : 'UL 508A certification pack';
  const scheme = iec
    ? region === 'EU' ? 'CE marking — Machinery Directive 2006/42/EC (Machinery Regulation (EU) 2023/1230 from 20 January 2027) and EMC Directive 2014/30/EU'
      : `CE-style technical file (IEC 60204-1 / IEC 61439). CE marking is needed only for machines placed on the EU market; follow the ${regionSpec(region).label} rules for this site.`
    : canada ? 'UL 508A industrial control panel built under a cUL listing, or CSA C22.2 No. 14 certification (Canada)' : 'UL 508A industrial control panel listing (US)';
  const empty: CertPack = { kind, title, scheme, plate: [], sccr: null, weakest: TO_CONFIRM, safety: [], components: [], statements: [], enclosure: [], declaration: null, toConfirm: ['There is no electrical design yet: make one on the Electrical design page.'] };
  if (!p.drawingCtx || !p.electrical) return empty;

  const ctx = p.drawingCtx;
  const m = buildModel(ctx);
  const np = panelNameplate(ctx);
  const sc = panelSccr(ctx);
  const largest = m.motors.reduce<typeof m.motors[number] | null>((a, x) => (!a || x.fla > a.fla ? x : a), null);
  const enc = m.rc.find((c) => c.category === 'enclosure' && c.part?.ratings.kind === 'enclosure') ?? m.rc.find((c) => c.category === 'enclosure');
  const required = p.electrical.inputs.enclosureRating;
  const encNema = enc?.part?.ratings.nema ? String(enc.part.ratings.nema) : '';
  const encMeets = Boolean(encNema) && encNema.split('/').includes(required.replace('NEMA ', ''));
  const ip = (nema: string) => NEMA_TO_IP[nema] ?? '';
  /** The required rating in the region's terms (IP54 / NEMA 12). */
  const req = iec ? ip(required) || required : required;

  // Short-circuit rating and its weakest link.
  const sccrKnown = sc.lowest !== null && !sc.unknown.length;
  const limitingRows = sc.rows.filter((r) => sc.limiting.includes(r.tag));
  const weakest = sc.lowest === null ? `${TO_CONFIRM}: no component ratings` : `${limitingRows.map((r) => r.component).join(', ')} at ${sc.lowest} kA`;
  const sccrValue = sc.lowest === null ? '' : `${sc.lowest} kA rms symmetrical, ${np.supplyText}${sc.conditions.length ? ` (valid with ${sc.conditions.map((c) => `${c.tag} ${c.condition}`).join('; ')})` : ''}`;
  const encText = enc ? `${encNema ? `NEMA ${encNema}` : required}${iec && ip(required) ? ` (${ip(required)})` : ''}` : '';

  // Ratings plate.
  const plate: CertItem[] = [];
  const maker = meta.company ? ok('Manufacturer (panel shop)', meta.company, 'Project data') : tbc('Manufacturer (panel shop)', '', 'Enter the company on the Project data page');
  plate.push(maker);
  plate.push(ok(iec ? 'Type designation' : 'Type / catalog designation', meta.projectNumber ? `${p.projectName} (${meta.projectNumber})` : p.projectName, 'Project data'));
  plate.push(tbc('Serial number', '', 'Given by the shop at build'));
  plate.push(tbc(iec ? 'Year of construction' : 'Date of manufacture', '', 'Given by the shop at build'));
  plate.push(ok(iec ? 'Rated voltage Ue, phases, frequency' : 'Supply voltage, phases, frequency', np.supplyText, 'Electrical design'));
  plate.push(tbc(iec ? 'Rated current (full load)' : 'Full-load current', `${np.fullLoadAmps} A`,
    `Motors ${np.motorAmps} A (${iec ? 'IEC 60947-4-1 Annex G' : canada ? 'CEC Table 44/45' : 'NEC Table 430.250'}) + control ${np.controlAmps} A (estimated from the power supply ratings); check against the motor nameplates`));
  plate.push(largest
    ? ok(iec ? 'Largest motor' : 'Largest motor (full-load current)', `${largest.motor.tag} ${powerText(largest.motor.hp, region)}, ${largest.fla} A`, iec ? 'IEC 60947-4-1 Annex G' : canada ? 'CEC Table 44/45' : 'NEC Table 430.250')
    : ok('Largest motor', 'no motors', 'Electrical design'));
  if (iec) plate.push(tbc('Rated conditional short-circuit current Icc', sccrValue ? `${sccrValue} — preliminary, by the UL 508A SB method` : '', 'Verify per IEC 61439-1 §10.11 for the prospective fault current at the site'));
  else plate.push(sccrKnown && !sc.unmet.length ? ok('Short-circuit current rating (SCCR)', sccrValue, 'UL 508A Supplement SB (section 2)') : tbc('Short-circuit current rating (SCCR)', sccrValue, `Missing or unmet ratings: ${[...sc.unknown, ...sc.unmet.map((u) => u.tag)].join(', ') || 'none counted'}`));
  plate.push(enc ? (encMeets ? ok(iec ? 'Degree of protection (IP)' : 'Enclosure type rating', iec ? ip(required) || encText : encText, `${enc.tag} ${enc.partNumber} (catalog)`) : tbc(iec ? 'Degree of protection (IP)' : 'Enclosure type rating', encText, `Required ${required}; the enclosure rating could not be checked`)) : tbc(iec ? 'Degree of protection (IP)' : 'Enclosure type rating', '', 'No enclosure in the design'));
  plate.push(ok('Wiring diagram reference', meta.drawings ? `${meta.drawings.first} … ${meta.drawings.last}` : `${p.fileBase}_drawings.pdf`, 'Drawing set'));
  if (!iec) plate.push(ok('More than one power source', np.multipleSources ? 'Yes — mark each disconnect and the "more than one source" warning' : 'No', 'Electrical design'));
  plate.push(iec ? ok('Standards', 'IEC 60204-1, IEC 61439-2', 'Design basis') : ok('Marking', `"Industrial Control Panel"${canada ? ', CSA C22.2 No. 14' : ''}`, 'UL 508A §52'));
  plate.push(tbc(iec ? 'CE mark' : canada ? 'Listing mark (cUL / CSA)' : 'UL listing mark', '', iec ? 'Only after the declaration of conformity is signed' : 'Applied by the listed panel shop after its own inspection'));

  // Safety functions with PL / category.
  const safety: CertSafety[] = safetyFunctions(p).map((s) => {
    const logic = m.rc.find((c) => s.logic.startsWith(`${c.tag} `));
    const r = logic?.part?.ratings ?? {};
    const rated = [r.PL, r.category, r.SIL].filter(Boolean).map(String).join(', ');
    const inputs = m.rc.filter((c) => c.part?.ratings.PL && s.initiating.includes(c.tag)).map((c) => `${c.tag} ${c.part!.ratings.PL}`);
    return {
      id: s.id, name: s.name, initiating: s.initiating, logic: s.logic, stopCategory: s.stopCategory, architecture: s.architecture,
      plr: `${TO_CONFIRM} (risk assessment)`,
      deviceRating: rated || inputs.length ? [rated && `${logic!.tag} rated ${rated}`, ...inputs].filter(Boolean).join('; ') + ' (catalog)' : TO_CONFIRM,
      achieved: `${TO_CONFIRM} (ISO 13849-1 calculation: MTTFd, DCavg, CCF)`,
    };
  });

  // Components and listings.
  const components: CertComponent[] = m.rc.filter((c) => c.partNumber).map((c) => ({
    tag: c.tag, partNumber: c.partNumber, manufacturer: c.part?.manufacturer ?? TO_CONFIRM, description: c.part?.description ?? c.comp.function,
    where: c.mount === 'field' ? 'field' : c.mount === 'door' ? 'door' : 'panel', ...listingsOf(c),
  }));

  // Wire sizing, overcurrent protection and spacings.
  const statements: CertStatement[] = [];
  const calcs = calculations(p);
  const motorCalcs = calcs.filter((s) => s.title.startsWith('Motor '));
  const power = m.wires.filter((w) => w.color === 'BK');
  const sizes = (ws: typeof m.wires) => [...new Set(ws.map((w) => w.size))].join(', ') || 'none';
  if (iec) {
    statements.push({ topic: 'Wire sizing', text: `Power conductors ${sizes(power)}; control conductors ${sizes(m.wires.filter((w) => w.color !== 'BK' && w.color !== 'GN/YE' && !/cat/i.test(w.size)))}; protective conductors ${sizes(m.wires.filter((w) => w.color === 'GN/YE'))}. Sized per IEC 60204-1 §12.4 and Table 6 (PVC copper, method B2, 40 °C) at 125% of the motor rated current.`, status: motorCalcs.every((s) => s.ok) ? 'OK' : 'Check' });
  } else {
    const minPower = power.filter((w) => awgRank(w.size) >= 0 && awgRank(w.size) < awgRank('14 AWG'));
    statements.push({ topic: 'Wire sizing', text: `Power conductors ${sizes(power)}, control conductors ${sizes(m.wires.filter((w) => w.color !== 'BK' && w.color !== 'GN/YE' && !/cat/i.test(w.size)))}, equipment grounding ${sizes(m.wires.filter((w) => w.color === 'GN/YE'))}; 75 °C copper. Motor branch conductors at 125% of the full-load current (${canada ? 'CEC 28-106' : 'NEC 430.22'}); ampacity per UL 508A Table 28.1${minPower.length ? `. Power conductors smaller than 14 AWG: ${minPower.map((w) => w.wire).join(', ')}` : ''}.`, status: motorCalcs.every((s) => s.ok) && !minPower.length ? 'OK' : 'Check' });
  }
  for (const s of motorCalcs) {
    const cond = s.lines.find((l) => l.item.startsWith('Conductors'));
    if (cond) statements.push({ topic: `Wire sizing — ${s.title.split(' — ')[0]}`, text: `${cond.value} for ${cond.basis}. ${s.result}`.trim(), status: s.ok ? 'OK' : 'Check' });
  }
  // Branch protection: every power circuit has a protective device, and it is a branch-circuit device.
  const branches: { circuit: string; prot?: ResolvedComponent }[] = [
    ...m.motors.map((mm) => ({ circuit: `${mm.motor.tag} motor branch`, prot: mm.protection })),
    ...m.psBranches.filter((b) => !b.fromXfmr).map((b) => ({ circuit: `${b.ps.tag} power supply`, prot: b.protection })),
    ...(m.xfmrBranch ? [{ circuit: `${m.xfmrBranch.xfmr.tag} control transformer primary`, prot: m.xfmrBranch.protection }] : []),
    ...m.auxBranches.map((b) => ({ circuit: b.load || b.protection.comp.function || b.protection.tag, prot: b.protection })),
  ];
  const missing = branches.filter((b) => !b.prot).map((b) => b.circuit);
  const supplementary = branches.filter((b) => b.prot && (/no/i.test(String(b.prot.part?.ratings.branchRated ?? '')) || String(b.prot.part?.ratings.ul ?? '') === '1077')).map((b) => `${b.prot!.tag} (${b.circuit})`);
  const unknownBasis = branches.filter((b) => b.prot && !b.prot.part?.ratings.ul && b.prot.category !== 'fuse' && !supplementary.some((s) => s.startsWith(`${b.prot!.tag} `))).map((b) => b.prot!.tag);
  statements.push({
    topic: 'Overcurrent protection',
    text: `${branches.length} protected circuit${branches.length === 1 ? '' : 's'}: ${branches.map((b) => `${b.circuit} — ${b.prot ? `${b.prot.tag} ${b.prot.partNumber}` : 'NONE'}`).join('; ')}.${iec ? ' Devices per IEC 60898-1 / IEC 60947-2 / IEC 60947-4-1.' : ` Branch-circuit devices must be UL 489 breakers, UL 248 fuses or listed Type E/F combination starters (${canada ? 'CEC 28-200' : 'NEC 430.52'}).`}${missing.length ? ` No protection: ${missing.join(', ')}.` : ''}${supplementary.length ? ` Supplementary protectors used as branch protection: ${supplementary.join(', ')}.` : ''}${unknownBasis.length ? ` Listing basis not in the catalog: ${unknownBasis.join(', ')}.` : ''}`,
    status: missing.length || supplementary.length ? 'Check' : unknownBasis.length ? 'To confirm' : 'OK',
  });
  statements.push({
    topic: 'Main disconnect',
    text: m.disconnect ? `${m.disconnect.tag} ${m.disconnect.partNumber}${m.disconnect.part?.ratings.ul ? ` (UL ${m.disconnect.part.ratings.ul})` : ''}, lockable in the OFF position${m.mainBreaker ? `; main protection ${m.mainBreaker.tag}` : '; feeder protection upstream by others'}.` : 'No main disconnect in the design.',
    status: m.disconnect ? 'OK' : 'Check',
  });
  statements.push({
    topic: 'Spacings',
    text: iec
      ? 'Clearances and creepage distances per IEC 61439-1 §8.3 (rated impulse voltage, pollution degree 3) and the component makers\' instructions. Check at the line side of the main switch, distribution blocks and field terminals at the routine verification.'
      : `Listed components keep their own spacings when installed per their instructions. Field-wiring terminals, power distribution blocks and bare live parts at ${np.volts} V need the spacings of UL 508A Section 10 (through air and over surface, to grounded metal and between opposite polarity): check at build, especially at the line side of ${m.disconnect?.tag ?? 'the main disconnect'}.`,
    status: 'To confirm',
  });

  // Enclosure rating.
  const enclosure: CertItem[] = [];
  enclosure.push(ok('Required rating', iec ? `${ip(required) || required} (${required})` : required, 'Specification'));
  enclosure.push(enc ? (encMeets ? ok('Enclosure', `${enc.tag} ${enc.partNumber} — ${encText}`, 'Catalog') : tbc('Enclosure', `${enc.tag} ${enc.partNumber}${encNema ? ` — NEMA ${encNema}` : ''}`, `Rating does not show ${required}: check the datasheet`)) : tbc('Enclosure', '', 'No enclosure in the design'));
  for (const c of m.rc.filter((x) => x.mount === 'door' && x.category !== 'other')) {
    const n = c.part?.ratings.nema ?? c.part?.ratings.ip ?? c.part?.ratings.IP;
    enclosure.push(n ? ok(`Door device ${c.tag}`, `${c.partNumber} — ${/^IP/i.test(String(n)) ? String(n) : `NEMA ${String(n)}`}`, 'Catalog') : tbc(`Door device ${c.tag}`, `${c.partNumber}`, `Check it keeps the ${req} rating when fitted`));
  }
  if (p.hmi) enclosure.push(tbc(`Door HMI`, p.hmi.hmiPartNumber, `Check the front-panel rating keeps ${req} (gasket fitted)`));
  const glands = m.machine.cables.length;
  if (glands) enclosure.push(tbc('Cable entries', `${glands + 1} entries (field cables + supply)`, `Glands / cord grips rated ${req} or better`));

  // CE declaration of conformity (draft).
  let declaration: CertItem[] | null = null;
  if (iec) {
    const overview = (p.spec.overview ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
    declaration = [
      meta.company ? ok('Manufacturer', meta.company, 'Project data') : tbc('Manufacturer', '', 'Name of the machine builder'),
      tbc('Manufacturer address', '', 'Postal address of the machine builder'),
      tbc('Person authorised to compile the technical file', '', 'Name and address (must be in the EU)'),
      ok('Machine', p.projectName, 'Project data'),
      overview ? ok('Function', overview, 'Specification') : tbc('Function', '', 'Describe what the machine does'),
      tbc('Model / type and serial number', meta.projectNumber, 'Given by the shop'),
      ok('Directives', region === 'EU' ? 'Machinery Directive 2006/42/EC (Machinery Regulation (EU) 2023/1230 from 20 January 2027); EMC Directive 2014/30/EU' : 'Machinery Directive 2006/42/EC; EMC Directive 2014/30/EU (only if the machine is placed on the EU market)', 'Design basis'),
      ok('Harmonised standards applied', 'EN ISO 12100, EN 60204-1, EN ISO 13849-1, EN ISO 13849-2, EN ISO 13850; EN 61000-6-2 / -6-4 (EMC)', 'Design basis — check the current OJEU list'),
      tbc('Place and date', '', 'At signature'),
      tbc('Signature (name and function)', '', 'Signed by the manufacturer after the risk assessment and tests'),
    ];
  }

  const toConfirm: string[] = designWarnings(ctx).filter((x) => x.startsWith('The design is for')).map((x) => `Design: ${x}`);
  const pushItems = (section: string, items: CertItem[]) => { for (const i of items) if (i.confirm) toConfirm.push(`${section}: ${i.label}${i.value && i.value !== TO_CONFIRM ? ` (${i.value})` : ''} — ${i.source}`); };
  pushItems('Ratings plate', plate);
  if (sc.unknown.length) toConfirm.push(`Short-circuit rating: no published rating for ${sc.unknown.join(', ')}`);
  if (sc.unmet.length) toConfirm.push(`Short-circuit rating: condition not met for ${sc.unmet.map((u) => `${u.tag} (${u.condition})`).join(', ')}`);
  if (sc.exemptCheck.length) toConfirm.push(`Short-circuit rating: check the UL 508A SB4 exemption for ${sc.exemptCheck.join(', ')}`);
  if (safety.length) toConfirm.push(`Safety functions: required PL (PLr) and achieved PL of ${safety.map((s) => s.id).join(', ')} — risk assessment and ISO 13849-1 calculation`);
  else toConfirm.push('Safety functions: none found in the design or the specification');
  const unlisted = components.filter((c) => c.confirm && c.where !== 'field');
  if (unlisted.length) toConfirm.push(`Component listings: no ${iec ? 'CE / ' : ''}UL / CSA listing in the catalog for ${unlisted.map((c) => c.tag).join(', ')} — check the datasheets`);
  for (const s of statements) if (s.status !== 'OK') toConfirm.push(`${s.topic}: ${s.status === 'Check' ? 'check' : 'confirm'} at build`);
  pushItems('Enclosure', enclosure);
  if (declaration) pushItems('Declaration of conformity', declaration);
  if (iec) toConfirm.push('Risk assessment: carry out and sign (EN ISO 12100); this pack has the summary only');

  return { kind, title, scheme, plate, sccr: sc, weakest, safety, components, statements, enclosure, declaration, toConfirm };
}

const itemTable = (items: CertItem[]) => makeTable([['Item', 34], ['Value', 50], ['Source / basis', 50], ['Status', 14, 'center']], items.map((i) => [i.label, i.value, i.source, i.confirm ? 'TO CONFIRM' : 'OK']));

/** The certification pack as one PDF (Letter, title block, page numbers). */
export async function buildCertPackPdf(p: ProjectSnapshot): Promise<Blob> {
  const c = certPack(p);
  const iec = c.kind === 'ce';
  return simpleDoc(p, c.title, p.projectName, (w) => {
    w.text(c.scheme, { size: 9, bold: true, gap: 1 });
    w.para('Everything in this pack is read from the design data and the parts catalog. Values that the design cannot back up are marked TO CONFIRM and listed first: close each one before the file is submitted.');
    let n = 0;
    w.h2(`${++n}. Items to confirm (${c.toConfirm.length})`, false);
    if (c.toConfirm.length) w.bullets(c.toConfirm, { size: 8 }); else w.para('None.');
    if (!p.drawingCtx) return;

    w.h2(`${++n}. ${iec ? 'Rating plate' : 'Ratings plate (nameplate data)'}`, false);
    w.table(itemTable(c.plate), { fontSize: 7.6 });

    w.h2(`${++n}. ${iec ? 'Short-circuit rating (Icc) — component ratings' : 'Short-circuit current rating (SCCR) — UL 508A Supplement SB'}`, false);
    const rows: DocRow[] = (c.sccr?.rows ?? []).map((r) => [r.component, r.circuit, r.kA !== null ? `${r.kA} kA${r.met ? '' : ' (not counted)'}` : TO_CONFIRM.toUpperCase(), r.source, r.note, c.sccr!.limiting.includes(r.tag) ? 'WEAKEST' : '']);
    w.table(makeTable([['Component', 26], ['Circuit', 18], ['Rating', 13, 'center'], ['Source', 30], ['Note', 46], ['', 12, 'center']], rows), { fontSize: 6.9 });
    w.callout(`Weakest link: ${c.weakest}. ${c.sccr?.result ?? ''}`, c.sccr && !c.sccr.unknown.length && c.sccr.lowest !== null ? BRAND : RED, c.sccr && !c.sccr.unknown.length && c.sccr.lowest !== null ? INFO_FILL : WARN_FILL);

    w.h2(`${++n}. Safety functions — PL and category`, false);
    if (c.safety.length) w.table(makeTable([['SF', 7], ['Safety function', 20], ['Input devices', 24], ['Logic', 20], ['Stop cat.', 10], ['Device rating', 24], ['PLr', 16], ['Achieved PL / category', 24]],
      c.safety.map((s) => [s.id, s.name, s.initiating, s.logic, s.stopCategory, s.deviceRating, s.plr, s.achieved])), { fontSize: 6.7 });
    else w.para('No safety functions were found in the design or the specification.');

    w.h2(`${++n}. Components and listings`, false);
    w.table(makeTable([['Tag', 9], ['Part number', 20], ['Maker', 16], ['Description', 46], ['Where', 9], ['UL', 14], ['CSA', 14], ['CE', 10]],
      c.components.map((x) => [x.tag, x.partNumber, x.manufacturer, x.description, x.where, x.ul, x.csa, x.ce])), { fontSize: 6.4 });
    w.text(`Listings are shown only where the catalog gives them; "${TO_CONFIRM}" means check the maker's datasheet or certificate. Field devices are outside the panel ${iec ? 'assembly' : 'listing'}.`, { size: 7 });

    w.h2(`${++n}. Wire sizing, overcurrent protection and spacings`, false);
    w.table(makeTable([['Topic', 24], ['Statement', 100], ['Status', 14, 'center']], c.statements.map((s) => [s.topic, s.text, s.status.toUpperCase()])), { fontSize: 7.2 });

    w.h2(`${++n}. Enclosure rating`, false);
    w.table(itemTable(c.enclosure), { fontSize: 7.4 });

    if (c.declaration) {
      w.h2(`${++n}. EC declaration of conformity (draft)`, false);
      w.para('Draft for the manufacturer to complete and sign (Machinery Directive Annex II 1.A). It may only be signed once the risk assessment, the tests and the technical file are complete.');
      w.table(itemTable(c.declaration), { fontSize: 7.4 });
      w.h2(`${++n}. Risk assessment summary`, false);
      w.table(hazardTable(p), { fontSize: 7 });
      w.h3('Residual risks');
      w.bullets(residualRisks(p), { size: 8 });
      w.callout(riskStatement(p), RED, WARN_FILL);
    }

    w.h2(`${n + 1}. Standards`, false);
    const st: DocTable = standardsTable(p, docMeta(p));
    w.table(st, { fontSize: 7.2 });
    w.text(byRegion(p.info.region, 'Prepared for the UL 508A file of the listed panel shop. The listing mark is applied by the shop under its own UL procedure.', 'Prepared for the cUL (UL 508A) or CSA C22.2 No. 14 file of the certified panel shop.', 'Part of the technical file kept by the manufacturer for 10 years after the last machine is made.'), { size: 7 });
  });
}
