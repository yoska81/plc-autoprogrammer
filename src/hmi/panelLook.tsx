import type { HmiElement, HmiStyle } from './types';
import { fitSize, fitText, fmtTime, frameTitle, LEVEL_SHORT, onWarning, shade, stateTextColor, styleColor, textWidth, type HmiTheme } from './theme';
import { HmiIcon } from './icons';
import { iconFor, type HmiIconName } from './iconRules';
import { FRAME_TITLE_H, GroupFrame, LockBadge, TitleStrip } from './symbols';
import { barLimits, showNum, stateFor, type Ctx } from './viewCtx';
import { lockInset } from './layout';

/**
 * Operator-panel looks: Siemens WinCC Comfort / Unified, the ISA-101 grey
 * high-performance look and the maker styles (src/hmi/theme.ts). One renderer,
 * steered by the look's palette and shape: raised, glossy or flat buttons with
 * the look's corner radius, round / square lamps with or without a lens, F-key
 * tiles or flat tabs for navigation, a header bar with a stripe, gloss or rule,
 * value fields sunken or flat. Colour carries state (ISA-101); the high-performance
 * look keeps even START / STOP grey.
 */

/** Fill, edge and text colours of a button; `neutral` = the plain (off) key face. */
interface Tone { fill: string; edge: string; text: string; neutral?: boolean }

const toneOf = (t: HmiTheme, kind: 'neutral' | 'start' | 'stop' | 'accent' | 'warning'): Tone => {
  if (!t.shape.colorKeys && (kind === 'start' || kind === 'stop')) kind = 'neutral';
  switch (kind) {
    case 'start': return { fill: t.ok, edge: shade(t.ok, -0.25), text: '#ffffff' };
    case 'stop': return { fill: t.alarm, edge: shade(t.alarm, -0.25), text: '#ffffff' };
    case 'accent': return { fill: t.accent, edge: shade(t.accent, -0.25), text: t.onAccent };
    case 'warning': return { fill: t.warning, edge: shade(t.warning, -0.25), text: onWarning(t) };
    default: return { fill: t.button, edge: t.bevel, text: t.buttonText, neutral: true };
  }
};

/**
 * Button body in the look's style. Bevel (WinCC-like): 1 px edge on the sides and top, a 2 px
 * darker edge at the bottom and a light highlight; pressed it sinks. Gloss: a light upper half
 * over the face. Flat: one face with a 1 px border. Pressed keys lose their highlight.
 */
function Raised({ x, y, w, h, tone, pressed, t }: { x: number; y: number; w: number; h: number; tone: Tone; pressed?: boolean; t: HmiTheme }) {
  const fill = pressed ? (tone.neutral ? t.pressed : tone.edge) : tone.fill;
  const r = Math.max(0, Math.min(t.shape.radius, h / 2, w / 2));
  const r1 = Math.max(0, r - 1);
  if (t.shape.button === 'flat') {
    return <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx={r} fill={fill} stroke={tone.neutral && !pressed ? t.line : tone.edge} />;
  }
  if (t.shape.button === 'gloss') {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={r} fill={tone.edge} />
        <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} rx={r1} fill={fill} />
        {!pressed && <rect x={x + 2} y={y + 2} width={w - 4} height={(h - 4) * 0.46} rx={Math.max(0, r - 2)} fill="#ffffff" opacity={tone.neutral && t.light ? 0.6 : 0.2} />}
        {!pressed && <rect x={x + 1} y={y + 1 + (h - 2) * 0.72} width={w - 2} height={(h - 2) * 0.28} rx={r1} fill="#000" opacity={0.06} />}
      </g>
    );
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} fill={tone.edge} />
      <rect x={x + 1} y={y + (pressed ? 2 : 1)} width={w - 2} height={h - 3} rx={r1} fill={fill} />
      {!pressed && <rect x={x + 1} y={y + 1 + (h - 3) * 0.45} width={w - 2} height={(h - 3) * 0.55} rx={r1} fill="#000" opacity={0.018} />}
      {!pressed && <rect x={x + 1} y={y + 1 + (h - 3) * 0.75} width={w - 2} height={(h - 3) * 0.25} rx={r1} fill="#000" opacity={0.018} />}
      {!pressed && <rect x={x + 1 + Math.max(2, r1)} y={y + 1.5} width={Math.max(0, w - 2 - 2 * Math.max(2, r1))} height={1} fill="#ffffff" opacity={tone.neutral && t.light ? 0.9 : 0.25} />}
    </g>
  );
}

/**
 * Icon and text centred in a box: side by side, or the icon above the text
 * when the box is tall. The text stays its own <text> element (tests and
 * screen readers find a button by its label). Without room the icon is left out.
 */
function IconLabel({ x, y, w, h, icon, text, color, size, weight, t, dy = 0, inset = 0 }: {
  x: number; y: number; w: number; h: number; icon: HmiIconName | null; text: string; color: string; size: number; weight: number; t: HmiTheme; dy?: number;
  /** Room kept free on both sides of the centred text (the password lock badge in the top-right corner). */
  inset?: number;
}) {
  const cx = x + w / 2, cy = y + h / 2 + dy;
  // Bold upper-case labels run about a tenth wider than the width estimate: fit them into less room.
  const k = t.shape.upper && weight >= 600 ? 1.12 : 1;
  const avail = w - 16 - 2 * inset;
  // Icon above the text in tall boxes, unless a second line (interlock state) needs the room.
  const stacked = icon && h >= 72 && w >= 64 && dy === 0;
  if (icon && stacked) {
    const is = Math.min(26, h * 0.32);
    const fs = fitSize(text, avail / k, size, 10);
    const top = cy - (is + 6 + fs) / 2;
    return (
      <g>
        <HmiIcon name={icon} x={cx - is / 2} y={top} size={is} color={color} />
        <text x={cx} y={top + is + 6 + fs / 2} fill={color} fontSize={fs} fontFamily={t.font} fontWeight={weight} textAnchor="middle" dominantBaseline="central"
          style={{ pointerEvents: 'none' }}>{fitText(text, avail / k, fs)}</text>
      </g>
    );
  }
  const is = Math.max(12, Math.min(20, h * 0.36));
  const withIcon = icon && textWidth(text, 10) * k <= avail - is - 7;
  const textAvail = withIcon ? avail - is - 7 : avail;
  const fs = fitSize(text, textAvail / k, size, 10);
  const shown = fitText(text, textAvail / k, fs);
  if (!withIcon) {
    return <text x={cx} y={cy} fill={color} fontSize={fs} fontFamily={t.font} fontWeight={weight} textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none' }}>{shown}</text>;
  }
  const groupW = is + 7 + Math.min(textAvail, textWidth(shown, fs) * k);
  const left = cx - groupW / 2;
  return (
    <g>
      <HmiIcon name={icon} x={left} y={cy - is / 2} size={is} color={color} />
      <text x={left + is + 7} y={cy} fill={color} fontSize={fs} fontFamily={t.font} fontWeight={weight} dominantBaseline="central" style={{ pointerEvents: 'none' }}>{shown}</text>
    </g>
  );
}

/** Display / entry field: sunken (inset border) or flat, in the look's field colour. */
function Field({ x, y, w, h, t, border }: { x: number; y: number; w: number; h: number; t: HmiTheme; border?: string }) {
  return (
    <g>
      <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx={Math.min(t.shape.boxRadius, h / 2)} fill={t.field} stroke={border ?? t.line} strokeWidth={border ? 1.5 : 1} />
      {!border && t.shape.fieldInset && <path d={`M${x + 1.5} ${y + h - 2} V${y + 1.5} H${x + w - 2}`} fill="none" stroke={t.bevel} strokeWidth={1} opacity={0.7} />}
    </g>
  );
}

/** Light panel with a 1 px border (no title). */
function Box({ el, t, stroke }: { el: HmiElement; t: HmiTheme; stroke?: string }) {
  return <rect x={el.x + 0.5} y={el.y + 0.5} width={el.w - 1} height={el.h - 1} rx={Math.min(t.shape.boxRadius, el.h / 2)} fill={t.surface} stroke={stroke ?? t.line} />;
}

/** Lamp colour when ON: plain 'normal' lamps are green; E-stop lamps are always red. */
const lampColor = (el: HmiElement, t: HmiTheme) =>
  /\b(e-?stop|emergency)\b/i.test(`${el.label} ${el.onText ?? ''}`) ? t.alarm : el.style === 'normal' ? t.ok : styleColor(el.style, t);

/** A lamp in the look's shape: the off colour when off, coloured when on; with a lens highlight in glossy looks. */
function Lamp({ cx, cy, r, on, color, t }: { cx: number; cy: number; r: number; on: boolean; color: string; t: HmiTheme }) {
  const fill = on ? color : t.lampOff;
  const stroke = on ? 'rgba(0,0,0,0.28)' : t.bevel;
  const body = t.shape.lamp === 'round'
    ? <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={1} />
    : <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} rx={t.shape.lamp === 'rounded' ? r * 0.45 : 1} fill={fill} stroke={stroke} strokeWidth={1} />;
  return (
    <g>
      {body}
      {t.shape.lampGloss && <circle cx={cx - r * 0.3} cy={cy - r * 0.32} r={r * 0.32} fill="#ffffff" opacity={on ? 0.45 : 0.6} />}
    </g>
  );
}

/** Fill and text colours of a state badge (mode, alarm counter) on the header bar. */
const badgeTone = (t: HmiTheme, style: HmiStyle) =>
  style === 'alarm' ? { fill: t.alarm, stroke: t.alarm, text: '#ffffff' }
    : style === 'warning' ? { fill: t.warning, stroke: t.warning, text: onWarning(t) }
      : style === 'ok' ? { fill: t.ok, stroke: t.ok, text: '#ffffff' }
        : { fill: t.headerBadge, stroke: t.headerBadgeLine, text: t.headerText };

function Header({ el, ctx }: { el: HmiElement; ctx: Ctx }) {
  const { t } = ctx;
  const h = el.h;
  const fs = Math.max(13, Math.min(19, h * 0.38));
  const small = Math.max(11, Math.min(13, h * 0.28));
  const cy = el.y + (h - 3) / 2;
  const machine = t.caps(el.label || ctx.design?.machineName || 'Machine');
  const screenName = t.caps(ctx.screen.name);
  // Right-hand cluster, laid out right to left: clock, alarm counter, mode.
  const clockX = el.x + el.w - 12;
  const clockW = textWidth('00:00:00', fs * 0.9) + 8;
  const badgeR = Math.min(t.shape.badgeRadius, 14);
  const badgeH = Math.min(28, h - 14);
  const by = cy - badgeH / 2;
  const alarmsOn = ctx.activeCount > 0;
  const anyAlarm = ctx.rows.some((r) => r.active && r.severity === 'alarm');
  const alarmText = t.caps(alarmsOn ? `Alarms ${ctx.activeCount}` : 'No alarms');
  const alarmW = Math.max(104, textWidth(t.caps('Alarms 00'), small) + 40);
  const alarmX = clockX - clockW - 12 - alarmW;
  const alarmTone = badgeTone(t, alarmsOn ? (anyAlarm ? 'alarm' : 'warning') : 'normal');
  const modeVal = el.address && ctx.read ? Number(ctx.read(el.address)) : 0;
  const mode = el.address ? (stateFor(el.states, modeVal) ?? { value: modeVal, text: el.states?.length ? `Mode ${modeVal}` : 'Auto', style: 'normal' as const }) : null;
  const modeText = mode ? t.caps(mode.text) : '';
  const modeW = mode ? textWidth(modeText, small) + 34 : 0;
  const modeX = alarmX - 8 - modeW;
  const modeTone = badgeTone(t, mode?.style ?? 'normal');
  // Bold upper-case names run about a tenth wider than the width estimate.
  const k = t.shape.upper ? 1.12 : 1;
  const nameFs = fitSize(machine, (el.w * 0.32) / k, fs, 11);
  const nameW = Math.min(el.w * 0.32, textWidth(machine, nameFs) * k);
  const titleX = el.x + 16 + nameW + 25;
  const locked = ctx.screen.level && ctx.screen.level !== 'operator' ? ctx.screen.level : null;
  const titleMax = (mode ? modeX : alarmX) - titleX - 12 - (locked ? 26 : 0);
  return (
    <g>
      <rect x={el.x} y={el.y} width={el.w} height={h} fill={t.header} />
      {t.shape.header === 'gloss' && <rect x={el.x} y={el.y} width={el.w} height={h * 0.5} fill="#ffffff" opacity={0.1} />}
      {t.headerAccent !== t.header
        ? <rect x={el.x} y={el.y + h - 3} width={el.w} height={3} fill={t.headerAccent} />
        : <rect x={el.x} y={el.y + h - 1} width={el.w} height={1} fill={t.headerLine} />}
      <text x={el.x + 16} y={cy} fill={t.headerText} fontSize={nameFs} fontFamily={t.font} fontWeight={700} dominantBaseline="central">{fitText(machine, (el.w * 0.32) / k, nameFs)}</text>
      <rect x={el.x + 16 + nameW + 12} y={cy - fs * 0.6} width={1} height={fs * 1.2} fill={t.headerLine} />
      {titleMax > 30 && (
        <text x={titleX} y={cy} fill={t.headerDim} fontSize={fs} fontFamily={t.font} fontWeight={400} dominantBaseline="central">{fitText(screenName, titleMax, fs)}</text>
      )}
      {locked && titleMax > 30 && (
        <LockBadge x={titleX + Math.min(textWidth(screenName, fs), titleMax) + 26} y={cy - 7} letter={LEVEL_SHORT[locked]} color={t.headerDim} t={t} />
      )}
      {mode && (
        <g>
          <rect x={modeX} y={by} width={modeW} height={badgeH} rx={badgeR} fill={modeTone.fill} stroke={modeTone.stroke} />
          <circle cx={modeX + 13} cy={cy} r={4} fill={mode.style === 'normal' ? t.headerDim : modeTone.text} />
          <text x={modeX + 23} y={cy} fill={modeTone.text} fontSize={small} fontFamily={t.font} fontWeight={700} dominantBaseline="central">{modeText}</text>
        </g>
      )}
      <g style={{ cursor: el.targetScreenId ? 'pointer' : undefined }} data-nav={el.targetScreenId ?? undefined}>
        <rect x={alarmX} y={by} width={alarmW} height={badgeH} rx={badgeR} fill={alarmTone.fill} stroke={alarmTone.stroke} />
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
  const text = t.caps(latched && el.onText ? el.onText : !latched && el.offText && el.action === 'toggle' ? el.offText : el.label);
  const sub = el.interlock && el.h >= 52 ? (interlocked === true ? 'Interlocked' : interlocked === false ? 'Ready' : 'Permissive') : null;
  const size = Math.max(12, Math.min(18, el.h * 0.3));
  const sink = pressed || (latched && role !== 'neutral') ? 1 : 0;
  return (
    <g opacity={interlocked ? 0.45 : 1}>
      <Raised x={el.x} y={el.y} w={el.w} h={el.h} tone={tone} pressed={pressed || (latched && role !== 'neutral')} t={t} />
      <IconLabel x={el.x} y={el.y + sink} w={el.w} h={el.h - 2} icon={icon} text={text} color={tone.text} size={size} weight={t.shape.weight} t={t} dy={sub ? -7 : 0} inset={lockInset(el)} />
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
  const icon = iconFor(el.label, target?.name);
  const size = Math.max(12, Math.min(16, el.h * 0.3));
  const weight = active ? t.shape.weight : 400;
  if (t.shape.nav === 'tabs') {
    // Flat tab: the current screen filled and marked by a bar along its bottom edge.
    const r = Math.max(0, Math.min(t.shape.radius, el.h / 2));
    const color = active ? t.navActiveText : t.navText;
    return (
      <g>
        <rect x={el.x + 0.5} y={el.y + 0.5} width={el.w - 1} height={el.h - 1} rx={r} fill={active ? t.navActive : t.navBand} stroke={active ? t.accent : t.lineSoft} strokeOpacity={active ? 0.5 : 1} />
        {active && <rect x={el.x + Math.max(2, r)} y={el.y + el.h - 4} width={el.w - 2 * Math.max(2, r)} height={3} rx={1} fill={t.accent} />}
        <IconLabel x={el.x} y={el.y} w={el.w - (lock ? 10 : 0)} h={el.h - 2} icon={icon} text={t.caps(el.label)} color={color} size={size} weight={weight} t={t} />
        {lock && <LockBadge x={el.x + el.w - 5} y={el.y + 4} letter={LEVEL_SHORT[lock]} color={color} t={t} />}
      </g>
    );
  }
  const tone: Tone = active ? { fill: t.navActive, edge: shade(t.navActive, -0.25), text: t.navActiveText } : toneOf(t, 'neutral');
  return (
    <g>
      <Raised x={el.x} y={el.y} w={el.w} h={el.h} tone={tone} t={t} />
      <IconLabel x={el.x} y={el.y} w={el.w - (lock ? 10 : 0)} h={el.h - 2} icon={icon} text={t.caps(el.label)} color={tone.text}
        size={size} weight={weight} t={t} />
      {lock && <LockBadge x={el.x + el.w - 5} y={el.y + 4} letter={LEVEL_SHORT[lock]} color={active ? t.navActiveText : t.dim} t={t} />}
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
      <Lamp cx={el.x + 8 + r} cy={el.y + el.h / 2} r={r} on={on} color={color} t={t} />
      <text x={tx} y={el.y + el.h / 2} fill={on ? t.text : t.dim} fontSize={fs} fontFamily={t.font} fontWeight={on ? t.shape.weight : 400} dominantBaseline="central">
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
      <text x={fx + 23} y={fy + fh / 2} fill={color} fontSize={valueSize} fontFamily={t.font} fontWeight={t.shape.weight} dominantBaseline="central">{fitText(st.text, fw - 30, valueSize)}</text>
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
      <text x={fx + fw - 8 - unitsW} y={fy + fh / 2} fill={t.text} fontSize={fitSize(valueText, fw - unitsW - 16, valueSize, 10)} fontFamily={t.font} fontWeight={t.shape.weight}
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
  const lim = barLimits(el, ctx, v);
  return (
    <g>
      <text x={el.x} y={textY} fill={t.dim} fontSize={fs} fontFamily={t.font} dominantBaseline="central">{fitText(el.label, el.w * 0.6, fs)}</text>
      <text x={el.x + el.w} y={textY} fill={lim.beyond ? t.warningText : t.text} fontSize={fs + 1} fontFamily={t.font} fontWeight={t.shape.weight} textAnchor="end" dominantBaseline="central">{valueText}</text>
      <Field x={el.x} y={ty} w={el.w} h={trackH} t={t} />
      {frac > 0 && <rect x={el.x + 2} y={ty + 2} width={Math.max(0, (el.w - 4) * frac)} height={trackH - 4} fill={lim.beyond ? t.warning : styleColor(el.style, t)} />}
      {[0.25, 0.5, 0.75].map((f) => <rect key={f} x={el.x + 2 + (el.w - 4) * f} y={ty + trackH - 5} width={1} height={3} fill={t.bevel} />)}
      {lim.marks.map((f, i) => <rect key={`lim${i}`} data-limit="" x={el.x + 1 + (el.w - 4) * f} y={ty - 1} width={2} height={trackH + 2} fill={t.warningText} />)}
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
  const line = el.style === 'normal' ? t.trend : styleColor(el.style, t);
  const reading = ctx.live ? `${value ?? 0}${el.units ? ` ${el.units}` : ''}` : (el.units ?? '');
  const readingW = reading ? textWidth(reading, 12) + 12 : 0;
  return (
    <g>
      <GroupFrame el={el} t={t} title={fitText(el.label, el.w - readingW - 24, 12)} />
      {reading && <text x={el.x + el.w - 10} y={el.y + th / 2 + 0.5} fill={frameTitle(t).text} fontSize={12} fontFamily={t.font} fontWeight={700} textAnchor="end" dominantBaseline="central">{reading}</text>}
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
      <rect x={el.x + 0.5} y={el.y + 0.5} width={el.w - 1} height={el.h - 1} rx={Math.min(t.shape.boxRadius, 8)} fill={t.field} stroke={t.line} />
      <TitleStrip x={el.x} y={el.y} w={el.w} h={headH} t={t} />
      {([['Time', el.x + 22], [el.label || 'Message', msgX], ['State', stateX]] as [string, number][]).map(([head, x]) => (
        <text key={head} x={x} y={el.y + headH / 2} fill={frameTitle(t).text} fontSize={12} fontFamily={t.font} fontWeight={700} dominantBaseline="central">{fitText(head, msgW, 12)}</text>
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
            <rect x={el.x + 8} y={y + rowH / 2 - 5} width={10} height={10} rx={t.shape.lamp === 'round' ? 5 : 1.5} fill={lit ? col : t.lampOff} stroke={lit ? 'none' : t.bevel} strokeWidth={0.75} />
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
  const color = !active.length ? t.dim : alarm ? '#ffffff' : onWarning(t);
  const fs = Math.max(12, Math.min(16, el.h * 0.42));
  const is = Math.max(12, Math.min(18, el.h * 0.5));
  const text = active.length ? `${active[0].message}${active.length > 1 ? `  (+${active.length - 1} more)` : ''}` : 'No active alarms';
  return (
    <g>
      <rect x={el.x + 0.5} y={el.y + 0.5} width={el.w - 1} height={el.h - 1} rx={Math.min(t.shape.boxRadius, el.h / 2)} fill={fill} stroke={active.length ? fill : t.line} />
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
      <text x={el.x + el.w - 10} y={el.y + el.h / 2} fill={t.text} fontSize={fs} fontFamily={t.font} fontWeight={t.shape.weight} textAnchor="end" dominantBaseline="central">{fmtTime(ctx.now)}</text>
    </g>
  );
}

function Text({ el, ctx }: { el: HmiElement; ctx: Ctx }) {
  const { t } = ctx;
  if (el.h >= 32) {
    const fs = Math.min(26, el.h * 0.58);
    return (
      <text x={el.x} y={el.y + el.h / 2} fill={t.text} fontSize={fs} fontFamily={t.font} fontWeight={t.shape.weight} dominantBaseline="central" style={{ pointerEvents: 'none' }}>
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

/** One element in a panel look (kinds listed in PANEL_KINDS). */
export function PanelElement({ el, value, ctx }: { el: HmiElement; value: boolean | number | undefined; ctx: Ctx }) {
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
 * Navigation band behind the bottom row of screen buttons (WinCC F-key bar, tab strip):
 * the look's band colour with a top edge. Drawn only when the screen buttons sit along the bottom.
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
      <rect x={0} y={y} width={widthPx} height={heightPx - y} fill={t.navBand} />
      <rect x={0} y={y} width={widthPx} height={1} fill={t.line} />
    </g>
  );
}
