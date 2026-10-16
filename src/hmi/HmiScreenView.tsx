import type { HmiElement, HmiScreen } from './types';

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
  /** Active alarm messages for the alarm banner. */
  activeAlarms?: string[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

// Minimal dark console style (Tesla / SpaceX look): near-black world, thin
// lines, one accent; colour only carries meaning (ok / warning / alarm), which
// also follows ISA-101 high-performance practice.
const C = {
  screen: '#0a0c0f',
  surface: '#15181d',
  surfaceUp: '#1d2128',
  line: '#2b3038',
  text: '#eef0f3',
  dim: '#8b929d',
  faint: '#5a616c',
  accent: '#3e6ae1',
  ok: '#33c47a',
  warning: '#f2a93b',
  alarm: '#e5484d',
  select: '#7aa2ff',
};
const FONT = "Barlow, 'D-DIN', 'Segoe UI', Arial, sans-serif";

const onColor = (style: HmiElement['style']) =>
  style === 'alarm' ? C.alarm : style === 'warning' ? C.warning : style === 'ok' ? C.ok : C.accent;

const caps = (s: string) => s.toUpperCase();

function Label({ el, children, color = C.text, size, weight = 500, spacing = 1.5 }: { el: HmiElement; children: string; color?: string; size?: number; weight?: number; spacing?: number }) {
  const fs = size ?? Math.max(11, Math.min(18, el.h * 0.3));
  return (
    <text x={el.x + el.w / 2} y={el.y + el.h / 2} fill={color} fontSize={fs} fontFamily={FONT} fontWeight={weight} letterSpacing={spacing}
      textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none' }}>{children}</text>
  );
}

function ElementShape({ el, value, alarms, screenId }: { el: HmiElement; value: boolean | number | undefined; alarms: string[]; screenId: string }) {
  const on = Boolean(value);
  const r = Math.min(12, el.h / 2);
  switch (el.kind) {
    case 'button': {
      const latched = el.action === 'toggle' && on;
      const danger = el.style === 'alarm';
      const fill = latched ? C.accent : danger ? '#2a1517' : C.surfaceUp;
      const stroke = latched ? C.accent : danger ? C.alarm : C.line;
      const text = latched && el.onText ? el.onText : !latched && el.offText && el.action === 'toggle' ? el.offText : el.label;
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={fill} stroke={stroke} strokeWidth={1} />
          <Label el={el} color={danger && !latched ? '#ff8b8f' : C.text}>{caps(text)}</Label>
        </g>
      );
    }
    case 'nav': {
      const active = el.targetScreenId === screenId;
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={active ? C.surfaceUp : 'transparent'} />
          <Label el={el} color={active ? C.text : C.dim} weight={active ? 600 : 500} spacing={2}>{caps(el.label)}</Label>
          {active && <rect x={el.x + el.w * 0.3} y={el.y + el.h - 4} width={el.w * 0.4} height={2} rx={1} fill={C.accent} />}
        </g>
      );
    }
    case 'indicator': {
      const color = on ? onColor(el.style) : C.faint;
      const d = Math.min(el.h * 0.28, 7);
      const text = on && el.onText ? el.onText : !on && el.offText ? el.offText : el.label;
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={C.surface} stroke={on && el.style !== 'normal' ? color : C.line} strokeOpacity={on && el.style !== 'normal' ? 0.6 : 1} />
          {on && <circle cx={el.x + 16 + d} cy={el.y + el.h / 2} r={d * 2.2} fill={color} opacity={0.18} />}
          <circle cx={el.x + 16 + d} cy={el.y + el.h / 2} r={d} fill={color} />
          <text x={el.x + 28 + 2 * d} y={el.y + el.h / 2} fill={on ? C.text : C.dim} fontSize={Math.max(11, Math.min(16, el.h * 0.34))} fontFamily={FONT} fontWeight={500} letterSpacing={1.2} dominantBaseline="central">
            {caps(text)}
          </text>
        </g>
      );
    }
    case 'numeric':
    case 'numeric-entry': {
      const v = typeof value === 'number' ? value : value === undefined ? 0 : Number(value);
      const entry = el.kind === 'numeric-entry';
      const labelSize = Math.max(10, Math.min(13, el.h * 0.22));
      const valueSize = Math.max(14, Math.min(34, el.h * 0.5));
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={C.surface} stroke={entry ? C.accent : C.line} strokeOpacity={entry ? 0.7 : 1} />
          <text x={el.x + 14} y={el.y + el.h / 2} fill={C.dim} fontSize={labelSize} fontFamily={FONT} fontWeight={500} letterSpacing={1.5} dominantBaseline="central">{caps(el.label)}</text>
          <text x={el.x + el.w - 14 - (el.units ? labelSize * 2.6 : 0)} y={el.y + el.h / 2} fill={C.text} fontSize={valueSize} fontFamily={FONT} fontWeight={300} textAnchor="end" dominantBaseline="central">{String(v)}</text>
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
          <text x={el.x} y={el.y + (el.h - trackH) / 2} fill={C.dim} fontSize={Math.max(10, Math.min(13, el.h * 0.24))} fontFamily={FONT} fontWeight={500} letterSpacing={1.5} dominantBaseline="central">{caps(el.label)}</text>
          <text x={el.x + el.w} y={el.y + (el.h - trackH) / 2} fill={C.text} fontSize={Math.max(12, Math.min(20, el.h * 0.32))} fontFamily={FONT} fontWeight={300} textAnchor="end" dominantBaseline="central">{`${v}${el.units ? ` ${el.units}` : ''}`}</text>
          <rect x={el.x} y={ty} width={el.w} height={trackH} rx={trackH / 2} fill={C.surfaceUp} />
          <rect x={el.x} y={ty} width={el.w * frac} height={trackH} rx={trackH / 2} fill={onColor(el.style)} />
        </g>
      );
    }
    case 'alarm-banner': {
      const active = alarms.length > 0;
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill={active ? C.alarm : C.surface} stroke={active ? C.alarm : C.line} />
          <circle cx={el.x + 18} cy={el.y + el.h / 2} r={4} fill={active ? '#ffffff' : C.ok} />
          <text x={el.x + 32} y={el.y + el.h / 2} fill={active ? '#ffffff' : C.dim} fontSize={Math.max(11, Math.min(16, el.h * 0.4))}
            fontFamily={FONT} fontWeight={500} letterSpacing={1.2} dominantBaseline="central">
            {active ? caps(`${alarms[0]}${alarms.length > 1 ? `  +${alarms.length - 1} more` : ''}`) : 'SYSTEM NOMINAL'}
          </text>
        </g>
      );
    }
    case 'text':
    default: {
      // Titles (taller text) are left-aligned and light, like a console heading.
      if (el.h >= 32) {
        return (
          <text x={el.x} y={el.y + el.h / 2} fill={C.text} fontSize={Math.min(30, el.h * 0.62)} fontFamily={FONT} fontWeight={300} letterSpacing={3}
            dominantBaseline="central" style={{ pointerEvents: 'none' }}>{caps(el.label)}</text>
        );
      }
      return <Label el={el} color={C.dim} spacing={1.5}>{caps(el.label)}</Label>;
    }
  }
}

export default function HmiScreenView({ screen, widthPx, heightPx, read, onPress, onNavigate, activeAlarms = [], selectedId, onSelect }: HmiScreenViewProps) {
  return (
    <svg viewBox={`0 0 ${widthPx} ${heightPx}`} className="w-full h-auto max-h-full block" role="img" aria-label={`HMI screen: ${screen.name}`}
      style={{ background: C.screen, borderRadius: 10 }}>
      <defs>
        <radialGradient id="hmi-glow" cx="50%" cy="0%" r="90%">
          <stop offset="0%" stopColor="#1b2230" />
          <stop offset="100%" stopColor={C.screen} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={widthPx} height={heightPx} fill="url(#hmi-glow)" />
      {screen.elements.map((el) => {
        const value = el.address && read ? read(el.address) : undefined;
        const interactive = (el.kind === 'button' && onPress) || (el.kind === 'nav' && onNavigate) || onSelect;
        return (
          <g
            key={el.id}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
            onPointerDown={(e) => {
              if (onSelect) { onSelect(el.id); return; }
              if (el.kind === 'button' && onPress) { (e.target as Element).setPointerCapture?.(e.pointerId); onPress(el, true); }
              if (el.kind === 'nav' && el.targetScreenId && onNavigate) onNavigate(el.targetScreenId);
            }}
            onPointerUp={() => { if (!onSelect && el.kind === 'button' && onPress) onPress(el, false); }}
            onPointerCancel={() => { if (!onSelect && el.kind === 'button' && onPress) onPress(el, false); }}
          >
            <ElementShape el={el} value={value} alarms={activeAlarms} screenId={screen.id} />
            {selectedId === el.id && <rect x={el.x - 3} y={el.y - 3} width={el.w + 6} height={el.h + 6} fill="none" stroke={C.select} strokeWidth={2} strokeDasharray="6 4" />}
          </g>
        );
      })}
    </svg>
  );
}
