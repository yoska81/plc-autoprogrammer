import { sheetOnPaper } from '../../standards/regions';
import { codeRefs, supplyText } from '../derive';
import type { DrawingPlan, PlannedSheet } from './plan';
import { doorScale, drillScale, machineLayoutScale, panelScale, scaleText } from './scale';
import SheetFrame from './SheetFrame';
import { SymbolSetContext } from './symbolSet';
import { IoSheet } from './sheets/IoSheet';
import { DoorLayoutSheet, PanelLayoutSheet } from './sheets/LayoutSheets';
import { ControlSheet, MotorSheet, PowerSheet } from './sheets/SchematicSheets';
import { DrillingSheet } from './sheets/DrillingSheet';
import { AnalogSheet } from './sheets/AnalogSheet';
import { CableScheduleSheet, JunctionBoxSheet, MachineOverviewSheet } from './sheets/MachineSheets';
import { MachineLayoutSheet } from './sheets/MachineLayoutSheet';
import { BomSheet, CoverSheet, NotesSheet, TerminalSheet } from './sheets/TableSheets';
import { DeviceListSheet, LabelSheet, LegendSheet } from './sheets/ReferenceSheets';

function Content({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  switch (sheet.spec.kind) {
    case 'cover': return <CoverSheet plan={plan} sheet={sheet} />;
    case 'legend': return <LegendSheet plan={plan} sheet={sheet} />;
    case 'notes': return <NotesSheet plan={plan} sheet={sheet} />;
    case 'devices': return <DeviceListSheet plan={plan} sheet={sheet} />;
    case 'labels': return <LabelSheet plan={plan} sheet={sheet} />;
    case 'power': return <PowerSheet plan={plan} sheet={sheet} />;
    case 'motors': return <MotorSheet plan={plan} sheet={sheet} />;
    case 'control': return <ControlSheet plan={plan} sheet={sheet} />;
    case 'io': return <IoSheet plan={plan} sheet={sheet} />;
    case 'panel': return <PanelLayoutSheet plan={plan} sheet={sheet} />;
    case 'door': return <DoorLayoutSheet plan={plan} sheet={sheet} />;
    case 'terminals': return <TerminalSheet plan={plan} sheet={sheet} />;
    case 'bom': return <BomSheet plan={plan} sheet={sheet} />;
    case 'machine': return <MachineOverviewSheet plan={plan} sheet={sheet} />;
    case 'layout': return <MachineLayoutSheet plan={plan} sheet={sheet} />;
    case 'cables': return <CableScheduleSheet plan={plan} sheet={sheet} />;
    case 'jb': return <JunctionBoxSheet plan={plan} sheet={sheet} />;
    case 'drill': return <DrillingSheet plan={plan} sheet={sheet} />;
    case 'analog': return <AnalogSheet plan={plan} sheet={sheet} />;
  }
}

/** One complete sheet (frame + content) as an SVG element. */
export default function SheetView({ plan, sheet, width, height }: { plan: DrawingPlan; sheet: PlannedSheet; width?: string; height?: string }) {
  const kind = sheet.spec.kind;
  const sp = sheet.spec;
  const ansiScale = kind === 'panel' ? scaleText(panelScale(plan)) : kind === 'door' ? scaleText(doorScale(plan)) : sp.kind === 'drill' && sp.drawing ? scaleText(drillScale(sp.drill.w, sp.drill.h)) : kind === 'layout' ? `1:${machineLayoutScale(plan) ?? '—'}` : 'NONE';
  // On A3 the ANSI B sheet prints at 97.3 %: scale 1:5 becomes 1:5.1.
  const f = sheetOnPaper(plan.ctx.sheet).factor;
  const d = Number(ansiScale.slice(2)) / f;
  const scale = f !== 1 && /^1:[\d.]+$/.test(ansiScale) ? `1:${d.toFixed(d < 10 ? 2 : 1)} (A3)` : ansiScale;
  return (
    <SheetFrame
      width={width} height={height}
      info={{
        projectName: plan.ctx.projectName, title: sheet.title, n: sheet.n, total: plan.sheets.length,
        drawingNo: sheet.drawingNo, date: plan.date, scale, cpu: plan.ctx.plc.cpuPartNumber, codes: codeRefs(plan.ctx).short,
        doc: plan.doc, rev: sheet.rev, supply: supplyText(plan.model.supply),
      }}
    >
      <SymbolSetContext.Provider value={plan.ctx.symbols ?? 'ansi'}><Content plan={plan} sheet={sheet} /></SymbolSetContext.Provider>
    </SheetFrame>
  );
}
