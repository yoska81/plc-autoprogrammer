
import { bgBox } from './background';
import type { HmiDesign, HmiElement, HmiLook, HmiScreen } from './types';
import type { HmiRuntime } from './runtime';
import { fitSize, fitText, fmtTime, hmiTheme, LEVEL_SHORT, lookOf, stateTextColor, styleColor, textWidth } from './theme';
import { LockBadge, MachineGraphic } from './symbols';
import { NavBand, PanelElement } from './panelLook';
import { lockInset } from './layout';
import { Label } from './viewParts';
import { showNum, PANEL_KINDS, stateFor, type AlarmRow, type Ctx } from './viewCtx';

/**
 * Draws one HMI screen as SVG in the panel's native pixels (scales to fit its
 * container). Static by default; pass `read`/`onPress` to make it live
 * (simulation) and `onSelect` to make elements selectable (editing). The
 * design's `look` picks the visual style (by default the look of the panel's maker).
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
  /** A numeric entry (setpoint) was tapped: the panel opens its keypad. */
  onEntry?: (el: HmiElement) => void;
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
  /** Override the design's look (e.g. a preview of another style). */
  look?: HmiLook;
}

const renderTime = () => Date.now();

function Header({ el, ctx }: { el: HmiElement; ctx: Ctx }) {
  const { t } = ctx;
  const h = el.h;
  const fs = Math.max(12, Math.min(18, h * 0.36));
  const small = Math.max(10, Math.min(13, h * 0.27));
  const cy = el.y + h / 2;
  const machine = t.caps(el.label || ctx.design?.machineName || 'Machine');
  const screenName = t.caps(ctx.screen.name);
  // Right-hand cluster, laid out right to left: clock, alarm counter, mode.
  const clockW = textWidth('00:00:00', fs, 1) + 16;
  const clockX = el.x + el.w - 14;
  const alarmW = Math.max(96, textWidth('ALARMS 00', small, 1.2) + 34);
  const alarmX = clockX - clockW - 10 - alarmW;
  const modeVal = el.address && ctx.read ? Number(ctx.read(el.address)) : 0;
  const mode = el.address ? (stateFor(el.states, modeVal) ?? { value: modeVal, text: el.states?.length ? `Mode ${modeVal}` : 'Auto', style: 'normal' as const }) : null;
  const modeText = mode ? t.caps(mode.text) : '';
  const modeW = mode ? textWidth(modeText, small, 1.4) + 30 : 0;
  const modeX = alarmX - 10 - modeW;
  const pillH = Math.min(30, h - 12);
  const py = cy - pillH / 2;
  const alarmsOn = ctx.activeCount > 0;
  const anyAlarm = ctx.rows.some((r) => r.active && r.severity === 'alarm');
  const alarmColor = anyAlarm ? t.alarm : t.warning;
  const nameW = textWidth(machine, fs, 2);
  const titleX = el.x + 16 + nameW + 22;
  const titleMax = (mode ? modeX : alarmX) - titleX - 14;
  return (
    <g>
      <rect x={el.x} y={el.y} width={el.w} height={h} fill={t.header} />
      <rect x={el.x} y={el.y + h - 1} width={el.w} height={1} fill={t.line} />
      <rect x={el.x} y={el.y} width={4} height={h} fill={alarmsOn ? alarmColor : t.accent} />
      <text x={el.x + 16} y={cy} fill={t.text} fontSize={fs} fontFamily={t.font} fontWeight={600} letterSpacing={t.ls(2)} dominantBaseline="central">{machine}</text>
      <rect x={el.x + 16 + nameW + 10} y={cy - fs * 0.55} width={1} height={fs * 1.1} fill={t.line} />
      {titleMax > 30 && (
        <text x={titleX} y={cy} fill={t.dim} fontSize={fs} fontFamily={t.font} fontWeight={t.thin} letterSpacing={t.ls(2)} dominantBaseline="central">
          {fitText(screenName, titleMax - (ctx.screen.level && ctx.screen.level !== 'operator' ? 26 : 0), fs, 2)}
        </text>
      )}
      {ctx.screen.level && ctx.screen.level !== 'operator' && titleMax > 30 && (
        <LockBadge x={titleX + Math.min(textWidth(screenName, fs, 2), titleMax - 26) + 26} y={cy - 7} letter={LEVEL_SHORT[ctx.screen.level]} t={t} />
      )}
      {mode && (
        <g>
          <rect x={modeX} y={py} width={modeW} height={pillH} rx={pillH / 2} fill={mode.style === 'normal' ? t.surfaceUp : 'transparent'} stroke={mode.style === 'normal' ? t.line : stateTextColor(mode.style, t)} />
          <circle cx={modeX + 14} cy={cy} r={3.5} fill={mode.style === 'normal' ? t.dim : stateTextColor(mode.style, t)} />
          <text x={modeX + 24} y={cy} fill={stateTextColor(mode.style, t)} fontSize={small} fontFamily={t.font} fontWeight={600} letterSpacing={t.ls(1.4)} dominantBaseline="central">{modeText}</text>
        </g>
      )}
      <g style={{ cursor: el.targetScreenId ? 'pointer' : undefined }} data-nav={el.targetScreenId ?? undefined}>
        <rect x={alarmX} y={py} width={alarmW} height={pillH} rx={pillH / 2} fill={alarmsOn ? alarmColor : 'transparent'} stroke={alarmsOn ? alarmColor : t.line} />
        <path d={`M${alarmX + 14} ${cy + 5} l6 -11 l6 11 z`} fill={alarmsOn ? '#0a0c0f' : 'none'} stroke={alarmsOn ? '#0a0c0f' : t.dim} strokeWidth={1.2} strokeLinejoin="round" />
        <text x={alarmX + 32} y={cy} fill={alarmsOn ? '#0a0c0f' : t.dim} fontSize={small} fontFamily={t.font} fontWeight={600} letterSpacing={t.ls(1.2)} dominantBaseline="central">
          {alarmsOn ? `ALARMS ${ctx.activeCount}` : 'NO ALARMS'}
        </text>
      </g>
      <text x={clockX} y={cy - small * 0.55} fill={t.text} fontSize={fs * 0.92} fontFamily={t.font} fontWeight={400} letterSpacing={t.ls(1)} textAnchor="end" dominantBaseline="central">{fmtTime(ctx.now)}</text>
      <text x={clockX} y={cy + fs * 0.55} fill={t.faint} fontSize={Math.max(9, small * 0.8)} fontFamily={t.font} fontWeight={500} letterSpacing={t.ls(1)} textAnchor="end" dominantBaseline="central">{t.date(ctx.now)}</text>
    </g>
  );
}

function AlarmList({ el, ctx }: { el: HmiElement; ctx: Ctx }) {
  const { t } = ctx;
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
      <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={10} fill={t.panel} stroke={t.lineSoft} />
      <rect x={el.x} y={el.y} width={el.w} height={headH} rx={10} fill={t.surface} />
      <rect x={el.x} y={el.y + headH - 10} width={el.w} height={10} fill={t.surface} />
      {[['TIME', el.x + 14], [t.caps(el.label || 'Message'), msgX], ['STATE', el.x + el.w - 14 - stateW]].map(([head, x]) => (
        <text key={String(head)} x={Number(x)} y={el.y + headH / 2} fill={t.faint} fontSize={10} fontFamily={t.font} fontWeight={600} letterSpacing={t.ls(1.6)} dominantBaseline="central">{fitText(String(head), msgW, 10, 1.6)}</text>
      ))}
      {shown.length === 0 && (
        <text x={el.x + el.w / 2} y={el.y + headH + (el.h - headH) / 2} fill={t.faint} fontSize={13} fontFamily={t.font} fontWeight={500} letterSpacing={t.ls(2)} textAnchor="middle" dominantBaseline="central">NO ALARMS</text>
      )}
      {shown.map((r, i) => {
        const y = el.y + headH + 4 + i * rowH;
        const col = r.severity === 'alarm' ? t.alarm : t.warning;
        const state = !ctx.live ? (r.severity === 'alarm' ? 'ALARM' : 'WARNING') : r.active ? 'ACTIVE' : 'CLEARED';
        return (
          <g key={i}>
            {i > 0 && <rect x={el.x + 12} y={y} width={el.w - 24} height={1} fill={t.lineSoft} />}
            <rect x={el.x + 6} y={y + 6} width={3} height={rowH - 12} rx={1.5} fill={r.active || !ctx.live ? col : t.faint} opacity={r.active || !ctx.live ? 1 : 0.6} />
            <text x={el.x + 14} y={y + rowH / 2} fill={r.active ? t.text : t.dim} fontSize={fs} fontFamily={t.mono} dominantBaseline="central">{r.on ? fmtTime(r.on) : '--:--:--'}</text>
            <text x={msgX} y={y + rowH / 2} fill={r.active ? t.text : t.dim} fontSize={fs} fontFamily={t.font} fontWeight={500} letterSpacing={t.ls(0.6)} dominantBaseline="central">{fitText(r.message, msgW, fs, 0.6)}</text>
            <text x={el.x + el.w - 14 - stateW} y={y + rowH / 2} fill={r.active ? col : t.faint} fontSize={fs - 1} fontFamily={t.font} fontWeight={600} letterSpacing={t.ls(1.2)} dominantBaseline="central">
              {fitText(r.off && ctx.live ? `${state} ${fmtTime(r.off).slice(0, 5)}` : state, stateW - 4, fs - 1, 1.2)}
            </text>
          </g>
        );
      })}
      {more > 0 && (
        <text x={el.x + el.w / 2} y={el.y + headH + 4 + shown.length * rowH + rowH / 2} fill={t.dim} fontSize={fs} fontFamily={t.font} letterSpacing={t.ls(1)} textAnchor="middle" dominantBaseline="central">{`+${more} MORE`}</text>
      )}
    </g>
  );
}

function Trend({ el, ctx, value }: { el: HmiElement; ctx: Ctx; value: number | undefined }) {
  const { t } = ctx;
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
      <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={10} fill={t.panel} stroke={t.lineSoft} />
      <text x={el.x + pad} y={el.y + 16} fill={t.dim} fontSize={fs} fontFamily={t.font} fontWeight={500} letterSpacing={t.ls(1.5)} dominantBaseline="central">{fitText(t.caps(el.label), el.w * 0.6, fs, 1.5)}</text>
      <text x={el.x + el.w - pad} y={el.y + 16} fill={t.text} fontSize={15} fontFamily={t.font} fontWeight={t.thin} textAnchor="end" dominantBaseline="central">
        {ctx.live ? `${value ?? 0}${el.units ? ` ${el.units}` : ''}` : (el.units ?? '')}
      </text>
      {[0, 0.5, 1].map((f) => <rect key={f} x={px} y={py + ph * f} width={pw} height={1} fill={t.lineSoft} />)}
      <text x={px + 2} y={py + 7} fill={t.faint} fontSize={9} fontFamily={t.font}>{String(hi)}</text>
      <text x={px + 2} y={py + ph - 4} fill={t.faint} fontSize={9} fontFamily={t.font}>{String(lo)}</text>
      {ctx.live && pts.length > 1 && (
        <>
          <polyline points={`${px},${py + ph} ${pts.join(' ')} ${last.split(',')[0]},${py + ph}`} fill={styleColor(el.style, t)} opacity={0.08} stroke="none" />
          <polyline points={pts.join(' ')} fill="none" stroke={styleColor(el.style, t)} strokeWidth={1.6} strokeLinejoin="round" />
        </>
      )}
      {ctx.live && last && <circle cx={Number(last.split(',')[0])} cy={Number(last.split(',')[1])} r={3} fill={styleColor(el.style, t)} />}
      {!ctx.live && (
        <>
          <path d={`M${px} ${py + ph * 0.7} C ${px + pw * 0.25} ${py + ph * 0.7}, ${px + pw * 0.3} ${py + ph * 0.35}, ${px + pw * 0.5} ${py + ph * 0.4} S ${px + pw * 0.8} ${py + ph * 0.2}, ${px + pw} ${py + ph * 0.25}`}
            fill="none" stroke={t.faint} strokeWidth={1.4} strokeDasharray="4 4" />
          <text x={px + pw / 2} y={py + ph / 2} fill={t.faint} fontSize={10} fontFamily={t.font} fontWeight={600} letterSpacing={t.ls(2)} textAnchor="middle" dominantBaseline="central">LIVE TREND</text>
        </>
      )}
    </g>
  );
}

function ElementShape({ el, value, ctx }: { el: HmiElement; value: boolean | number | undefined; ctx: Ctx }) {
  const { t } = ctx;
  if (t.shape.family === 'panel' && PANEL_KINDS.has(el.kind)) return <PanelElement el={el} value={value} ctx={ctx} />;
  const on = Boolean(value);
  const r = Math.min(12, el.h / 2);
  switch (el.kind) {
    case 'header':
      return <Header el={el} ctx={ctx} />;
    case 'image':
      return el.src ? (
        <g style={{ pointerEvents: 'none' }}>
          <image href={el.src} x={el.x} y={el.y} width={el.w} height={el.h} preserveAspectRatio="none" />
          {(el.dim ?? 0) > 0 && <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="#000" opacity={Math.min(0.9, el.dim ?? 0)} />}
        </g>
      )
        : <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="none" stroke={t.lineSoft} strokeDasharray="4 3" />;
    case 'panel':
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={10} fill={t.panel} stroke={t.lineSoft} />
          {el.label && (
            <text x={el.x + 14} y={el.y + 15} fill={t.faint} fontSize={10} fontFamily={t.font} fontWeight={600} letterSpacing={t.ls(1.8)} dominantBaseline="central">{fitText(t.caps(el.label), el.w - 28, 10, 1.8)}</text>
          )}
        </g>
      );
    case 'button': {
      const interlocked = el.interlock ? (ctx.read ? !ctx.read(el.interlock) : null) : null;
      const showOn = ctx.live && on && el.action !== 'reset';
      const latched = showOn && (el.action === 'toggle' || el.action === 'set');
      const pressed = showOn && !latched;
      const danger = el.style === 'alarm';
      const fill = latched ? t.accent : pressed ? t.pressed : danger ? '#2a1517' : t.surfaceUp;
      const stroke = latched || pressed ? t.accent : danger ? t.alarm : t.line;
      const text = latched && el.onText ? el.onText : !latched && el.offText && el.action === 'toggle' ? el.offText : el.label;
      const sub = el.interlock && el.h >= 52 ? (interlocked === true ? 'INTERLOCKED' : interlocked === false ? 'READY' : 'PERMISSIVE') : null;
      return (
        <g opacity={interlocked ? 0.45 : 1}>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={fill} stroke={stroke} strokeWidth={1} />
          <Label el={el} t={t} color={latched ? t.onAccent : danger ? '#ff8b8f' : t.text} dy={sub ? -7 : 0} maxW={el.w - 16 - 2 * lockInset(el)}>{t.caps(text)}</Label>
          {sub && (
            <g>
              <circle cx={el.x + el.w / 2 - textWidth(sub, 9, 1.2) / 2 - 7} cy={el.y + el.h / 2 + 12} r={3}
                fill={interlocked === true ? t.warning : interlocked === false ? t.ok : 'none'} stroke={interlocked === null ? t.faint : 'none'} />
              <text x={el.x + el.w / 2 + 3} y={el.y + el.h / 2 + 12} fill={interlocked === true ? t.warning : t.faint} fontSize={9} fontFamily={t.font} fontWeight={600} letterSpacing={t.ls(1.2)}
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
      while (textWidth(t.caps(el.label), navSize, navSpacing) > avail && (navSize > 10 || navSpacing > 0.8)) {
        if (navSpacing > 1) navSpacing -= 0.25; else navSize -= 0.5;
      }
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={active ? t.surfaceUp : 'transparent'} />
          <Label el={el} t={t} color={active ? t.text : t.dim} weight={active ? 600 : 500} spacing={navSpacing} size={navSize}>{t.caps(el.label)}</Label>
          {active && <rect x={el.x + el.w * 0.3} y={el.y + el.h - 4} width={el.w * 0.4} height={2} rx={1} fill={t.accent} />}
          {lock && <LockBadge x={Math.min(el.x + el.w - 4, el.x + el.w / 2 + textWidth(t.caps(el.label), navSize, navSpacing) / 2 + 26)} y={el.y + el.h / 2 - 8} letter={LEVEL_SHORT[lock]} color={t.faint} t={t} />}
        </g>
      );
    }
    case 'indicator': {
      const color = on ? styleColor(el.style, t) : t.faint;
      const d = Math.min(el.h * 0.28, 7);
      const text = on && el.onText ? el.onText : !on && el.offText ? el.offText : el.label;
      const fs = fitSize(t.caps(text), el.w - 40 - 2 * d, Math.max(11, Math.min(16, el.h * 0.34)), 10.5, 1.2);
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={t.surface} stroke={on && el.style !== 'normal' ? color : t.line} strokeOpacity={on && el.style !== 'normal' ? 0.6 : 1} />
          {on && <circle cx={el.x + 16 + d} cy={el.y + el.h / 2} r={d * 2.2} fill={color} opacity={0.18} />}
          <circle cx={el.x + 16 + d} cy={el.y + el.h / 2} r={d} fill={color} />
          <text x={el.x + 28 + 2 * d} y={el.y + el.h / 2} fill={on ? t.text : t.dim} fontSize={fs} fontFamily={t.font} fontWeight={500} letterSpacing={t.ls(1.2)} dominantBaseline="central">
            {fitText(t.caps(text), el.w - 40 - 2 * d, fs, 1.2)}
          </text>
        </g>
      );
    }
    case 'multistate': {
      const v = typeof value === 'number' ? value : value === undefined ? (el.states?.[0]?.value ?? 0) : Number(value);
      const st = stateFor(el.states, v) ?? (ctx.live ? { value: v, text: `State ${v}`, style: 'warning' as const } : el.states?.[0] ?? { value: 0, text: '—', style: 'normal' as const });
      const color = stateTextColor(st.style, t);
      const tall = el.h >= 60;
      const labelSize = Math.max(10, Math.min(12, el.h * 0.2));
      const valueSize = tall ? Math.max(16, Math.min(28, el.h * 0.36)) : Math.max(13, Math.min(20, el.h * 0.4));
      const dotX = el.x + 18;
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={t.surface} stroke={st.style === 'normal' ? t.line : color} strokeOpacity={st.style === 'normal' ? 1 : 0.55} />
          {tall ? (
            <>
              <text x={el.x + 14} y={el.y + 16} fill={t.dim} fontSize={labelSize} fontFamily={t.font} fontWeight={500} letterSpacing={t.ls(1.5)} dominantBaseline="central">{fitText(t.caps(el.label), el.w - 28, labelSize, 1.5)}</text>
              <circle cx={dotX} cy={el.y + el.h * 0.62} r={5} fill={st.style === 'normal' ? t.dim : color} />
              <text x={dotX + 14} y={el.y + el.h * 0.62} fill={color} fontSize={valueSize} fontFamily={t.font} fontWeight={400} letterSpacing={t.ls(1.5)} dominantBaseline="central">{fitText(t.caps(st.text), el.w - 46, valueSize, 1.5)}</text>
            </>
          ) : (
            <>
              <text x={el.x + 14} y={el.y + el.h / 2} fill={t.dim} fontSize={labelSize} fontFamily={t.font} fontWeight={500} letterSpacing={t.ls(1.5)} dominantBaseline="central">{fitText(t.caps(el.label), el.w * 0.4, labelSize, 1.5)}</text>
              <text x={el.x + el.w - 14} y={el.y + el.h / 2} fill={color} fontSize={valueSize} fontFamily={t.font} fontWeight={500} letterSpacing={t.ls(1.5)} textAnchor="end" dominantBaseline="central">{fitText(t.caps(st.text), el.w * 0.55, valueSize, 1.5)}</text>
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
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={t.surface} stroke={entry ? t.accent : t.line} strokeOpacity={entry ? 0.45 : 1} />
          <text x={el.x + 14} y={el.y + el.h / 2 - (range ? 7 : 0)} fill={t.dim} fontSize={labelSize} fontFamily={t.font} fontWeight={500} letterSpacing={t.ls(1.5)} dominantBaseline="central">{fitText(t.caps(el.label), Math.max(30, labelMax), labelSize, 1.5)}</text>
          {range && <text x={el.x + 14} y={el.y + el.h / 2 + 10} fill={t.faint} fontSize={Math.max(9, labelSize - 2)} fontFamily={t.font} letterSpacing={t.ls(1)} dominantBaseline="central">{range}</text>}
          <text x={el.x + el.w - 14 - unitsW} y={el.y + el.h / 2} fill={t.text} fontSize={valueSize} fontFamily={t.font} fontWeight={t.thin} textAnchor="end" dominantBaseline="central">{valueText}</text>
          {el.units && <text x={el.x + el.w - 14} y={el.y + el.h / 2} fill={t.dim} fontSize={labelSize} fontFamily={t.font} textAnchor="end" dominantBaseline="central">{el.units}</text>}
          {entry && <rect x={el.x + 14} y={el.y + el.h - 6} width={24} height={2} rx={1} fill={t.accent} />}
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
          <text x={el.x} y={el.y + (el.h - trackH) / 2} fill={t.dim} fontSize={Math.max(10, Math.min(13, el.h * 0.24))} fontFamily={t.font} fontWeight={500} letterSpacing={t.ls(1.5)} dominantBaseline="central">{fitText(t.caps(el.label), el.w * 0.6, Math.max(10, Math.min(13, el.h * 0.24)), 1.5)}</text>
          <text x={el.x + el.w} y={el.y + (el.h - trackH) / 2} fill={t.text} fontSize={Math.max(12, Math.min(20, el.h * 0.32))} fontFamily={t.font} fontWeight={t.thin} textAnchor="end" dominantBaseline="central">{`${showNum(v)}${el.units ? ` ${el.units}` : ''}`}</text>
          <rect x={el.x} y={ty} width={el.w} height={trackH} rx={trackH / 2} fill={t.surfaceUp} />
          <rect x={el.x} y={ty} width={el.w * frac} height={trackH} rx={trackH / 2} fill={styleColor(el.style, t)} />
        </g>
      );
    }
    case 'trend':
      return <Trend el={el} ctx={ctx} value={typeof value === 'number' ? value : value === undefined ? undefined : Number(value)} />;
    case 'machine':
      return <MachineGraphic el={el} read={ctx.read} t={t} />;
    case 'alarm-list':
      return <AlarmList el={el} ctx={ctx} />;
    case 'datetime': {
      const fs = Math.max(14, Math.min(30, el.h * 0.42));
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={t.surface} stroke={t.line} />
          <text x={el.x + 14} y={el.y + el.h / 2} fill={t.dim} fontSize={Math.max(10, fs * 0.45)} fontFamily={t.font} fontWeight={500} letterSpacing={t.ls(1.5)} dominantBaseline="central">{t.date(ctx.now)}</text>
          <text x={el.x + el.w - 14} y={el.y + el.h / 2} fill={t.text} fontSize={fs} fontFamily={t.font} fontWeight={t.thin} letterSpacing={t.ls(1)} textAnchor="end" dominantBaseline="central">{fmtTime(ctx.now)}</text>
        </g>
      );
    }
    case 'alarm-banner': {
      const active = ctx.rows.filter((a) => a.active);
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={active.length ? t.alarm : t.surface} stroke={active.length ? t.alarm : t.line} />
          <circle cx={el.x + 18} cy={el.y + el.h / 2} r={4} fill={active.length ? '#ffffff' : t.ok} />
          <text x={el.x + 32} y={el.y + el.h / 2} fill={active.length ? '#ffffff' : t.dim} fontSize={Math.max(11, Math.min(16, el.h * 0.4))}
            fontFamily={t.font} fontWeight={500} letterSpacing={t.ls(1.2)} dominantBaseline="central">
            {fitText(active.length ? t.caps(`${active[0].message}${active.length > 1 ? `  +${active.length - 1} more` : ''}`) : 'SYSTEM NOMINAL', el.w - 44, Math.max(11, Math.min(16, el.h * 0.4)), 1.2)}
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
          <text x={el.x} y={el.y + el.h / 2} fill={t.text} fontSize={fs} fontFamily={t.font} fontWeight={t.thin} letterSpacing={t.ls(3)}
            dominantBaseline="central" style={{ pointerEvents: 'none' }}>{fitText(t.caps(el.label), el.w, fs, 3)}</text>
        );
      }
      if (el.style !== 'normal' || el.h < 24) {
        // Small left-aligned caption / section label.
        const fs = Math.max(10, Math.min(13, el.h * 0.55));
        return (
          <text x={el.x} y={el.y + el.h / 2} fill={el.style === 'normal' ? t.faint : stateTextColor(el.style, t)} fontSize={fs} fontFamily={t.font} fontWeight={600} letterSpacing={t.ls(1.6)}
            dominantBaseline="central" style={{ pointerEvents: 'none' }}>{fitText(t.caps(el.label), el.w, fs, 1.6)}</text>
        );
      }
      return <Label el={el} t={t} color={t.dim} spacing={1.5}>{t.caps(el.label)}</Label>;
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

export default function HmiScreenView({ screen, widthPx, heightPx, read, onPress, onNavigate, onEntry, activeAlarms = [], selectedId, onSelect, design, runtime, staticTime, thumbnail, look }: HmiScreenViewProps) {
  const live = Boolean(read);
  const rows = alarmRows(design, read, runtime, activeAlarms);
  const t = hmiTheme(look ?? lookOf(design));
  const ctx: Ctx = {
    screen, design, read, live, rows, runtime, t,
    activeCount: live || activeAlarms.length ? rows.filter((r) => r.active).length : 0,
    now: runtime?.now ?? staticTime ?? renderTime(),
  };
  // Group frames first so they sit behind the elements they contain.
  const ordered = [...screen.elements.filter((e) => e.kind === 'panel'), ...screen.elements.filter((e) => e.kind !== 'panel')];
  const gradId = `hmi-glow-${screen.id.replace(/[^\w-]/g, '')}`;
  return (
    <svg viewBox={`0 0 ${widthPx} ${heightPx}`} className="w-full h-auto max-h-full block" role="img" aria-label={`HMI screen: ${screen.name}`}
      style={{ background: t.screen, borderRadius: thumbnail ? 4 : 10 }}>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="0%" r="90%">
          <stop offset="0%" stopColor={t.glow} />
          <stop offset="100%" stopColor={t.screen} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={widthPx} height={heightPx} fill={`url(#${gradId})`} />
      {t.shape.family === 'panel' && <NavBand elements={screen.elements} widthPx={widthPx} heightPx={heightPx} t={t} />}
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
        const entry = el.kind === 'numeric-entry' && el.address && onEntry && !onSelect;
        const interactive = !thumbnail && ((el.kind === 'button' && onPress) || (navTarget && onNavigate) || entry || onSelect);
        const lock = el.level && el.level !== 'operator' && el.kind !== 'nav' && el.kind !== 'header' ? el.level : null;
        return (
          <g
            key={el.id}
            data-el={el.id}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
            onPointerDown={thumbnail ? undefined : (e) => {
              if (onSelect) { e.stopPropagation(); onSelect(el.id); return; }
              // Capture on the element's group: its shapes are re-drawn while pressed, and a lost capture would lose the release.
              if (el.kind === 'button' && onPress) { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); onPress(el, true); }
              if (entry) { onEntry(el); return; }
              if (navTarget && onNavigate && (el.kind === 'nav' || (e.target as Element).closest?.('[data-nav]'))) onNavigate(navTarget);
            }}
            onPointerUp={() => { if (!onSelect && el.kind === 'button' && onPress) onPress(el, false); }}
            onPointerCancel={() => { if (!onSelect && el.kind === 'button' && onPress) onPress(el, false); }}
            onLostPointerCapture={() => { if (!onSelect && el.kind === 'button' && onPress) onPress(el, false); }}
          >
            <ElementShape el={el} value={value} ctx={ctx} />
            {lock && <LockBadge x={el.x + el.w - 6} y={el.y + 5} letter={LEVEL_SHORT[lock]} t={t} />}
            {!thumbnail && selectedId === el.id && <rect x={el.x - 3} y={el.y - 3} width={el.w + 6} height={el.h + 6} fill="none" stroke={t.select} strokeWidth={2} strokeDasharray="6 4" />}
          </g>
        );
      })}
    </svg>
  );
}
