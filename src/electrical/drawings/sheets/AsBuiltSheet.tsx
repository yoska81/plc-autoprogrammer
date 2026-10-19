import { AREA, AREA_B, LW, LW_HEAVY, LW_THIN } from '../geometry';
import { ASBUILT_NETS, type AsBuiltNet, type DrawingPlan, type PlannedSheet, type SheetSpec } from '../plan';
import { Line, Txt } from '../symbols';

const CLASS_TEXT: Record<AsBuiltNet['cls'], string> = { ac: 'AC SUPPLY', pe: 'PROTECTIVE EARTH', dc: '24 VDC CONTROL', branch: 'BRANCH CIRCUIT' };

/**
 * As-built power distribution from cabinet photos: each traced wire (by its ferrule number) as a bus
 * with a drop to every device terminal it was read at; supply wires drawn heavy. Below, the wire
 * numbers read at one end only. Everything here was read from photos: verify on the cabinet.
 */
export function AsBuiltSheet({ sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'asbuilt' }>;
  const x0 = AREA.x + 8, labelW = 38, busX0 = x0 + labelW + 4, busX1 = AREA.x + AREA.w - 8;
  const top = AREA.y + 14;
  const footer = sp.single.length ? 26 : 12;
  const rowH = (AREA_B - footer - top) / ASBUILT_NETS;
  return (
    <g data-testid="asbuilt-sheet">
      <Txt x={x0} y={AREA.y + 7} size={3} bold>AS-BUILT FROM CABINET PHOTOS — WIRES TRACED BY THEIR NUMBERS (FERRULES). VERIFY ON THE CABINET BEFORE USE.</Txt>
      {!sp.nets.length && <Txt x={x0} y={top + 6} size={2.6} italic>No supply or branch wire number was read at two places in the photos.</Txt>}
      {sp.nets.map((n, i) => {
        const y = top + i * rowH + 4;
        const heavy = n.cls === 'ac' || n.cls === 'dc' || n.cls === 'pe';
        const step = Math.max(30, Math.min(60, (busX1 - busX0 - 16) / Math.max(1, n.ends.length)));
        return (
          <g key={n.wire} data-asbuilt-wire={n.wire}>
            <rect x={x0} y={y - 4} width={labelW} height={8} strokeWidth={LW} fill="none" />
            <Txt x={x0 + labelW / 2} y={y + 1} size={3.2} bold mono anchor="middle" maxW={labelW - 2}>{n.wire}</Txt>
            <Txt x={x0} y={y + 8} size={2} maxW={labelW}>{CLASS_TEXT[n.cls]}</Txt>
            <Line x1={busX0} y1={y} x2={busX0 + 16 + step * (n.ends.length - 1) + 4} y2={y} w={heavy ? LW_HEAVY : LW} dash={n.cls === 'pe' ? '3 1.5' : undefined} />
            {n.ends.map((e, k) => {
              const tx = busX0 + 16 + k * step;
              return (
                <g key={`${e.tag}:${e.terminal}`}>
                  <circle cx={tx} cy={y} r={0.7} fill="#000" />
                  <Line x1={tx} y1={y} x2={tx} y2={y + rowH * 0.42} w={LW} />
                  <circle cx={tx} cy={y + rowH * 0.42 + 0.9} r={0.9} fill="#fff" strokeWidth={LW_THIN} />
                  <Txt x={tx + 1.8} y={y + rowH * 0.42 + 1.8} size={2.5} bold mono maxW={step - 4}>{`${e.tag}:${e.terminal}`}</Txt>
                  {e.what && <Txt x={tx + 1.8} y={y + rowH * 0.42 + 4.6} size={1.9} maxW={step - 4}>{e.what.toUpperCase()}</Txt>}
                </g>
              );
            })}
          </g>
        );
      })}
      {sp.single.length > 0 && (
        <g>
          <Line x1={x0} y1={AREA_B - footer + 2} x2={busX1} y2={AREA_B - footer + 2} w={LW_THIN} />
          <Txt x={x0} y={AREA_B - footer + 7} size={2.5} bold>WIRE NUMBERS READ AT ONE END ONLY (OTHER END NOT IN THE PHOTOS — TRACE ON THE CABINET):</Txt>
          <Txt x={x0} y={AREA_B - footer + 12} size={2.3} mono maxW={busX1 - x0}>{sp.single.map((s) => `${s.wire} @ ${s.at}`).join('   ·   ')}</Txt>
        </g>
      )}
      <Txt x={x0} y={AREA_B - 3} size={2.2} italic>{`SHEET ${sp.page} OF ${sp.pages} OF THE AS-BUILT WIRING. PLC I/O WIRES ARE ON THE I/O SHEETS. HEAVY = SUPPLY (AC / 24 VDC), DASHED = PE.`}</Txt>
    </g>
  );
}
