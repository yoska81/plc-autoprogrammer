/**
 * Realistic front views of back-panel devices, drawn in mm at the rectangle the layout
 * engine placed them in. Terminal screws come from pinLayout() so the wiring lines up.
 */
import type { ReactNode } from 'react';
import type { DeviceView, PinLayout } from './scene';
import { ioCounts, isTransformer, polesOf, relayStyle, stripGeometry } from './scene';

type P = { d: DeviceView; pins: PinLayout; p: string };

const rnum = (d: DeviceView, ...keys: string[]): number | undefined => {
  for (const k of keys) {
    const v = d.part?.ratings[k];
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return undefined;
};
const rstr = (d: DeviceView, ...keys: string[]): string | undefined => {
  for (const k of keys) { const v = d.part?.ratings[k]; if (v !== undefined && v !== '') return String(v); }
  return undefined;
};

export function T({ x, y, size, fill = '#2a2c2f', anchor = 'middle', weight, rotate, children, family, opacity }: {
  x: number; y: number; size: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; weight?: number | string; rotate?: number; children: ReactNode; family?: string; opacity?: number;
}) {
  return (
    <text x={x} y={y} fontSize={size} fill={fill} textAnchor={anchor} fontWeight={weight} fontFamily={family} opacity={opacity}
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined} style={{ userSelect: 'none' }}>
      {children}
    </text>
  );
}

export function Screw({ x, y, r = 1.6, p, recess = true, angle = 35 }: { x: number; y: number; r?: number; p: string; recess?: boolean; angle?: number }) {
  const a = (angle * Math.PI) / 180;
  const dx = Math.cos(a) * r * 0.75, dy = Math.sin(a) * r * 0.75;
  return (
    <g>
      {recess && <rect x={x - r - 0.9} y={y - r - 0.9} width={2 * r + 1.8} height={2 * r + 1.8} rx={0.6} fill="#3a3d41" opacity={0.55} />}
      <circle cx={x} cy={y} r={r} fill={`url(#${p}-screw)`} stroke="#5d6368" strokeWidth={0.2} />
      <line x1={x - dx} y1={y - dy} x2={x + dx} y2={y + dy} stroke="#3a3f44" strokeWidth={r * 0.32} strokeLinecap="round" />
      <line x1={x + dy} y1={y - dx} x2={x - dy} y2={y + dx} stroke="#3a3f44" strokeWidth={r * 0.32} strokeLinecap="round" />
    </g>
  );
}

/** Body with soft bevel (light top-left edge, darker bottom-right edge). */
function Body({ x, y, w, h, rx = 1.8, fill, stroke = '#8f938e' }: { x: number; y: number; w: number; h: number; rx?: number; fill: string; stroke?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} stroke={stroke} strokeWidth={0.35} />
      <path d={`M${x + rx} ${y + 0.45} H${x + w - rx} M${x + 0.45} ${y + rx} V${y + h - rx}`} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={0.5} fill="none" />
      <path d={`M${x + rx} ${y + h - 0.4} H${x + w - rx} M${x + w - 0.4} ${y + rx} V${y + h - rx}`} stroke="#000000" strokeOpacity={0.18} strokeWidth={0.6} fill="none" />
    </g>
  );
}

function Led({ x, y, r = 0.9, color, on = true, p }: { x: number; y: number; r?: number; color: string; on?: boolean; p: string }) {
  return on
    ? <g filter={`url(#${p}-ledGlow)`}><circle cx={x} cy={y} r={r} fill={color} /><circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.35} fill="#fff" opacity={0.7} /></g>
    : <circle cx={x} cy={y} r={r} fill={color} opacity={0.35} stroke="#000" strokeOpacity={0.25} strokeWidth={0.15} />;
}

function Screws({ pins, p, r }: { pins: PinLayout; p: string; r?: number }) {
  return <g>{[...pins.top, ...pins.bottom].map((q, i) => <Screw key={i} x={q.x} y={q.y} p={p} r={r} />)}</g>;
}

// ---------------------------------------------------------------------------

function Breaker({ d, pins, p }: P) {
  const { x, y, w, h } = d.rect;
  const n = polesOf(d, 1);
  const pw = w / n;
  const amps = rnum(d, 'amps');
  const curve = rstr(d, 'curve') ?? '';
  const label = d.category === 'fuse' ? (amps ? `${amps}A` : '') : `${curve}${amps ?? ''}`;
  const cy = y + h / 2;
  const fuse = d.category === 'fuse';
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const px = x + i * pw, cx = px + pw / 2;
        return (
          <g key={i}>
            <Body x={px + 0.2} y={y} w={pw - 0.4} h={h} rx={1.6} fill={`url(#${p}-devLight)`} />
            <rect x={px + 1.4} y={y + 1.4} width={pw - 2.8} height={11} rx={1} fill="#d4d7d2" stroke="#b0b4af" strokeWidth={0.25} />
            <rect x={px + 1.4} y={y + h - 12.4} width={pw - 2.8} height={11} rx={1} fill="#d4d7d2" stroke="#b0b4af" strokeWidth={0.25} />
            <rect x={px + 1} y={y + h * 0.22} width={pw - 2} height={h * 0.56} rx={1.4} fill={`url(#${p}-devLightV)`} stroke="#a9ada8" strokeWidth={0.3} />
            {fuse ? (
              <g>
                <rect x={cx - pw * 0.32} y={cy - 16} width={pw * 0.64} height={32} rx={1.5} fill="#5b6066" stroke="#3b3f44" strokeWidth={0.3} />
                <rect x={cx - pw * 0.18} y={cy - 9} width={pw * 0.36} height={14} rx={0.8} fill="#e9e3cf" stroke="#9c947a" strokeWidth={0.2} />
                <rect x={cx - pw * 0.25} y={cy - 15} width={pw * 0.5} height={3} rx={0.8} fill="#2a2c2f" />
              </g>
            ) : (
              <g>
                <rect x={cx - 3.2} y={cy - 10} width={6.4} height={20} rx={1.3} fill="#26282b" />
                <rect x={cx - 2.6} y={cy - 9.6} width={5.2} height={10.6} rx={1.1} fill={`url(#${p}-devBlack)`} />
                <rect x={cx - 2.1} y={cy - 9.1} width={4.2} height={1.6} rx={0.6} fill="#ffffff" opacity={0.25} />
                <rect x={cx - 1.6} y={y + h * 0.22 + 3} width={3.2} height={2.2} rx={0.4} fill="#d23b2b" />
              </g>
            )}
            {label && <T x={cx} y={y + h * 0.78 - 3} size={Math.min(3.6, pw * 0.22)} weight={700}>{label}</T>}
          </g>
        );
      })}
      {n > 1 && !fuse && <rect x={x + pw / 2 - 2.4} y={cy - 6.4} width={(n - 1) * pw + 4.8} height={2.4} rx={0.8} fill="#2f3134" />}
      <T x={x + w / 2} y={y + h * 0.22 - 1.4} size={1.6} fill="#55595e">{d.partNumber}</T>
      <Screws pins={pins} p={p} />
    </g>
  );
}

function Disconnect({ d, pins, p }: P) {
  const { x, y, w, h } = d.rect;
  const cx = x + w / 2, cy = y + h / 2;
  const r = Math.min(w, h) * 0.3;
  const amps = rnum(d, 'amps');
  return (
    <g>
      <Body x={x} y={y} w={w} h={h} rx={2.2} fill={`url(#${p}-devDark)`} stroke="#1d1f22" />
      <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={11.5} rx={1} fill="#4d5258" />
      <rect x={x + 1.5} y={y + h - 13} width={w - 3} height={11.5} rx={1} fill="#4d5258" />
      <circle cx={cx} cy={cy} r={r + 2.5} fill="#2b2e32" stroke="#5d6268" strokeWidth={0.4} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${p}-devBlack)`} stroke="#6b7177" strokeWidth={0.3} />
      <T x={cx - r - 0.2} y={cy + 1} size={2.6} fill="#e8e8e8" anchor="end" weight={700}>0</T>
      <T x={cx} y={cy - r - 0.6} size={2.6} fill="#e8e8e8" weight={700}>I</T>
      <rect x={cx - 3.2} y={cy - 3.2} width={6.4} height={6.4} fill="#0d0e10" transform={`rotate(45 ${cx} ${cy})`} />
      {d.shaft ? (
        <g>
          <polygon points={`${cx - 2.5},${cy - 2.5} ${cx + 2.5},${cy - 2.5} ${cx - 6.5},${cy + 5.5} ${cx - 11.5},${cy + 5.5}`} fill={`url(#${p}-shaft)`} stroke="#5f666c" strokeWidth={0.25} />
          <polygon points={`${cx + 2.5},${cy - 2.5} ${cx + 2.5},${cy + 2.5} ${cx - 6.5},${cy + 10.5} ${cx - 6.5},${cy + 5.5}`} fill="#7d848a" />
          <rect x={cx - 11.5} y={cy + 5.5} width={5} height={5} fill="#c9ced2" stroke="#6d747a" strokeWidth={0.25} />
        </g>
      ) : (
        <rect x={cx - 2.4} y={cy - 2.4} width={4.8} height={4.8} fill={`url(#${p}-shaft)`} />
      )}
      {amps !== undefined && <T x={x + w - 3} y={y + h - 15.5} size={3} fill="#f2f2f2" anchor="end" weight={700}>{`${amps}A`}</T>}
      <T x={x + 3} y={y + 16.5} size={1.7} fill="#c9cdd1" anchor="start">{d.partNumber}</T>
      <Screws pins={pins} p={p} r={1.8} />
    </g>
  );
}

function MotorProtector({ d, pins, p }: P) {
  const { x, y, w, h } = d.rect;
  const cx = x + w / 2, cy = y + h * 0.47;
  const r = Math.min(w * 0.34, 15);
  const range = rstr(d, 'range', 'setting') ?? (rnum(d, 'minAmps') !== undefined ? `${rnum(d, 'minAmps')}-${rnum(d, 'maxAmps')}A` : d.rating);
  return (
    <g>
      <Body x={x} y={y} w={w} h={h} fill={`url(#${p}-devLight)`} />
      <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={11} rx={1} fill="#d4d7d2" />
      <rect x={x + 1.5} y={y + h - 12.5} width={w - 3} height={11} rx={1} fill="#d4d7d2" />
      <circle cx={cx} cy={cy} r={r + 2.2} fill="#f4f4f0" stroke="#a5a9a4" strokeWidth={0.3} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${p}-devBlack)`} />
      <rect x={cx - 1.6} y={cy - r + 1} width={3.2} height={r * 1.2} rx={1} fill="#d32f2f" />
      <T x={cx - r - 1} y={cy + 1} size={2.4} anchor="end" weight={700}>0</T>
      <T x={cx} y={cy - r - 2.8} size={2.4} weight={700}>I</T>
      {range && <T x={cx} y={y + h - 15} size={2.4} weight={700}>{range}</T>}
      <Screws pins={pins} p={p} />
    </g>
  );
}

function Contactor({ d, pins, p }: P) {
  const { x, y, w, h } = d.rect;
  const upper = d.stack === 'upper';
  const cx = x + w / 2;
  const coil = rstr(d, 'coilVoltage', 'coil');
  return (
    <g>
      <Body x={x} y={y} w={w} h={h} rx={2} fill={`url(#${p}-devLight)`} />
      <rect x={x + 1.4} y={y + 1.4} width={w - 2.8} height={12} rx={1.2} fill="#d2d5d0" stroke="#b1b5b0" strokeWidth={0.25} />
      {!upper && <rect x={x + 1.4} y={y + h - 13.4} width={w - 2.8} height={12} rx={1.2} fill="#d2d5d0" stroke="#b1b5b0" strokeWidth={0.25} />}
      <rect x={x + 3} y={y + 15.5} width={w - 6} height={h - (upper ? 18 : 31)} rx={1.6} fill={`url(#${p}-devLightV)`} stroke="#a7aba6" strokeWidth={0.3} />
      {[0, 1, 2].map((i) => <line key={i} x1={x + 5} x2={x + w - 5} y1={y + 18 + i * 2} y2={y + 18 + i * 2} stroke="#b6bab5" strokeWidth={0.4} />)}
      <rect x={cx - 5} y={y + h * (upper ? 0.5 : 0.44)} width={10} height={6.5} rx={0.8} fill="#2c2e31" />
      <rect x={cx - 3.8} y={y + h * (upper ? 0.5 : 0.44) + 1.2} width={7.6} height={4.1} rx={0.5} fill="#f1f1ec" />
      <rect x={cx - 3.8} y={y + h * (upper ? 0.5 : 0.44) + 1.2} width={3.6} height={4.1} rx={0.5} fill="#3a3d40" />
      {coil && <T x={cx} y={y + h * (upper ? 0.5 : 0.44) - 2.6} size={2.4} weight={700}>{coil.replace(/\s+/g, '')}</T>}
      <T x={cx} y={y + h * (upper ? 0.86 : 0.74)} size={1.7} fill="#55595e">{d.partNumber}</T>
      <Screws pins={pins} p={p} />
    </g>
  );
}

function Overload({ d, pins, p }: P) {
  const { x, y, w, h } = d.rect;
  const lower = d.stack === 'lower';
  const range = rstr(d, 'range', 'setting') ?? (rnum(d, 'minAmps') !== undefined ? `${rnum(d, 'minAmps')}-${rnum(d, 'maxAmps')}A` : '');
  const dx = x + w * 0.3, dy = y + h * 0.42;
  return (
    <g>
      <Body x={x + 0.8} y={y} w={w - 1.6} h={h} rx={1.8} fill={`url(#${p}-devLight)`} />
      {lower && <rect x={x + 2} y={y - 0.6} width={w - 4} height={2.2} fill="#9da19c" opacity={0.7} />}
      <rect x={x + 2.2} y={y + h - 13} width={w - 4.4} height={11.6} rx={1.1} fill="#d2d5d0" stroke="#b1b5b0" strokeWidth={0.25} />
      <circle cx={dx} cy={dy} r={5.4} fill="#fbfbf8" stroke="#8e928d" strokeWidth={0.35} />
      {Array.from({ length: 7 }, (_, i) => { const a = (-140 + i * 46.6) * Math.PI / 180; return <line key={i} x1={dx + Math.sin(a) * 4.2} y1={dy - Math.cos(a) * 4.2} x2={dx + Math.sin(a) * 5.1} y2={dy - Math.cos(a) * 5.1} stroke="#555" strokeWidth={0.3} />; })}
      <circle cx={dx} cy={dy} r={2.6} fill="#40444a" />
      <rect x={dx - 0.45} y={dy - 2.5} width={0.9} height={2.6} fill="#e8e8e8" transform={`rotate(25 ${dx} ${dy})`} />
      <circle cx={x + w * 0.7} cy={y + h * 0.36} r={3.6} fill="#1e5cc8" stroke="#123b80" strokeWidth={0.35} />
      <circle cx={x + w * 0.7 - 1} cy={y + h * 0.36 - 1} r={1.2} fill="#ffffff" opacity={0.35} />
      <rect x={x + w * 0.7 - 2} y={y + h * 0.36 + 5.5} width={4} height={2.4} rx={0.5} fill="#cf2a2a" />
      {range && <T x={dx} y={dy + 9.2} size={2.2} weight={700}>{range}</T>}
      <Screws pins={pins} p={p} />
    </g>
  );
}

function PowerSupply({ d, pins, p }: P) {
  const { x, y, w, h } = d.rect;
  const slotsN = Math.max(3, Math.floor((w - 10) / 3.2));
  const slotW = (w - 10) / slotsN;
  const vents = (vy: number, vh: number) => Array.from({ length: slotsN }, (_, i) => (
    <rect key={i} x={x + 5 + i * slotW + slotW * 0.25} y={vy} width={slotW * 0.5} height={vh} rx={slotW * 0.25} fill="#2e3237" opacity={0.85} />
  ));
  const tbW = (pins: { x: number }[]) => pins.length ? [Math.min(...pins.map((q) => q.x)) - 3.4, Math.max(...pins.map((q) => q.x)) + 3.4] : [x, x];
  const [t0, t1] = tbW(pins.top), [b0, b1] = tbW(pins.bottom);
  const volts = rstr(d, 'outputVoltage', 'output') ?? (rnum(d, 'outputVolts') !== undefined ? `${rnum(d, 'outputVolts')}V DC` : '24V DC');
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2.4} fill={`url(#${p}-alu)`} stroke="#80878d" strokeWidth={0.4} />
      <rect x={x} y={y} width={w} height={h} rx={2.4} fill={`url(#${p}-brushLines)`} />
      <rect x={t0} y={y + 2} width={t1 - t0} height={11} rx={0.8} fill={`url(#${p}-tbGreen)`} stroke="#1c4d2c" strokeWidth={0.3} />
      <rect x={b0} y={y + h - 13} width={b1 - b0} height={11} rx={0.8} fill={`url(#${p}-tbGreen)`} stroke="#1c4d2c" strokeWidth={0.3} />
      {vents(y + 16, 13)}
      {vents(y + h - 30, 13)}
      <rect x={x + 3.5} y={y + h * 0.36} width={w - 7} height={h * 0.28} rx={1.2} fill="#2b2f34" />
      <T x={x + w / 2} y={y + h * 0.36 + 7} size={Math.min(4.2, w * 0.085)} fill="#ffffff" weight={700}>{volts.replace(/VDC$/i, 'V DC')}</T>
      <T x={x + w / 2} y={y + h * 0.36 + 11.5} size={2.3} fill="#c8ced4">{d.rating || 'DC power supply'}</T>
      <Led x={x + 7} y={y + h * 0.64 - 5} r={1.2} color="#3cff6a" p={p} />
      <T x={x + 9.5} y={y + h * 0.64 - 4.3} size={1.8} fill="#c8ced4" anchor="start">DC OK</T>
      <circle cx={x + w - 8} cy={y + h * 0.64 - 5} r={1.8} fill={`url(#${p}-screw)`} />
      <line x1={x + w - 9.2} y1={y + h * 0.64 - 5} x2={x + w - 6.8} y2={y + h * 0.64 - 5} stroke="#3a3f44" strokeWidth={0.45} />
      <T x={x + w - 11} y={y + h * 0.64 - 4.3} size={1.6} fill="#c8ced4" anchor="end">ADJ</T>
      <T x={x + w / 2} y={y + h * 0.36 - 2} size={1.7} fill="#4c5258">{d.partNumber}</T>
      <Screws pins={pins} p={p} r={1.5} />
    </g>
  );
}

function Plc({ d, pins, p }: P) {
  const { x, y, w, h } = d.rect;
  const io = ioCounts(d);
  const family = rstr(d, 'family') ?? '';
  const eth = /ethernet/i.test(`${d.description} ${rstr(d, 'ethernet', 'ports') ?? ''}`);
  const serial = /serial|rs-?232|rs-?485/i.test(`${d.description} ${rstr(d, 'ports') ?? ''}`);
  const panelY = y + 15.5, panelH = 22;
  const ledRow = (n: number, ly: number, label: string) => (
    <g>
      <T x={x + 15} y={ly + 0.7} size={1.7} fill="#c8ced4" anchor="end">{label}</T>
      {Array.from({ length: Math.min(n, 16) }, (_, i) => <Led key={i} x={x + 17 + i * 2.6} y={ly} r={0.75} color="#39d353" on={false} p={p} />)}
    </g>
  );
  return (
    <g>
      <Body x={x} y={y} w={w} h={h} rx={2} fill={`url(#${p}-devLight)`} stroke="#979b96" />
      <rect x={x + 1.4} y={y + 2.2} width={w - 2.8} height={10.6} rx={0.8} fill={`url(#${p}-devBlack)`} />
      <rect x={x + 1.4} y={y + h - 12.8} width={w - 2.8} height={10.6} rx={0.8} fill={`url(#${p}-devBlack)`} />
      <rect x={x + 2.2} y={panelY} width={w - 4.4} height={panelH} rx={1} fill="#2e3135" />
      <Led x={x + 4.6} y={panelY + 3.5} color="#42e86b" p={p} />
      <T x={x + 6.2} y={panelY + 4.1} size={1.6} fill="#d6dbe0" anchor="start">PWR</T>
      <Led x={x + 4.6} y={panelY + 7.5} color="#42e86b" p={p} />
      <T x={x + 6.2} y={panelY + 8.1} size={1.6} fill="#d6dbe0" anchor="start">RUN</T>
      <Led x={x + 4.6} y={panelY + 11.5} color="#ff4b3a" on={false} p={p} />
      <T x={x + 6.2} y={panelY + 12.1} size={1.6} fill="#d6dbe0" anchor="start">ERR</T>
      {io.inputs > 0 && ledRow(io.inputs, panelY + 4, 'X')}
      {io.outputs > 0 && ledRow(io.outputs, panelY + 9, 'Y')}
      <rect x={x + w - 11} y={panelY + panelH - 7} width={7} height={4} rx={1} fill="#1b1d20" />
      <rect x={x + w - 10.5} y={panelY + panelH - 6.5} width={3} height={3} rx={0.6} fill="#d8dcdf" />
      <T x={x + w - 7.5} y={panelY + panelH - 8} size={1.4} fill="#d6dbe0">RUN STOP</T>
      {family && <T x={x + w / 2} y={y + h * 0.58} size={3.6} weight={800} fill="#3a3d41">{family}</T>}
      <T x={x + w / 2} y={y + h * 0.58 + 3.6} size={1.7} fill="#55595e">{d.partNumber}</T>
      {eth && (
        <g>
          <rect x={x + 3} y={y + h - 29} width={12.5} height={11} rx={0.8} fill="#c4c9cd" stroke="#7d848a" strokeWidth={0.3} />
          <rect x={x + 4.3} y={y + h - 27} width={9.9} height={7.5} rx={0.4} fill="#141516" />
          <rect x={x + 6.8} y={y + h - 19.6} width={4.9} height={1.4} fill="#141516" />
          <rect x={x + 3.6} y={y + h - 28.6} width={2} height={1.2} fill="#3cdc5a" />
          <rect x={x + 12.9} y={y + h - 28.6} width={2} height={1.2} fill="#f2a53a" />
        </g>
      )}
      {serial && (
        <g>
          <rect x={x + 18} y={y + h - 27.5} width={9.5} height={9} rx={0.7} fill="#3a3d41" />
          <rect x={x + 19.2} y={y + h - 26.2} width={7.1} height={5.8} rx={0.4} fill="#121314" />
        </g>
      )}
      <Screws pins={pins} p={p} r={1.25} />
    </g>
  );
}

function PlcModule({ d, pins, p }: P) {
  const { x, y, w, h } = d.rect;
  const io = ioCounts(d);
  const n = Math.min(16, Math.max(io.inputs, io.outputs, 4));
  const cols = n > 8 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const ph = Math.min(2.3, (h - 40) / rows);
  return (
    <g>
      <Body x={x + 0.2} y={y} w={w - 0.4} h={h} rx={1.8} fill={`url(#${p}-devLight)`} stroke="#979b96" />
      <rect x={x + 1.3} y={y + 2.2} width={w - 2.6} height={10.6} rx={0.8} fill={`url(#${p}-devBlack)`} />
      <rect x={x + 1.3} y={y + h - 12.8} width={w - 2.6} height={10.6} rx={0.8} fill={`url(#${p}-devBlack)`} />
      <rect x={x + 2.4} y={y + 16} width={w - 4.8} height={rows * ph + 4} rx={0.9} fill="#2e3135" />
      {Array.from({ length: n }, (_, i) => {
        const c = Math.floor(i / rows), r = i % rows;
        return <Led key={i} x={x + w / 2 + (cols === 2 ? (c ? 3 : -3) : 0)} y={y + 18.2 + r * ph} r={0.65} color="#39d353" on={false} p={p} />;
      })}
      <T x={x + w / 2 + 1} y={y + h - 18} size={1.8} fill="#45494e" rotate={-90} anchor="start">{d.partNumber}</T>
      <Screws pins={pins} p={p} r={1.25} />
    </g>
  );
}

function SafetyRelay({ d, pins, p, safety }: P & { safety: boolean }) {
  const { x, y, w, h } = d.rect;
  const cx = x + w / 2;
  return (
    <g>
      <Body x={x + 0.2} y={y} w={w - 0.4} h={h} rx={1.8} fill={`url(#${p}-devLight)`} stroke="#979b96" />
      <rect x={x + 1.2} y={y + 1.5} width={w - 2.4} height={9.2} rx={0.8} fill="#3a3d41" />
      <rect x={x + 1.2} y={y + h - 10.7} width={w - 2.4} height={9.2} rx={0.8} fill="#3a3d41" />
      <rect x={x + 1.8} y={y + 13} width={w - 3.6} height={h - 26} rx={1.2} fill={safety ? '#f2c414' : `url(#${p}-devLightV)`} stroke={safety ? '#b48c00' : '#a9ada8'} strokeWidth={0.3} />
      <rect x={x + 3} y={y + 16} width={w - 6} height={14} rx={0.8} fill="#2e3135" />
      <Led x={cx - (w > 18 ? 4 : 0)} y={y + 19.5} color="#42e86b" p={p} />
      <Led x={cx + (w > 18 ? 0 : 0)} y={y + 23.5} color="#42e86b" p={p} on={safety} />
      <Led x={cx + (w > 18 ? 4 : 0)} y={y + 27.5} color="#42e86b" p={p} on={safety} />
      <T x={cx + 0.8} y={y + h - 16} size={Math.min(2, w * 0.1)} fill={safety ? '#3b3000' : '#45494e'} rotate={-90} anchor="start">{d.partNumber}</T>
      {safety && <T x={cx} y={y + 35} size={Math.min(2.4, w * 0.11)} weight={800} fill="#3b3000">SAFETY</T>}
      <Screws pins={pins} p={p} r={1.3} />
    </g>
  );
}

function Relay(props: P) {
  const { d, pins, p } = props;
  const { x, y, w, h } = d.rect;
  const style = relayStyle(d);
  if (style === 'module') return <SafetyRelay {...props} safety={false} />;
  if (style === 'slim') {
    return (
      <g>
        <rect x={x + 0.2} y={y} width={w - 0.4} height={h} rx={0.8} fill={`url(#${p}-devDark)`} stroke="#1c1e21" strokeWidth={0.3} />
        <rect x={x + 0.8} y={y + h * 0.3} width={w - 1.6} height={h * 0.4} rx={0.5} fill="#e7e9e5" />
        <Led x={x + w / 2} y={y + h * 0.27} r={0.7} color="#ffd23a" p={p} />
        <Screws pins={pins} p={p} r={Math.min(1.3, w * 0.22)} />
      </g>
    );
  }
  const base = (
    <g>
      <Body x={x} y={y} w={w} h={h} rx={1.6} fill={`url(#${p}-devDark)`} stroke="#1f2124" />
      <rect x={x + 1.2} y={y + 1.2} width={w - 2.4} height={10} rx={0.8} fill="#4a4e54" />
      <rect x={x + 1.2} y={y + h - 11.2} width={w - 2.4} height={10} rx={0.8} fill="#4a4e54" />
    </g>
  );
  if (style === 'socket') {
    return (
      <g>{base}
        {Array.from({ length: 8 }, (_, i) => <rect key={i} x={x + w / 2 - 6 + (i % 4) * 3.6} y={y + h / 2 - 5 + Math.floor(i / 4) * 8} width={1.6} height={3} fill="#111" />)}
        <Screws pins={pins} p={p} r={1.4} />
      </g>
    );
  }
  const rx0 = x + 2, ry0 = y + 13, rw = w - 4, rh = h - 26;
  return (
    <g>{base}
      <rect x={rx0} y={ry0} width={rw} height={rh} rx={1.6} fill={`url(#${p}-clear)`} stroke="#7f939e" strokeWidth={0.35} />
      <rect x={rx0 + rw * 0.2} y={ry0 + rh * 0.45} width={rw * 0.6} height={rh * 0.35} rx={1} fill={`url(#${p}-coil)`} opacity={0.85} />
      <line x1={rx0 + rw * 0.25} y1={ry0 + rh * 0.12} x2={rx0 + rw * 0.25} y2={ry0 + rh * 0.4} stroke="#b9895a" strokeWidth={0.6} />
      <line x1={rx0 + rw * 0.75} y1={ry0 + rh * 0.12} x2={rx0 + rw * 0.75} y2={ry0 + rh * 0.4} stroke="#b9895a" strokeWidth={0.6} />
      <rect x={rx0 + rw / 2 - 2} y={ry0 + 1.5} width={4} height={3} rx={0.6} fill="#f08a1c" />
      <Led x={rx0 + rw - 2.5} y={ry0 + 3} r={0.7} color="#ff4b3a" p={p} on={false} />
      <rect x={rx0 + 0.6} y={ry0 + 0.6} width={rw * 0.3} height={rh - 1.2} rx={1} fill="#fff" opacity={0.25} />
      <Screws pins={pins} p={p} r={1.4} />
    </g>
  );
}

function Vfd({ d, pins, p }: P) {
  const { x, y, w, h } = d.rect;
  const kx = x + 6, ky = y + h * 0.16, kw = w - 12, kh = Math.min(h * 0.4, kw * 1.1);
  const slots = Math.max(3, Math.floor((w - 14) / 3.4));
  const sw = (w - 14) / slots;
  const hp = rnum(d, 'hp480', 'hp', 'hp230');
  const bx = (i: number, n: number) => kx + 3 + ((kw - 6) * (i + 0.5)) / n;
  return (
    <g>
      <Body x={x} y={y} w={w} h={h} rx={3} fill={`url(#${p}-devDark)`} stroke="#15171a" />
      {[x + 1.2, x + w - 3.2].map((fx, j) => Array.from({ length: Math.floor((h - 8) / 3) }, (_, i) => <rect key={`${j}-${i}`} x={fx} y={y + 4 + i * 3} width={2} height={1.4} fill="#1b1d20" />))}
      {Array.from({ length: slots }, (_, i) => <rect key={i} x={x + 7 + i * sw + sw * 0.2} y={y + 4} width={sw * 0.6} height={h * 0.1} rx={sw * 0.3} fill="#141518" />)}
      <rect x={kx} y={ky} width={kw} height={kh} rx={2.2} fill="#1d1f22" stroke="#5b6066" strokeWidth={0.4} />
      <rect x={kx + 3} y={ky + 3} width={kw - 6} height={kh * 0.26} rx={1} fill="#0a0b0c" stroke="#3c4045" strokeWidth={0.3} />
      <g filter={`url(#${p}-ledGlow)`}>
        <T x={kx + kw - 5} y={ky + 3 + kh * 0.21} size={kh * 0.17} fill="#ff3b2f" anchor="end" family="'Courier New', monospace" weight={700}>0.00</T>
      </g>
      {['RUN', 'STOP', 'FWD', 'REV'].map((s, i) => (
        <g key={s}>
          <Led x={kx + 4 + i * ((kw - 8) / 3.4)} y={ky + kh * 0.38} r={0.6} color={i === 1 ? '#ff4b3a' : '#42e86b'} on={i === 1} p={p} />
          <T x={kx + 5.2 + i * ((kw - 8) / 3.4)} y={ky + kh * 0.38 + 0.6} size={1.4} fill="#c8ced4" anchor="start">{s}</T>
        </g>
      ))}
      {[0, 1, 2, 3].map((i) => <rect key={i} x={bx(i, 4) - 3} y={ky + kh * 0.5} width={6} height={kh * 0.13} rx={1} fill="#3b3f45" stroke="#62676d" strokeWidth={0.25} />)}
      {['▲', '▼', '◀', '↵'].map((s, i) => <T key={i} x={bx(i, 4)} y={ky + kh * 0.5 + kh * 0.1} size={kh * 0.08} fill="#e3e6e9">{s}</T>)}
      <rect x={bx(0, 2) - 7} y={ky + kh * 0.71} width={14} height={kh * 0.16} rx={1.4} fill="#2f7d3c" />
      <T x={bx(0, 2)} y={ky + kh * 0.71 + kh * 0.11} size={kh * 0.08} fill="#fff" weight={700}>RUN</T>
      <rect x={bx(1, 2) - 7} y={ky + kh * 0.71} width={14} height={kh * 0.16} rx={1.4} fill="#b8231f" />
      <T x={bx(1, 2)} y={ky + kh * 0.71 + kh * 0.11} size={kh * 0.07} fill="#fff" weight={700}>STOP</T>
      <rect x={x + 4} y={y + h - 25} width={w - 8} height={22} rx={1.6} fill="#2a2d31" stroke="#4b5056" strokeWidth={0.3} />
      <rect x={x + 5} y={y + h - 16.5} width={w - 10} height={7} rx={0.6} fill="#111214" />
      {hp !== undefined && <T x={x + w / 2} y={ky + kh + 7} size={3.2} fill="#e8eaec" weight={700}>{`${hp} HP`}</T>}
      <T x={x + w / 2} y={ky + kh + 11} size={1.8} fill="#aab1b8">{d.partNumber}</T>
      <Screws pins={pins} p={p} r={1.5} />
    </g>
  );
}

function Transformer({ d, pins, p }: P) {
  const { x, y, w, h } = d.rect;
  const va = rnum(d, 'va', 'VA', 'kva');
  const label = va !== undefined ? `${va} VA` : (d.description.match(/(\d+)\s*VA/i)?.[0] ?? 'XFMR');
  return (
    <g>
      <rect x={x} y={y + h - 9} width={w} height={9} rx={1} fill={`url(#${p}-alu)`} stroke="#7d848a" strokeWidth={0.3} />
      <rect x={x + w * 0.06} y={y + h * 0.12} width={w * 0.88} height={h * 0.74} fill={`url(#${p}-lamPattern)`} stroke="#1f2124" strokeWidth={0.4} />
      <rect x={x + w * 0.2} y={y + h * 0.18} width={w * 0.6} height={h * 0.6} rx={4} fill={`url(#${p}-coil)`} stroke="#6b3412" strokeWidth={0.4} />
      <rect x={x + w * 0.2} y={y + h * 0.18} width={w * 0.6} height={h * 0.6} rx={4} fill={`url(#${p}-windings)`} />
      <rect x={x + w * 0.3} y={y + h * 0.36} width={w * 0.4} height={h * 0.2} rx={1} fill="#efe6c8" stroke="#a69a72" strokeWidth={0.3} />
      <T x={x + w / 2} y={y + h * 0.46} size={Math.min(3.4, w * 0.07)} weight={700}>{label}</T>
      <T x={x + w / 2} y={y + h * 0.46 + 3.2} size={1.7}>{d.partNumber}</T>
      <rect x={x + w * 0.1} y={y + 1} width={w * 0.8} height={10} rx={0.8} fill="#2b2d30" />
      <rect x={x + w * 0.25} y={y + h - 11} width={w * 0.5} height={10} rx={0.8} fill="#2b2d30" />
      <Screws pins={pins} p={p} r={1.6} />
    </g>
  );
}

function GroundBar({ d, pins, p }: P) {
  const { x, y, w, h } = d.rect;
  const tin = /tin|nickel/i.test(d.description);
  const by = y + h * 0.2, bh = h * 0.6;
  return (
    <g>
      {[x + 4, x + w - 4].map((sx) => <rect key={sx} x={sx - 3.5} y={y + 1} width={7} height={h - 2} rx={1.2} fill="#3c4045" />)}
      <rect x={x} y={by} width={w} height={bh} rx={1.4} fill={`url(#${p}-${tin ? 'tin' : 'copper'})`} stroke={tin ? '#7f8079' : '#8a4b23'} strokeWidth={0.35} />
      <rect x={x + 1} y={by + 0.8} width={w - 2} height={bh * 0.22} rx={0.8} fill="#ffffff" opacity={0.3} />
      {[x + 4, x + w - 4].map((sx) => <circle key={sx} cx={sx} cy={y + h / 2} r={2.2} fill="#2f3236" stroke="#777" strokeWidth={0.3} />)}
      {pins.top.map((q, i) => <Screw key={i} x={q.x} y={q.y} r={2} p={p} recess={false} angle={20 + i * 17} />)}
    </g>
  );
}

function TerminalStripView({ d, pins, p }: P) {
  const { y, h } = d.rect;
  const g = stripGeometry(d);
  const ts = d.strip?.terminals ?? [];
  return (
    <g>
      {g.terminals.map((t) => {
        const term = ts[t.i];
        const pe = term?.kind === 'ground';
        const mw = Math.max(1, t.w - 1.2);
        return (
          <g key={t.i}>
            <rect x={t.x + 0.1} y={y} width={t.w - 0.2} height={h} rx={0.6} fill={`url(#${p}-${pe ? 'tbPE' : 'tbGrey'})`} stroke={pe ? '#1e5b2b' : '#7a7e80'} strokeWidth={0.22} />
            {pe && <rect x={t.x + t.w / 2 - t.w * 0.15} y={y + 9} width={t.w * 0.3} height={h - 18} fill="#f2d22e" opacity={0.95} />}
            <rect x={t.x + t.w * 0.18} y={y + 1.2} width={t.w * 0.64} height={1.6} rx={0.3} fill="#2a2c2e" />
            <rect x={t.x + t.w * 0.18} y={y + h - 2.8} width={t.w * 0.64} height={1.6} rx={0.3} fill="#2a2c2e" />
            <rect x={t.x + 0.6} y={y + h / 2 - 3.6} width={mw} height={7.2} rx={0.4} fill="#fbfbf7" stroke="#b9bbb5" strokeWidth={0.15} />
            {term && <T x={t.x + t.w / 2} y={y + h / 2 + 1.1} size={Math.min(2.8, (t.w - 0.8) / (String(term.number).length * 0.62))} weight={700} fill="#1b1c1e">{term.number}</T>}
          </g>
        );
      })}
      {g.plates.map((r, i) => <rect key={`p${i}`} x={r.x} y={r.y} width={r.w} height={r.h} rx={0.3} fill="#5f6466" />)}
      {g.stops.map((r, i) => (
        <g key={`s${i}`}>
          <path d={`M${r.x + 0.5} ${r.y + r.h} L${r.x + 0.5} ${r.y + 6} Q${r.x + r.w / 2} ${r.y - 1} ${r.x + r.w - 0.5} ${r.y + 6} L${r.x + r.w - 0.5} ${r.y + r.h} Z`} fill={`url(#${p}-devMid)`} stroke="#4c5054" strokeWidth={0.3} />
          <Screw x={r.x + r.w / 2} y={r.y + r.h / 2} r={1.6} p={p} recess={false} />
        </g>
      ))}
      <Screws pins={{ top: pins.top.filter((_, i) => ts[i]), bottom: pins.bottom.filter((_, i) => ts[i]) }} p={p} r={Math.min(1.5, (g.terminals[0]?.w ?? 6) * 0.27)} />
    </g>
  );
}

function Generic({ d, p }: P) {
  const { x, y, w, h } = d.rect;
  const words = d.description.split(/[\s,]+/).slice(0, 3).join(' ');
  return (
    <g>
      <Body x={x} y={y} w={w} h={h} fill={`url(#${p}-devLight)`} />
      <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx={1.2} fill="none" stroke="#b5b9b4" strokeWidth={0.3} />
      <T x={x + w / 2} y={y + h / 2} size={Math.min(2.6, w * 0.07)} weight={700}>{d.partNumber}</T>
      {words && <T x={x + w / 2} y={y + h / 2 + 3.4} size={Math.min(2, w * 0.05)} fill="#5a5e63">{words}</T>}
    </g>
  );
}

export function Device({ d, pins, p }: P) {
  const props = { d, pins, p };
  let body: ReactNode;
  switch (d.category) {
    case 'breaker': case 'fuse': body = <Breaker {...props} />; break;
    case 'disconnect': body = <Disconnect {...props} />; break;
    case 'motorProtector': body = <MotorProtector {...props} />; break;
    case 'contactor': body = <Contactor {...props} />; break;
    case 'overload': body = <Overload {...props} />; break;
    case 'powerSupply': body = <PowerSupply {...props} />; break;
    case 'plc': body = <Plc {...props} />; break;
    case 'plcModule': body = <PlcModule {...props} />; break;
    case 'safetyRelay': body = <SafetyRelay {...props} safety />; break;
    case 'relay': body = <Relay {...props} />; break;
    case 'vfd': body = <Vfd {...props} />; break;
    case 'groundBar': body = <GroundBar {...props} />; break;
    case 'terminal': body = <TerminalStripView {...props} />; break;
    default: body = isTransformer(d) ? <Transformer {...props} /> : <Generic {...props} />;
  }
  return (
    <g filter={d.category === 'terminal' ? `url(#${p}-shadowSmall)` : `url(#${p}-shadow)`}>
      <title>{`${d.tag} — ${d.partNumber}${d.description ? ` — ${d.description}` : ''}${d.estimated ? ' (size estimated)' : ''}`}</title>
      {body}
    </g>
  );
}
