import type { HmiElement, HmiStyle } from './types';
import { fitSize, fitText, fmtTime, LEVEL_SHORT, stateTextColor, styleColor, textWidth, type HmiTheme } from './theme';
import { HmiIcon } from './icons';
import { iconFor, type HmiIconName } from './iconRules';
import { FRAME_TITLE_H, GroupFrame, LockBadge } from './symbols';
import { showNum, stateFor, type Ctx } from './viewCtx';

/**
 * Siemens look: a WinCC Comfort / Unified style operator panel in the app's
 * blues. Light grey screen, light raised buttons with a darker bottom edge,
 * filled green START / red STOP, F-key style navigation tiles (the current
 * screen filled blue), white value fields with an inset border, plain
 * (not upper-case) Arial text. Colour carries state only (ISA-101).
 */

/** Fill, edge and text colours of a raised button. */
interface Tone { fill: string; edge: string; text: string }

const toneOf = (t: HmiTheme, kind: 'neutral' | 'start' | 'stop' | 'accent' | 'warning'): Tone => {
  switch (kind) {
    case 'start': return { fill: t.ok, edge: '#147a3c', text: '#ffffff' };
    case 'stop': return { fill: t.alarm, edge: '#a11f1f', text: '#ffffff' };
    case 'accent': return { fill: t.accent, edge: '#0a4fb8', text: t.onAccent };
    case 'warning': return { fill: t.warning, edge: '#a86f00', text: t.text };
    default: return { fill: '#f7f8fa', edge: t.bevel, text: t.text };
  }
};

/**
 * Raised WinCC-like button body: 1 px edge on the sides and top, a 2 px darker
 * edge at the bottom and a light highlight; pressed it sinks (edge on top, no highlight).
 */
function Raised({ x, y, w, h, tone, pressed, t }: { x: number; y: number; w: number; h: number; tone: Tone; pressed?: boolean; t: HmiTheme }) {
  const fill = pressed ? (tone.fill === '#f7f8fa' ? t.pressed : tone.edge) : tone.fill;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={tone.edge} />
      <rect x={x + 1} y={y + (pressed ? 2 : 1)} width={w - 2} height={h - 3} rx={2} fill={fill} />
      {!pressed && <rect x={x + 1} y={y + 1 + (h - 3) * 0.45} width={w - 2} height={(h - 3) * 0.55} rx={2} fill="#000" opacity={0.018} />}
      {!pressed && <rect x={x + 1} y={y + 1 + (h - 3) * 0.75} width={w - 2} height={(h - 3) * 0.25} rx={2} fill="#000" opacity={0.018} />}
      {!pressed && <rect x={x + 3} y={y + 1.5} width={w - 6} height={1} fill="#ffffff" opacity={tone.fill === '#f7f8fa' ? 0.9 : 0.25} />}
    </g>
  );
}

/**
 * Icon and text centred in a box: side by side, or the icon above the text
 * when the box is tall. The text stays its own <text> element (tests and
 * screen readers find a button by its label). Without room the icon is left out.
 */
function IconLabel({ x, y, w, h, icon, text, color, size, weight, t, dy = 0 }: {
  x: number; y: number; w: number; h: number; icon: HmiIconName | null; text: string; color: string; size: number; weight: number; t: HmiTheme; dy?: number;
}) {
  const cx = x + w / 2, cy = y + h / 2 + dy;
  const avail = w - 16;
  // Icon above the text in tall boxes, unless a second line (interlock state) needs the room.
  const stacked = icon && h >= 72 && w >= 64 && dy === 0;
  if (icon && stacked) {
    const is = Math.min(26, h * 0.32);
    const fs = fitSize(text, avail, size, 10);
    const top = cy - (is + 6 + fs) / 2;
    return (
      <g>
        <HmiIcon name={icon} x={cx - is / 2} y={top} size={is} color={color} />
        <text x={cx} y={top + is + 6 + fs / 2} fill={color} fontSize={fs} fontFamily={t.font} fontWeight={weight} textAnchor="middle" dominantBaseline="central"
          style={{ pointerEvents: 'none' }}>{fitText(text, avail, fs)}</text>
      </g>
    );
  }
  const is = Math.max(12, Math.min(20, h * 0.36));
  const withIcon = icon && textWidth(text, 10) <= avail - is - 7;
  const textAvail = withIcon ? avail - is - 7 : avail;
  const fs = fitSize(text, textAvail, size, 10);
  const shown = fitText(text, textAvail, fs);
  if (!withIcon) {
    return <text x={cx} y={cy} fill={color} fontSize={fs} fontFamily={t.font} fontWeight={weight} textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none' }}>{shown}</text>;
  }
  const groupW = is + 7 + Math.min(textAvail, textWidth(shown, fs));
  const left = cx - groupW / 2;
  return (
    <g>
      <HmiIcon name={icon} x={left} y={cy - is / 2} size={is} color={color} />
      <text x={left + is + 7} y={cy} fill={color} fontSize={fs} fontFamily={t.font} fontWeight={weight} dominantBaseline="central" style={{ pointerEvents: 'none' }}>{shown}</text>
    </g>
  );
}

/** White display / entry field with an inset (sunken) border. */
function Field({ x, y, w, h, t, border }: { x: number; y: number; w: number; h: number; t: HmiTheme; border?: string }) {
  return (
    <g>
      <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx={1.5} fill={t.field} stroke={border ?? t.line} strokeWidth={border ? 1.5 : 1} />
      {!border && <path d={`M${x + 1.5} ${y + h - 2} V${y + 1.5} H${x + w - 2}`} fill="none" stroke={t.bevel} strokeWidth={1} opacity={0.7} />}
    </g>
  );
}

/** Light panel with a 1 px border (no title). */
function Box({ el, t, stroke }: { el: HmiElement; t: HmiTheme; stroke?: string }) {
  return <rect x={el.x + 0.5} y={el.y + 0.5} width={el.w - 1} height={el.h - 1} rx={2} fill={t.surface} stroke={stroke ?? t.line} />;
}

/** Lamp colour when ON: plain 'normal' lamps are green; E-stop lamps are always red. */
const lampColor = (el: HmiElement, t: HmiTheme) =>
  /\b(e-?stop|emergency)\b/i.test(`${el.label} ${el.onText ?? ''}`) ? t.alarm : el.style === 'normal' ? t.ok : styleColor(el.style, t);

/** A lamp: grey when off, coloured with a highlight when on. */
function Lamp({ cx, cy, r, on, color }: { cx: number; cy: number; r: number; on: boolean; color: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={on ? color : '#c3cad1'} stroke={on ? 'rgba(0,0,0,0.28)' : '#8c96a0'} strokeWidth={1} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.32} r={r * 0.32} fill="#ffffff" opacity={on ? 0.45 : 0.6} />
    </g>
  );
}

/** Fill and text colours of a state badge (mode, alarm counter) on the dark blue header. */
const badgeTone = (t: HmiTheme, style: HmiStyle) =>
  style === 'alarm' ? { fill: t.alarm, stroke: t.alarm, text: '#ffffff' }
    : style === 'warning' ? { fill: t.warning, stroke: t.warning, text: t.text }
      : style === 'ok' ? { fill: t.ok, stroke: t.ok, text: '#ffffff' }
        : { fill: 'rgba(255,255,255,0.10)', stroke: 'rgba(255,255,255,0.28)', text: t.headerText };

function Header({ el, ctx }: { el: HmiElement; ctx: Ctx }) {
  const { t } = ctx;
  const h = el.h;
  const fs = Math.max(13, Math.min(19, h * 0.38));
  const small = Math.max(11, Math.min(13, h * 0.28));
  const cy = el.y + (h - 3) / 2;
  const machine = el.label || ctx.design?.machineName || 'Machine';
  const screenName = ctx.screen.name;
  // Right-hand cluster, laid out right to left: clock, alarm counter, mode.
  const clockX = el.x + el.w - 12;
  const clockW = textWidth('00:00:00', fs * 0.9) + 8;
  const badgeH = Math.min(28, h - 14);
  const by = cy - badgeH / 2;
  const alarmsOn = ctx.activeCount > 0;
  const anyAlarm = ctx.rows.some((r) => r.active && r.severity === 'alarm');
  const alarmText = alarmsOn ? `Alarms ${ctx.activeCount}` : 'No alarms';
  const alarmW = Math.max(104, textWidth('Alarms 00', small) + 40);
  const alarmX = clockX - clockW - 12 - alarmW;
  const alarmTone = badgeTone(t, alarmsOn ? (anyAlarm ? 'alarm' : 'warning') : 'normal');
  const modeVal = el.address && ctx.read ? Number(ctx.read(el.address)) : 0;
  const mode = el.address ? (stateFor(el.states, modeVal) ?? { value: modeVal, text: el.states?.length ? `Mode ${modeVal}` : 'Auto', style: 'normal' as const }) : null;
  const modeW = mode ? textWidth(mode.text, small) + 34 : 0;
  const modeX = alarmX - 8 - modeW;
  const modeTone = badgeTone(t, mode?.style ?? 'normal');
  const nameFs = fitSize(machine, el.w * 0.32, fs, 11);
  const nameW = Math.min(el.w * 0.32, textWidth(machine, nameFs));
  const titleX = el.x + 16 + nameW + 25;
  const locked = ctx.screen.level && ctx.screen.level !== 'operator' ? ctx.screen.level : null;
  const titleMax = (mode ? modeX : alarmX) - titleX - 12 - (locked ? 26 : 0);
  return (
    <g>
      <rect x={el.x} y={el.y} width={el.w} height={h} fill={t.header} />
      <rect x={el.x} y={el.y + h - 3} width={el.w} height={3} fill={t.accent} />
      <text x={el.x + 16} y={cy} fill={t.headerText} fontSize={nameFs} fontFamily={t.font} fontWeight={700} dominantBaseline="central">{fitText(machine, el.w * 0.32, nameFs)}</text>
      <rect x={el.x + 16 + nameW + 12} y={cy - fs * 0.6} width={1} height={fs * 1.2} fill={t.headerLine} />
      {titleMax > 30 && (
        <text x={titleX} y={cy} fill={t.headerDim} fontSize={fs} fontFamily={t.font} fontWeight={400} dominantBaseline="central">{fitText(screenName, titleMax, fs)}</text>
      )}
      {locked && titleMax > 30 && (
        <LockBadge x={titleX + Math.min(textWidth(screenName, fs), titleMax) + 26} y={cy - 7} letter={LEVEL_SHORT[locked]} color={t.headerDim} t={t} />
      )}
      {mode && (
        <g>
          <rect x={modeX} y={by} width={modeW} height={badgeH} rx={3} fill={modeTone.fill} stroke={modeTone.stroke} />
          <circle cx={modeX + 13} cy={cy} r={4} fill={mode.style === 'normal' ? t.headerDim : modeTone.text} />
          <text x={modeX + 23} y={cy} fill={modeTone.text} fontSize={small} fontFamily={t.font} fontWeight={700} dominantBaseline="central">{mode.text}</text>
        </g>
      )}
      <g style={{ cursor: el.targetScreenId ? 'pointer' : undefined }} data-nav={el.targetScreenId ?? undefined}>
        <rect x={alarmX} y={by} width={alarmW} height={badgeH} rx={3} fill={alarmTone.fill} stroke={alarmTone.stroke} />
        <HmiIcon name="warning" x={alarmX + 8} y={cy - 8} size={16} color={alarmsOn ? alarmTone.text : t.headerDim} />
        <text x={alarmX + 30} y={cy} fill={alarmsOn ? alarmTone.text : t.headerDim} fontSize={small} fontFamily={t.font} fontWeight={700} dominantBaseline="central">{alarmText}</text>
      </g>
      <text x={clockX} y={cy - small * 0.55} fill={t.headerText} fontSize={fs * 0.9} fontFamily={t.font} fontWeight={700} textAnchor="end" dominantBaseline="central">{fmtTime(ctx.now)}</text>
      <text x={clockX} y={cy + fs * 0.6} fill={t.headerDim} fontSize={Math.max(10, small * 0.85)} fontFamily={t.font} textAnchor="end" dominantBaseline="central">{t.date(ctx.now)}</text>
    </g>
  );
}

function Button({ el, value, ctx }: { el: HmiElement; value: boolean | number | undefined; ctx: Ctx }) {
  const { t } = ctx;
  const on = Boolean(value);
  const interlocked = el.interlock ? (ctx.read ? !ctx.read(el.interlock) : null) : null;
  const showOn = ctx.live && on && el.action !== 'reset';
  const latched = showOn && (el.action === 'toggle' || el.action === 'set');
  const pressed = showOn && !latched;
  const icon = iconFor(el.label) ?? iconFor(el.onText, el.offText);
  const roleIcon = iconFor(el.label);
  const role = roleIcon === 'stop' || el.style === 'alarm' ? 'stop' : roleIcon === 'play' || el.style === 'ok' ? 'start' : el.style === 'warning' ? 'warning' : 'neutral';
  const tone = toneOf(t, latched && role === 'neutral' ? 'accent' : role);
  const text = latched && el.onText ? el.onText : !latched && el.offText && el.action === 'toggle' ? el.offText : el.label;
  const sub = el.interlock && el.h >= 52 ? (interlocked === true ? 'Interlocked' : interlocked === false ? 'Ready' : 'Permissive') : null;
  const size = Math.max(12, Math.min(18, el.h * 0.3));
  const sink = pressed || (latched && role !== 'neutral') ? 1 : 0;
  return (
    <g opacity={interlocked ? 0.45 : 1}>
      <Raised x={el.x} y={el.y} w={el.w} h={el.h} tone={tone} pressed={pressed || (latched && role !== 'neutral')} t={t} />
      <IconLabel x={el.x} y={el.y + sink} w={el.w} h={el.h - 2} icon={icon} text={text} color={tone.text} size={size} weight={700} t={t} dy={sub ? -7 : 0} />
      {sub && (
        <g>
          <circle cx={el.x + el.w / 2 - textWidth(sub, 10) / 2 - 7} cy={el.y + el.h / 2 + 11} r={3.5}
            fill={interlocked === true ? t.warning : interlocked === false ? t.ok : 'none'} stroke={interlocked === null ? tone.text : 'rgba(0,0,0,0.25)'} />
          <text x={el.x + el.w / 2 + 3} y={el.y + el.h / 2 + 11} fill={tone.text} fontSize={10} fontFamily={t.font} textAnchor="middle" dominantBaseline="central">{sub}</text>
        </g>
      )}
    </g>
  );
}

function Nav({ el, ctx }: { el: HmiElement; ctx: Ctx }) {
  const { t } = ctx;
  const active = el.targetScreenId === ctx.screen.id;
  const target = ctx.design?.screens.find((s) => s.id === el.targetScreenId);
  const lock = target?.level && target.level !== 'operator' ? target.level : null;
  const tone = toneOf(t, active ? 'accent' : 'neutral');
  const icon = iconFor(el.label, target?.name);
  return (
    <g>
      <Raised x={el.x} y={el.y} w={el.w} h={el.h} tone={tone} t={t} />
      <IconLabel x={el.x} y={el.y} w={el.w - (lock ? 10 : 0)} h={el.h - 2} icon={icon} text={el.label} color={tone.text}
        size={Math.max(12, Math.min(16, el.h * 0.3))} weight={active ? 700 : 400} t={t} />
      {lock && <LockBadge x={el.x + el.w - 5} y={el.y + 4} letter={LEVEL_SHORT[lock]} color={active ? t.onAccent : t.dim} t={t} />}
    </g>
  );
}

function Indicator({ el, value, ctx }: { el: HmiElement; value: boolean | number | undefined; ctx: Ctx }) {
  const { t } = ctx;
  const on = Boolean(value);
  const color = lampColor(el, t);
  const r = Math.max(5, Math.min(el.h * 0.26, 10));
  const text = on && el.onText ? el.onText : !on && el.offText ? el.offText : el.label;
  const tx = el.x + 14 + 2 * r;
  const maxW = el.x + el.w - 10 - tx;
  const fs = fitSize(text, maxW, Math.max(12, Math.min(16, el.h * 0.34)), 10.5);
  return (
    <g>
      <Box el={el} t={t} />
      <Lamp cx={el.x + 8 + r} cy={el.y + el.h / 2} r={r} on={on} color={color} />
      <text x={tx} y={el.y + el.h / 2} fill={on ? t.text : t.dim} fontSize={fs} fontFamily={t.font} fontWeight={on ? 700 : 400} dominantBaseline="central">
        {fitText(text, maxW, fs)}
      </text>
    </g>
  );
}

function Multistate({ el, value, ctx }: { el: HmiElement; value: boolean | number | undefined; ctx: Ctx }) {
  const { t } = ctx;
  const v = typeof value === 'number' ? value : value === undefined ? (el.states?.[0]?.value ?? 0) : Number(value);
  const st = stateFor(el.states, v) ?? (ctx.live ? { value: v, text: `State ${v}`, style: 'warning' as const } : el.states?.[0] ?? { value: 0, text: '—', style: 'normal' as const });
  const color = stateTextColor(st.style, t);
  const tall = el.h >= 60;
  const labelSize = Math.max(11, Math.min(13, el.h * 0.22));
  const pad = 8;
  const fx = tall ? el.x + pad : el.x + Math.max(el.w * 0.42, Math.min(el.w - 90, textWidth(el.label, labelSize) + 20));
  const fy = tall ? el.y + 24 : el.y + 5;
  const fw = el.x + el.w - pad - fx;
  const fh = tall ? el.h - 24 - pad : el.h - 10;
  const valueSize = Math.max(12, Math.min(tall ? 24 : 17, fh * 0.55));
  const dot = st.style === 'normal' ? t.dim : styleColor(st.style, t);
  return (
    <g>
      <Box el={el} t={t} />
      <text x={el.x + 10} y={tall ? el.y + 13 : el.y + el.h / 2} fill={t.dim} fontSize={labelSize} fontFamily={t.font} dominantBaseline="central">
        {fitText(el.label, tall ? el.w - 20 : fx - el.x - 16, labelSize)}
      </text>
      <Field x={fx} y={fy} w={fw} h={fh} t={t} />
      <circle cx={fx + 12} cy={fy + fh / 2} r={4.5} fill={dot} />
      <text x={fx + 23} y={fy + fh / 2} fill={color} fontSize={valueSize} fontFamily={t.font} fontWeight={700} dominantBaseline="central">{fitText(st.text, fw - 30, valueSize)}</text>
    </g>
  );
}

function Numeric({ el, value, ctx }: { el: HmiElement; value: boolean | number | undefined; ctx: Ctx }) {
  const { t } = ctx;
  const v = typeof value === 'number' ? value : value === undefined ? 0 : Number(value);
  const entry = el.kind === 'numeric-entry';
  const labelSize = Math.max(11, Math.min(13, el.h * 0.22));
  const pad = 6;
  const fh = Math.max(16, Math.min(el.h - 2 * pad, 40));
  const valueSize = Math.max(12, Math.min(22, fh * 0.56));
  const unitSize = Math.max(10, Math.min(13, valueSize * 0.7));
  const valueText = showNum(v);
  const unitsW = el.units ? textWidth(el.units, unitSize) + 6 : 0;
  const need = textWidth(valueText, valueSize) + unitsW + 22;
  const fw = Math.min(el.w - 2 * pad - 40, Math.max(need, el.w * 0.42));
  const fx = el.x + el.w - pad - fw;
  const fy = el.y + (el.h - fh) / 2;
  const range = el.min !== null && el.max !== null && el.h >= 50 ? `${el.min}–${el.max}${el.units ? ` ${el.units}` : ''}` : null;
  const labelMax = fx - el.x - 16;
  return (
    <g>
      <Box el={el} t={t} />
      <text x={el.x + 10} y={el.y + el.h / 2 - (range ? 8 : 0)} fill={t.dim} fontSize={labelSize} fontFamily={t.font} dominantBaseline="central">
        {fitText(el.label, Math.max(24, labelMax), labelSize)}
      </text>
      {range && <text x={el.x + 10} y={el.y + el.h / 2 + 9} fill={t.dim} fontSize={Math.max(10, labelSize - 2)} fontFamily={t.font} dominantBaseline="central">{fitText(range, Math.max(24, labelMax), Math.max(10, labelSize - 2))}</text>}
      <Field x={fx} y={fy} w={fw} h={fh} t={t} border={entry ? t.accent : undefined} />
      <text x={fx + fw - 8 - unitsW} y={fy + fh / 2} fill={t.text} fontSize={fitSize(valueText, fw - unitsW - 16, valueSize, 10)} fontFamily={t.font} fontWeight={700}
        textAnchor="end" dominantBaseline="central">{valueText}</text>
      {el.units && <text x={fx + fw - 8} y={fy + fh / 2} fill={t.dim} fontSize={unitSize} fontFamily={t.font} textAnchor="end" dominantBaseline="central">{el.units}</text>}
      {entry && <path d={`M${fx + fw - 1.5} ${fy + fh - 9} V${fy + fh - 1.5} H${fx + fw - 9} Z`} fill={t.accent} />}
    </g>
  );
}

function Bar({ el, value, ctx }: { el: HmiElement; value: boolean | number | undefined; ctx: Ctx }) {
  const { t } = ctx;
  const v = typeof value === 'number' ? value : 0;
  const min = el.min ?? 0;
  const max = el.max ?? 100;
  const frac = Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
  const trackH = Math.max(8, Math.min(16, el.h * 0.32));
  const ty = el.y + el.h - trackH - 2;
  const textY = el.y + (el.h - trackH - 2) / 2;
  const fs = Math.max(11, Math.min(14, el.h * 0.26));
  const valueText = `${showNum(v)}${el.units ? ` ${el.units}` : ''}`;
  return (
    <g>
      <text x={el.x} y={textY} fill={t.dim} fontSize={fs} fontFamily={t.font} dominantBaseline="central">{fitText(el.label, el.w * 0.6, fs)}</text>
      <text x={el.x + el.w} y={textY} fill={t.text} fontSize={fs + 1} fontFamily={t.font} fontWeight={700} textAnchor="end" dominantBaseline="central">{valueText}</text>
      <Field x={el.x} y={ty} w={el.w} h={trackH} t={t} />
      {frac > 0 && <rect x={el.x + 2} y={ty + 2} width={Math.max(0, (el.w - 4) * frac)} height={trackH - 4} fill={styleColor(el.style, t)} />}
      {[0.25, 0.5, 0.75].map((f) => <rect key={f} x={el.x + 2 + (el.w - 4) * f} y={ty + trackH - 5} width={1} height={3} fill={t.bevel} />)}
    </g>
  );
}

function Trend({ el, value, ctx }: { el: HmiElement; value: number | undefined; ctx: Ctx }) {
  const { t } = ctx;
  const samples = el.address ? ctx.runtime?.trends.get(el.address) ?? [] : [];
  const th = Math.min(FRAME_TITLE_H, el.h / 2);
  const pad = 8;
  const fx = el.x + pad, fy = el.y + th + pad, fw = el.w - 2 * pad, fh = el.h - th - 2 * pad;
  const axisW = 30;
  const px = fx + axisW, py = fy + 6, pw = fw - axisW - 6, ph = fh - 12;
  const lo = el.min ?? Math.min(0, ...samples);
  const hiRaw = el.max ?? Math.max(1, ...samples);
  const hi = hiRaw === lo ? lo + 1 : hiRaw;
  const pts = samples.map((v, i) => `${px + (samples.length > 1 ? (i / (samples.length - 1)) * pw : pw)},${py + ph - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * ph}`);
  const last = pts[pts.length - 1];
  const line = el.style === 'normal' ? t.accent : styleColor(el.style, t);
  const reading = ctx.live ? `${value ?? 0}${el.units ? ` ${el.units}` : ''}` : (el.units ?? '');
  const readingW = reading ? textWidth(reading, 12) + 12 : 0;
  return (
    <g>
      <GroupFrame el={el} t={t} title={fitText(el.label, el.w - readingW - 24, 12)} />
      {reading && <text x={el.x + el.w - 10} y={el.y + th / 2 + 0.5} fill={t.text} fontSize={12} fontFamily={t.font} fontWeight={700} textAnchor="end" dominantBaseline="central">{reading}</text>}
      {fh > 20 && (
        <g>
          <Field x={fx} y={fy} w={fw} h={fh} t={t} />
          {[0, 0.25, 0.5, 0.75, 1].map((f) => <rect key={f} x={px} y={py + ph * f} width={pw} height={1} fill={f === 1 ? t.line : t.lineSoft} />)}
          {[0.25, 0.5, 0.75].map((f) => <rect key={f} x={px + pw * f} y={py} width={1} height={ph} fill={t.lineSoft} />)}
          <text x={px - 4} y={py + 1} fill={t.dim} fontSize={10} fontFamily={t.font} textAnchor="end" dominantBaseline="central">{String(hi)}</text>
          <text x={px - 4} y={py + ph} fill={t.dim} fontSize={10} fontFamily={t.font} textAnchor="end" dominantBaseline="central">{String(lo)}</text>
          {ctx.live && pts.length > 1 && (
            <>
              <polyline points={`${px},${py + ph} ${pts.join(' ')} ${last.split(',')[0]},${py + ph}`} fill={line} opacity={0.1} stroke="none" />
              <polyline points={pts.join(' ')} fill="none" stroke={line} strokeWidth={2} strokeLinejoin="round" />
            </>
          )}
          {ctx.live && last && <circle cx={Number(last.split(',')[0])} cy={Number(last.split(',')[1])} r={3} fill={line} />}
          {!ctx.live && (
            <>
              <path d={`M${px} ${py + ph * 0.7} C ${px + pw * 0.25} ${py + ph * 0.7}, ${px + pw * 0.3} ${py + ph * 0.35}, ${px + pw * 0.5} ${py + ph * 0.4} S ${px + pw * 0.8} ${py + ph * 0.2}, ${px + pw} ${py + ph * 0.25}`}
                fill="none" stroke={line} strokeOpacity={0.55} strokeWidth={2} strokeDasharray="5 4" />
              {ph > 30 && <text x={px + pw / 2} y={py + ph * 0.9} fill={t.dim} fontSize={11} fontFamily={t.font} textAnchor="middle" dominantBaseline="central">Live trend in the simulator</text>}
            </>
          )}
        </g>
      )}
    </g>
  );
}

function AlarmList({ el, ctx }: { el: HmiElement; ctx: Ctx }) {
  const { t } = ctx;
  const headH = 26;
  const rowH = Math.max(24, Math.min(32, el.h / 8));
  const fs = Math.max(11, Math.min(13, rowH * 0.44));
  const timeW = Math.max(74, el.w * 0.16);
  const stateW = Math.max(ctx.live ? 112 : 76, el.w * (ctx.live ? 0.21 : 0.15));
  const msgX = el.x + 22 + timeW;
  const stateX = el.x + el.w - 10 - stateW;
  const msgW = stateX - msgX - 10;
  const maxRows = Math.max(1, Math.floor((el.h - headH - 2) / rowH));
  const rows = ctx.rows;
  const shown = rows.length > maxRows ? rows.slice(0, maxRows - 1) : rows;
  const more = rows.length - shown.length;
  return (
    <g>
      <rect x={el.x + 0.5} y={el.y + 0.5} width={el.w - 1} height={el.h - 1} rx={2} fill={t.field} stroke={t.line} />
      <path d={`M${el.x + 1} ${el.y + headH} V${el.y + 3} a2 2 0 0 1 2 -2 H${el.x + el.w - 3} a2 2 0 0 1 2 2 V${el.y + headH} Z`} fill={t.surfaceUp} />
      <rect x={el.x + 1} y={el.y + headH} width={el.w - 2} height={1} fill={t.line} />
      {([['Time', el.x + 22], [el.label || 'Message', msgX], ['State', stateX]] as [string, number][]).map(([head, x]) => (
        <text key={head} x={x} y={el.y + headH / 2} fill={t.text} fontSize={12} fontFamily={t.font} fontWeight={700} dominantBaseline="central">{fitText(head, msgW, 12)}</text>
      ))}
      {shown.length === 0 && (
        <text x={el.x + el.w / 2} y={el.y + headH + (el.h - headH) / 2} fill={t.dim} fontSize={13} fontFamily={t.font} textAnchor="middle" dominantBaseline="central">No alarms</text>
      )}
      {shown.map((r, i) => {
        const y = el.y + headH + 1 + i * rowH;
        const col = r.severity === 'alarm' ? t.alarm : t.warning;
        const textCol = r.severity === 'alarm' ? t.alarmText : t.warningText;
        const state = !ctx.live ? (r.severity === 'alarm' ? 'Alarm' : 'Warning') : r.active ? 'Active' : 'Cleared';
        const lit = r.active || !ctx.live;
        return (
          <g key={i}>
            {i % 2 === 1 && <rect x={el.x + 1} y={y} width={el.w - 2} height={rowH} fill={t.surface} />}
            <rect x={el.x + 1} y={y + rowH - 1} width={el.w - 2} height={1} fill={t.lineSoft} />
            <rect x={el.x + 8} y={y + rowH / 2 - 5} width={10} height={10} rx={1.5} fill={lit ? col : '#c3cad1'} />
            <text x={el.x + 22} y={y + rowH / 2} fill={r.active ? t.text : t.dim} fontSize={fs} fontFamily={t.mono} dominantBaseline="central">{r.on ? fmtTime(r.on) : '--:--:--'}</text>
            <text x={msgX} y={y + rowH / 2} fill={r.active ? t.text : t.dim} fontSize={fs} fontFamily={t.font} fontWeight={r.active ? 700 : 400} dominantBaseline="central">{fitText(r.message, msgW, fs)}</text>
            <text x={stateX} y={y + rowH / 2} fill={lit ? textCol : t.dim} fontSize={fs} fontFamily={t.font} fontWeight={700} dominantBaseline="central">
              {fitText(r.off && ctx.live ? `${state} ${fmtTime(r.off).slice(0, 5)}` : state, stateW - 4, fs)}
            </text>
          </g>
        );
      })}
      {more > 0 && (
        <text x={el.x + el.w / 2} y={el.y + headH + 1 + shown.length * rowH + rowH / 2} fill={t.dim} fontSize={fs} fontFamily={t.font} textAnchor="middle" dominantBaseline="central">{`+${more} more`}</text>
      )}
    </g>
  );
}

function AlarmBanner({ el, ctx }: { el: HmiElement; ctx: Ctx }) {
  const { t } = ctx;
  const active = ctx.rows.filter((a) => a.active);
  const alarm = active.some((a) => a.severity === 'alarm');
  const fill = !active.length ? t.surface : alarm ? t.alarm : t.warning;
  const color = !active.length ? t.dim : alarm ? '#ffffff' : t.text;
  const fs = Math.max(12, Math.min(16, el.h * 0.42));
  const is = Math.max(12, Math.min(18, el.h * 0.5));
  const text = active.length ? `${active[0].message}${active.length > 1 ? `  (+${active.length - 1} more)` : ''}` : 'No active alarms';
  return (
    <g>
      <rect x={el.x + 0.5} y={el.y + 0.5} width={el.w - 1} height={el.h - 1} rx={2} fill={fill} stroke={active.length ? fill : t.line} />
      {active.length
        ? <HmiIcon name="warning" x={el.x + 10} y={el.y + el.h / 2 - is / 2} size={is} color={color} />
        : <circle cx={el.x + 10 + is / 2} cy={el.y + el.h / 2} r={Math.min(5, is / 3)} fill={t.ok} />}
      <text x={el.x + 18 + is} y={el.y + el.h / 2} fill={color} fontSize={fs} fontFamily={t.font} fontWeight={active.length ? 700 : 400} dominantBaseline="central">
        {fitText(text, el.w - 28 - is, fs)}
      </text>
    </g>
  );
}

function DateTime({ el, ctx }: { el: HmiElement; ctx: Ctx }) {
  const { t } = ctx;
  const fh = el.h - 8;
  const fs = Math.max(13, Math.min(26, fh * 0.55));
  return (
    <g>
      <Field x={el.x} y={el.y + 4} w={el.w} h={fh} t={t} />
      <text x={el.x + 10} y={el.y + el.h / 2} fill={t.dim} fontSize={Math.max(11, fs * 0.6)} fontFamily={t.font} dominantBaseline="central">{t.date(ctx.now)}</text>
      <text x={el.x + el.w - 10} y={el.y + el.h / 2} fill={t.text} fontSize={fs} fontFamily={t.font} fontWeight={700} textAnchor="end" dominantBaseline="central">{fmtTime(ctx.now)}</text>
    </g>
  );
}

function Text({ el, ctx }: { el: HmiElement; ctx: Ctx }) {
  const { t } = ctx;
  if (el.h >= 32) {
    const fs = Math.min(26, el.h * 0.58);
    return (
      <text x={el.x} y={el.y + el.h / 2} fill={t.text} fontSize={fs} fontFamily={t.font} fontWeight={700} dominantBaseline="central" style={{ pointerEvents: 'none' }}>
        {fitText(el.label, el.w, fs)}
      </text>
    );
  }
  if (el.style !== 'normal' || el.h < 24) {
    const fs = Math.max(11, Math.min(14, el.h * 0.6));
    return (
      <text x={el.x} y={el.y + el.h / 2} fill={el.style === 'normal' ? t.dim : stateTextColor(el.style, t)} fontSize={fs} fontFamily={t.font} fontWeight={700}
        dominantBaseline="central" style={{ pointerEvents: 'none' }}>{fitText(el.label, el.w, fs)}</text>
    );
  }
  const fs = fitSize(el.label, el.w - 16, Math.max(12, Math.min(18, el.h * 0.5)), 10);
  return (
    <text x={el.x + el.w / 2} y={el.y + el.h / 2} fill={t.dim} fontSize={fs} fontFamily={t.font} textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none' }}>
      {fitText(el.label, el.w - 16, fs)}
    </text>
  );
}

/** One element in the Siemens look (kinds listed in SIEMENS_KINDS). */
export function SiemensElement({ el, value, ctx }: { el: HmiElement; value: boolean | number | undefined; ctx: Ctx }) {
  switch (el.kind) {
    case 'header': return <Header el={el} ctx={ctx} />;
    case 'panel': return <GroupFrame el={el} t={ctx.t} />;
    case 'button': return <Button el={el} value={value} ctx={ctx} />;
    case 'nav': return <Nav el={el} ctx={ctx} />;
    case 'indicator': return <Indicator el={el} value={value} ctx={ctx} />;
    case 'multistate': return <Multistate el={el} value={value} ctx={ctx} />;
    case 'numeric':
    case 'numeric-entry': return <Numeric el={el} value={value} ctx={ctx} />;
    case 'bar': return <Bar el={el} value={value} ctx={ctx} />;
    case 'trend': return <Trend el={el} ctx={ctx} value={typeof value === 'number' ? value : value === undefined ? undefined : Number(value)} />;
    case 'alarm-list': return <AlarmList el={el} ctx={ctx} />;
    case 'alarm-banner': return <AlarmBanner el={el} ctx={ctx} />;
    case 'datetime': return <DateTime el={el} ctx={ctx} />;
    default: return <Text el={el} ctx={ctx} />;
  }
}

/**
 * WinCC-style navigation bar behind the bottom row of screen buttons: a slightly
 * darker band with a top edge. Drawn only when the nav tiles sit along the bottom.
 */
export function NavBand({ elements, widthPx, heightPx, t }: { elements: HmiElement[]; widthPx: number; heightPx: number; t: HmiTheme }) {
  const navs = elements.filter((e) => e.kind === 'nav');
  if (navs.length < 2) return null;
  const top = Math.min(...navs.map((n) => n.y));
  const bottom = Math.max(...navs.map((n) => n.y + n.h));
  if (top < heightPx * 0.7 || heightPx - bottom > 12) return null;
  const y = Math.max(0, top - 4);
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={0} y={y} width={widthPx} height={heightPx - y} fill="#d5dbe1" />
      <rect x={0} y={y} width={widthPx} height={1} fill={t.line} />
    </g>
  );
}
