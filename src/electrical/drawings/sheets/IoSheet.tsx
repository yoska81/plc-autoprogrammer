/** PLC input / output wiring sheets: PLC terminal column, wire numbers, terminal strip, field device. */
import type { IoGroup, IoPoint } from '../../derive';
import { AREA, AREA_R, LW_THIN } from '../geometry';
import { IO_PITCH, type DrawingPlan, type PlannedSheet, type SheetSpec } from '../plan';
import {
  Coil, Contact, DevBox, Dot, Lamp, LimitSwitch, Line, PressureSwitch, Pushbutton, Selector, Sensor3W, Solenoid,
  TermBox, TermPt, Txt, WireNo, XrefArrow,
} from '../symbols';
import { LineNumbers } from './SchematicSheets';

const Y0 = AREA.y + 4;
const yOf = (i: number) => Y0 + i * IO_PITCH;
const tn = (label?: string) => (label ? label.split('-').pop() ?? '' : '');
const stripOf = (label?: string) => (label ? label.split('-')[0] : '');

const TYPE_TEXT: Record<string, string> = {
  'pushbutton-no': 'PUSHBUTTON N.O.', 'pushbutton-nc': 'PUSHBUTTON N.C.', selector: 'SELECTOR SWITCH', 'estop-contact': 'E-STOP AUX. CONTACT',
  'sensor-pnp': 'PNP SENSOR, 3-WIRE', 'sensor-npn': 'NPN SENSOR, 3-WIRE', 'limit-switch': 'LIMIT SWITCH', 'pressure-switch': 'PRESSURE SWITCH',
  'safety-relay-output': 'SAFETY RELAY CONTACT', 'contactor-coil': 'CONTACTOR COIL', 'relay-coil': 'RELAY COIL', solenoid: 'SOLENOID VALVE',
  'pilot-light': 'PILOT LIGHT', 'stack-light': 'STACK LIGHT', 'vfd-input': 'VFD DIGITAL INPUT', other: 'DEVICE (NOT SPECIFIED)',
};

function locText(p: IoPoint) {
  return p.location === 'door' ? 'DOOR' : p.location === 'field' ? 'FIELD' : 'PANEL';
}

export function IoSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'io' }>;
  return sp.group.type === 'input'
    ? <InputSheet plan={plan} sheet={sheet} g={sp.group} pts={sp.points} last={sp.last} />
    : <OutputSheet plan={plan} sheet={sheet} g={sp.group} pts={sp.points} last={sp.last} />;
}

function Header({ cols }: { cols: [number, string, ('start' | 'middle')?][] }) {
  return (
    <g>
      {cols.map(([x, t, a]) => <Txt key={t + x} x={x} y={yOf(0) + 0.9} size={2.5} bold anchor={a ?? 'middle'}>{t}</Txt>)}
      <Line x1={AREA.x + 14} y1={yOf(0) + 3} x2={AREA_R} y2={yOf(0) + 3} w={LW_THIN} />
    </g>
  );
}

function PlcColumn({ x, w, rows, labels, title, terminalSide }: { x: number; w: number; rows: number; labels: string[]; title: string; terminalSide: 'left' | 'right' }) {
  const top = yOf(1) - IO_PITCH / 2 + 1;
  const bot = yOf(rows) + IO_PITCH / 2 - 1.5;
  return (
    <g>
      <rect x={x} y={top} width={w} height={bot - top} strokeWidth={0.5} fill="#fff" />
      {labels.map((l, i) => (
        <g key={i}>
          {i > 0 && <Line x1={x} y1={yOf(i + 1) - IO_PITCH / 2} x2={x + w} y2={yOf(i + 1) - IO_PITCH / 2} w={LW_THIN} dash="0.8 0.8" />}
          <Txt x={x + w / 2} y={yOf(i + 1) + 1} size={2.8} mono bold anchor="middle">{l}</Txt>
          <TermPt x={terminalSide === 'left' ? x : x + w} y={yOf(i + 1)} />
        </g>
      ))}
      <Txt x={x + w / 2} y={bot + 3.4} size={2.3} anchor="middle" mono maxW={w + 20}>{title}</Txt>
    </g>
  );
}

function Desc({ x, y, p }: { x: number; y: number; p: IoPoint }) {
  return (
    <g>
      <Txt x={x} y={y + 0.2} size={2.6} bold maxW={AREA_R - x - 2}>{`${p.deviceTag || '—'}  ${p.description.toUpperCase()}`}</Txt>
      <Txt x={x} y={y + 3.6} size={2.2} maxW={AREA_R - x - 2}>{`${TYPE_TEXT[p.deviceType] ?? p.deviceType.toUpperCase()} — ${locText(p)}${p.wiring ? '' : ' — NO WIRING INFO, VERIFY'}`}</Txt>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

const I = { R24: 34, R0: 42, TBS: 58, DEV: 100, TBX: 150, PLC: 190, PLCW: 32, DESC: 232 };

function InputSheet({ plan, sheet, g, pts, last }: { plan: DrawingPlan; sheet: PlannedSheet; g: IoGroup; pts: IoPoint[]; last: boolean }) {
  const rows = pts.length + (last ? 1 : 0);
  const labels = [...pts.map((p) => p.address), ...(last ? ['COM'] : [])];
  const strip = stripOf(pts.find((p) => p.signalTerminal)?.signalTerminal) || 'TB2';
  const railEnd = yOf(rows) + (last ? 0 : 6);
  const ref24 = plan.xref.get(`ps:${plan.model.psBranches[0]?.ps.tag ?? ''}`);
  return (
    <g>
      <LineNumbers sheet={sheet.n} count={rows + 1} pitch={IO_PITCH} y0={Y0} />
      <Header cols={[[I.R24, '24+'], [I.R0 + 1, '0V'], [I.TBS, strip], [I.DEV, 'FIELD / DOOR DEVICE'], [I.TBX, strip], [I.PLC + I.PLCW / 2, 'PLC INPUT'], [I.DESC, 'DESCRIPTION', 'start']]} />
      <Line x1={I.R24} y1={yOf(0) + 4} x2={I.R24} y2={railEnd} w={0.5} />
      <Line x1={I.R0} y1={yOf(0) + 4} x2={I.R0} y2={railEnd} w={0.5} />
      <Txt x={I.R24 + 1} y={yOf(0) + 7.6} size={2.0} mono>{ref24 ? `/${ref24}` : ''}</Txt>
      <PlcColumn x={I.PLC} w={I.PLCW} rows={rows} labels={labels} title={`${g.devTag} — ${g.label}`} terminalSide="left" />
      {pts.map((p, i) => <InputRow key={p.address} plan={plan} p={p} y={yOf(i + 1)} />)}
      {last && (
        <g>
          <Dot x={g.commonTo === '0V' ? I.R0 : I.R24} y={yOf(rows)} />
          <Line x1={g.commonTo === '0V' ? I.R0 : I.R24} y1={yOf(rows)} x2={I.PLC} y2={yOf(rows)} />
          <WireNo x={120} y={yOf(rows)} n={g.commonTo} />
          <Txt x={I.DESC} y={yOf(rows) + 0.2} size={2.6} bold>{`INPUT COMMON TO ${g.commonTo === '0V' ? '0V (SINKING INPUTS, PNP DEVICES)' : '+24V (SOURCING INPUTS, NPN DEVICES)'}`}</Txt>
        </g>
      )}
    </g>
  );
}

function InputRow({ plan, p, y }: { plan: DrawingPlan; p: IoPoint; y: number }) {
  const sensor = p.deviceType === 'sensor-pnp' || p.deviceType === 'sensor-npn';
  const field = !!p.signalTerminal;
  const dx = I.DEV;
  const half = sensor ? 9 : p.deviceType === 'safety-relay-output' ? 4 : 5;
  const tag = p.deviceTag;
  const srRef = p.deviceType === 'safety-relay-output' ? plan.xref.get(`coil:${p.deviceTag}`) : undefined;
  const npn = p.deviceType === 'sensor-npn';
  return (
    <g>
      {/* supply */}
      <Dot x={I.R24} y={y} />
      <Line x1={I.R24} y1={y} x2={p.supplyTerminal ? I.TBS - 2.5 : dx - half} y2={y} />
      {p.supplyTerminal && <><TermBox x={I.TBS} y={y} n={tn(p.supplyTerminal)} /><Line x1={I.TBS + 2.5} y1={y} x2={dx - half} y2={y} /></>}
      <WireNo x={(p.supplyTerminal ? I.TBS + 2.5 + dx - half : I.R24 + dx - half) / 2 + (p.supplyTerminal ? 0 : 8)} y={y} n="24+" />
      {/* device */}
      <DeviceSymbol p={p} x={dx} y={y} />
      {tag && <Txt x={dx + (sensor ? 8 : 6)} y={y - 4.4} size={2.6} mono bold>{tag}</Txt>}
      {srRef && <Txt x={dx + 6 + tag.length * 1.6 + 2} y={y - 4.4} size={2.2} mono>{`23-24 /${srRef}`}</Txt>}
      {sensor && (
        <g>
          <Txt x={dx - 9.5} y={y + 3.4} size={2.0} mono anchor="end">BN</Txt>
          <Txt x={dx + 9.5} y={y + 3.4} size={2.0} mono>BK</Txt>
          <Txt x={dx + 1.2} y={y + 6.6} size={2.0} mono>BU</Txt>
          <Line x1={dx} y1={y + 5} x2={dx} y2={y + 6} />
          <Line x1={dx} y1={y + 6} x2={p.returnTerminal ? I.TBS + 2.5 : I.R0} y2={y + 6} />
          {p.returnTerminal && <><TermBox x={I.TBS} y={y + 6} n={tn(p.returnTerminal)} /><Line x1={I.TBS - 2.5} y1={y + 6} x2={I.R0} y2={y + 6} /></>}
          <Dot x={I.R0} y={y + 6} />
          {npn && <Txt x={dx} y={y + 9.6} size={2.0} anchor="middle">NPN: INPUT COMMON TO +24V</Txt>}
        </g>
      )}
      {/* signal */}
      <Line x1={dx + half} y1={y} x2={field ? I.TBX - 2.5 : I.PLC} y2={y} />
      {field && <><TermBox x={I.TBX} y={y} n={tn(p.signalTerminal)} /><Line x1={I.TBX + 2.5} y1={y} x2={I.PLC} y2={y} /></>}
      <WireNo x={field ? (dx + half + I.TBX - 2.5) / 2 + 2 : (dx + half + I.PLC) / 2} y={y} n={p.wire} />
      {field && <WireNo x={(I.TBX + 2.5 + I.PLC) / 2} y={y} n={p.wire} />}
      <Desc x={I.DESC} y={y} p={p} />
    </g>
  );
}

/** Field device symbol by device type, centred at (x, y), signal flow left→right. */
function DeviceSymbol({ p, x, y }: { p: IoPoint; x: number; y: number }) {
  switch (p.deviceType) {
    case 'pushbutton-no': return <Pushbutton x={x} y={y} />;
    case 'pushbutton-nc': return <Pushbutton x={x} y={y} nc />;
    case 'estop-contact': return <Pushbutton x={x} y={y} mushroom />;
    case 'selector': return <Selector x={x} y={y} />;
    case 'sensor-pnp': return <Sensor3W x={x} y={y} kind="PNP" />;
    case 'sensor-npn': return <Sensor3W x={x} y={y} kind="NPN" />;
    case 'limit-switch': return <LimitSwitch x={x} y={y} />;
    case 'pressure-switch': return <PressureSwitch x={x} y={y} />;
    case 'safety-relay-output': return <Contact x={x} y={y} />;
    case 'contactor-coil': case 'relay-coil': return <Coil x={x} y={y} />;
    case 'solenoid': return <Solenoid x={x} y={y} />;
    case 'pilot-light': case 'stack-light': return <Lamp x={x} y={y} color={colorWord(p.description)} />;
    case 'vfd-input': return <DevBox x={x} y={y} label="DI" w={7} />;
    default: return <DevBox x={x} y={y} label="?" w={7} />;
  }
}

function colorWord(s: string): string {
  return (s.match(/\b(red|green|amber|yellow|blue|white|clear)\b/i)?.[1] ?? '').toUpperCase();
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

const O = { PLC: 44, PLCW: 32, TBX: 112, DEV: 150, TBR: 190, RAIL: 214, DESC: 226 };

function OutputSheet({ plan, sheet, g, pts, last }: { plan: DrawingPlan; sheet: PlannedSheet; g: IoGroup; pts: IoPoint[]; last: boolean }) {
  const sink = g.outputStyle === 'sinking';
  const supply = plan.model.safety.outputSupply;
  const rail = sink ? supply : '0V';
  const rows = pts.length + (last ? 1 : 0);
  const comLabel = sink ? 'C' : g.outputStyle === 'relay' ? 'C' : '+V';
  const labels = [...pts.map((p) => p.address), ...(last ? [comLabel] : [])];
  const strip = stripOf(pts.find((p) => p.signalTerminal)?.signalTerminal) || 'TB3';
  const supplyRef = plan.xref.get('rung:24+S');
  const railUsers = pts.filter((p) => !(p.coilChain || (p.location === 'internal' && p.deviceType !== 'vfd-input')));
  const lastRailRow = Math.max(0, ...pts.map((p, i) => (railUsers.includes(p) ? i + 1 : 0)));
  return (
    <g>
      <LineNumbers sheet={sheet.n} count={rows + 1} pitch={IO_PITCH} y0={Y0} />
      <Header cols={[[O.PLC + O.PLCW / 2, 'PLC OUTPUT'], [O.TBX, strip], [O.DEV, 'FIELD / DOOR / PANEL DEVICE'], [O.TBR, strip], [O.RAIL, rail], [O.DESC, 'DESCRIPTION', 'start']]} />
      {lastRailRow > 0 && <Line x1={O.RAIL} y1={yOf(0) + 4} x2={O.RAIL} y2={yOf(lastRailRow)} w={0.5} />}
      {sink && supplyRef && <Txt x={O.RAIL + 1} y={yOf(0) + 7.6} size={2.0} mono>{`/${supplyRef}`}</Txt>}
      <PlcColumn x={O.PLC} w={O.PLCW} rows={rows} labels={labels} title={`${g.devTag} — ${g.label} (${g.outputStyle.toUpperCase()})`} terminalSide="right" />
      {pts.map((p, i) => <OutputRow key={p.address} plan={plan} p={p} y={yOf(i + 1)} rail={rail} prev={pts[i - 1]} />)}
      {last && (
        <g>
          <Line x1={O.PLC + O.PLCW} y1={yOf(rows)} x2={O.TBX + 8} y2={yOf(rows)} />
          <XrefArrow x={O.TBX + 8} y={yOf(rows)} dir={sink ? 'right' : 'left'} />
          <WireNo x={(O.PLC + O.PLCW + O.TBX + 8) / 2} y={yOf(rows)} n={sink ? '0V' : supply} />
          <Txt x={O.TBX + 12} y={yOf(rows) + 0.9} size={2.5} mono>{sink ? '0V TB1' : `${supply} ${supplyRef ? `/${supplyRef}` : 'TB1'}`}</Txt>
          <Txt x={O.DESC} y={yOf(rows) + 0.2} size={2.6} bold>{sink ? 'OUTPUT COMMON TO 0V (SINKING OUTPUTS, LOADS FROM +24V)' : `OUTPUT SUPPLY ${supply}${supply === '24+S' ? ' (SAFETY-SWITCHED +24V)' : ''}`}</Txt>
        </g>
      )}
    </g>
  );
}

function OutputRow({ plan, p, y, rail, prev }: { plan: DrawingPlan; p: IoPoint; y: number; rail: string; prev?: IoPoint }) {
  const field = !!p.signalTerminal;
  const start = O.PLC + O.PLCW;
  const internalCoil = !!p.coilChain || ((p.deviceType === 'contactor-coil' || p.deviceType === 'relay-coil') && p.location === 'internal');
  const vfd = p.deviceType === 'vfd-input';
  const half = vfd ? 5 : 5;
  const sharedReturn = !!p.returnTerminal && prev?.returnTerminal === p.returnTerminal;
  const tag = p.deviceTag;
  if (internalCoil) {
    const ref = plan.xref.get(`coil:${tag}`);
    return (
      <g>
        <Line x1={start} y1={y} x2={O.DEV - 8} y2={y} />
        <WireNo x={(start + O.DEV - 8) / 2} y={y} n={p.wire} />
        <XrefArrow x={O.DEV - 8} y={y} />
        <Txt x={O.DEV - 4} y={y + 0.9} size={2.6} mono bold>{`${tag || '?'} COIL`}</Txt>
        <Txt x={O.DEV - 4} y={y + 4.4} size={2.2} mono>{ref ? `SEE /${ref}` : 'SEE CONTROL SHEET'}</Txt>
        <Desc x={O.DESC} y={y} p={p} />
      </g>
    );
  }
  return (
    <g>
      <Line x1={start} y1={y} x2={field ? O.TBX - 2.5 : O.DEV - half} y2={y} />
      {field && <><TermBox x={O.TBX} y={y} n={tn(p.signalTerminal)} /><Line x1={O.TBX + 2.5} y1={y} x2={O.DEV - half} y2={y} /></>}
      <WireNo x={field ? (start + O.TBX - 2.5) / 2 : (start + O.DEV - half) / 2} y={y} n={p.wire} />
      {field && <WireNo x={(O.TBX + 2.5 + O.DEV - half) / 2} y={y} n={p.wire} />}
      <DeviceSymbol p={p} x={O.DEV} y={y} />
      {tag && <Txt x={O.DEV + 6} y={y - 4.4} size={2.6} mono bold>{tag}</Txt>}
      {vfd && <Txt x={O.DEV} y={y + 5.4} size={2.0} anchor="middle">RUN</Txt>}
      {/* return */}
      {sharedReturn ? (
        <g>
          <Line x1={O.DEV + half} y1={y} x2={O.TBR - 8} y2={y} />
          <Line x1={O.TBR - 8} y1={y} x2={O.TBR - 8} y2={y - 12} />
          <Dot x={O.TBR - 8} y={y - 12} />
          <Txt x={O.TBR - 6.5} y={y + 0.9} size={2.0}>COMMON</Txt>
        </g>
      ) : (
        <g>
          <Line x1={O.DEV + half} y1={y} x2={p.returnTerminal ? O.TBR - 2.5 : O.RAIL} y2={y} />
          {p.returnTerminal && <><TermBox x={O.TBR} y={y} n={tn(p.returnTerminal)} /><Line x1={O.TBR + 2.5} y1={y} x2={O.RAIL} y2={y} /></>}
          <WireNo x={(O.DEV + half + (p.returnTerminal ? O.TBR - 2.5 : O.RAIL)) / 2 + 3} y={y} n={rail} />
          <Dot x={O.RAIL} y={y} />
        </g>
      )}
      <Desc x={O.DESC} y={y} p={p} />
    </g>
  );
}
