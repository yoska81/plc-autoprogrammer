import { memo } from 'react';
import { sheetOnPaper } from '../../standards/regions';
import { codeRefs, supplyText } from '../derive';
import type { DrawingPlan, PlannedSheet } from './plan';
import { doorScale, drillSheetScale, machineLayoutScale, panelScale, scaleText } from './scale';
import SheetFrame from './SheetFrame';
import { SymbolSetContext } from './symbolSet';
import { IoSheet } from './sheets/IoSheet';
import { DoorLayoutSheet, PanelLayoutSheet } from './sheets/LayoutSheets';
import { ControlSheet, MotorSheet, PowerSheet } from './sheets/SchematicSheets';
import { DrillingSheet } from './sheets/DrillingSheet';
import { ServoSheet } from './sheets/ServoSheet';
import { DriveSheet } from './sheets/DriveSheet';
import { AnalogSheet } from './sheets/AnalogSheet';
import { AsBuiltSheet } from './sheets/AsBuiltSheet';
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
    case 'drive': return <DriveSheet plan={plan} sheet={sheet} />;
    case 'asbuilt': return <AsBuiltSheet plan={plan} sheet={sheet} />;
    case 'servo': return <ServoSheet plan={plan} sheet={sheet} />;
  }
}

/** One complete sheet (frame + content) as an SVG element. */
function SheetView({ plan, sheet, width, height }: { plan: DrawingPlan; sheet: PlannedSheet; width?: string; height?: string }) {
  const kind = sheet.spec.kind;
  const sp = sheet.spec;
  const ansiScale = kind === 'panel' ? scaleText(panelScale(plan)) : kind === 'door' ? scaleText(doorScale(plan)) : sp.kind === 'drill' && sp.drawing ? scaleText(drillSheetScale(sp.drill)) : kind === 'layout' ? `1:${machineLayoutScale(plan) ?? '—'}` : 'NONE';
  // On A3 the content is drawn at 97.1 %: scale 1:5 becomes 1:5.15.
  const f = sheetOnPaper(plan.ctx.sheet).factor;
  const d = Number(ansiScale.slice(2)) / f;
  const scale = f !== 1 && /^1:[\d.]+$/.test(ansiScale) ? `1:${d.toFixed(d < 10 ? 2 : 1)} (A3)` : ansiScale;
  return (
    <SheetFrame
      width={width} height={height} sheet={plan.ctx.sheet}
      info={{
        projectName: plan.ctx.projectName, title: sheet.title, n: sheet.n, total: plan.sheets.length,
        drawingNo: sheet.drawingNo, date: plan.date, scale, cpu: plan.ctx.plc.cpuPartNumber, codes: codeRefs(plan.ctx).short,
        doc: plan.doc, rev: sheet.rev, supply: supplyText(plan.model.supply),
      }}
    >
      <SymbolSetContext.Provider value={plan.ctx.symbols ?? 'ansi'}><g data-cad-sheet={kind}><Content plan={plan} sheet={sheet} /></g></SymbolSetContext.Provider>
    </SheetFrame>
  );
}

// Memoized: the drawing document re-renders on scroll (current sheet); a sheet redraws only when its own data changes.
export default memo(SheetView);
