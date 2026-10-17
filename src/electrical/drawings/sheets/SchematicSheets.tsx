/** Power distribution, motor circuits and 24VDC control/safety ladder sheets. */
import { iecMotorKw, isIec } from '../../../standards/regions';
import { isFusedDisconnect, ratingText, supplyText, type MotorModel, type ResolvedComponent, type XfmrBranch } from '../../derive';
import { AREA, AREA_B, AREA_R, LW_THIN, lineNo } from '../geometry';
import {
  CONTROL_PITCH, CONTROL_RUNGS, MOTOR_LINES, MOTOR_PITCH, POWER_PITCH, resolveRefs,
  type DrawingPlan, type PlannedSheet, type Rung, type RungEl, type RungEnd, type SheetSpec,
} from '../plan';
import {
  BreakerPole, Coil, Contact, Dot, Fuse, Ground, Lamp, Line, Motor, OverloadHeater, Pushbutton, SwitchPole,
  TermBox, TermPt, Txt, WireNo, XrefArrow,
} from '../symbols';

const Y0 = AREA.y + 8;

/** Ladder line numbers down the left margin. */
export function LineNumbers({ sheet, count, pitch, y0 = Y0 }: { sheet: number; count: number; pitch: number; y0?: number }) {
  return (
    <g>
      <Line x1={AREA.x + 13} y1={AREA.y} x2={AREA.x + 13} y2={AREA_B} w={LW_THIN} />
      {Array.from({ length: count }, (_, i) => (
        <Txt key={i} x={AREA.x + 11} y={y0 + i * pitch + 0.9} size={2.5} mono anchor="end">{lineNo(sheet, i)}</Txt>
      ))}
    </g>
  );
}

function tagLabel(rc: ResolvedComponent | undefined, fallback: string) {
  return rc?.tag ?? fallback;
}

/** Multi-pole device: draws one pole per line plus a dashed mechanical linkage. */
function Poles({ x, ys, kind }: { x: number; ys: number[]; kind: 'breaker' | 'switch' | 'fuse' | 'contact' | 'ol' | 'mmp' }) {
  return (
    <g>
      {ys.map((y, i) => (
        <g key={i}>
          {kind === 'breaker' && <BreakerPole x={x} y={y} />}
          {kind === 'mmp' && <><BreakerPole x={x - 5} y={y} /><OverloadHeater x={x + 5} y={y} /></>}
          {kind === 'switch' && <SwitchPole x={x} y={y} />}
          {kind === 'fuse' && <Fuse x={x} y={y} />}
          {kind === 'contact' && <Contact x={x} y={y} />}
          {kind === 'ol' && <OverloadHeater x={x} y={y} />}
        </g>
      ))}
      {ys.length > 1 && kind !== 'fuse' && kind !== 'ol' && (
        <Line x1={x + (kind === 'switch' ? 0.6 : kind === 'mmp' ? -5 : 0)} y1={ys[0] - (kind === 'contact' ? 2.5 : 2.6)} x2={x + (kind === 'switch' ? 0.6 : kind === 'mmp' ? -5 : 0)} y2={ys[ys.length - 1] - (kind === 'contact' ? -2.5 : 1.2)} w={LW_THIN} dash="1.2 0.8" />
      )}
    </g>
  );
}

const protKind = (rc: ResolvedComponent | undefined): 'breaker' | 'fuse' | 'mmp' => (rc?.category === 'fuse' ? 'fuse' : rc?.category === 'motorProtector' ? 'mmp' : 'breaker');

// ---------------------------------------------------------------------------
// Power distribution
// ---------------------------------------------------------------------------

export function PowerSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'power' }>;
  const m = plan.model;
  const y = (i: number) => Y0 + i * POWER_PITCH;
  const BX = m.phases === 3 ? [104, 110, 116] : [104, 110];
  const nPh = BX.length;
  const ds = m.disconnect;
  const dsX = 62;
  const mbX = 84;
  const lastTap = Math.max(...sp.branches.map((b) => b.idx + b.b.feedWires.length - 1), 2 + nPh - 1);
  const busEnd = m.motors.length ? sp.contIdx + 1 : lastTap;
  const gy = y(sp.groundIdx);
  const pe = m.groundBar?.tag ?? 'PE BAR';
  const grounds = [
    'SUPPLY PE', ...m.psBranches.map((b) => `${b.ps.tag} PE`), ...m.motors.map((mm) => `${mm.motor.tag} ${mm.peTerminal ?? ''}`),
    ...m.strips.map((s) => `${s.tag} PE`), m.psBranches.length ? '0V BOND' : '', 'DOOR', 'BACK PANEL',
  ].filter(Boolean);
  const gStep = Math.min(30, (300 - 48) / Math.max(1, grounds.length));
  return (
    <g>
      <LineNumbers sheet={sheet.n} count={28} pitch={POWER_PITCH} />
      <Txt x={30} y={y(0) + 0.9} size={2.8} bold>{`INCOMING SUPPLY ${supplyText(m.supply)}`}</Txt>
      <Txt x={30} y={y(0) + 4.4} size={2.3}>{`FROM PLANT DISTRIBUTION — CONDUCTORS ${m.mainAwg} MIN. (VERIFY)`}</Txt>
      {/* incoming lines */}
      {m.incoming.map((w, k) => {
        const yy = y(2 + k);
        const isN = w === 'N';
        return (
          <g key={w}>
            <TermPt x={30} y={yy} />
            <Line x1={30.7} y1={yy} x2={isN ? BX[k] : dsX - 5} y2={yy} />
            <WireNo x={44} y={yy} n={w} />
            {isN && <Line x1={BX[k]} y1={yy} x2={BX[k]} y2={y(busEnd)} />}
          </g>
        );
      })}
      {/* disconnect */}
      <Poles x={dsX} ys={m.incoming.map((w, k) => (w === 'N' ? NaN : y(2 + k))).filter((v) => !Number.isNaN(v))} kind="switch" />
      <Txt x={dsX} y={y(2) - 5} size={2.8} mono bold anchor="middle">{tagLabel(ds, 'DS1')}</Txt>
      <Txt x={dsX} y={y(1 + nPh) + 5.2} size={2.3} anchor="middle">{ds ? ratingText(ds) || 'DISCONNECT' : 'NOT SPECIFIED'}</Txt>
      <Txt x={dsX} y={y(1 + nPh) + 8.4} size={2.3} anchor="middle">{isFusedDisconnect(ds) ? 'FUSED DISCONNECT' : 'MAIN DISCONNECT'}</Txt>
      {isFusedDisconnect(ds) && m.incoming.map((w, k) => (w === 'N' ? null : <Fuse key={`f${k}`} x={dsX + 12} y={y(2 + k)} />))}
      {/* main breaker (optional) and bus */}
      {m.incoming.map((w, k) => {
        if (w === 'N') return null;
        const yy = y(2 + k);
        return (
          <g key={`b${k}`}>
            {m.mainBreaker && <BreakerPole x={mbX} y={yy} />}
            <Line x1={dsX + 5} y1={yy} x2={m.mainBreaker ? mbX - 5 : BX[k]} y2={yy} />
            {m.mainBreaker && <Line x1={mbX + 5} y1={yy} x2={BX[k]} y2={yy} />}
            <WireNo x={m.mainBreaker ? (mbX + 5 + BX[k]) / 2 : (dsX + 5 + BX[0]) / 2} y={yy} n={m.bus[k]} />
            <Line x1={BX[k]} y1={yy} x2={BX[k]} y2={y(busEnd)} />
          </g>
        );
      })}
      {m.mainBreaker && (
        <g>
          <Line x1={mbX} y1={y(2) - 2.6} x2={mbX} y2={y(1 + nPh) - 1.2} w={LW_THIN} dash="1.2 0.8" />
          <Txt x={mbX} y={y(2) - 5} size={2.8} mono bold anchor="middle">{m.mainBreaker.tag}</Txt>
          <Txt x={mbX} y={y(1 + nPh) + 5.2} size={2.3} anchor="middle">{ratingText(m.mainBreaker)}</Txt>
        </g>
      )}

      {/* branches */}
      {sp.branches.map((br) => {
        const prot = br.b.protection;
        const ys = br.b.feedWires.map((_, k) => y(br.idx + k));
        const protYs = ys.slice(0, br.b.protectedPoles);
        const PX = 146;
        const fromX = br.type === 'ps' && !!br.b.fromXfmr;
        // Transformers with an integral fuse block (CT-...-1) protect their own primary and the secondary feed.
        const xfmr = m.xfmrBranch?.xfmr;
        const integral = !prot && (br.type === 'xfmr' || fromX) && /yes/i.test(String(xfmr?.part?.ratings.fused ?? ''));
        const protYsShown = integral ? ys.slice(0, br.type === 'xfmr' ? ys.length : 1) : protYs;
        return (
          <g key={`${br.type}${br.idx}`}>
            {br.b.feedWires.map((w, k) => (
              <g key={k}>
                {fromX ? (
                  <g>
                    <XrefArrow x={122} y={ys[k]} />
                    <Txt x={120} y={ys[k] + 0.9} size={2.4} mono anchor="end">{k === 0 ? 'X1' : 'X2'}</Txt>
                  </g>
                ) : <Dot x={BX[k]} y={ys[k]} />}
                <Line x1={fromX ? 124.4 : BX[k]} y1={ys[k]} x2={k < br.b.protectedPoles ? PX - 5 : PX + 5} y2={ys[k]} />
                {k >= br.b.protectedPoles && <Line x1={PX - 5} y1={ys[k]} x2={PX + 5} y2={ys[k]} />}
                <WireNo x={k < br.b.protectedPoles ? 172 : 172} y={ys[k]} n={w} />
              </g>
            ))}
            {prot ? <Poles x={PX} ys={protYs} kind={protKind(prot)} /> : integral ? <Poles x={PX} ys={protYsShown} kind="fuse" /> : protYs.map((yy, k) => <Line key={k} x1={PX - 5} y1={yy} x2={PX + 5} y2={yy} />)}
            <Txt x={PX} y={ys[0] - 4.6} size={2.8} mono bold anchor="middle">{prot?.tag ?? (integral ? `${xfmr?.tag ?? 'T1'} FU` : 'NO PROTECTION')}</Txt>
            <Txt x={PX} y={ys[ys.length - 1] + 5} size={2.3} anchor="middle">{integral ? (br.type === 'xfmr' ? 'INTEGRAL PRIMARY FUSES' : 'INTEGRAL SECONDARY FUSE') : ratingText(prot)}</Txt>
            {/* above the X1 wire right of its arrow: below the branch is the protection's note, left of it the bus */}
            {fromX && <Txt x={125} y={ys[0] - 1.4} size={2.0} maxW={PX - 7 - 125}>{`FROM ${m.xfmrBranch?.xfmr.tag ?? 'T1'} ${plan.xref.get('xfmr') ?? ''}`.trim()}</Txt>}
            {br.type === 'xfmr' ? <XfmrBox plan={plan} br={br.b} ys={ys} y0={y(br.idx)} pitch={POWER_PITCH} /> : br.type === 'ps' ? <PsBox plan={plan} br={br.b} ys={ys} y0={y(br.idx)} pitch={POWER_PITCH} /> : (
              <g>
                {ys.map((yy, k) => <Line key={k} x1={PX + 5} y1={yy} x2={208} y2={yy} />)}
                {ys.map((yy, k) => <XrefArrow key={`a${k}`} x={208} y={yy} />)}
                <Txt x={214} y={ys[0] + 0.9} size={2.5}>{(br.b.protection.comp.function || 'AUXILIARY LOAD').toUpperCase()}</Txt>
              </g>
            )}
          </g>
        );
      })}

      {/* bus continuation to motor sheets */}
      {m.motors.length > 0 && (
        <g>
          {BX.map((x, k) => <XrefArrow key={k} x={x} y={y(busEnd)} dir="down" />)}
          <Txt x={BX[nPh - 1] + 6} y={y(busEnd) + 2} size={2.5} mono bold>{m.bus.join(', ')}</Txt>
          <Txt x={BX[nPh - 1] + 6} y={y(busEnd) + 5.5} size={2.5}>{`TO MOTOR CIRCUITS ${plan.xref.get('motors') ?? ''}`}</Txt>
        </g>
      )}

      {/* PE */}
      <g>
        <Txt x={30} y={y(2 + nPh) - 1} size={2.5} mono>PE</Txt>
        <TermPt x={30} y={y(2 + nPh)} />
        <Line x1={30.7} y1={y(2 + nPh)} x2={36} y2={y(2 + nPh)} />
        <Line x1={36} y1={y(2 + nPh)} x2={36} y2={gy} />
        <Line x1={36} y1={gy} x2={44} y2={gy} />
        <rect x={44} y={gy - 1.6} width={260} height={3.2} strokeWidth={0.5} fill="#fff" />
        <Txt x={44} y={gy - 3.2} size={2.8} mono bold>{pe}</Txt>
        <Txt x={44 + 14} y={gy - 3.2} size={2.5}>MAIN PROTECTIVE EARTH (PE) BAR — BONDED TO ENCLOSURE AND BACK PANEL</Txt>
        <Ground x={300} y={gy + 1.6} />
        {grounds.map((g, i) => {
          const x = 52 + i * gStep;
          return (
            <g key={g}>
              <Line x1={x} y1={gy + 1.6} x2={x} y2={gy + 5} w={LW_THIN} />
              <TermPt x={x} y={gy + 5.4} />
              <Txt x={x} y={gy + 9.6} size={2.2} anchor="middle" maxW={gStep - 1.5}>{g.split(' ')[0]}</Txt>
              <Txt x={x} y={gy + 12.6} size={2.2} anchor="middle" mono maxW={gStep - 1.5}>{g.split(' ').slice(1).join(' ')}</Txt>
            </g>
          );
        })}
        <Txt x={44} y={gy + 18} size={2.3}>ALL PE CONDUCTORS GREEN/YELLOW. ONE CONDUCTOR PER TERMINAL. BOND DOOR WITH FLEXIBLE STRAP (NFPA 79 CH. 8).</Txt>
      </g>
      <Txt x={AREA_R - 2} y={AREA_B - 2} size={2.3} anchor="end" italic>BRANCH WIRES ARE NUMBERED &lt;DEVICE&gt;-L1.. ON THE LOAD SIDE OF THE BRANCH PROTECTION</Txt>
    </g>
  );
}

function XfmrBox({ plan, br, ys, y0, pitch }: { plan: DrawingPlan; br: XfmrBranch; ys: number[]; y0: number; pitch: number }) {
  const bx = 196, bw = 42;
  const top = y0 - 4, bot = y0 + 2 * pitch + 4;
  const T = br.xfmr;
  const r = T.part?.ratings ?? {};
  const yX1 = y0, yX2 = y0 + pitch;
  const ps = plan.model.psBranches[0]?.ps.tag;
  const psRef = ps ? plan.xref.get(`ps:${ps}`) : undefined;
  return (
    <g>
      {ys.map((yy, k) => <Line key={k} x1={151} y1={yy} x2={bx} y2={yy} />)}
      <rect x={bx} y={top} width={bw} height={bot - top} strokeWidth={0.5} fill="#fff" />
      {/* transformer windings symbol */}
      <path d={`M ${bx + 15} ${y0 - 2} q 2 1.5 0 3 q 2 1.5 0 3 q 2 1.5 0 3 q 2 1.5 0 3`} strokeWidth={0.35} />
      <path d={`M ${bx + 27} ${y0 - 2} q -2 1.5 0 3 q -2 1.5 0 3 q -2 1.5 0 3 q -2 1.5 0 3`} strokeWidth={0.35} />
      <Line x1={bx + 20.4} y1={y0 - 2.5} x2={bx + 20.4} y2={y0 + 10.5} w={0.3} />
      <Line x1={bx + 21.6} y1={y0 - 2.5} x2={bx + 21.6} y2={y0 + 10.5} w={0.3} />
      {ys.map((_, k) => <Txt key={k} x={bx + 1.5} y={ys[k] + 0.9} size={2.2} mono>{k === 0 ? 'H1' : 'H4'}</Txt>)}
      <Txt x={bx + bw - 1.5} y={yX1 + 0.9} size={2.2} mono anchor="end">X1</Txt>
      <Txt x={bx + bw - 1.5} y={yX2 + 0.9} size={2.2} mono anchor="end">X2</Txt>
      <Txt x={bx + bw / 2} y={y0 + 2 * pitch + 1} size={2.6} mono bold anchor="middle">{T.tag}</Txt>
      <Txt x={bx + bw / 2} y={bot + 4} size={2.2} anchor="middle" maxW={60}>{`CONTROL TRANSFORMER ${ratingText(T)}`}</Txt>
      <Line x1={bx + bw} y1={yX1} x2={300} y2={yX1} />
      <Line x1={bx + bw} y1={yX2} x2={300} y2={yX2} />
      <WireNo x={258} y={yX1} n="X1" />
      <WireNo x={258} y={yX2} n="X2" />
      <XrefArrow x={300} y={yX1} />
      <XrefArrow x={300} y={yX2} />
      <Txt x={305} y={yX1 + 0.9} size={2.5} mono>{`X1 ${r.secondaryVolts ?? 120}VAC TO ${ps ?? 'CONTROL'} ${psRef ?? ''}`}</Txt>
      <Txt x={305} y={yX2 + 0.9} size={2.5} mono>{`X2 TO ${ps ?? 'CONTROL'} ${psRef ? plan.xref.get(`ps0:${ps}`) ?? psRef : ''}`}</Txt>
      <Dot x={280} y={yX2} />
      <Line x1={280} y1={yX2} x2={280} y2={yX2 + 4} />
      <Ground x={280} y={yX2 + 4} />
      <Txt x={284} y={yX2 + 7.6} size={2.2}>X2 BONDED TO PE</Txt>
    </g>
  );
}

function PsBox({ plan, br, ys, y0, pitch }: { plan: DrawingPlan; br: { ps: ResolvedComponent; feedWires: string[] }; ys: number[]; y0: number; pitch: number }) {
  const bx = 200, bw = 42;
  const top = y0 - 4, bot = y0 + 2 * pitch + 4;
  const ps = br.ps;
  const yP = y0, yN = y0 + pitch;
  const ctlRef = plan.xref.get('ctl:first') ?? '';
  return (
    <g>
      {ys.map((yy, k) => <Line key={k} x1={151} y1={yy} x2={bx} y2={yy} />)}
      <rect x={bx} y={top} width={bw} height={bot - top} strokeWidth={0.5} fill="#fff" />
      {br.feedWires.map((w, k) => <Txt key={k} x={bx + 1.5} y={ys[k] + 0.9} size={2.2} mono>{w === 'N' || w === 'X2' ? 'N' : br.feedWires.length === 2 && br.feedWires[1] === 'X2' ? 'L' : `L${k + 1}`}</Txt>)}
      <Txt x={bx + bw - 1.5} y={yP + 0.9} size={2.2} mono anchor="end">+V</Txt>
      <Txt x={bx + bw - 1.5} y={yN + 0.9} size={2.2} mono anchor="end">-V</Txt>
      <Txt x={bx + bw / 2} y={yP + 1} size={2.8} mono bold anchor="middle">{ps.tag}</Txt>
      <Txt x={bx + bw / 2} y={yN + 1} size={2.3} anchor="middle" maxW={24}>{ratingText(ps) || '24VDC'}</Txt>
      <Txt x={bx + bw / 2} y={yN + pitch + 1} size={2.2} anchor="middle">AC / DC</Txt>
      <Line x1={bx + bw / 2} y1={bot} x2={bx + bw / 2} y2={bot + 1.5} />
      <Ground x={bx + bw / 2} y={bot + 1.5} />
      <Txt x={bx + bw / 2 + 3} y={bot + 4.5} size={2.2} mono>PE</Txt>
      <Line x1={bx + bw} y1={yP} x2={300} y2={yP} />
      <Line x1={bx + bw} y1={yN} x2={300} y2={yN} />
      <WireNo x={258} y={yP} n="24+" />
      <WireNo x={258} y={yN} n="0V" />
      <XrefArrow x={300} y={yP} />
      <XrefArrow x={300} y={yN} />
      <Txt x={305} y={yP + 0.9} size={2.5} mono>{`24+ TO ${ctlRef || 'CONTROL'}`}</Txt>
      <Txt x={305} y={yN + 0.9} size={2.5} mono>{`0V  TO ${ctlRef || 'CONTROL'}`}</Txt>
      {/* 0V bond to PE */}
      <Dot x={280} y={yN} />
      <Line x1={280} y1={yN} x2={280} y2={yN + 4} />
      <Ground x={280} y={yN + 4} />
      <Txt x={284} y={yN + 7.6} size={2.2}>0V BONDED TO PE</Txt>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Motor circuits
// ---------------------------------------------------------------------------

export function MotorSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'motors' }>;
  const y = (i: number) => Y0 + i * MOTOR_PITCH;
  const nPh = plan.model.phases === 3 ? 3 : 2;
  const BX = [40, 46, 52].slice(0, nPh);
  const bottom = sp.continues ? y(MOTOR_LINES - 1) : y(sp.busEnd);
  const fromRef = sp.first ? plan.xref.get('power:cont') : `${sheet.n - 1}.${String(MOTOR_LINES - 1).padStart(2, '0')}`;
  return (
    <g>
      <LineNumbers sheet={sheet.n} count={MOTOR_LINES + 1} pitch={MOTOR_PITCH} />
      {BX.map((x, k) => (
        <g key={k}>
          <Line x1={x} y1={y(0) + 2} x2={x} y2={bottom} />
          <XrefArrow x={x} y={y(0) + 2} dir="up" />
          {sp.continues && <XrefArrow x={x} y={bottom} dir="down" />}
        </g>
      ))}
      <Txt x={BX[nPh - 1] + 6} y={y(0) + 0.9} size={2.5} mono bold>{plan.model.bus.join(', ')}</Txt>
      <Txt x={BX[nPh - 1] + 6 + 30} y={y(0) + 0.9} size={2.5}>{`FROM ${fromRef ?? 'PREVIOUS SHEET'}`}</Txt>
      {sp.continues && <Txt x={BX[nPh - 1] + 6} y={bottom + 1} size={2.5}>{`${plan.model.bus.join(', ')} TO ${sheet.n + 1}.01`}</Txt>}
      {sp.items.map((it) => <MotorBranch key={it.m.motor.tag} plan={plan} m={it.m} idx={it.idx} y={y} BX={BX} />)}
    </g>
  );
}

function MotorBranch({ plan, m, idx, y, BX }: { plan: DrawingPlan; m: MotorModel; idx: number; y: (i: number) => number; BX: number[] }) {
  const ph = m.lineWires.length;
  const ys = m.lineWires.map((_, k) => y(idx + 1 + k));
  const rev = m.motor.reversing && m.contactors.length >= 2 && !m.vfd;
  const ysR = ys.map((_, k) => y(idx + 5 + k));
  const labY = ys[ph - 1] + 5.2;
  const PX = 80;
  const protEnd = m.protection?.category === 'motorProtector' ? PX + 10 : PX + 5;
  const KX = 135, OX = 186, TBX = 240, MX = 300;
  const kf = m.contactors[0], kr = m.contactors[1];
  const ioRun = plan.model.io.find((p) => p.deviceTag && p.deviceTag === m.vfd?.tag);
  const coilRef = (tag: string | undefined) => (tag ? plan.xref.get(`coil:${tag}`) : undefined);
  const tbNo = (label: string | undefined) => (label ? label.split('-').pop() ?? '' : '');
  const peNo = tbNo(m.peTerminal);
  const cy = ys[Math.floor(ph / 2)] + (ph === 2 ? MOTOR_PITCH / 2 : 0);
  const loadStart = m.vfd ? 205 : m.overload ? OX + 5 : kf ? KX + 4 : protEnd;
  const peY = y(idx + 4);
  return (
    <g>
      <Txt x={60} y={y(idx) + 0.9} size={2.8} bold>{`${m.motor.tag} — ${m.motor.description.toUpperCase()}`}</Txt>
      {/* taps + protection */}
      {ys.map((yy, k) => (
        <g key={k}>
          <Dot x={BX[k]} y={yy} />
          <Line x1={BX[k]} y1={yy} x2={PX - (m.protection?.category === 'motorProtector' ? 10 : 5)} y2={yy} />
        </g>
      ))}
      {m.protection ? <Poles x={m.protection.category === 'motorProtector' ? PX + 0 : PX} ys={ys} kind={protKind(m.protection)} /> : ys.map((yy, k) => <Line key={k} x1={PX - 5} y1={yy} x2={PX + 5} y2={yy} />)}
      <Txt x={PX} y={labY} size={2.8} mono bold anchor="middle">{m.protection?.tag ?? '—'}</Txt>
      <Txt x={PX} y={labY + 3.2} size={2.2} anchor="middle">{ratingText(m.protection) || (m.protection ? '' : 'NO PROTECTION')}</Txt>

      {m.vfd ? (
        <g>
          {kf ? (
            <g>
              {/* line contactor ahead of the drive (safety stop by contactor) */}
              {ys.map((yy, k) => <g key={k}><Line x1={protEnd} y1={yy} x2={101} y2={yy} /><WireNo x={(protEnd + 101) / 2} y={yy} n={m.lineWires[k]} /><Line x1={109} y1={yy} x2={125} y2={yy} /><WireNo x={117} y={yy} n={m.midWires[k]} /></g>)}
              <Poles x={105} ys={ys} kind="contact" />
              <Txt x={105} y={labY} size={2.8} mono bold anchor="middle">{kf.tag}</Txt>
              <Txt x={105} y={labY + 3.2} size={2.2} anchor="middle">{`COIL /${coilRef(kf.tag) ?? '?'}`}</Txt>
            </g>
          ) : ys.map((yy, k) => <g key={k}><Line x1={protEnd} y1={yy} x2={125} y2={yy} /><WireNo x={(protEnd + 125) / 2} y={yy} n={m.lineWires[k]} /></g>)}
          <rect x={125} y={ys[0] - 4} width={80} height={ys[ph - 1] - ys[0] + 8} strokeWidth={0.5} fill="#fff" />
          {ys.map((yy, k) => <Txt key={`i${k}`} x={127} y={yy + 0.9} size={2.2} mono>{`L${k + 1}`}</Txt>)}
          {ys.map((yy, k) => <Txt key={`o${k}`} x={203} y={yy + 0.9} size={2.2} mono anchor="end">{`T${k + 1}`}</Txt>)}
          <Txt x={165} y={ys[0] + 1} size={2.8} mono bold anchor="middle">{m.vfd.tag}</Txt>
          <Txt x={165} y={ys[1] + 0.9} size={2.3} anchor="middle">{`AC DRIVE ${ratingText(m.vfd)}`}</Txt>
          {ph > 2 && <Txt x={165} y={ys[2] + 0.9} size={2.2} anchor="middle" maxW={60}>{ioRun ? `RUN: ${ioRun.address} /${plan.xref.get(`io:${ioRun.address}`) ?? ''}` : 'RUN CMD: SEE I/O'}</Txt>}
          <Txt x={165} y={ys[ph - 1] + 9} size={2.2} anchor="middle">STO/ENABLE PER DRIVE MANUAL</Txt>
        </g>
      ) : (
        <g>
          {ys.map((yy, k) => (
            <g key={k}>
              <Line x1={protEnd} y1={yy} x2={kf ? KX - 4 : OX - 5} y2={yy} />
              <WireNo x={rev ? (protEnd + 104) / 2 : (protEnd + KX - 4) / 2} y={yy} n={m.lineWires[k]} />
            </g>
          ))}
          {kf && <Poles x={KX} ys={ys} kind="contact" />}
          {kf && (
            <g>
              <Txt x={rev ? KX - 5 : KX} y={labY} size={2.8} mono bold anchor={rev ? 'end' : 'middle'}>{kf.tag}</Txt>
              <Txt x={rev ? KX - 5 : KX} y={labY + 3.2} size={2.2} anchor={rev ? 'end' : 'middle'}>{`COIL /${coilRef(kf.tag) ?? '?'}`}</Txt>
            </g>
          )}
          {ys.map((yy, k) => (
            <g key={`m${k}`}>
              <Line x1={kf ? KX + 4 : OX - 5} y1={yy} x2={m.overload ? OX - 5 : TBX - 2.5} y2={yy} />
              {m.overload && <WireNo x={170} y={yy} n={m.midWires[k]} />}
            </g>
          ))}
          {rev && kr && (
            <g>
              {ys.map((yy, k) => {
                const dx = 106 + k * 5;
                const to = ph === 3 ? [2, 1, 0][k] : k;
                const ux = 148 + k * 5;
                return (
                  <g key={`r${k}`}>
                    <Dot x={dx} y={yy} />
                    <Line x1={dx} y1={yy} x2={dx} y2={ysR[k]} />
                    <Line x1={dx} y1={ysR[k]} x2={KX - 4} y2={ysR[k]} />
                    <Line x1={KX + 4} y1={ysR[k]} x2={ux} y2={ysR[k]} />
                    <Line x1={ux} y1={ysR[k]} x2={ux} y2={ys[to]} />
                    <Dot x={ux} y={ys[to]} />
                  </g>
                );
              })}
              <Poles x={KX} ys={ysR} kind="contact" />
              <Line x1={KX} y1={ys[ph - 1] + 2.5} x2={KX} y2={ysR[0] - 2.5} w={LW_THIN} dash="0.6 0.9" />
              <Txt x={KX - 5} y={ysR[ph - 1] + 5.2} size={2.8} mono bold anchor="end">{kr.tag}</Txt>
              <Txt x={KX - 5} y={ysR[ph - 1] + 8.4} size={2.2} anchor="end">{`COIL /${coilRef(kr.tag) ?? '?'}`}</Txt>
              <Txt x={KX + 12} y={ysR[ph - 1] + 5.2} size={2.2}>{`REVERSE: L1/L3 SWAPPED. ${kf.tag}/${kr.tag} MECHANICALLY + ELECTRICALLY INTERLOCKED`}</Txt>
            </g>
          )}
          {m.overload && (
            <g>
              <Poles x={OX} ys={ys} kind="ol" />
              <Line x1={OX} y1={ys[0] - 2.4} x2={OX} y2={ys[ph - 1] - 2.4} w={LW_THIN} dash="1.2 0.8" />
              <Txt x={OX} y={labY} size={2.8} mono bold anchor="middle">{m.overload.tag}</Txt>
              <Txt x={OX} y={labY + 3.2} size={2.2} anchor="middle">{ratingText(m.overload)}</Txt>
              {(plan.contacts.get(m.overload.tag) ?? []).slice(0, 2).map((c, i) => <Txt key={i} x={OX} y={labY + 6.2 + i * 2.8} size={2.0} mono anchor="middle">{`${c.term} /${c.line}`}</Txt>)}
            </g>
          )}
        </g>
      )}

      {/* load side, terminals, motor */}
      {ys.map((yy, k) => (
        <g key={`l${k}`}>
          <Line x1={loadStart} y1={yy} x2={TBX - 2.5} y2={yy} />
          <WireNo x={(Math.max(loadStart, OX + 5) + TBX) / 2} y={yy} n={m.loadWires[k]} />
          <TermBox x={TBX} y={yy} n={tbNo(m.terminals[k])} />
          <Line x1={TBX + 2.5} y1={yy} x2={MX - 14.5} y2={yy} />
          <WireNo x={268} y={yy} n={m.loadWires[k]} />
        </g>
      ))}
      <Txt x={TBX} y={ys[0] - 3.6} size={2.5} mono bold anchor="middle">TB1</Txt>
      <Motor cx={MX} cy={cy} leadsY={ys} r={8.5} />
      <Txt x={MX + 12} y={ys[0] + 0.9} size={2.8} mono bold>{m.motor.tag}</Txt>
      <Txt x={MX + 12} y={ys[0] + 4.6} size={2.5}>{isIec(plan.ctx.region) ? `${iecMotorKw(m.motor.hp)} kW (${m.motor.hp} HP)  ${m.motor.voltage.replace('-', ' ')}` : `${m.motor.hp} HP  ${m.motor.voltage.replace('-', ' ')}`}</Txt>
      <Txt x={MX + 12} y={ys[0] + 8.3} size={2.5}>{isIec(plan.ctx.region) ? `Ie ${m.fla} A (IEC 60947-4-1 ANNEX G)` : `FLA ${m.fla} A (${plan.ctx.region === 'Canada' ? 'CEC TABLE 44' : 'NEC 430.250'})`}</Txt>
      <Txt x={MX + 12} y={ys[0] + 12} size={2.5}>{`CONDUCTORS ${m.awg} MIN. (VERIFY)`}</Txt>
      <Txt x={MX + 12} y={ys[0] + 15.7} size={2.3} maxW={100}>{(m.vfd ? 'VFD CONTROLLED' : m.motor.starter === 'motor-protector' ? 'MANUAL MOTOR PROTECTOR' : 'ACROSS-THE-LINE STARTER') + (m.motor.reversing ? ', REVERSING' : '')}</Txt>
      {/* PE */}
      <Line x1={MX} y1={cy + 8.5} x2={MX} y2={peY} />
      <Line x1={TBX + 2.5} y1={peY} x2={MX} y2={peY} />
      <TermBox x={TBX} y={peY} n={peNo} />
      <Line x1={TBX - 2.5} y1={peY} x2={TBX - 8} y2={peY} />
      <Ground x={TBX - 8} y={peY} />
      <WireNo x={268} y={peY} n="PE" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Control ladder
// ---------------------------------------------------------------------------

const RAIL_L = 34;
const RAIL_R = 288;
const LOAD_X = 262;

export function ControlSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'control' }>;
  const y = (i: number) => Y0 + i * CONTROL_PITCH;
  const used = sp.rungs.filter((r) => r.els.length);
  const lastL = Math.max(1, ...used.filter((r) => r.start.kind === 'rail').map((r) => r.idx));
  const lastR = Math.max(1, ...used.filter((r) => r.end.kind === 'rail').map((r) => r.idx));
  const ps = plan.model.psBranches[0]?.ps.tag ?? 'PS1';
  const psRef = plan.xref.get(`ps:${ps}`);
  return (
    <g>
      <LineNumbers sheet={sheet.n} count={CONTROL_RUNGS + 1} pitch={CONTROL_PITCH} />
      <Txt x={RAIL_L - 3} y={y(0) - 1.5} size={2.8} mono bold>24+</Txt>
      <Txt x={RAIL_L + 6} y={y(0) - 1.5} size={2.3}>{`+24VDC FROM ${ps} ${psRef ?? ''}`}</Txt>
      <Txt x={RAIL_R + 3} y={y(0) - 1.5} size={2.8} mono bold anchor="end">0V</Txt>
      <Txt x={RAIL_R - 6} y={y(0) - 1.5} size={2.3} anchor="end">{`0V FROM ${ps} ${plan.xref.get(`ps0:${ps}`) ?? ''}`}</Txt>
      <Line x1={RAIL_L} y1={y(0)} x2={RAIL_L} y2={y(lastL)} w={0.5} />
      <Line x1={RAIL_R} y1={y(0)} x2={RAIL_R} y2={y(lastR)} w={0.5} />
      <Line x1={RAIL_R + 6} y1={AREA.y} x2={RAIL_R + 6} y2={AREA_B} w={LW_THIN} />
      <Txt x={RAIL_R + 9} y={y(0) - 1.5} size={2.5} bold>DESCRIPTION / CROSS-REFERENCE</Txt>
      {sp.rungs.map((r) => <RungView key={r.idx} plan={plan} r={r} yy={y(r.idx)} />)}
    </g>
  );
}

function elWidth(e: RungEl): number {
  if (e.t === 'contact') return e.dev === 'pb' || e.dev === 'estop' ? 10 : 8;
  if (e.t === 'box') return 24;
  return 10;
}

function endLabel(end: RungEnd, plan: DrawingPlan) {
  return end.kind === 'rail' ? '' : resolveRefs(end.label, plan.xref);
}

function RungView({ plan, r, yy }: { plan: DrawingPlan; r: Rung; yy: number }) {
  if (!r.els.length) return null;
  const loadIdx = r.els.findIndex((e) => e.t === 'coil' || e.t === 'lamp' || e.t === 'box');
  // x positions
  const xs: number[] = [];
  const startX = r.start.kind === 'rail' ? RAIL_L : r.start.kind === 'node' ? 50 : 52;
  const endX = r.end.kind === 'rail' ? RAIL_R : 270;
  let cx = Math.max(startX, 50) + 22;
  r.els.forEach((e, i) => {
    if (i === loadIdx && loadIdx === r.els.length - 1) xs.push(LOAD_X);
    else { xs.push(cx); cx += 36; }
    void e;
  });
  const segs: [number, number][] = [];
  let prev = startX;
  r.els.forEach((e, i) => { segs.push([prev, xs[i] - elWidth(e) / 2]); prev = xs[i] + elWidth(e) / 2; });
  segs.push([prev, endX]);
  const desc = r.desc.map((d) => resolveRefs(d, plan.xref)).filter(Boolean);
  return (
    <g>
      {/* start */}
      {r.start.kind === 'rail' && <Dot x={RAIL_L} y={yy} />}
      {r.start.kind === 'node' && (
        <g>
          <TermPt x={startX} y={yy} />
          <Txt x={startX - 1.5} y={yy - 2} size={2.5} mono bold anchor="end">{r.start.label.split(' ')[0]}</Txt>
          <Txt x={startX - 1.5} y={yy + 3.6} size={2.3} mono anchor="end">{r.start.label.split(' ').slice(1).join(' ')}</Txt>
        </g>
      )}
      {r.start.kind === 'xref' && (
        <g>
          <XrefArrow x={startX - 2.4} y={yy} />
          <Txt x={startX - 4} y={yy + 0.9} size={2.5} mono anchor="end">{endLabel(r.start, plan).split(' ')[0]}</Txt>
          <Txt x={startX - 4} y={yy + 4.4} size={2.2} mono anchor="end">{endLabel(r.start, plan).split(' ').slice(1).join(' ')}</Txt>
        </g>
      )}
      {segs.map(([a, b], i) => (
        <g key={i}>
          <Line x1={a + (i === 0 && r.start.kind === 'node' ? 0.7 : 0)} y1={yy} x2={b - (i === segs.length - 1 && r.end.kind === 'node' ? 0.7 : 0)} y2={yy} />
          {b - a > 9 && <WireNo x={wireLabelX(r, xs, i, a, b)} y={yy} n={r.wires[i] ?? ''} maxW={b - a - 2} />}
        </g>
      ))}
      {r.els.map((e, i) => <RungElement key={i} plan={plan} e={e} x={xs[i]} y={yy} />)}
      {r.end.kind === 'rail' && <Dot x={RAIL_R} y={yy} />}
      {r.end.kind === 'node' && (
        <g>
          <TermPt x={endX} y={yy} />
          <Txt x={endX + 1.5} y={yy - 2} size={2.5} mono bold>{r.end.label.split(' ')[0]}</Txt>
          <Txt x={endX + 1.5} y={yy + 3.6} size={2.3} mono>{r.end.label.split(' ').slice(1).join(' ')}</Txt>
        </g>
      )}
      {r.end.kind === 'xref' && (
        <g>
          <XrefArrow x={endX} y={yy} />
          <Txt x={endX + 3.5} y={yy + 0.9} size={2.4} mono bold>{endLabel(r.end, plan).split(' ')[0]}</Txt>
          <Txt x={endX + 3.5} y={yy + 4.2} size={2.0} mono maxW={RAIL_R - endX - 4}>{endLabel(r.end, plan).split(' ').slice(1).join(' ')}</Txt>
        </g>
      )}
      {desc.map((d, i) => <Txt key={i} x={RAIL_R + 9} y={yy - 0.6 + i * 3.4} size={i === 0 ? 2.5 : 2.3} bold={i === 0} maxW={AREA_R - RAIL_R - 11}>{d}</Txt>)}
    </g>
  );
}

/** Midpoint of a rung segment, pushed right so it clears a pushbutton tag drawn to the right of its actuator. */
function wireLabelX(r: Rung, xs: number[], i: number, a: number, b: number): number {
  const mid = (a + b) / 2;
  const prev = r.els[i - 1];
  if (!prev || prev.t !== 'contact' || (prev.dev !== 'pb' && prev.dev !== 'estop')) return mid;
  const tagEnd = xs[i - 1] + 4.6 + prev.tag.length * 1.56 + prev.term.length * 1.32 + 1;
  const w = (r.wires[i] ?? '').length * 1.5;
  return Math.min(Math.max(mid, tagEnd + w / 2), b - w / 2 - 0.5);
}

/** Where the coil of a contact is (or the overload heaters of an overload contact). */
function coilOf(plan: DrawingPlan, tag: string): string | undefined {
  return plan.xref.get(`coil:${tag}`) ?? plan.xref.get(`heater:${tag}`);
}

/** Contact mirror under a coil: every contact of the device with its line ("NO 13-14  5.06"). */
function ContactMirror({ plan, tag, x, y }: { plan: DrawingPlan; tag: string; x: number; y: number }) {
  const list = plan.contacts.get(tag) ?? [];
  if (!list.length) return null;
  const items = list.map((c) => (c.main ? `MAIN ${c.line}` : `${c.nc ? 'NC' : 'NO'} ${c.term} ${c.line}`));
  const shown = items.length > 4 ? [...items.slice(0, 3), `+${items.length - 3} MORE`] : items;
  const lines: string[] = [];
  for (let i = 0; i < shown.length; i += 2) lines.push(shown.slice(i, i + 2).join('  '));
  return (
    <g>
      <Line x1={x - 11} y1={y + 4.6} x2={x + 11} y2={y + 4.6} w={0.12} />
      {lines.map((l, i) => <Txt key={i} x={x} y={y + 6.3 + i * 2.0} size={1.7} mono anchor="middle">{l}</Txt>)}
    </g>
  );
}

function RungElement({ plan, e, x, y }: { plan: DrawingPlan; e: RungEl; x: number; y: number }) {
  switch (e.t) {
    case 'contact': {
      const isPb = e.dev === 'pb' || e.dev === 'estop';
      return (
        <g>
          {isPb ? <Pushbutton x={x} y={y} nc={e.nc} mushroom={e.dev === 'estop'} /> : <Contact x={x} y={y} nc={e.nc} />}
          {isPb ? (
            <>
              <Txt x={x + 4} y={y - 3.4} size={2.6} mono bold>{e.tag}</Txt>
              <Txt x={x + 4.6 + e.tag.length * 1.56} y={y - 3.4} size={2.2} mono>{e.term}</Txt>
            </>
          ) : (
            <>
              <Txt x={x - 1} y={y - 4.0} size={2.6} mono bold anchor="end">{e.tag}</Txt>
              <Txt x={x + 0.5} y={y - 4.0} size={2.2} mono>{e.term}</Txt>
              {coilOf(plan, e.tag) && <Txt x={x} y={y + 5.2} size={1.9} mono anchor="middle">{`/${coilOf(plan, e.tag)}`}</Txt>}
            </>
          )}
        </g>
      );
    }
    case 'coil':
      return (
        <g>
          <Coil x={x} y={y} />
          <Txt x={x} y={y - 4.2} size={2.6} mono bold anchor="middle">{e.tag}</Txt>
          <Txt x={x - 3.6} y={y + 3.6} size={2.0} mono anchor="end">A1</Txt>
          <Txt x={x + 3.6} y={y + 3.6} size={2.0} mono>A2</Txt>
          <ContactMirror plan={plan} tag={e.tag} x={x} y={y + 0.4} />
        </g>
      );
    case 'lamp':
      return (
        <g>
          <Lamp x={x} y={y} color={e.color} />
          <Txt x={x} y={y - 4.6} size={2.6} mono bold anchor="middle">{e.tag}</Txt>
          <Txt x={x - 3.8} y={y + 3.9} size={2.0} mono anchor="end">X1</Txt>
          <Txt x={x + 3.8} y={y + 3.9} size={2.0} mono>X2</Txt>
        </g>
      );
    case 'box':
      return (
        <g>
          <rect x={x - 12} y={y - 3} width={24} height={6} strokeWidth={0.45} fill="#fff" />
          <Txt x={x - 11} y={y + 0.9} size={2.2} mono>{e.left}</Txt>
          <Txt x={x + 11} y={y + 0.9} size={2.2} mono anchor="end">{e.right}</Txt>
          <Txt x={x} y={y + 0.9} size={2.2} anchor="middle">SAFETY</Txt>
          <Txt x={x} y={y - 4.2} size={2.6} mono bold anchor="middle">{e.tag}</Txt>
          <ContactMirror plan={plan} tag={e.tag} x={x} y={y - 0.4} />
        </g>
      );
  }
}
