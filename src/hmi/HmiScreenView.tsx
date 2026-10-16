import { bgBox } from './background';
import type { HmiDesign, HmiElement, HmiScreen, HmiState } from './types';
import type { HmiRuntime } from './runtime';
import { C, FONT, MONO, caps, fitSize, fitText, fmtDate, fmtTime, LEVEL_SHORT, stateTextColor, styleColor, textWidth } from './theme';
import { LockBadge, MachineGraphic } from './symbols';

/**
 * Draws one HMI screen as SVG in the panel's native pixels (scales to fit its
 * container). Static by default; pass `read`/`onPress` to make it live
 * (simulation) and `onSelect` to make elements selectable (editing).
 */
export interface HmiScreenViewProps {
  screen: HmiScreen;
  widthPx: number;
  heightPx: number;
  /** Live PLC value for an address (simulation). */
  read?: (address: string) => boolean | number;
  /** Button pressed (down=true) or released (down=false). */
  onPress?: (el: HmiElement, down: boolean) => void;
  onNavigate?: (screenId: string) => void;
  /** Active alarm messages (legacy; used when no `design`/`runtime` is given). */
  activeAlarms?: string[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Whole design: header machine name, alarm table rows, locks on nav buttons. */
  design?: HmiDesign;
  /** Live panel data: clock, alarm log, trend buffers. */
  runtime?: HmiRuntime;
  /** Clock time for static renders (defaults to the time of rendering). */
  staticTime?: number;
  /** Hide the selection outline etc. for thumbnails. */
  thumbnail?: boolean;
}

interface AlarmRow { message: string; severity: 'alarm' | 'warning'; on: number | null; off: number | null; active: boolean }

interface Ctx {
  screen: HmiScreen;
  design?: HmiDesign;
  read?: (address: string) => boolean | number;
  live: boolean;
  now: number;
  rows: AlarmRow[];
  activeCount: number;
  runtime?: HmiRuntime;
}

const renderTime = () => Date.now();

/** Register values: integers as-is, floating point (DF, analog in engineering units) to one decimal. */
const showNum = (v: number) => (Number.isInteger(v) || !Number.isFinite(v) ? String(v) : v.toFixed(1));

function Label({ el, children, color = C.text, size, weight = 500, spacing = 1.5, dy = 0 }: { el: HmiElement; children: string; color?: string; size?: number; weight?: number; spacing?: number; dy?: number }) {
  const fs = fitSize(children, el.w - 16, size ?? Math.max(11, Math.min(18, el.h * 0.3)), 10, spacing);
  return (
    <text x={el.x + el.w / 2} y={el.y + el.h / 2 + dy} fill={color} fontSize={fs} fontFamily={FONT} fontWeight={weight} letterSpacing={spacing}
      textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none' }}>{fitText(children, el.w - 16, fs, spacing)}</text>
  );
}

const stateFor = (states: HmiState[] | undefined, v: number): HmiState | null =>
  (states ?? []).find((s) => s.value === v) ?? null;

function Header({ el, ctx }: { el: HmiElement; ctx: Ctx }) {
  const h = el.h;
  const fs = Math.max(12, Math.min(18, h * 0.36));
  const small = Math.max(10, Math.min(13, h * 0.27));
  const cy = el.y + h / 2;
  const machine = caps(el.label || ctx.design?.machineName || 'Machine');
  const screenName = caps(ctx.screen.name);
  // Right-hand cluster, laid out right to left: clock, alarm counter, mode.
  const clockW = textWidth('00:00:00', fs, 1) + 16;
  const clockX = el.x + el.w - 14;
  const alarmW = Math.max(96, textWidth('ALARMS 00', small, 1.2) + 34);
  const alarmX = clockX - clockW - 10 - alarmW;
  const modeVal = el.address && ctx.read ? Number(ctx.read(el.address)) : 0;
  const mode = el.address ? (stateFor(el.states, modeVal) ?? { value: modeVal, text: el.states?.length ? `Mode ${modeVal}` : 'Auto', style: 'normal' as const }) : null;
  const modeText = mode ? caps(mode.text) : '';
  const modeW = mode ? textWidth(modeText, small, 1.4) + 30 : 0;
  const modeX = alarmX - 10 - modeW;
  const pillH = Math.min(30, h - 12);
  const py = cy - pillH / 2;
  const alarmsOn = ctx.activeCount > 0;
  const anyAlarm = ctx.rows.some((r) => r.active && r.severity === 'alarm');
  const alarmColor = anyAlarm ? C.alarm : C.warning;
  const nameW = textWidth(machine, fs, 2);
  const titleX = el.x + 16 + nameW + 22;
  const titleMax = (mode ? modeX : alarmX) - titleX - 14;
  return (
    <g>
      <rect x={el.x} y={el.y} width={el.w} height={h} fill={C.header} />
      <rect x={el.x} y={el.y + h - 1} width={el.w} height={1} fill={C.line} />
      <rect x={el.x} y={el.y} width={4} height={h} fill={alarmsOn ? alarmColor : C.accent} />
      <text x={el.x + 16} y={cy} fill={C.text} fontSize={fs} fontFamily={FONT} fontWeight={600} letterSpacing={2} dominantBaseline="central">{machine}</text>
      <rect x={el.x + 16 + nameW + 10} y={cy - fs * 0.55} width={1} height={fs * 1.1} fill={C.line} />
      {titleMax > 30 && (
        <text x={titleX} y={cy} fill={C.dim} fontSize={fs} fontFamily={FONT} fontWeight={300} letterSpacing={2} dominantBaseline="central">
          {fitText(screenName, titleMax - (ctx.screen.level && ctx.screen.level !== 'operator' ? 26 : 0), fs, 2)}
        </text>
      )}
      {ctx.screen.level && ctx.screen.level !== 'operator' && titleMax > 30 && (
        <LockBadge x={titleX + Math.min(textWidth(screenName, fs, 2), titleMax - 26) + 26} y={cy - 7} letter={LEVEL_SHORT[ctx.screen.level]} />
      )}
      {mode && (
        <g>
          <rect x={modeX} y={py} width={modeW} height={pillH} rx={pillH / 2} fill={mode.style === 'normal' ? C.surfaceUp : 'transparent'} stroke={mode.style === 'normal' ? C.line : stateTextColor(mode.style)} />
          <circle cx={modeX + 14} cy={cy} r={3.5} fill={mode.style === 'normal' ? C.dim : stateTextColor(mode.style)} />
          <text x={modeX + 24} y={cy} fill={stateTextColor(mode.style)} fontSize={small} fontFamily={FONT} fontWeight={600} letterSpacing={1.4} dominantBaseline="central">{modeText}</text>
        </g>
      )}
      <g style={{ cursor: el.targetScreenId ? 'pointer' : undefined }} data-nav={el.targetScreenId ?? undefined}>
        <rect x={alarmX} y={py} width={alarmW} height={pillH} rx={pillH / 2} fill={alarmsOn ? alarmColor : 'transparent'} stroke={alarmsOn ? alarmColor : C.line} />
        <path d={`M${alarmX + 14} ${cy + 5} l6 -11 l6 11 z`} fill={alarmsOn ? '#0a0c0f' : 'none'} stroke={alarmsOn ? '#0a0c0f' : C.dim} strokeWidth={1.2} strokeLinejoin="round" />
        <text x={alarmX + 32} y={cy} fill={alarmsOn ? '#0a0c0f' : C.dim} fontSize={small} fontFamily={FONT} fontWeight={600} letterSpacing={1.2} dominantBaseline="central">
          {alarmsOn ? `ALARMS ${ctx.activeCount}` : 'NO ALARMS'}
        </text>
      </g>
      <text x={clockX} y={cy - small * 0.55} fill={C.text} fontSize={fs * 0.92} fontFamily={FONT} fontWeight={400} letterSpacing={1} textAnchor="end" dominantBaseline="central">{fmtTime(ctx.now)}</text>
      <text x={clockX} y={cy + fs * 0.55} fill={C.faint} fontSize={Math.max(9, small * 0.8)} fontFamily={FONT} fontWeight={500} letterSpacing={1} textAnchor="end" dominantBaseline="central">{fmtDate(ctx.now)}</text>
    </g>
  );
}

function AlarmList({ el, ctx }: { el: HmiElement; ctx: Ctx }) {
  const headH = 28;
  const rowH = Math.max(26, Math.min(34, el.h / 8));
  const fs = Math.max(10, Math.min(13, rowH * 0.42));
  const timeW = Math.max(74, el.w * 0.17);
  const stateW = Math.max(ctx.live ? 112 : 72, el.w * (ctx.live ? 0.21 : 0.15));
  const msgX = el.x + 14 + timeW;
  const msgW = el.w - timeW - stateW - 28;
  const maxRows = Math.max(1, Math.floor((el.h - headH - 6) / rowH));
  const rows = ctx.rows;
  const shown = rows.length > maxRows ? rows.slice(0, maxRows - 1) : rows;
  const more = rows.length - shown.length;
  return (
    <g>
      <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={10} fill={C.panel} stroke={C.lineSoft} />
      <rect x={el.x} y={el.y} width={el.w} height={headH} rx={10} fill={C.surface} />
      <rect x={el.x} y={el.y + headH - 10} width={el.w} height={10} fill={C.surface} />
      {[['TIME', el.x + 14], [caps(el.label || 'Message'), msgX], ['STATE', el.x + el.w - 14 - stateW]].map(([t, x]) => (
        <text key={String(t)} x={Number(x)} y={el.y + headH / 2} fill={C.faint} fontSize={10} fontFamily={FONT} fontWeight={600} letterSpacing={1.6} dominantBaseline="central">{fitText(String(t), msgW, 10, 1.6)}</text>
      ))}
      {shown.length === 0 && (
        <text x={el.x + el.w / 2} y={el.y + headH + (el.h - headH) / 2} fill={C.faint} fontSize={13} fontFamily={FONT} fontWeight={500} letterSpacing={2} textAnchor="middle" dominantBaseline="central">NO ALARMS</text>
      )}
      {shown.map((r, i) => {
        const y = el.y + headH + 4 + i * rowH;
        const col = r.severity === 'alarm' ? C.alarm : C.warning;
        const state = !ctx.live ? (r.severity === 'alarm' ? 'ALARM' : 'WARNING') : r.active ? 'ACTIVE' : 'CLEARED';
        return (
          <g key={i}>
            {i > 0 && <rect x={el.x + 12} y={y} width={el.w - 24} height={1} fill={C.lineSoft} />}
            <rect x={el.x + 6} y={y + 6} width={3} height={rowH - 12} rx={1.5} fill={r.active || !ctx.live ? col : C.faint} opacity={r.active || !ctx.live ? 1 : 0.6} />
            <text x={el.x + 14} y={y + rowH / 2} fill={r.active ? C.text : C.dim} fontSize={fs} fontFamily={MONO} dominantBaseline="central">{r.on ? fmtTime(r.on) : '--:--:--'}</text>
            <text x={msgX} y={y + rowH / 2} fill={r.active ? C.text : C.dim} fontSize={fs} fontFamily={FONT} fontWeight={500} letterSpacing={0.6} dominantBaseline="central">{fitText(r.message, msgW, fs, 0.6)}</text>
            <text x={el.x + el.w - 14 - stateW} y={y + rowH / 2} fill={r.active ? col : C.faint} fontSize={fs - 1} fontFamily={FONT} fontWeight={600} letterSpacing={1.2} dominantBaseline="central">
              {fitText(r.off && ctx.live ? `${state} ${fmtTime(r.off).slice(0, 5)}` : state, stateW - 4, fs - 1, 1.2)}
            </text>
          </g>
        );
      })}
      {more > 0 && (
        <text x={el.x + el.w / 2} y={el.y + headH + 4 + shown.length * rowH + rowH / 2} fill={C.dim} fontSize={fs} fontFamily={FONT} letterSpacing={1} textAnchor="middle" dominantBaseline="central">{`+${more} MORE`}</text>
      )}
    </g>
  );
}

function Trend({ el, ctx, value }: { el: HmiElement; ctx: Ctx; value: number | undefined }) {
  const samples = el.address ? ctx.runtime?.trends.get(el.address) ?? [] : [];
  const pad = 14, top = 30, bottom = 12;
  const px = el.x + pad, py = el.y + top, pw = el.w - 2 * pad, ph = el.h - top - bottom;
  const lo = el.min ?? Math.min(0, ...samples);
  const hiRaw = el.max ?? Math.max(1, ...samples);
  const hi = hiRaw === lo ? lo + 1 : hiRaw;
  const pts = samples.map((v, i) => `${px + (samples.length > 1 ? (i / (samples.length - 1)) * pw : pw)},${py + ph - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * ph}`);
  const last = pts[pts.length - 1];
  const fs = 11;
  return (
    <g>
      <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={10} fill={C.panel} stroke={C.lineSoft} />
      <text x={el.x + pad} y={el.y + 16} fill={C.dim} fontSize={fs} fontFamily={FONT} fontWeight={500} letterSpacing={1.5} dominantBaseline="central">{fitText(caps(el.label), el.w * 0.6, fs, 1.5)}</text>
      <text x={el.x + el.w - pad} y={el.y + 16} fill={C.text} fontSize={15} fontFamily={FONT} fontWeight={300} textAnchor="end" dominantBaseline="central">
        {ctx.live ? `${value ?? 0}${el.units ? ` ${el.units}` : ''}` : (el.units ?? '')}
      </text>
      {[0, 0.5, 1].map((f) => <rect key={f} x={px} y={py + ph * f} width={pw} height={1} fill={C.lineSoft} />)}
      <text x={px + 2} y={py + 7} fill={C.faint} fontSize={9} fontFamily={FONT}>{String(hi)}</text>
      <text x={px + 2} y={py + ph - 4} fill={C.faint} fontSize={9} fontFamily={FONT}>{String(lo)}</text>
      {ctx.live && pts.length > 1 && (
        <>
          <polyline points={`${px},${py + ph} ${pts.join(' ')} ${last.split(',')[0]},${py + ph}`} fill={styleColor(el.style)} opacity={0.08} stroke="none" />
          <polyline points={pts.join(' ')} fill="none" stroke={styleColor(el.style)} strokeWidth={1.6} strokeLinejoin="round" />
        </>
      )}
      {ctx.live && last && <circle cx={Number(last.split(',')[0])} cy={Number(last.split(',')[1])} r={3} fill={styleColor(el.style)} />}
      {!ctx.live && (
        <>
          <path d={`M${px} ${py + ph * 0.7} C ${px + pw * 0.25} ${py + ph * 0.7}, ${px + pw * 0.3} ${py + ph * 0.35}, ${px + pw * 0.5} ${py + ph * 0.4} S ${px + pw * 0.8} ${py + ph * 0.2}, ${px + pw} ${py + ph * 0.25}`}
            fill="none" stroke={C.faint} strokeWidth={1.4} strokeDasharray="4 4" />
          <text x={px + pw / 2} y={py + ph / 2} fill={C.faint} fontSize={10} fontFamily={FONT} fontWeight={600} letterSpacing={2} textAnchor="middle" dominantBaseline="central">LIVE TREND</text>
        </>
      )}
    </g>
  );
}

function ElementShape({ el, value, ctx }: { el: HmiElement; value: boolean | number | undefined; ctx: Ctx }) {
  const on = Boolean(value);
  const r = Math.min(12, el.h / 2);
  switch (el.kind) {
    case 'header':
      return <Header el={el} ctx={ctx} />;
    case 'image':
      return el.src ? <image href={el.src} x={el.x} y={el.y} width={el.w} height={el.h} preserveAspectRatio="none" style={{ pointerEvents: 'none' }} />
        : <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="none" stroke={C.lineSoft} strokeDasharray="4 3" />;
    case 'panel':
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={10} fill={C.panel} stroke={C.lineSoft} />
          {el.label && (
            <text x={el.x + 14} y={el.y + 15} fill={C.faint} fontSize={10} fontFamily={FONT} fontWeight={600} letterSpacing={1.8} dominantBaseline="central">{fitText(caps(el.label), el.w - 28, 10, 1.8)}</text>
          )}
        </g>
      );
    case 'button': {
      const interlocked = el.interlock ? (ctx.read ? !ctx.read(el.interlock) : null) : null;
      const showOn = ctx.live && on && el.action !== 'reset';
      const latched = showOn && (el.action === 'toggle' || el.action === 'set');
      const pressed = showOn && !latched;
      const danger = el.style === 'alarm';
      const fill = latched ? C.accent : pressed ? C.pressed : danger ? '#2a1517' : C.surfaceUp;
      const stroke = latched || pressed ? C.accent : danger ? C.alarm : C.line;
      const text = latched && el.onText ? el.onText : !latched && el.offText && el.action === 'toggle' ? el.offText : el.label;
      const sub = el.interlock && el.h >= 52 ? (interlocked === true ? 'INTERLOCKED' : interlocked === false ? 'READY' : 'PERMISSIVE') : null;
      return (
        <g opacity={interlocked ? 0.45 : 1}>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={fill} stroke={stroke} strokeWidth={1} />
          <Label el={el} color={latched ? C.onAccent : danger ? '#ff8b8f' : C.text} dy={sub ? -7 : 0}>{caps(text)}</Label>
          {sub && (
            <g>
              <circle cx={el.x + el.w / 2 - textWidth(sub, 9, 1.2) / 2 - 7} cy={el.y + el.h / 2 + 12} r={3}
                fill={interlocked === true ? C.warning : interlocked === false ? C.ok : 'none'} stroke={interlocked === null ? C.faint : 'none'} />
              <text x={el.x + el.w / 2 + 3} y={el.y + el.h / 2 + 12} fill={interlocked === true ? C.warning : C.faint} fontSize={9} fontFamily={FONT} fontWeight={600} letterSpacing={1.2}
                textAnchor="middle" dominantBaseline="central">{sub}</text>
            </g>
          )}
        </g>
      );
    }
    case 'nav': {
      const active = el.targetScreenId === ctx.screen.id;
      const target = ctx.design?.screens.find((s) => s.id === el.targetScreenId);
      const lock = target?.level && target.level !== 'operator' ? target.level : null;
      // Shrink long names (e.g. DIAGNOSTICS) to fit instead of cutting them off.
      let navSize = Math.max(11, Math.min(15, el.h * 0.28));
      let navSpacing = 2;
      const avail = el.w - 18 - (lock ? 48 : 0);
      while (textWidth(caps(el.label), navSize, navSpacing) > avail && (navSize > 10 || navSpacing > 0.8)) {
        if (navSpacing > 1) navSpacing -= 0.25; else navSize -= 0.5;
      }
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={active ? C.surfaceUp : 'transparent'} />
          <Label el={el} color={active ? C.text : C.dim} weight={active ? 600 : 500} spacing={navSpacing} size={navSize}>{caps(el.label)}</Label>
          {active && <rect x={el.x + el.w * 0.3} y={el.y + el.h - 4} width={el.w * 0.4} height={2} rx={1} fill={C.accent} />}
          {lock && <LockBadge x={Math.min(el.x + el.w - 4, el.x + el.w / 2 + textWidth(caps(el.label), navSize, navSpacing) / 2 + 26)} y={el.y + el.h / 2 - 8} letter={LEVEL_SHORT[lock]} color={C.faint} />}
        </g>
      );
    }
    case 'indicator': {
      const color = on ? styleColor(el.style) : C.faint;
      const d = Math.min(el.h * 0.28, 7);
      const text = on && el.onText ? el.onText : !on && el.offText ? el.offText : el.label;
      const fs = fitSize(caps(text), el.w - 40 - 2 * d, Math.max(11, Math.min(16, el.h * 0.34)), 10.5, 1.2);
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={C.surface} stroke={on && el.style !== 'normal' ? color : C.line} strokeOpacity={on && el.style !== 'normal' ? 0.6 : 1} />
          {on && <circle cx={el.x + 16 + d} cy={el.y + el.h / 2} r={d * 2.2} fill={color} opacity={0.18} />}
          <circle cx={el.x + 16 + d} cy={el.y + el.h / 2} r={d} fill={color} />
          <text x={el.x + 28 + 2 * d} y={el.y + el.h / 2} fill={on ? C.text : C.dim} fontSize={fs} fontFamily={FONT} fontWeight={500} letterSpacing={1.2} dominantBaseline="central">
            {fitText(caps(text), el.w - 40 - 2 * d, fs, 1.2)}
          </text>
        </g>
      );
    }
    case 'multistate': {
      const v = typeof value === 'number' ? value : value === undefined ? (el.states?.[0]?.value ?? 0) : Number(value);
      const st = stateFor(el.states, v) ?? (ctx.live ? { value: v, text: `State ${v}`, style: 'warning' as const } : el.states?.[0] ?? { value: 0, text: '—', style: 'normal' as const });
      const color = stateTextColor(st.style);
      const tall = el.h >= 60;
      const labelSize = Math.max(10, Math.min(12, el.h * 0.2));
      const valueSize = tall ? Math.max(16, Math.min(28, el.h * 0.36)) : Math.max(13, Math.min(20, el.h * 0.4));
      const dotX = el.x + 18;
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={C.surface} stroke={st.style === 'normal' ? C.line : color} strokeOpacity={st.style === 'normal' ? 1 : 0.55} />
          {tall ? (
            <>
              <text x={el.x + 14} y={el.y + 16} fill={C.dim} fontSize={labelSize} fontFamily={FONT} fontWeight={500} letterSpacing={1.5} dominantBaseline="central">{fitText(caps(el.label), el.w - 28, labelSize, 1.5)}</text>
              <circle cx={dotX} cy={el.y + el.h * 0.62} r={5} fill={st.style === 'normal' ? C.dim : color} />
              <text x={dotX + 14} y={el.y + el.h * 0.62} fill={color} fontSize={valueSize} fontFamily={FONT} fontWeight={400} letterSpacing={1.5} dominantBaseline="central">{fitText(caps(st.text), el.w - 46, valueSize, 1.5)}</text>
            </>
          ) : (
            <>
              <text x={el.x + 14} y={el.y + el.h / 2} fill={C.dim} fontSize={labelSize} fontFamily={FONT} fontWeight={500} letterSpacing={1.5} dominantBaseline="central">{fitText(caps(el.label), el.w * 0.4, labelSize, 1.5)}</text>
              <text x={el.x + el.w - 14} y={el.y + el.h / 2} fill={color} fontSize={valueSize} fontFamily={FONT} fontWeight={500} letterSpacing={1.5} textAnchor="end" dominantBaseline="central">{fitText(caps(st.text), el.w * 0.55, valueSize, 1.5)}</text>
            </>
          )}
        </g>
      );
    }
    case 'numeric':
    case 'numeric-entry': {
      const v = typeof value === 'number' ? value : value === undefined ? 0 : Number(value);
      const entry = el.kind === 'numeric-entry';
      const labelSize = Math.max(10, Math.min(13, el.h * 0.22));
      const valueSize = Math.max(14, Math.min(34, el.h * 0.5));
      const unitsW = el.units ? textWidth(el.units, labelSize) + 8 : 0;
      const range = el.min !== null && el.max !== null && el.h >= 50 ? `${el.min}–${el.max}${el.units ? ` ${el.units}` : ''}` : null;
      const valueText = showNum(v);
      const labelMax = el.w - 28 - unitsW - textWidth(valueText, valueSize) - 12;
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={C.surface} stroke={entry ? C.accent : C.line} strokeOpacity={entry ? 0.45 : 1} />
          <text x={el.x + 14} y={el.y + el.h / 2 - (range ? 7 : 0)} fill={C.dim} fontSize={labelSize} fontFamily={FONT} fontWeight={500} letterSpacing={1.5} dominantBaseline="central">{fitText(caps(el.label), Math.max(30, labelMax), labelSize, 1.5)}</text>
          {range && <text x={el.x + 14} y={el.y + el.h / 2 + 10} fill={C.faint} fontSize={Math.max(9, labelSize - 2)} fontFamily={FONT} letterSpacing={1} dominantBaseline="central">{range}</text>}
          <text x={el.x + el.w - 14 - unitsW} y={el.y + el.h / 2} fill={C.text} fontSize={valueSize} fontFamily={FONT} fontWeight={300} textAnchor="end" dominantBaseline="central">{valueText}</text>
          {el.units && <text x={el.x + el.w - 14} y={el.y + el.h / 2} fill={C.dim} fontSize={labelSize} fontFamily={FONT} textAnchor="end" dominantBaseline="central">{el.units}</text>}
          {entry && <rect x={el.x + 14} y={el.y + el.h - 6} width={24} height={2} rx={1} fill={C.accent} />}
        </g>
      );
    }
    case 'bar': {
      const v = typeof value === 'number' ? value : 0;
      const min = el.min ?? 0;
      const max = el.max ?? 100;
      const frac = Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
      const trackH = Math.max(4, Math.min(8, el.h * 0.18));
      const ty = el.y + el.h - trackH - 6;
      return (
        <g>
          <text x={el.x} y={el.y + (el.h - trackH) / 2} fill={C.dim} fontSize={Math.max(10, Math.min(13, el.h * 0.24))} fontFamily={FONT} fontWeight={500} letterSpacing={1.5} dominantBaseline="central">{fitText(caps(el.label), el.w * 0.6, Math.max(10, Math.min(13, el.h * 0.24)), 1.5)}</text>
          <text x={el.x + el.w} y={el.y + (el.h - trackH) / 2} fill={C.text} fontSize={Math.max(12, Math.min(20, el.h * 0.32))} fontFamily={FONT} fontWeight={300} textAnchor="end" dominantBaseline="central">{`${showNum(v)}${el.units ? ` ${el.units}` : ''}`}</text>
          <rect x={el.x} y={ty} width={el.w} height={trackH} rx={trackH / 2} fill={C.surfaceUp} />
          <rect x={el.x} y={ty} width={el.w * frac} height={trackH} rx={trackH / 2} fill={styleColor(el.style)} />
        </g>
      );
    }
    case 'trend':
      return <Trend el={el} ctx={ctx} value={typeof value === 'number' ? value : value === undefined ? undefined : Number(value)} />;
    case 'machine':
      return <MachineGraphic el={el} read={ctx.read} />;
    case 'alarm-list':
      return <AlarmList el={el} ctx={ctx} />;
    case 'datetime': {
      const fs = Math.max(14, Math.min(30, el.h * 0.42));
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={C.surface} stroke={C.line} />
          <text x={el.x + 14} y={el.y + el.h / 2} fill={C.dim} fontSize={Math.max(10, fs * 0.45)} fontFamily={FONT} fontWeight={500} letterSpacing={1.5} dominantBaseline="central">{fmtDate(ctx.now)}</text>
          <text x={el.x + el.w - 14} y={el.y + el.h / 2} fill={C.text} fontSize={fs} fontFamily={FONT} fontWeight={300} letterSpacing={1} textAnchor="end" dominantBaseline="central">{fmtTime(ctx.now)}</text>
        </g>
      );
    }
    case 'alarm-banner': {
      const active = ctx.rows.filter((a) => a.active);
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={active.length ? C.alarm : C.surface} stroke={active.length ? C.alarm : C.line} />
          <circle cx={el.x + 18} cy={el.y + el.h / 2} r={4} fill={active.length ? '#ffffff' : C.ok} />
          <text x={el.x + 32} y={el.y + el.h / 2} fill={active.length ? '#ffffff' : C.dim} fontSize={Math.max(11, Math.min(16, el.h * 0.4))}
            fontFamily={FONT} fontWeight={500} letterSpacing={1.2} dominantBaseline="central">
            {fitText(active.length ? caps(`${active[0].message}${active.length > 1 ? `  +${active.length - 1} more` : ''}`) : 'SYSTEM NOMINAL', el.w - 44, Math.max(11, Math.min(16, el.h * 0.4)), 1.2)}
          </text>
        </g>
      );
    }
    case 'text':
    default: {
      // Titles (taller text) are left-aligned and light, like a console heading.
      if (el.h >= 32) {
        const fs = Math.min(30, el.h * 0.62);
        return (
          <text x={el.x} y={el.y + el.h / 2} fill={C.text} fontSize={fs} fontFamily={FONT} fontWeight={300} letterSpacing={3}
            dominantBaseline="central" style={{ pointerEvents: 'none' }}>{fitText(caps(el.label), el.w, fs, 3)}</text>
        );
      }
      if (el.style !== 'normal' || el.h < 24) {
        // Small left-aligned caption / section label.
        const fs = Math.max(10, Math.min(13, el.h * 0.55));
        return (
          <text x={el.x} y={el.y + el.h / 2} fill={el.style === 'normal' ? C.faint : stateTextColor(el.style)} fontSize={fs} fontFamily={FONT} fontWeight={600} letterSpacing={1.6}
            dominantBaseline="central" style={{ pointerEvents: 'none' }}>{fitText(caps(el.label), el.w, fs, 1.6)}</text>
        );
      }
      return <Label el={el} color={C.dim} spacing={1.5}>{caps(el.label)}</Label>;
    }
  }
}

function alarmRows(design: HmiDesign | undefined, read: HmiScreenViewProps['read'], runtime: HmiRuntime | undefined, legacy: string[]): AlarmRow[] {
  if (runtime) {
    const rows = runtime.alarms.map((a) => ({ message: a.message, severity: a.severity, on: a.on, off: a.off, active: a.off === null }));
    return [...rows.filter((r) => r.active), ...rows.filter((r) => !r.active)];
  }
  if (design && read) {
    return design.alarms.filter((a) => Boolean(read(a.address))).map((a) => ({ message: a.message, severity: a.severity, on: null, off: null, active: true }));
  }
  if (legacy.length) return legacy.map((m) => ({ message: m, severity: 'alarm' as const, on: null, off: null, active: true }));
  // Static design view: list the configured alarms (what the alarm table will show).
  return (design?.alarms ?? []).map((a) => ({ message: a.message, severity: a.severity, on: null, off: null, active: false }));
}

export default function HmiScreenView({ screen, widthPx, heightPx, read, onPress, onNavigate, activeAlarms = [], selectedId, onSelect, design, runtime, staticTime, thumbnail }: HmiScreenViewProps) {
  const live = Boolean(read);
  const rows = alarmRows(design, read, runtime, activeAlarms);
  const ctx: Ctx = {
    screen, design, read, live, rows, runtime,
    activeCount: live || activeAlarms.length ? rows.filter((r) => r.active).length : 0,
    now: runtime?.now ?? staticTime ?? renderTime(),
  };
  // Group frames first so they sit behind the elements they contain.
  const ordered = [...screen.elements.filter((e) => e.kind === 'panel'), ...screen.elements.filter((e) => e.kind !== 'panel')];
  const gradId = `hmi-glow-${screen.id.replace(/[^\w-]/g, '')}`;
  return (
    <svg viewBox={`0 0 ${widthPx} ${heightPx}`} className="w-full h-auto max-h-full block" role="img" aria-label={`HMI screen: ${screen.name}`}
      style={{ background: C.screen, borderRadius: thumbnail ? 4 : 10 }}>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="0%" r="90%">
          <stop offset="0%" stopColor="#1c1f24" />
          <stop offset="100%" stopColor={C.screen} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={widthPx} height={heightPx} fill={`url(#${gradId})`} />
      {screen.background && (
        <g style={{ pointerEvents: 'none' }} data-background="">
          <image href={screen.background.src}
            {...bgBox(screen.background, widthPx, heightPx)}
            preserveAspectRatio={screen.background.fit === 'stretch' ? 'none' : screen.background.fit === 'fill' ? 'xMidYMid slice' : 'xMidYMid meet'} />
          {screen.background.dim > 0 && <rect x={0} y={0} width={widthPx} height={heightPx} fill="#000" opacity={Math.min(0.9, screen.background.dim)} />}
        </g>
      )}
      {ordered.map((el) => {
        const value = el.address && read ? read(el.address) : undefined;
        const navTarget = el.kind === 'nav' || el.kind === 'header' ? el.targetScreenId : null;
        const interactive = !thumbnail && ((el.kind === 'button' && onPress) || (navTarget && onNavigate) || onSelect);
        const lock = el.level && el.level !== 'operator' && el.kind !== 'nav' && el.kind !== 'header' ? el.level : null;
        return (
          <g
            key={el.id}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
            onPointerDown={thumbnail ? undefined : (e) => {
              if (onSelect) { e.stopPropagation(); onSelect(el.id); return; }
              // Capture on the element's group: its shapes are re-drawn while pressed, and a lost capture would lose the release.
              if (el.kind === 'button' && onPress) { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); onPress(el, true); }
              if (navTarget && onNavigate && (el.kind === 'nav' || (e.target as Element).closest?.('[data-nav]'))) onNavigate(navTarget);
            }}
            onPointerUp={() => { if (!onSelect && el.kind === 'button' && onPress) onPress(el, false); }}
            onPointerCancel={() => { if (!onSelect && el.kind === 'button' && onPress) onPress(el, false); }}
            onLostPointerCapture={() => { if (!onSelect && el.kind === 'button' && onPress) onPress(el, false); }}
          >
            <ElementShape el={el} value={value} ctx={ctx} />
            {lock && <LockBadge x={el.x + el.w - 6} y={el.y + 5} letter={LEVEL_SHORT[lock]} />}
            {!thumbnail && selectedId === el.id && <rect x={el.x - 3} y={el.y - 3} width={el.w + 6} height={el.h + 6} fill="none" stroke={C.select} strokeWidth={2} strokeDasharray="6 4" />}
          </g>
        );
      })}
    </svg>
  );
}
