/** PLC input / output wiring sheets: PLC terminal column, wire numbers, terminal strip, field device. */
import { vendorTerminal, type IoGroup, type IoPoint } from '../../derive';
import { ioLabel } from '../../ioNames';
import { AREA, AREA_B, AREA_R, LW_THIN, textWidth, wrapText } from '../geometry';
import { IO_PITCH, type DrawingPlan, type IoRow, type PlannedSheet, type SheetSpec } from '../plan';
import {
  Coil, Contact, DevBox, Dot, Lamp, LimitSwitch, Line, PressureSwitch, Pushbutton, Selector, Sensor3W, Solenoid,
  TermBox, TermPt, Txt, WireNo, XrefArrow,
} from '../symbols';
import { LineNumbers } from './SchematicSheets';
import { stripTag } from '../../../standards/designations';

const Y0 = AREA.y + 4;
const yOf = (i: number) => Y0 + i * IO_PITCH;
const tn = (label?: string) => (label ? label.split('-').pop() ?? '' : '');
const stripOf = (label?: string) => (label ? label.split('-')[0] : '');

const TYPE_TEXT: Record<string, string> = {
  'pushbutton-no': 'PUSHBUTTON N.O.', 'pushbutton-nc': 'PUSHBUTTON N.C.', selector: 'SELECTOR SWITCH', 'estop-contact': 'E-STOP AUX. CONTACT',
  'sensor-pnp': 'PNP SENSOR, 3-WIRE', 'sensor-npn': 'NPN SENSOR, 3-WIRE', 'limit-switch': 'LIMIT SWITCH', 'pressure-switch': 'PRESSURE SWITCH',
  'safety-relay-output': 'SAFETY RELAY CONTACT', 'contactor-coil': 'CONTACTOR COIL', 'relay-coil': 'RELAY COIL', solenoid: 'SOLENOID VALVE',
  'pilot-light': 'PILOT LIGHT', 'stack-light': 'STACK LIGHT', 'vfd-input': 'VFD DIGITAL INPUT',
  'servo-drive': 'SERVO DRIVE CN1 (SEE SERVO SHEET)', encoder: 'ENCODER CHANNEL, SHIELDED', ultrasonic: 'ULTRASONIC SENSOR, 3-WIRE', other: 'DEVICE (NOT SPECIFIED)',
};

export function IoSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'io' }>;
  return (
    <g>
      {sp.group.type === 'input'
        ? <InputSheet plan={plan} sheet={sheet} g={sp.group} rows={sp.rows} last={sp.last} />
        : <OutputSheet plan={plan} sheet={sheet} g={sp.group} rows={sp.rows} last={sp.last} />}
      <ModuleNote plan={plan} sp={sp} />
    </g>
  );
}

/** Module identification and terminal-name note along the bottom of the sheet. */
function ModuleNote({ plan, sp }: { plan: DrawingPlan; sp: Extract<SheetSpec, { kind: 'io' }> }) {
  const r = sp.rack;
  const g = sp.group;
  const used = sp.points.length;
  const spare = sp.rows.length - used;
  const desc = r ? (r.description ?? '').replace(/^FIXTURE — /, '') : '';
  const line1 = `${g.devTag}  ${g.partNumber ?? ''}  ${r ? (r.slot === 0 ? 'CPU (SLOT 0)' : `SLOT ${r.slot}`) : ''}  —  ${desc.toUpperCase()}`;
  const line2 = `${g.type === 'input' ? 'INPUTS' : 'OUTPUTS'} ON THIS SHEET: ${used} USED, ${spare} SPARE${sp.pages > 1 ? ` (PAGE ${sp.page} OF ${sp.pages})` : ''}. TERMINAL NAMES = PLC ADDRESSES; COMMON TERMINALS SHADED (${g.type === 'input' ? 'COM' : g.outputStyle === 'sinking' ? 'C' : '+V'}). VERIFY TERMINAL ARRANGEMENT AGAINST THE ${plan.ctx.plc.name} MODULE WIRING DIAGRAM.`;
  return (
    <g>
      <Line x1={AREA.x + 14} y1={AREA_B - 10} x2={AREA_R} y2={AREA_B - 10} w={LW_THIN} />
      <Txt x={AREA.x + 17} y={AREA_B - 6} size={2.5} bold maxW={AREA_R - AREA.x - 20}>{line1}</Txt>
      <Txt x={AREA.x + 17} y={AREA_B - 2.4} size={2.0} maxW={AREA_R - AREA.x - 20}>{line2}</Txt>
    </g>
  );
}

/** Field-side columns on the right: terminals used, cable, and location. */
const T = { DESC: 232, TERM: 334, CABLE: 366, ZONE: 384 };

function TableHead() {
  return (
    <g>
      <Txt x={T.TERM} y={yOf(0) + 0.9} size={2.5} bold>TERMINALS</Txt>
      <Txt x={T.CABLE} y={yOf(0) + 0.9} size={2.5} bold>CABLE</Txt>
      <Txt x={T.ZONE} y={yOf(0) + 0.9} size={2.5} bold>LOCATION</Txt>
      <Line x1={T.TERM - 2} y1={yOf(0) - 3} x2={T.TERM - 2} y2={AREA_B - 10} w={0.12} />
    </g>
  );
}

function TableCells({ plan, p, y }: { plan: DrawingPlan; p: IoPoint; y: number }) {
  const terms = [p.signalTerminal, p.supplyTerminal, p.returnTerminal].filter(Boolean) as string[];
  const cable = plan.model.machine.devices.find((d) => d.tag === (p.deviceTag || p.address))?.cable ?? '';
  const loc = p.location === 'door' ? 'DOOR' : p.location === 'internal' ? 'PANEL' : (p.zone || 'FIELD').toUpperCase();
  return (
    <g>
      <Txt x={T.TERM} y={y + 0.2} size={2.3} mono bold maxW={T.CABLE - T.TERM - 2}>{terms[0] ?? '—'}</Txt>
      {terms.length > 1 && <Txt x={T.TERM} y={y + 3.6} size={2.0} mono maxW={T.CABLE - T.TERM - 2}>{terms.slice(1).join(' ')}</Txt>}
      <Txt x={T.CABLE} y={y + 0.2} size={2.3} mono>{cable || '—'}</Txt>
      <Txt x={T.ZONE} y={y + 0.2} size={2.2} maxW={AREA_R - T.ZONE - 2}>{loc}</Txt>
      {p.jb && <Txt x={T.ZONE} y={y + 3.6} size={2.0} mono maxW={AREA_R - T.ZONE - 2}>{`VIA ${p.jb}`}</Txt>}
    </g>
  );
}

/** Unused PLC point: short stub and "SPARE". */
function SpareRow({ y, x, dir, desc }: { y: number; x: number; dir: 1 | -1; desc: number }) {
  return (
    <g>
      <Line x1={x} y1={y} x2={x + dir * 10} y2={y} w={LW_THIN} />
      <Txt x={x + dir * 12} y={y + 0.9} size={2.4} mono anchor={dir === 1 ? 'start' : 'end'}>SPARE</Txt>
      <Txt x={desc} y={y + 0.2} size={2.6} bold>SPARE</Txt>
      <Txt x={desc} y={y + 3.6} size={2.2}>NOT WIRED — AVAILABLE FOR FUTURE USE</Txt>
    </g>
  );
}

function Header({ cols }: { cols: [number, string, ('start' | 'middle')?][] }) {
  return (
    <g>
      {cols.map(([x, t, a]) => <Txt key={t + x} x={x} y={yOf(0) + 0.9} size={2.5} bold anchor={a ?? 'middle'}>{t}</Txt>)}
      <Line x1={AREA.x + 14} y1={yOf(0) + 3} x2={AREA_R} y2={yOf(0) + 3} w={LW_THIN} />
    </g>
  );
}

/** PLC column label: the address, plus the maker's terminal name where it differs (Unitronics "X001 I0"). */
function termLabel(plan: DrawingPlan, g: IoGroup, address: string): string {
  const t = vendorTerminal(g.partNumber ? plan.ctx.getPart(g.partNumber) : undefined, address);
  // the PLC's own name (%I0.0 on an S7) where it has one, else the address
  const name = ioLabel(plan.model.ioNames, address);
  return t && t !== name ? `${name} ${t}` : name;
}

function PlcColumn({ x, w, rows, labels, title, terminalSide, common }: { x: number; w: number; rows: number; labels: string[]; title: string; terminalSide: 'left' | 'right'; common?: boolean }) {
  const top = yOf(1) - IO_PITCH / 2 + 1;
  const bot = yOf(rows) + IO_PITCH / 2 - 1.5;
  return (
    <g>
      <rect x={x} y={top} width={w} height={bot - top} strokeWidth={0.5} fill="#fff" />
      {common && <rect x={x + 0.3} y={yOf(rows) - IO_PITCH / 2 + 0.3} width={w - 0.6} height={IO_PITCH - 2.1} fill="#d9d9d9" stroke="none" />}
      {labels.map((l, i) => (
        <g key={i}>
          {i > 0 && <Line x1={x} y1={yOf(i + 1) - IO_PITCH / 2} x2={x + w} y2={yOf(i + 1) - IO_PITCH / 2} w={LW_THIN} dash="0.8 0.8" />}
          <Txt x={x + w / 2} y={yOf(i + 1) + 1} size={2.8} mono bold anchor="middle">{l}</Txt>
          <TermPt x={terminalSide === 'left' ? x : x + w} y={yOf(i + 1)} />
        </g>
      ))}
      {bot + 3.4 < AREA_B - 11 && <Txt x={x + w / 2} y={bot + 3.4} size={2.3} anchor="middle" mono maxW={w + 20}>{title}</Txt>}
    </g>
  );
}

/** Text cut at a word with "..." to fit `w` at `size` (no shrinking). */
function cut(text: string, w: number, size: number): string {
  if (textWidth(text, size) <= w) return text;
  const words = text.split(' ');
  while (words.length > 1 && textWidth(`${words.join(' ')}...`, size) > w) words.pop();
  return `${words.join(' ').replace(/[\s,;:—-]+$/, '')}...`;
}

function Desc({ x, y, p }: { x: number; y: number; p: IoPoint }) {
  const w = T.TERM - x - 4;
  const text = `${p.deviceTag || '—'}  ${p.description.toUpperCase()}`;
  // long (AI-written) descriptions wrap onto a second line above instead of shrinking to an unreadable size
  const lines = textWidth(text, 2.6) * 1.08 <= w ? [text] : wrapText(text, w / 1.08, 2.2);
  return (
    <g>
      {lines.length === 1
        ? <Txt x={x} y={y + 0.2} size={2.6} bold maxW={w}>{text}</Txt>
        : <>
          <Txt x={x} y={y - 2.6} size={2.2} bold maxW={w}>{lines[0]}</Txt>
          <Txt x={x} y={y + 0.2} size={2.2} bold maxW={w}>{cut(lines.slice(1).join(' '), w / 1.08, 2.2)}</Txt>
        </>}
      <Txt x={x} y={y + 3.6} size={2.2} maxW={T.TERM - x - 4}>{`${TYPE_TEXT[p.deviceType] ?? p.deviceType.toUpperCase()}${p.wiring ? '' : ' — NO WIRING INFO, VERIFY'}`}</Txt>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Right edge of the line-number column (LineNumbers). */
const LINE_COL = AREA.x + 13;
const I = { R24: 34, R0: 42, TBS: 58, DEV: 100, TBX: 150, PLC: 190, PLCW: 32, DESC: 232 };

function InputSheet({ plan, sheet, g, rows: ioRows, last }: { plan: DrawingPlan; sheet: PlannedSheet; g: IoGroup; rows: IoRow[]; last: boolean }) {
  const pts = ioRows.flatMap((r) => (r.point ? [r.point] : []));
  const rows = ioRows.length + (last ? 1 : 0);
  const labels = [...ioRows.map((r) => termLabel(plan, g, r.address)), ...(last ? ['COM'] : [])];
  const strip = stripOf(pts.find((p) => p.signalTerminal)?.signalTerminal) || stripTag(plan.ctx.designations, 2);
  const lastUsed = Math.max(0, ...ioRows.map((r, i) => (r.point ? i + 1 : 0)));
  const railEnd = last ? yOf(rows) : yOf(lastUsed) + 6;
  const psTag = plan.model.psBranches[0]?.ps.tag ?? '';
  const ref24 = plan.xref.get(`ps:${psTag}`);
  const ref0 = plan.xref.get(`ps0:${psTag}`);
  return (
    <g>
      <LineNumbers sheet={sheet.n} count={rows + 1} pitch={IO_PITCH} y0={Y0} />
      <Header cols={[[I.R24, '24+'], [I.R0 + 1, '0V'], [I.TBS, strip], [I.DEV, 'FIELD / DOOR DEVICE'], [I.TBX, strip], [I.PLC + I.PLCW / 2, 'PLC INPUT'], [I.DESC, 'DEVICE / DESCRIPTION', 'start']]} />
      <TableHead />
      <Line x1={I.R24} y1={yOf(0) + 4} x2={I.R24} y2={railEnd} w={0.5} />
      <Line x1={I.R0} y1={yOf(0) + 4} x2={I.R0} y2={railEnd} w={0.5} />
      {/* between the line-number column and the 24+ rail: shrink to the gap rather than cross the column line */}
      <Txt x={I.R24 - 1} y={yOf(0) + 7.0} size={1.8} mono anchor="end" maxW={I.R24 - 1 - (LINE_COL + 0.8)}>{ref24 ? `FROM ${ref24}` : ''}</Txt>
      <Txt x={I.R0 + 1} y={yOf(0) + 7.0} size={1.8} mono>{ref0 ? `FROM ${ref0}` : ''}</Txt>
      <PlcColumn x={I.PLC} w={I.PLCW} rows={rows} labels={labels} title={`${g.devTag} — ${g.label}`} terminalSide="left" common={last} />
      {ioRows.map((r, i) => (r.point
        ? <InputRow key={r.address} plan={plan} p={r.point} y={yOf(i + 1)} />
        : <SpareRow key={r.address} y={yOf(i + 1)} x={I.PLC} dir={-1} desc={I.DESC} />))}
      {pts.length === 0 && <Txt x={I.DEV} y={yOf(1) - 5} size={2.2} italic anchor="middle">ALL POINTS SPARE</Txt>}
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
  const sensor = p.deviceType === 'sensor-pnp' || p.deviceType === 'sensor-npn' || p.deviceType === 'ultrasonic' || p.deviceType === 'encoder';
  const field = !!p.signalTerminal;
  const dx = I.DEV;
  const half = sensor ? 9 : p.deviceType === 'safety-relay-output' ? 4 : 5;
  const tag = p.deviceTag;
  const srRef = p.deviceType === 'safety-relay-output' ? plan.xref.get(`coil:${p.deviceTag}`) : undefined;
  const sw = sensor ? '24+' : p.supplyWire ?? '24+';
  const rail = sw === '0V' ? I.R0 : I.R24;
  return (
    <g>
      {/* supply */}
      {/* a dry contact in a +24V-common (NPN) group switches 0V into the input: fed from the 0V rail */}
      <Dot x={rail} y={y} />
      <Line x1={rail} y1={y} x2={p.supplyTerminal ? I.TBS - 2.5 : dx - half} y2={y} />
      {p.supplyTerminal && <><TermBox x={I.TBS} y={y} n={tn(p.supplyTerminal)} /><Line x1={I.TBS + 2.5} y1={y} x2={dx - half} y2={y} /></>}
      <WireNo x={(p.supplyTerminal ? I.TBS + 2.5 + dx - half : rail + dx - half) / 2 + (p.supplyTerminal ? 0 : 8)} y={y} n={sw} />
      {/* device */}
      <DeviceSymbol p={p} x={dx} y={y} />
      {tag && <Txt x={dx + (sensor ? 8 : 6)} y={y - 4.4} size={2.6} mono bold>{tag}</Txt>}
      {srRef && <Txt x={dx + 6 + tag.length * 1.6 + 2} y={y - 4.4} size={2.2} mono>{`23-24 /${srRef}`}</Txt>}
      {sensor && (
        <g>
          <Txt x={dx - 9.5} y={y + 3.4} size={2.0} mono anchor="end">BN</Txt>
          <Txt x={dx + 9.5} y={y + 3.4} size={2.0} mono>BK</Txt>
          <Txt x={dx + 1.2} y={y + 5.6} size={2.0} mono>BU</Txt>
          <Line x1={dx} y1={y + 5} x2={dx} y2={y + 6} />
          <Line x1={dx} y1={y + 6} x2={p.returnTerminal ? I.TBS + 2.5 : I.R0} y2={y + 6} />
          {p.returnTerminal && <><TermBox x={I.TBS} y={y + 6} n={tn(p.returnTerminal)} /><Line x1={I.TBS - 2.5} y1={y + 6} x2={I.R0} y2={y + 6} /></>}
          <Dot x={I.R0} y={y + 6} />
        </g>
      )}
      {/* signal */}
      <Line x1={dx + half} y1={y} x2={field ? I.TBX - 2.5 : I.PLC} y2={y} />
      {field && <><TermBox x={I.TBX} y={y} n={tn(p.signalTerminal)} /><Line x1={I.TBX + 2.5} y1={y} x2={I.PLC} y2={y} /></>}
      <WireNo x={field ? (dx + half + I.TBX - 2.5) / 2 + 2 : (dx + half + I.PLC) / 2} y={y} n={p.wire} />
      {field && <WireNo x={(I.TBX + 2.5 + I.PLC) / 2} y={y} n={p.wire} />}
      <Desc x={I.DESC} y={y} p={p} />
      <TableCells plan={plan} p={p} y={y} />
    </g>
  );
}

/** Field device symbol by device type, centred at (x, y), signal flow left→right. */
function DeviceSymbol({ p, x, y, color }: { p: IoPoint; x: number; y: number; color?: string }) {
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
    case 'pilot-light': case 'stack-light': return <Lamp x={x} y={y} color={colorWord(p.description) || color} />;
    case 'vfd-input': return <DevBox x={x} y={y} label="DI" w={7} />;
    case 'servo-drive': return <DevBox x={x} y={y} label="SV" w={7} />;
    case 'encoder': return <DevBox x={x} y={y} label="ENC" w={8} />;
    case 'ultrasonic': return <Sensor3W x={x} y={y} kind={/npn/i.test(p.description) ? 'NPN' : 'PNP'} />;
    default: return <DevBox x={x} y={y} label="?" w={7} />;
  }
}

function tagColor(plan: DrawingPlan, tag: string): string {
  const rc = plan.model.rc.find((c) => c.tag === tag);
  return colorWord(`${rc?.part?.ratings.color ?? ''} ${rc?.part?.description ?? ''}`);
}

function colorWord(s: string): string {
  return (s.match(/\b(red|green|amber|yellow|blue|white|clear)\b/i)?.[1] ?? '').toUpperCase();
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

const O = { PLC: 44, PLCW: 32, TBX: 112, DEV: 150, TBR: 190, RAIL: 214, DESC: 226 };

function OutputSheet({ plan, sheet, g, rows: ioRows, last }: { plan: DrawingPlan; sheet: PlannedSheet; g: IoGroup; rows: IoRow[]; last: boolean }) {
  const pts = ioRows.flatMap((r) => (r.point ? [r.point] : []));
  const sink = g.outputStyle === 'sinking';
  const supply = plan.model.safety.outputSupply;
  const rail = sink ? supply : '0V';
  const rows = ioRows.length + (last ? 1 : 0);
  const comLabel = sink ? 'C' : g.outputStyle === 'relay' ? 'C' : '+V';
  const labels = [...ioRows.map((r) => termLabel(plan, g, r.address)), ...(last ? [comLabel] : [])];
  const strip = stripOf(pts.find((p) => p.signalTerminal)?.signalTerminal) || stripTag(plan.ctx.designations, 3);
  const supplyRef = supply === '24+S' ? plan.xref.get('rung:24+S') : plan.xref.get(`ps:${plan.model.psBranches[0]?.ps.tag ?? ''}`);
  const zeroRef = plan.xref.get(`ps0:${plan.model.psBranches[0]?.ps.tag ?? ''}`);
  const railUsers = pts.filter((p) => !(p.coilChain || (p.location === 'internal' && p.deviceType !== 'vfd-input') || (rail === '24+S' && isLamp(p))));
  const lastRailRow = Math.max(0, ...ioRows.map((r, i) => (r.point && railUsers.includes(r.point) ? i + 1 : 0)));
  return (
    <g>
      <LineNumbers sheet={sheet.n} count={rows + 1} pitch={IO_PITCH} y0={Y0} />
      <Header cols={[[O.PLC + O.PLCW / 2, 'PLC OUTPUT'], [O.TBX, strip], [O.DEV, 'FIELD / DOOR / PANEL DEVICE'], [O.TBR, strip], [O.RAIL, rail], [O.DESC, 'DEVICE / DESCRIPTION', 'start']]} />
      <TableHead />
      {lastRailRow > 0 && <Line x1={O.RAIL} y1={yOf(0) + 4} x2={O.RAIL} y2={yOf(lastRailRow)} w={0.5} />}
      {lastRailRow > 0 && <Txt x={O.RAIL - 1} y={yOf(0) + 7.0} size={1.8} mono anchor="end">{sink ? (supplyRef ? `FROM ${supplyRef}` : '') : (zeroRef ? `FROM ${zeroRef}` : '')}</Txt>}
      <PlcColumn x={O.PLC} w={O.PLCW} rows={rows} labels={labels} title={`${g.devTag} — ${g.label} (${g.outputStyle.toUpperCase()})`} terminalSide="right" common={last} />
      {ioRows.map((r, i) => (r.point
        ? <OutputRow key={r.address} plan={plan} p={r.point} y={yOf(i + 1)} rail={rail} prev={ioRows[i - 1]?.point} />
        : <SpareRow key={r.address} y={yOf(i + 1)} x={O.PLC + O.PLCW} dir={1} desc={O.DESC} />))}
      {pts.length === 0 && <Txt x={O.DEV} y={yOf(1) - 5} size={2.2} italic anchor="middle">ALL POINTS SPARE</Txt>}
      {last && (
        <g>
          <Line x1={O.PLC + O.PLCW} y1={yOf(rows)} x2={O.TBX + 8} y2={yOf(rows)} />
          <XrefArrow x={O.TBX + 8} y={yOf(rows)} dir={sink ? 'right' : 'left'} />
          <WireNo x={(O.PLC + O.PLCW + O.TBX + 8) / 2} y={yOf(rows)} n={sink ? '0V' : supply} />
          <Txt x={O.TBX + 12} y={yOf(rows) + 0.9} size={2.5} mono>{sink ? `0V FROM ${zeroRef ?? stripTag(plan.ctx.designations, 1)}` : `${supply} FROM ${supplyRef ?? stripTag(plan.ctx.designations, 1)}`}</Txt>
          <Txt x={O.DESC} y={yOf(rows) + 0.2} size={2.6} bold>{sink ? 'OUTPUT COMMON TO 0V (SINKING OUTPUTS, LOADS FROM +24V)' : `OUTPUT SUPPLY ${supply}${supply === '24+S' ? ' (SAFETY-SWITCHED +24V)' : ''}`}</Txt>
        </g>
      )}
    </g>
  );
}

const isLamp = (p: IoPoint) => p.deviceType === 'pilot-light' || p.deviceType === 'stack-light';

function OutputRow({ plan, p, y, rail, prev }: { plan: DrawingPlan; p: IoPoint; y: number; rail: string; prev?: IoPoint }) {
  const lampOff24S = rail === '24+S' && isLamp(p);
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
        <Txt x={O.DEV - 4 + `${tag || '?'} COIL`.length * 1.56 + 2} y={y + 0.9} size={2.4} mono>{ref ? `TO ${ref}` : '(SEE CONTROL SHEET)'}</Txt>
        <Desc x={O.DESC} y={y} p={p} />
        <TableCells plan={plan} p={p} y={y} />
      </g>
    );
  }
  return (
    <g>
      <Line x1={start} y1={y} x2={field ? O.TBX - 2.5 : O.DEV - half} y2={y} />
      {field && <><TermBox x={O.TBX} y={y} n={tn(p.signalTerminal)} /><Line x1={O.TBX + 2.5} y1={y} x2={O.DEV - half} y2={y} /></>}
      <WireNo x={field ? (start + O.TBX - 2.5) / 2 : (start + O.DEV - half) / 2} y={y} n={p.wire} />
      {field && <WireNo x={(O.TBX + 2.5 + O.DEV - half) / 2} y={y} n={p.wire} />}
      <DeviceSymbol p={p} x={O.DEV} y={y} color={tagColor(plan, tag)} />
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
          {/* lamps on a safety-switched sinking module are fed from the unswitched 24+, so a fault lamp lights during a safety stop */}
          <Line x1={O.DEV + half} y1={y} x2={p.returnTerminal ? O.TBR - 2.5 : O.RAIL - (lampOff24S ? 4 : 0)} y2={y} />
          {p.returnTerminal && <><TermBox x={O.TBR} y={y} n={tn(p.returnTerminal)} /><Line x1={O.TBR + 2.5} y1={y} x2={O.RAIL - (lampOff24S ? 4 : 0)} y2={y} /></>}
          <WireNo x={(O.DEV + half + (p.returnTerminal ? O.TBR - 2.5 : O.RAIL)) / 2 + 3} y={y} n={lampOff24S ? '24+' : rail} />
          {lampOff24S ? <XrefArrow x={O.RAIL - 4} y={y} /> : <Dot x={O.RAIL} y={y} />}
        </g>
      )}
      <Desc x={O.DESC} y={y} p={p} />
      <TableCells plan={plan} p={p} y={y} />
    </g>
  );
}
