
import type { HmiIconName } from './iconRules';

/**
 * Small line icons for HMI buttons and navigation tiles (Siemens look), drawn
 * in a 24×24 box and scaled to the requested size.
 */

/** Icon at (x, y) top-left, `size` px square. Filled shapes for play/stop, strokes for the rest. */
export function HmiIcon({ name, x, y, size, color }: { name: HmiIconName; x: number; y: number; size: number; color: string }) {
  const s = size / 24;
  const stroke = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  let body;
  switch (name) {
    case 'play': body = <path d="M7 4.5 L19.5 12 L7 19.5 Z" fill={color} />; break;
    case 'stop': body = <rect x={5} y={5} width={14} height={14} rx={1.5} fill={color} />; break;
    case 'reset': body = <g {...stroke}><path d="M19.5 12 A7.5 7.5 0 1 1 16.8 6.2" /><path d="M17.5 2.5 L17.2 6.6 L13.1 6.3" /></g>; break;
    case 'home': body = <g {...stroke}><path d="M3.5 11.5 L12 4 L20.5 11.5" /><path d="M6 10 V20 H18 V10" /><path d="M10 20 V14.5 H14 V20" /></g>; break;
    case 'hand': body = (
      <g {...stroke}>
        <path d="M8 13 V5.5 a1.5 1.5 0 0 1 3 0 V11" />
        <path d="M11 11 V4.5 a1.5 1.5 0 0 1 3 0 V11" />
        <path d="M14 11 V5.5 a1.5 1.5 0 0 1 3 0 V12" />
        <path d="M17 9 a1.5 1.5 0 0 1 3 0 V14 a7 7 0 0 1 -7 7 h-1 a7 7 0 0 1 -5.5 -2.7 L3.6 14.6 a1.6 1.6 0 0 1 2.5 -2 L8 14.5" />
      </g>
    ); break;
    case 'gear': body = (
      <g {...stroke}>
        <circle cx={12} cy={12} r={3} />
        <path d="M12 2.5 v3 M12 18.5 v3 M2.5 12 h3 M18.5 12 h3 M5.3 5.3 l2.1 2.1 M16.6 16.6 l2.1 2.1 M5.3 18.7 l2.1 -2.1 M16.6 7.4 l2.1 -2.1" />
        <circle cx={12} cy={12} r={6.5} />
      </g>
    ); break;
    case 'warning': body = (
      <g>
        <path d="M12 3 L22 20.5 H2 Z" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        <rect x={11} y={9} width={2} height={6} rx={1} fill={color} />
        <circle cx={12} cy={17.6} r={1.2} fill={color} />
      </g>
    ); break;
    case 'search': body = <g {...stroke}><circle cx={10.5} cy={10.5} r={6} /><path d="M15 15 L20.5 20.5" strokeWidth={2.6} /></g>; break;
    case 'wrench': body = <g {...stroke}><path d="M14.5 3.6 a5 5 0 0 0 -5.6 6.7 L3.6 15.6 a2.1 2.1 0 0 0 3 3 L11.9 13.3 a5 5 0 0 0 6.7 -5.6 L15.6 10.6 L13.4 10.6 L13.4 8.4 Z" /></g>; break;
    case 'power': body = <g {...stroke}><path d="M12 3 V11" /><path d="M7 6.5 a7.5 7.5 0 1 0 10 0" /></g>; break;
    case 'list': body = <g {...stroke}><path d="M9 6 H20 M9 12 H20 M9 18 H20" /><path d="M4.5 6 h.01 M4.5 12 h.01 M4.5 18 h.01" strokeWidth={2.8} /></g>; break;
    case 'chart': body = <g {...stroke}><path d="M3.5 20 H20.5" /><path d="M4 16 L9 10.5 L13 13.5 L20 6" /></g>; break;
  }
  return <g transform={`translate(${x} ${y}) scale(${s})`} style={{ pointerEvents: 'none' }} aria-hidden="true">{body}</g>;
}
