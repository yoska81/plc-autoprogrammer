import type { HmiElement, MachineSymbol } from './types';
import { C, FONT, caps, fitText } from './theme';

/** Small padlock with the level letter (M = maintenance, E = engineer), anchored at its top-right corner. */
export function LockBadge({ x, y, letter, color = C.dim }: { x: number; y: number; letter: string; color?: string }) {
  const bx = x - 11 - (letter ? 9 : 0);
  return (
    <g style={{ pointerEvents: 'none' }} aria-label="password protected">
      <path d={`M${bx + 2.5} ${y + 6} v-2.2 a3 3 0 0 1 6 0 v2.2`} fill="none" stroke={color} strokeWidth={1.3} />
      <rect x={bx + 1} y={y + 6} width={9} height={7} rx={1.5} fill={color} />
      {letter && <text x={bx + 12} y={y + 9.8} fill={color} fontSize={9} fontFamily={FONT} fontWeight={600} dominantBaseline="central">{letter}</text>}
    </g>
  );
}

/** One symbol of a machine graphic, in absolute panel coordinates. */
export function MachineSymbolShape({ s, ox, oy, on, live }: { s: MachineSymbol; ox: number; oy: number; on: boolean; live: boolean }) {
  const x = ox + s.x, y = oy + s.y, w = s.w, h = s.h;
  const active = on && live;
  const stroke = active ? C.text : C.dim;
  const label = s.label ? caps(s.label) : '';
  const fs = 10;
  const labelEl = label && s.kind !== 'station' ? (
    <text x={x + w / 2} y={y + h + 12} fill={active ? C.text : C.dim} fontSize={fs} fontFamily={FONT} fontWeight={500} letterSpacing={1}
      textAnchor="middle" dominantBaseline="central">{fitText(label, Math.max(w + 40, 60), fs, 1)}</text>
  ) : null;
  switch (s.kind) {
    case 'conveyor': {
      const r = h / 2;
      const chevrons = [];
      const step = 22;
      for (let cx = x + r + 10; cx < x + w - r - 6; cx += step) {
        chevrons.push(<path key={cx} d={`M${cx} ${y + h * 0.3} l5 ${h * 0.2} l-5 ${h * 0.2}`} fill="none" stroke={active ? C.ok : C.faint} strokeWidth={1.5} />);
      }
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={r} fill={active ? 'rgba(51,196,122,0.08)' : C.surface} stroke={active ? C.ok : C.line} />
          <circle cx={x + r} cy={y + r} r={r * 0.55} fill="none" stroke={stroke} strokeWidth={1.2} />
          <circle cx={x + w - r} cy={y + r} r={r * 0.55} fill="none" stroke={stroke} strokeWidth={1.2} />
          {chevrons}
          {labelEl}
        </g>
      );
    }
    case 'motor':
    case 'pump': {
      const r = Math.min(w, h) / 2;
      const cx = x + w / 2, cy = y + h / 2;
      return (
        <g>
          <circle cx={cx} cy={cy} r={r} fill={active ? 'rgba(51,196,122,0.12)' : C.surface} stroke={active ? C.ok : C.line} strokeWidth={1.3} />
          {s.kind === 'motor'
            ? <text x={cx} y={cy} fill={active ? C.ok : C.dim} fontSize={r * 0.9} fontFamily={FONT} fontWeight={600} textAnchor="middle" dominantBaseline="central">M</text>
            : <path d={`M${cx - r * 0.45} ${cy - r * 0.55} L${cx + r * 0.6} ${cy} L${cx - r * 0.45} ${cy + r * 0.55} Z`} fill={active ? C.ok : C.dim} />}
          {labelEl}
        </g>
      );
    }
    case 'cylinder': {
      const vertical = h > w;
      if (vertical) {
        // Top view: barrel on top, rod extends downwards.
        const bh = h * 0.55;
        const rodLen = active ? h - bh : (h - bh) * 0.25;
        return (
          <g>
            <rect x={x} y={y} width={w} height={bh} rx={3} fill={C.surface} stroke={active ? C.accent : C.line} strokeWidth={1.3} />
            <rect x={x + 3} y={y + bh * (active ? 0.92 : 0.18)} width={w - 6} height={4} fill={active ? C.accent : C.dim} />
            <rect x={x + w / 2 - 2.5} y={y + bh} width={5} height={rodLen} fill={active ? C.accent : C.dim} />
            <rect x={x + w * 0.15} y={y + bh + rodLen - 3} width={w * 0.7} height={6} rx={1.5} fill={active ? C.accent : C.dim} />
            {label && <text x={x + w + 8} y={y + bh / 2} fill={active ? C.text : C.dim} fontSize={fs} fontFamily={FONT} fontWeight={500} letterSpacing={1} dominantBaseline="central">{fitText(label, 90, fs, 1)}</text>}
          </g>
        );
      }
      const bw = w * 0.55, bh = h;
      const rodLen = active ? w - bw : (w - bw) * 0.25;
      return (
        <g>
          <rect x={x} y={y} width={bw} height={bh} rx={3} fill={C.surface} stroke={active ? C.accent : C.line} strokeWidth={1.3} />
          <rect x={x + bw * (active ? 0.92 : 0.18)} y={y + 3} width={4} height={bh - 6} fill={active ? C.accent : C.dim} />
          <rect x={x + bw} y={y + bh / 2 - 2.5} width={rodLen} height={5} fill={active ? C.accent : C.dim} />
          <rect x={x + bw + rodLen - 3} y={y + bh * 0.15} width={6} height={bh * 0.7} rx={1.5} fill={active ? C.accent : C.dim} />
          {labelEl}
        </g>
      );
    }
    case 'sensor': {
      const r = Math.min(h, 14) / 2;
      const cy = y + h / 2;
      return (
        <g>
          <line x1={x + 2 * r} y1={cy} x2={x + w} y2={cy} stroke={active ? C.warning : C.faint} strokeWidth={active ? 1.6 : 1} strokeDasharray={active ? undefined : '3 4'} />
          <rect x={x} y={cy - r} width={2 * r} height={2 * r} rx={2} fill={active ? C.warning : C.surface} stroke={active ? C.warning : C.dim} />
          {labelEl}
        </g>
      );
    }
    case 'valve': {
      const cx = x + w / 2, cy = y + h / 2;
      const d = `M${x} ${y} L${cx} ${cy} L${x} ${y + h} Z M${x + w} ${y} L${cx} ${cy} L${x + w} ${y + h} Z`;
      return <g><path d={d} fill={active ? C.accent : C.surface} stroke={active ? C.accent : C.dim} strokeWidth={1.2} />{labelEl}</g>;
    }
    case 'tank':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={Math.min(10, w / 4)} fill={C.surface} stroke={active ? C.accent : C.line} />
          {active && <rect x={x + 3} y={y + h * 0.4} width={w - 6} height={h * 0.6 - 3} rx={4} fill={C.accent} opacity={0.35} />}
          {labelEl}
        </g>
      );
    case 'light': {
      const r = Math.min(w, h) / 2;
      return (
        <g>
          {active && <circle cx={x + w / 2} cy={y + h / 2} r={r * 1.7} fill={C.ok} opacity={0.15} />}
          <circle cx={x + w / 2} cy={y + h / 2} r={r} fill={active ? C.ok : C.surface} stroke={active ? C.ok : C.dim} />
          {labelEl}
        </g>
      );
    }
    case 'part':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={3} fill={active ? C.warning : 'none'} fillOpacity={active ? 0.9 : 0} stroke={active ? C.warning : C.faint} strokeDasharray={active ? undefined : '3 3'} />
          {labelEl}
        </g>
      );
    case 'station':
    default:
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={6} fill="none" stroke={active ? C.dim : C.line} strokeDasharray="5 4" />
          {label && <text x={x + 8} y={y + 11} fill={C.faint} fontSize={9} fontFamily={FONT} fontWeight={600} letterSpacing={1.2} dominantBaseline="central">{fitText(label, w - 12, 9, 1.2)}</text>}
        </g>
      );
  }
}

/** Frame and symbols of a 'machine' element. */
export function MachineGraphic({ el, read }: { el: HmiElement; read?: (address: string) => boolean | number }) {
  return (
    <g>
      <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={10} fill={C.panel} stroke={C.lineSoft} />
      {el.label && <text x={el.x + 14} y={el.y + 16} fill={C.faint} fontSize={10} fontFamily={FONT} fontWeight={600} letterSpacing={1.6} dominantBaseline="central">{fitText(caps(el.label), el.w - 28, 10, 1.6)}</text>}
      {(el.symbols ?? []).map((s, i) => (
        <MachineSymbolShape key={i} s={s} ox={el.x} oy={el.y} on={s.address && read ? Boolean(read(s.address)) : false} live={Boolean(read)} />
      ))}
    </g>
  );
}
