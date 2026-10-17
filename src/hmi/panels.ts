/**
 * Touch panels from every maker in the parts catalog (src/electrical/catalogs), as HmiModel
 * entries the designer can use next to the C-more list. Resolution, size, touch, ports and
 * cutout come from the catalog ratings (each sourced from the maker's datasheet); a panel whose
 * resolution is not confirmed is listed but cannot be designed for — screens are never laid out
 * on a guessed resolution.
 */
import { ALL_PARTS } from '../electrical/catalogs';
import type { CatalogPart } from '../electrical/types';
import type { HmiModel } from './hmiCatalog';

/**
 * The maker's confirmed resolution ('800x480' in ratings.resolutionPx) → [800, 480], landscape.
 * The older free-text `resolution` does not count: where the datasheet could not confirm it,
 * resolutionPx is left out on purpose.
 */
export function parseResolution(p: CatalogPart): [number, number] | null {
  const t = String(p.ratings.resolutionPx ?? '');
  const m = t.match(/(\d{3,4})\s*[x×]\s*(\d{2,4})/i);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  return a >= b ? [a, b] : [b, a];
}

const num = (v: unknown) => (v === undefined || v === '' ? NaN : Number(v));

/** The other half of a display + box pair (e.g. Schneider HMIDT732 display + HMIG3U box). */
function partnerOf(p: CatalogPart): CatalogPart | undefined {
  const pn = String(p.ratings.pairsWith ?? '').trim();
  return pn ? ALL_PARTS.find((x) => x.partNumber.toUpperCase() === pn.toUpperCase()) : undefined;
}

/** One catalog panel as the designer sees it; for a pair, the display carries the box's comms. */
export function panelPart(p: CatalogPart): CatalogPart {
  const box = partnerOf(p);
  if (!box || parseResolution(box)) return p;
  return { ...p, ratings: { ...box.ratings, ...p.ratings, protocols: p.ratings.protocols ?? box.ratings.protocols ?? '', plcDrivers: p.ratings.plcDrivers ?? box.ratings.plcDrivers ?? '' } };
}

export interface PanelOption {
  part: CatalogPart;
  /** Null when the maker's resolution is not confirmed in the catalog. */
  model: HmiModel | null;
}

function toModel(raw: CatalogPart): HmiModel | null {
  const p = panelPart(raw);
  const res = parseResolution(p);
  if (!res) return null;
  const size = num(p.ratings.displayIn ?? p.ratings.sizeIn);
  const cw = num(p.ratings.cutoutWidthMm), ch = num(p.ratings.cutoutHeightMm);
  const eth = num(p.ratings.ethernetPorts);
  const box = partnerOf(raw);
  return {
    partNumber: raw.partNumber,
    family: String(p.family ?? p.ratings.family ?? raw.manufacturer),
    manufacturer: raw.manufacturer,
    description: box ? `${raw.description} with ${box.partNumber} box` : raw.description,
    sizeIn: Number.isFinite(size) ? size : 0,
    widthPx: res[0],
    heightPx: res[1],
    touch: !/^(no|none|false)$/i.test(String(p.ratings.touch ?? 'yes')),
    color: true,
    ethernet: Number.isFinite(eth) ? eth > 0 : /ethernet|profinet|ethernet\/ip|modbus tcp/i.test(`${p.ratings.ports ?? ''} ${p.ratings.protocols ?? ''}`),
    serial: String(p.ratings.ports ?? ''),
    supportsClickEthernet: String(p.ratings.plcDrivers ?? '').split(',').map((s) => s.trim()).includes('click'),
    cutoutMm: Number.isFinite(cw) && Number.isFinite(ch) ? { width: cw, height: ch } : undefined,
    bezelMm: raw.widthMm && raw.heightMm ? { width: raw.widthMm, height: raw.heightMm } : undefined,
    url: String(p.ratings.datasheet ?? raw.url),
    verified: raw.verified,
    software: p.ratings.software ? String(p.ratings.software) : undefined,
    catalog: true,
  };
}

let cache: PanelOption[] | null = null;

/** Every catalog touch panel (display halves of pairs; boxes on their own are left out). */
export function catalogPanels(): PanelOption[] {
  if (cache) return cache;
  cache = ALL_PARTS
    .filter((p) => p.category === 'hmi')
    .filter((p) => !(p.ratings.pairsWith && !parseResolution(p) && partnerOf(p) && parseResolution(partnerOf(p)!)))
    .map((part) => ({ part: panelPart(part), model: toModel(part) }));
  return cache;
}

/** A catalog panel the designer can lay out screens for (resolution confirmed). */
export function catalogPanel(partNumber: string): HmiModel | undefined {
  const k = partNumber.trim().toUpperCase();
  return catalogPanels().find((o) => o.part.partNumber.toUpperCase() === k)?.model ?? undefined;
}
