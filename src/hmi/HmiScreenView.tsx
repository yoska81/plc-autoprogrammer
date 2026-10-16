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

// High-performance (ISA-101 style) palette: grey world, color only for abnormal states.
const C = {
  screen: '#d4d7dc',
  panel: '#c3c7cd',
  button: '#e9ebee',
  buttonDown: '#9ca3af',
  nav: '#5b6472',
  text: '#1f2933',
  dim: '#4b5563',
  lampOff: '#7b818a',
  ok: '#2f9e44',
  warning: '#f59f00',
  alarm: '#e03131',
  lampOn: '#f8f9fa',
  field: '#ffffff',
  select: '#2563eb',
};

const onColor = (style: HmiElement['style']) =>
  style === 'alarm' ? C.alarm : style === 'warning' ? C.warning : style === 'ok' ? C.ok : C.lampOn;

function Label({ el, children, color = C.text, size }: { el: HmiElement; children: string; color?: string; size?: number }) {
  const fs = size ?? Math.max(11, Math.min(20, el.h * 0.32));
  return (
    <text x={el.x + el.w / 2} y={el.y + el.h / 2} fill={color} fontSize={fs} fontFamily="Arial, Helvetica, sans-serif"
      textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none' }}>{children}</text>
  );
}

function ElementShape({ el, value, alarms }: { el: HmiElement; value: boolean | number | undefined; alarms: string[] }) {
  const on = Boolean(value);
  switch (el.kind) {
    case 'button': {
      const latched = el.action === 'toggle' && on;
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={6} fill={latched ? C.buttonDown : C.button} stroke="#6b7280" strokeWidth={1.5} />
          <Label el={el}>{latched && el.onText ? el.onText : !latched && el.offText && el.action === 'toggle' ? el.offText : el.label}</Label>
        </g>
      );
    }
    case 'nav':
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={4} fill={C.nav} />
          <Label el={el} color="#ffffff">{el.label}</Label>
        </g>
      );
    case 'indicator': {
      const r = Math.min(el.h / 2 - 4, 14);
      return (
        <g>
          <circle cx={el.x + r + 4} cy={el.y + el.h / 2} r={r} fill={on ? onColor(el.style) : C.lampOff} stroke="#374151" strokeWidth={1} />
          <text x={el.x + 2 * r + 12} y={el.y + el.h / 2} fill={C.text} fontSize={Math.max(11, Math.min(18, el.h * 0.4))} fontFamily="Arial, Helvetica, sans-serif" dominantBaseline="central">
            {on && el.onText ? el.onText : !on && el.offText ? el.offText : el.label}
          </text>
        </g>
      );
    }
    case 'numeric':
    case 'numeric-entry': {
      const v = typeof value === 'number' ? value : value === undefined ? 0 : Number(value);
      const labelW = Math.min(el.w * 0.55, 220);
      return (
        <g>
          <text x={el.x} y={el.y + el.h / 2} fill={C.dim} fontSize={Math.max(11, Math.min(16, el.h * 0.35))} fontFamily="Arial, Helvetica, sans-serif" dominantBaseline="central">{el.label}</text>
          <rect x={el.x + labelW} y={el.y + 4} width={el.w - labelW} height={el.h - 8} fill={el.kind === 'numeric-entry' ? C.field : C.panel} stroke="#6b7280" />
          <text x={el.x + el.w - 6} y={el.y + el.h / 2} fill={C.text} fontSize={Math.max(12, Math.min(20, el.h * 0.42))} fontFamily="'Courier New', monospace" textAnchor="end" dominantBaseline="central">
            {`${v}${el.units ? ` ${el.units}` : ''}`}
          </text>
        </g>
      );
    }
    case 'bar': {
      const v = typeof value === 'number' ? value : 0;
      const min = el.min ?? 0;
      const max = el.max ?? 100;
      const frac = Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} fill={C.panel} stroke="#6b7280" />
          <rect x={el.x} y={el.y} width={el.w * frac} height={el.h} fill={C.nav} />
          <Label el={el} color={C.text}>{`${el.label} ${v}${el.units ? ` ${el.units}` : ''}`}</Label>
        </g>
      );
    }
    case 'alarm-banner': {
      const active = alarms.length > 0;
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} fill={active ? C.alarm : C.panel} />
          <text x={el.x + 10} y={el.y + el.h / 2} fill={active ? '#ffffff' : C.dim} fontSize={Math.max(11, Math.min(18, el.h * 0.45))}
            fontFamily="Arial, Helvetica, sans-serif" dominantBaseline="central">
            {active ? `ALARM: ${alarms[0]}${alarms.length > 1 ? ` (+${alarms.length - 1} more)` : ''}` : 'No active alarms'}
          </text>
        </g>
      );
    }
    case 'text':
    default:
      return <Label el={el} color={C.text}>{el.label}</Label>;
  }
}

export default function HmiScreenView({ screen, widthPx, heightPx, read, onPress, onNavigate, activeAlarms = [], selectedId, onSelect }: HmiScreenViewProps) {
  return (
    <svg viewBox={`0 0 ${widthPx} ${heightPx}`} className="w-full h-auto max-h-full block" role="img" aria-label={`HMI screen: ${screen.name}`}
      style={{ background: C.screen, borderRadius: 4 }}>
      <rect x={0} y={0} width={widthPx} height={heightPx} fill={C.screen} />
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
            <ElementShape el={el} value={value} alarms={activeAlarms} />
            {selectedId === el.id && <rect x={el.x - 3} y={el.y - 3} width={el.w + 6} height={el.h + 6} fill="none" stroke={C.select} strokeWidth={3} strokeDasharray="6 4" />}
          </g>
        );
      })}
    </svg>
  );
}
