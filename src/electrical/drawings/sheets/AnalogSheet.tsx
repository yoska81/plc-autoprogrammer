/**
 * Analog I/O loop sheet: one loop per analog signal, left to right —
 * PLC / module channel terminal, wire numbers, TBA terminals (+, −, shield),
 * shielded twisted-pair cable (shield grounded at the panel end only), field device
 * with its range and engineering-unit scale. Data: model.analog (electrical/analog.ts).
 */
import type { AnalogCircuit } from '../../analog';
import { AREA, AREA_B, AREA_R, LW_THIN } from '../geometry';
import type { DrawingPlan, PlannedSheet, SheetSpec } from '../plan';
import { Dot, Ground, Line, TermBox, TermPt, Txt, WireNo } from '../symbols';

export const ANALOG_PER_SHEET = 6;
const PITCH = 30;
const X = { plc: AREA.x + 18, tb: AREA.x + 150, cab: AREA.x + 205, dev: AREA.x + 262, desc: AREA.x + 300 };
const Y0 = AREA.y + 16;

/** PLC analog output wired straight to a device inside the panel (VFD speed input). */
function InternalLoop({ c, y }: { c: AnalogCircuit; y: number }) {
  const r = c.row, d = c.internal!;
  const yP = y, yM = y + 7, yS = y + 14;
  return (
    <g>
      <rect x={X.plc} y={yP - 4} width={34} height={22} strokeWidth={0.45} fill="#fff" />
      <Txt x={X.plc + 17} y={yP - 5.5} size={2.3} anchor="middle" mono bold>{c.moduleTag}</Txt>
      <Txt x={X.plc + 2} y={yP + 0.9} size={2.4} mono bold>{r.terminal}</Txt>
      <Txt x={X.plc + 2} y={yM + 0.9} size={2.4} mono bold>0V</Txt>
      <Txt x={X.plc + 2} y={yS + 0.9} size={2.1} mono>{r.channel.toUpperCase()}</Txt>
      <TermPt x={X.plc + 34} y={yP} />
      <TermPt x={X.plc + 34} y={yM} />
      <Line x1={X.plc + 34.7} y1={yP} x2={X.dev - 1} y2={yP} />
      <Line x1={X.plc + 34.7} y1={yM} x2={X.dev - 1} y2={yM} />
      <WireNo x={(X.plc + X.tb) / 2} y={yP} n={c.wires.plus} />
      <WireNo x={(X.plc + X.tb) / 2} y={yM} n={c.wires.minus} />
      <ellipse cx={X.cab + 8} cy={(yP + yM) / 2} rx={5} ry={(yM - yP) / 2 + 2.5} strokeWidth={LW_THIN} strokeDasharray="1.2 0.8" fill="none" />
      <Line x1={X.plc + 34.7} y1={yS} x2={X.plc + 66} y2={yS} w={LW_THIN} dash="1 0.8" />
      <WireNo x={X.plc + 50} y={yS} n={`${r.address}SH`} />
      <Ground x={X.plc + 66} y={yS} />
      <Txt x={X.plc + 70} y={yS + 0.9} size={1.8}>SHIELD TO PE AT THE PLC END ONLY</Txt>
      <Txt x={X.tb} y={yP - 4.5} size={2.0} anchor="middle" mono>INSIDE PANEL</Txt>
      <rect x={X.dev} y={yP - 4} width={30} height={15} strokeWidth={0.45} fill="#fff" />
      <Txt x={X.dev + 15} y={yP - 5.5} size={2.4} anchor="middle" mono bold>{d.tag}</Txt>
      <Txt x={X.dev + 2} y={yP + 0.9} size={2.4} mono>{d.plus}</Txt>
      <Txt x={X.dev + 2} y={yM + 0.9} size={2.4} mono>{d.minus}</Txt>
      <Dot x={X.dev} y={yP} />
      <Dot x={X.dev} y={yM} />
      <Txt x={X.desc} y={yP + 0.2} size={2.6} bold maxW={AREA_R - X.desc - 2}>{r.description.toUpperCase()}</Txt>
      <Txt x={X.desc} y={yP + 4} size={2.2} maxW={AREA_R - X.desc - 2}>{`${r.range} SPEED REFERENCE TO DRIVE ${d.tag}`}</Txt>
      <Txt x={X.desc} y={yP + 7.8} size={2.2} mono maxW={AREA_R - X.desc - 2}>{`${r.address} = ${r.scaleMin} … ${r.scaleMax} ${r.units}`}</Txt>
      <Txt x={X.desc} y={yP + 11.6} size={2.0} maxW={AREA_R - X.desc - 2}>{`CABINET · SHIELDED PAIR · ${r.partNumber}`}</Txt>
    </g>
  );
}

function Loop({ c, y }: { c: AnalogCircuit; y: number }) {
  if (c.internal) return <InternalLoop c={c} y={y} />;
  const r = c.row;
  const yP = y, yM = y + 7, yS = y + 14;
  const pTerm = c.loop === 'two-wire' ? '24+' : r.terminal;
  const mTerm = c.loop === 'two-wire' ? r.terminal : c.loop === 'thermocouple' ? r.terminal.replace(/\+$/, '-') : '0V';
  const kind = c.loop === 'thermocouple' ? 'THERMOCOUPLE — DIRECT TO THE MODULE (NO LOOP SUPPLY), TC EXTENSION WIRE' : c.loop === 'two-wire' ? '2-WIRE 4–20 mA TRANSMITTER (LOOP POWERED)'
    : c.loop === 'powered' ? `${r.range} SENSOR, 3-WIRE: +24 VDC ON ${c.supply?.terminal} (WIRE ${c.supply?.wire}), SIGNAL, 0 V` : c.loop === 'voltage' ? `${r.range} SIGNAL (DEVICE POWERED SEPARATELY)` : `${r.range} OUTPUT (SOURCING, LOAD 600 OHM MAX)`;
  return (
    <g>
      {/* PLC / module column */}
      <rect x={X.plc} y={yP - 4} width={34} height={22} strokeWidth={0.45} fill="#fff" />
      <Txt x={X.plc + 17} y={yP - 5.5} size={2.3} anchor="middle" mono bold>{c.moduleTag}</Txt>
      <Txt x={X.plc + 2} y={yP + 0.9} size={2.4} mono bold>{pTerm}</Txt>
      <Txt x={X.plc + 2} y={yM + 0.9} size={2.4} mono bold>{mTerm}</Txt>
      <Txt x={X.plc + 2} y={yS + 0.9} size={2.1} mono>{r.channel.toUpperCase()}</Txt>
      <TermPt x={X.plc + 34} y={yP} />
      <TermPt x={X.plc + 34} y={yM} />
      {/* wires to TBA */}
      <Line x1={X.plc + 34.7} y1={yP} x2={X.tb - 3} y2={yP} />
      <Line x1={X.plc + 34.7} y1={yM} x2={X.tb - 3} y2={yM} />
      <WireNo x={(X.plc + X.tb) / 2} y={yP} n={c.wires.plus} />
      <WireNo x={(X.plc + X.tb) / 2} y={yM} n={c.wires.minus} />
      {c.loop === 'two-wire' && <Txt x={X.plc + 40} y={yP - 2.2} size={1.9}>+24 VDC LOOP SUPPLY</Txt>}
      {/* terminals */}
      <TermBox x={X.tb} y={yP} n={c.plus.split('-')[1]} />
      <TermBox x={X.tb} y={yM} n={c.minus.split('-')[1]} />
      <TermBox x={X.tb} y={yS} n={c.shield.split('-')[1]} />
      <Txt x={X.tb} y={yP - 4.5} size={2.0} anchor="middle" mono>TBA</Txt>
      {/* shield to ground at the panel end */}
      <Line x1={X.tb - 3} y1={yS} x2={X.tb - 14} y2={yS} w={LW_THIN} />
      <Ground x={X.tb - 14} y={yS} />
      <Txt x={X.tb - 28} y={yS + 7.5} size={1.8}>SHIELD TO PE, PANEL END ONLY</Txt>
      {/* cable */}
      <Line x1={X.tb + 3} y1={yP} x2={X.dev - 1} y2={yP} />
      <Line x1={X.tb + 3} y1={yM} x2={X.dev - 1} y2={yM} />
      <Line x1={X.tb + 3} y1={yS} x2={X.cab + 20} y2={yS} w={LW_THIN} dash="1 0.8" />
      <ellipse cx={X.cab + 8} cy={(yP + yS) / 2} rx={5} ry={(yS - yP) / 2 + 2.5} strokeWidth={LW_THIN} strokeDasharray="1.2 0.8" fill="none" />
      <Txt x={X.cab + 8} y={yP - 5.5} size={2.2} anchor="middle" mono bold>{c.cable}</Txt>
      <Txt x={X.cab + 22} y={yS + 0.9} size={1.8}>CUT BACK &amp; INSULATE</Txt>
      {/* device */}
      <rect x={X.dev} y={yP - 4} width={30} height={15} strokeWidth={0.45} fill="#fff" />
      <Txt x={X.dev + 15} y={yP - 5.5} size={2.4} anchor="middle" mono bold>{c.deviceTag}</Txt>
      <Txt x={X.dev + 2} y={yP + 0.9} size={2.4} mono>+</Txt>
      <Txt x={X.dev + 2} y={yM + 0.9} size={2.4} mono>-</Txt>
      <Dot x={X.dev} y={yP} />
      <Dot x={X.dev} y={yM} />
      {/* description */}
      <Txt x={X.desc} y={yP + 0.2} size={2.6} bold maxW={AREA_R - X.desc - 2}>{r.description.toUpperCase()}</Txt>
      <Txt x={X.desc} y={yP + 4} size={2.2} maxW={AREA_R - X.desc - 2}>{kind}</Txt>
      <Txt x={X.desc} y={yP + 7.8} size={2.2} mono maxW={AREA_R - X.desc - 2}>{`${r.address} = ${r.scaleMin} … ${r.scaleMax} ${r.units}`}</Txt>
      <Txt x={X.desc} y={yP + 11.6} size={2.0} maxW={AREA_R - X.desc - 2}>{`${(c.zone || 'FIELD').toUpperCase()} · CABLE ${c.cable} · ${r.partNumber}`}</Txt>
    </g>
  );
}

export function AnalogSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'analog' }>;
  const circuits = plan.model.analog.circuits.slice(sp.from, sp.from + ANALOG_PER_SHEET);
  return (
    <g>
      {[['PLC / MODULE', X.plc + 17], ['WIRE', (X.plc + X.tb) / 2], ['TERMINAL', X.tb], ['CABLE', X.cab + 8], ['FIELD DEVICE', X.dev + 15], ['SIGNAL / SCALE', X.desc + 20]].map(([t, x]) => (
        <Txt key={String(t)} x={Number(x)} y={AREA.y + 6} size={2.5} bold anchor="middle">{String(t)}</Txt>
      ))}
      <Line x1={AREA.x + 6} y1={AREA.y + 8} x2={AREA_R} y2={AREA.y + 8} w={LW_THIN} />
      {circuits.map((c, i) => <Loop key={c.row.pointId} c={c} y={Y0 + 6 + i * PITCH} />)}
      <Txt x={AREA.x + 6} y={AREA_B - 9} size={2.1} maxW={AREA.w - 12}>
        ANALOG SIGNALS: ONE SHIELDED TWISTED PAIR PER SIGNAL, ROUTED APART FROM POWER AND 24 V DISCRETE WIRING. SHIELD (DRAIN) GROUNDED AT THE PANEL END ONLY.
      </Txt>
      <Txt x={AREA.x + 6} y={AREA_B - 5} size={2.1} maxW={AREA.w - 12}>
        SCALING IS SET IN THE PLC (CLICK: SETUP &gt; SYSTEM CONFIGURATION, DATA REGISTER = DF SHOWN, SCALE RANGE = ENGINEERING RANGE). MODULE 24 VDC AND 0V PER THE MODULE WIRING DIAGRAM.
      </Txt>
    </g>
  );
}
