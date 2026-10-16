import type { DrawingContext } from '../electrical/derive';
import { withIecDesignations } from './designations';
import { regionSpec, type DesignationStyle, type Region, type SheetFormat, type SymbolSet } from './regions';

/** Per-project drawing choices; each defaults to the region's (US/Canada: NFPA tags, ANSI symbols, ANSI B). */
export interface DrawingOptions { designations?: DesignationStyle; symbols?: SymbolSet; sheet?: SheetFormat }

export function drawingOptions(info: { region: Region; drawing?: DrawingOptions }): Required<DrawingOptions> {
  const r = regionSpec(info.region);
  return {
    designations: info.drawing?.designations ?? r.designations,
    symbols: info.drawing?.symbols ?? r.symbols,
    sheet: info.drawing?.sheet ?? r.sheet,
  };
}

/** Apply the project's drawing choices to a drawing context (IEC 81346 designations rename the design's tags). */
export function withDrawingOptions(ctx: DrawingContext, info: { region: Region; drawing?: DrawingOptions }): DrawingContext {
  const o = drawingOptions(info);
  const out: DrawingContext = { ...ctx, symbols: o.symbols, sheet: o.sheet, designations: o.designations };
  if (o.designations !== 'iec81346') return out;
  const { design, layout } = withIecDesignations(ctx.design, ctx.machineLayout);
  return { ...out, design, machineLayout: layout };
}
