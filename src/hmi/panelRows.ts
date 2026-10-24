import { HMI_MODELS, type HmiModel } from './hmiCatalog';
import { catalogPanels } from './panels';

/** One touch panel row of the HMI chooser (C-more list or parts catalog). */
export interface PanelRow {
  pn: string;
  maker: string;
  vendor: string;
  series: string;
  sizeIn: number;
  res: string;
  /** Null when the maker's resolution is not confirmed (listed, not selectable). */
  model: HmiModel | null;
  legacy: boolean;
  successor?: string;
  price?: string;
  /** The panel of an all-in-one PLC: chosen together with that CPU. */
  builtIn?: boolean;
  /** Availability note from the catalog (e.g. not on the maker's current series page). */
  note?: string;
}

const money = (v: unknown, cur: unknown) => (typeof v === 'number' ? `${cur === 'EUR' ? '€' : '$'}${v.toLocaleString('en-US')}` : undefined);

/** Every touch panel: C-more list + the parts catalog's panels of every maker. */
export function allPanelRows(): PanelRow[] {
  return [
    ...HMI_MODELS.filter((h) => h.touch).map((h): PanelRow => ({
      pn: h.partNumber, maker: 'AutomationDirect', vendor: 'automationdirect', series: h.family, sizeIn: h.sizeIn,
      res: `${h.widthPx}×${h.heightPx}`, model: h, legacy: Boolean(h.legacy), successor: h.successor, price: money(h.listPrice, 'USD'),
    })),
    ...catalogPanels().filter((o) => o.model?.touch !== false && String(o.part.ratings.touch ?? '') !== 'none').map((o): PanelRow => {
      const r = o.part.ratings;
      return {
        pn: o.part.partNumber, maker: o.part.manufacturer, vendor: o.part.vendor ?? '', series: String(r.series ?? o.part.family ?? o.part.manufacturer),
        sizeIn: Number(r.displayIn ?? r.sizeIn ?? 0), res: o.model ? `${o.model.widthPx}×${o.model.heightPx}` : '—', model: o.model,
        legacy: r.lifecycle === 'legacy', successor: r.successor ? String(r.successor) : undefined, price: money(r.listPrice, r.currency),
        builtIn: o.part.category === 'plc', note: r.lifecycleNote ? String(r.lifecycleNote) : undefined,
      };
    }),
  ];
}
