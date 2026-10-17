/**
 * Label printers and their supplies (cartridges / label rolls).
 *
 * Only data checked on the manufacturer's site or a distributor's product
 * page goes here, with the page in `source`. Anything that could not be
 * confirmed is left out (see docs/status/claude-isa-dev-labels-print.md),
 * never guessed. Brady first; Brother, Weidmüller and Phoenix Contact can be
 * added as more brands with the same shape.
 */

export type PrinterBrand = 'Brady' | 'Brother' | 'Weidmüller' | 'Phoenix Contact';

export const BRANDS: { brand: PrinterBrand; available: boolean }[] = [
  { brand: 'Brady', available: true },
  { brand: 'Brother', available: false },
  { brand: 'Weidmüller', available: false },
  { brand: 'Phoenix Contact', available: false },
];

export interface LabelPrinter {
  id: string;
  brand: PrinterBrand;
  model: string;
  /** Print resolution, dots per inch. */
  dpi?: number;
  /** Widest supply the printer takes, mm. */
  maxWidthMm?: number;
  source: string;
  note?: string;
}

/** What a supply is made for. */
export type SupplyKind = 'wire' | 'sleeve' | 'terminal' | 'device' | 'tape';

export const SUPPLY_KIND_TITLE: Record<SupplyKind, string> = {
  wire: 'Wire markers (self-laminating wraps)',
  sleeve: 'Heat-shrink sleeves',
  terminal: 'Terminal block markers',
  device: 'Device tags (die-cut)',
  tape: 'Continuous tape',
};

export interface LabelSupply {
  partNumber: string;
  brand: PrinterBrand;
  /** Printer ids this supply fits. */
  printers: string[];
  kind: SupplyKind;
  /** Continuous supplies: `heightMm` is the tape width and the length follows the text. */
  continuous: boolean;
  /** Label size in mm along the text (width) and across it (height). Continuous: width 0. */
  widthMm: number;
  heightMm: number;
  /** Printable area when smaller than the label (self-laminating wraps: the white part), from the top-left corner. */
  printable?: { x: number; y: number; w: number; h: number };
  /** Continuous self-laminating tape: the printable band across the tape (from its top edge). */
  band?: { y: number; h: number };
  /** Labels side by side on the liner (die-cut rolls). */
  across?: number;
  /**
   * Liner geometry for "match the roll" PDFs (N labels across per page). Only
   * set when the liner width, gap and margin were confirmed; otherwise that
   * page layout is not offered for the supply.
   */
  liner?: { widthMm: number; gapMm: number; marginMm: number; source: string; derived?: string };
  material: string;
  color: string;
  perRoll?: number;
  source: string;
  note?: string;
  /** Set when part of the entry could not be confirmed: what to check. */
  check?: string;
}

export const PRINTERS: LabelPrinter[] = [
  { id: 'brady-m211', brand: 'Brady', model: 'M211', dpi: 203, maxWidthMm: 19.05, source: 'https://www.advanced-automationinc.com/brady-accessory-m211/', note: 'M21- cartridges (label and ribbon in one); print width up to 15.75 mm' },
  { id: 'brady-bmp21-plus', brand: 'Brady', model: 'BMP21-PLUS', dpi: 203, maxWidthMm: 19.1, source: 'https://l-com.com/Images/Downloadables/Datasheets/ds_BMP21-PLUS.pdf', note: 'M21- cartridges; print width up to 16 mm' },
  { id: 'brady-m611', brand: 'Brady', model: 'M611', dpi: 300, maxWidthMm: 50.8, source: 'https://www.advanced-automationinc.com/brady-accessory-m611/', note: 'M6- / M6C- media with a separate M61-R4310 ribbon' },
  { id: 'brady-bmp41', brand: 'Brady', model: 'BMP41', dpi: 300, maxWidthMm: 25.4, source: 'https://docs.rs-online.com/a0c4/A700000007433164.pdf', note: 'M4- / M4C- cartridges (older M- / MC- numbers)' },
  { id: 'brady-bmp51', brand: 'Brady', model: 'BMP51', dpi: 300, maxWidthMm: 38.1, source: 'https://www.advanced-automationinc.com/content/product_downloads/brady/Brady%20BMP51%20Printer%20Spec%20Sheet.pdf', note: 'M4- / M4C- cartridges; print width up to 36.6 mm' },
  { id: 'brady-i3300', brand: 'Brady', model: 'i3300', dpi: 300, maxWidthMm: 107.95, source: 'https://www.advanced-automationinc.com/brady-i3300-barcode-printer-149552/', note: 'B33- / B33C- media rolls with a separate B30-series ribbon' },
  { id: 'brady-i5300', brand: 'Brady', model: 'i5300 (600 dpi)', dpi: 600, maxWidthMm: 107.95, source: 'https://www.advanced-automationinc.com/brady-accessory-151294/', note: 'Same B33- media as the i3300' },
  { id: 'brady-i7100', brand: 'Brady', model: 'i7100', maxWidthMm: 109.98, source: 'https://goind.com.au/cdn/shop/files/Brady_i7100_Spec_Sheet_New.pdf', note: '300 or 600 dpi models; separate media and ribbon rolls (THT-, PS- ...)' },
];

export const SUPPLIES: LabelSupply[] = [
  // M211 / BMP21-PLUS (M21- cartridges)
  { partNumber: 'M21-750-499', brand: 'Brady', printers: ['brady-m211', 'brady-bmp21-plus'], kind: 'device', continuous: true, widthMm: 0, heightMm: 19.05, material: 'B-499 nylon cloth', color: 'black on white', source: 'https://www.advanced-automationinc.com/brady-nylon-cloth-labels-label-m21-750-499/', note: '16 ft cartridge; supplied with the M211 and BMP21-PLUS' },
  { partNumber: 'M21-1000-427', brand: 'Brady', printers: ['brady-m211', 'brady-bmp21-plus'], kind: 'wire', continuous: true, widthMm: 0, heightMm: 25.4, band: { y: 0, h: 9.53 }, material: 'B-427 self-laminating vinyl', color: 'white band, clear tail', source: 'https://www.advanced-automationinc.com/brady-self-laminating-label-m21-1000-427/', note: '14 ft cartridge; 9.53 mm printable band, the clear part wraps over the print' },
  { partNumber: 'M21-375-C-342', brand: 'Brady', printers: ['brady-m211', 'brady-bmp21-plus'], kind: 'sleeve', continuous: true, widthMm: 0, heightMm: 16.38, material: 'B-342 PermaSleeve heat-shrink polyolefin', color: 'white', source: 'https://www.advanced-automationinc.com/brady-permasleeve-series-label-m21-375-c-342/', note: '7 ft cartridge; wire OD 3.18–8.13 mm (12–4 AWG), 3:1 shrink' },
  { partNumber: 'M21-500-499-TB', brand: 'Brady', printers: ['brady-m211', 'brady-bmp21-plus'], kind: 'terminal', continuous: true, widthMm: 0, heightMm: 12.7, material: 'B-499 nylon cloth', color: 'black on white', source: 'https://www.globalindustrial.com/p/bmp21-series-terminal-block-nylon-cloth-labels-1-2-w-black-white-m21-500-499-tb', note: '16 ft cartridge for terminal blocks; M211 listed in the Brady M211 brochure' },
  // M611 (M6- / M6C- media)
  { partNumber: 'M6C-750-499', brand: 'Brady', printers: ['brady-m611'], kind: 'device', continuous: true, widthMm: 0, heightMm: 19.05, material: 'nylon cloth', color: 'white', source: 'https://www.digikey.com/en/products/detail/brady-corporation/m6c-750-499/18691074', note: '30 ft roll' },
  { partNumber: 'M6-18-427', brand: 'Brady', printers: ['brady-m611'], kind: 'wire', continuous: false, widthMm: 19.05, heightMm: 25.4, material: 'B-427 self-laminating vinyl', color: 'white / clear', perRoll: 250, source: 'https://www.digikey.com/en/products/detail/brady-corporation/M6-18-427/18690511', check: 'Printable (white) area not stated by the source; text is placed on the whole label' },
  { partNumber: 'M6-32-427', brand: 'Brady', printers: ['brady-m611'], kind: 'wire', continuous: false, widthMm: 38.1, heightMm: 38.1, material: 'B-427 self-laminating vinyl', color: 'white / clear', perRoll: 250, source: 'https://www.digikey.com/en/products/detail/brady-corporation/M6-32-427/18691451', check: 'Printable (white) area not stated by the source; text is placed on the whole label' },
  { partNumber: 'M6-125-175-342-WT', brand: 'Brady', printers: ['brady-m611'], kind: 'sleeve', continuous: false, widthMm: 44.5, heightMm: 6, material: 'B-342 heat-shrink polyolefin', color: 'white', perRoll: 100, source: 'https://www.digikey.com/en/products/detail/brady-corporation/M6-125-175-342-WT/18690031', note: 'Wire OD 1.2–2.8 mm', check: 'M611 compatibility inferred from the M6- prefix (not stated on the source page)' },
  // BMP41 / BMP51 (M4- / M4C- cartridges)
  { partNumber: 'M4-91-427', brand: 'Brady', printers: ['brady-bmp41', 'brady-bmp51'], kind: 'wire', continuous: false, widthMm: 25.4, heightMm: 38.1, material: 'B-427 self-laminating vinyl', color: 'white / clear', perRoll: 180, source: 'https://www.digikey.com/en/products/detail/brady-corporation/M4-91-427/21348426', note: 'Replaces M-91-427', check: 'Printable (white) area not stated by the source; text is placed on the whole label' },
  { partNumber: 'M4C-375-7641', brand: 'Brady', printers: ['brady-bmp41', 'brady-bmp51'], kind: 'sleeve', continuous: true, widthMm: 0, heightMm: 16.38, material: 'low-smoke polyolefin heat-shrink sleeve', color: 'white', source: 'https://www.digikey.com/en/products/detail/brady-corporation/M4C-375-7641/21348278', note: '5.5 ft cartridge; 0.375 in sleeve' },
  { partNumber: 'M4C-125-342', brand: 'Brady', printers: ['brady-bmp41', 'brady-bmp51'], kind: 'sleeve', continuous: true, widthMm: 0, heightMm: 5.97, material: 'B-342 heat-shrink polyolefin', color: 'white', source: 'https://www.digikey.com/en/products/detail/brady-corporation/M4C-125-342/21348207', note: '7 ft cartridge; 0.125 in sleeve' },
  { partNumber: 'M4C-1000-595-WT-BK', brand: 'Brady', printers: ['brady-bmp41', 'brady-bmp51'], kind: 'device', continuous: true, widthMm: 0, heightMm: 25.4, material: 'indoor/outdoor vinyl', color: 'black on white', source: 'https://www.digikey.com/en/products/detail/brady-corporation/M4C-1000-595-WT-BK/21348220', note: '25 ft cartridge' },
  { partNumber: 'M-48-427', brand: 'Brady', printers: ['brady-bmp41'], kind: 'wire', continuous: false, widthMm: 25.4, heightMm: 19.05, material: 'B-427 self-laminating vinyl', color: 'white / clear', perRoll: 200, source: 'https://docs.rs-online.com/a0c4/A700000007433164.pdf', check: 'Older part number from the BMP41 datasheet; check it is still sold' },
  { partNumber: 'M-131-499', brand: 'Brady', printers: ['brady-bmp41'], kind: 'device', continuous: false, widthMm: 12.7, heightMm: 25.4, material: 'B-499 nylon cloth', color: 'black on white', perRoll: 180, source: 'https://docs.rs-online.com/a0c4/A700000007433164.pdf', check: 'Older part number from the BMP41 datasheet; check it is still sold' },
  // i3300 / i5300 (B33- media)
  { partNumber: 'B33-80-427', brand: 'Brady', printers: ['brady-i3300', 'brady-i5300'], kind: 'wire', continuous: false, widthMm: 12.7, heightMm: 19.05, printable: { x: 0, y: 0, w: 12.7, h: 9.53 }, across: 4, liner: { widthMm: 63.5, gapMm: 2.54, marginMm: 2.54, source: 'https://www.advanced-automationinc.com/brady-self-laminating-label-b33-80-427/', derived: 'Liner width 63.5 mm and label repeat 15.24 mm across are from the source; gap = repeat − label width; the row is assumed centred on the liner (edge margin not published) — check with a test print' }, material: 'B-427 self-laminating vinyl', color: 'white / translucent', perRoll: 2500, source: 'https://www.advanced-automationinc.com/brady-self-laminating-label-b33-80-427/', note: '16–12 AWG' },
  { partNumber: 'B33-117-427', brand: 'Brady', printers: ['brady-i3300', 'brady-i5300'], kind: 'wire', continuous: false, widthMm: 25.4, heightMm: 31.75, printable: { x: 0, y: 0, w: 25.4, h: 12.7 }, across: 2, liner: { widthMm: 58.42, gapMm: 2.54, marginMm: 2.54, source: 'https://www.advanced-automationinc.com/brady-label-b33-117-427/', derived: 'Liner width 58.42 mm and label repeat 27.94 mm across are from the source; gap = repeat − label width; the row is assumed centred on the liner (edge margin not published) — check with a test print' }, material: 'B-427 self-laminating vinyl', color: 'white / translucent', perRoll: 2000, source: 'https://www.advanced-automationinc.com/brady-label-b33-117-427/', note: '12–6 AWG' },
  { partNumber: 'B33-187-2-342-2', brand: 'Brady', printers: ['brady-i3300', 'brady-i5300'], kind: 'sleeve', continuous: false, widthMm: 25.4, heightMm: 8.51, material: 'B-342 PermaSleeve heat-shrink polyolefin', color: 'white', perRoll: 1500, source: 'https://www.advanced-automationinc.com/brady-permasleeve-series-label-b33-187-2-342-2/', note: 'Wire OD 1.57–3.81 mm (20–10 AWG)' },
  { partNumber: 'B33-5-422', brand: 'Brady', printers: ['brady-i3300', 'brady-i5300'], kind: 'device', continuous: false, widthMm: 25.4, heightMm: 12.7, across: 3, liner: { widthMm: 85.09, gapMm: 1.91, marginMm: 2.54, source: 'https://www.advanced-automationinc.com/brady-toughbond-label-b33-5-422/', derived: 'Liner width 85.09 mm and label repeat 27.31 mm across are from the source; gap = repeat − label width; the row is assumed centred on the liner (edge margin not published) — check with a test print' }, material: 'B-422 polyester', color: 'white', source: 'https://www.digikey.com/en/products/detail/brady-corporation/B33-5-422/12212091', note: '25.4 mm across the roll, 12.7 mm along it (from the label repeat on the source)' },
  { partNumber: 'B33C-375-498', brand: 'Brady', printers: ['brady-i3300'], kind: 'tape', continuous: true, widthMm: 0, heightMm: 9.53, material: 'B-498 vinyl cloth', color: 'white', source: 'https://www.digikey.com/en/products/detail/brady-corporation/B33C-375-498/11585837', note: '85 ft roll' },
  // i7100 (THT- / PS- media)
  { partNumber: 'THT-64-427-3', brand: 'Brady', printers: ['brady-i7100'], kind: 'wire', continuous: false, widthMm: 25.4, heightMm: 57.15, printable: { x: 0, y: 0, w: 25.4, h: 19.05 }, material: 'B-427 self-laminating vinyl', color: 'white / translucent', perRoll: 3000, source: 'https://www.advanced-automationinc.com/brady-1-x-2-25-self-laminating-label-tht-64-427-3/', note: 'Wire OD 6.10–12.19 mm (6–0 AWG); the 57.15 mm side runs across the roll (vertical repeat 30.15 mm)' },
  { partNumber: 'PS-250-2-WT-S-2', brand: 'Brady', printers: ['brady-i7100'], kind: 'sleeve', continuous: false, widthMm: 25.4, heightMm: 11.15, across: 2, material: 'B-342 PermaSleeve heat-shrink polyolefin', color: 'white', perRoll: 1000, source: 'https://www.advanced-automationinc.com/brady-label-ps-250-2-wt-s-2/', note: 'Wire OD 2.39–5.46 mm (16–8 AWG), 3:1 shrink' },
  { partNumber: 'THT-14-498-10', brand: 'Brady', printers: ['brady-i7100'], kind: 'terminal', continuous: false, widthMm: 16.51, heightMm: 5.08, across: 4, liner: { widthMm: 74.93, gapMm: 1.27, marginMm: 2.54, source: 'https://www.advanced-automationinc.com/brady-cleanlift-label-tht-14-498-10/', derived: 'Liner width 74.93 mm and label repeat 17.78 mm across are from the source; gap = repeat − label width; the row is assumed centred on the liner (edge margin not published) — check with a test print' }, material: 'B-498 vinyl cloth', color: 'white', source: 'https://www.digikey.com/en/products/detail/brady-corporation/THT-14-498-10/12219444', check: 'Use as a terminal marker inferred from its size (source says "component")' },
  { partNumber: 'THT-136-499-3', brand: 'Brady', printers: ['brady-i7100'], kind: 'device', continuous: false, widthMm: 38.1, heightMm: 19.05, material: 'B-499 nylon cloth', color: 'white', perRoll: 3000, source: 'https://www.advanced-automationinc.com/brady-1-5-x-0-75-nylon-cloth-labels-label-tht-136-499-3/' },
];

export const printerById = (id: string) => PRINTERS.find((p) => p.id === id);
export const supplyByPart = (pn: string) => SUPPLIES.find((s) => s.partNumber === pn);
export const suppliesFor = (printerId: string) => SUPPLIES.filter((s) => s.printers.includes(printerId));

/** "B-427 vinyl, white · 25.4 x 12.7 mm · 250 per roll" */
export function supplyText(s: LabelSupply): string {
  const size = s.continuous ? `${s.heightMm} mm continuous` : `${s.widthMm} x ${s.heightMm} mm`;
  return [`${s.material}, ${s.color}`, size, s.perRoll ? `${s.perRoll} per roll` : ''].filter(Boolean).join(' · ');
}
