import type { DrawingPlan, PlannedSheet } from './plan';
import { doorScale, panelScale, scaleText } from './scale';
import SheetFrame from './SheetFrame';
import { IoSheet } from './sheets/IoSheet';
import { DoorLayoutSheet, PanelLayoutSheet } from './sheets/LayoutSheets';
import { ControlSheet, MotorSheet, PowerSheet } from './sheets/SchematicSheets';
import { CableScheduleSheet, JunctionBoxSheet, MachineOverviewSheet } from './sheets/MachineSheets';
import { BomSheet, CoverSheet, NotesSheet, TerminalSheet } from './sheets/TableSheets';

function Content({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  switch (sheet.spec.kind) {
    case 'cover': return <CoverSheet plan={plan} sheet={sheet} />;
    case 'notes': return <NotesSheet plan={plan} sheet={sheet} />;
    case 'power': return <PowerSheet plan={plan} sheet={sheet} />;
    case 'motors': return <MotorSheet plan={plan} sheet={sheet} />;
    case 'control': return <ControlSheet plan={plan} sheet={sheet} />;
    case 'io': return <IoSheet plan={plan} sheet={sheet} />;
    case 'panel': return <PanelLayoutSheet plan={plan} sheet={sheet} />;
    case 'door': return <DoorLayoutSheet plan={plan} sheet={sheet} />;
    case 'terminals': return <TerminalSheet plan={plan} sheet={sheet} />;
    case 'bom': return <BomSheet plan={plan} sheet={sheet} />;
    case 'machine': return <MachineOverviewSheet plan={plan} sheet={sheet} />;
    case 'cables': return <CableScheduleSheet plan={plan} sheet={sheet} />;
    case 'jb': return <JunctionBoxSheet plan={plan} sheet={sheet} />;
  }
}

/** One complete sheet (frame + content) as an SVG element. */
export default function SheetView({ plan, sheet, width, height }: { plan: DrawingPlan; sheet: PlannedSheet; width?: string; height?: string }) {
  const kind = sheet.spec.kind;
  const scale = kind === 'panel' ? scaleText(panelScale(plan)) : kind === 'door' ? scaleText(doorScale(plan)) : 'NONE';
  return (
    <SheetFrame
      width={width} height={height}
      info={{
        projectName: plan.ctx.projectName, title: sheet.title, n: sheet.n, total: plan.sheets.length,
        drawingNo: sheet.drawingNo, date: plan.date, scale, cpu: plan.ctx.plc.cpuPartNumber,
      }}
    >
      <Content plan={plan} sheet={sheet} />
    </SheetFrame>
  );
}
