/** Open enclosure seen from the front: cabinet, back panel, rails, ducts, devices, wiring, open door. */
import type { DoorItem, Rect } from '../derive';
import { Device, Screw, T } from './Devices';
import { FINGER_PITCH, FINGER_W, WIRE_HEX, leafOf, openDoorPoint } from './scene';
import type { Duct, Scene, TagPlate, WirePath } from './scene';

const f = (n: number) => Math.round(n * 100) / 100;

function Rail({ r, p }: { r: Rect; p: string }) {
  const slots = Math.max(0, Math.floor((r.w - 20) / 25));
  const x0 = r.x + (r.w - slots * 25) / 2;
  return (
    <g filter={`url(#${p}-shadowSmall)`}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={0.8} fill={`url(#${p}-rail)`} stroke="#80878c" strokeWidth={0.3} />
      {Array.from({ length: slots }, (_, i) => (
        <rect key={i} x={x0 + i * 25 + 5} y={r.y + r.h / 2 - 2.6} width={15} height={5.2} rx={2.6} fill="#8d9396" stroke="#5f666b" strokeWidth={0.3} />
      ))}
      {[r.x + 6, r.x + r.w - 6].map((sx) => <Screw key={sx} x={sx} y={r.y + r.h / 2} r={2.4} p={p} recess={false} />)}
    </g>
  );
}

/** Duct base (dark interior) — drawn under the wires. */
function DuctBase({ d }: { d: Duct }) {
  return <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={0.8} fill="#4a4e51" />;
}

/** Duct fingers and cover — drawn over the wires so they disappear into the duct. */
function DuctTop({ d, p }: { d: Duct; p: string }) {
  const horiz = d.orientation === 'h';
  const len = horiz ? d.w : d.h;
  const depth = (horiz ? d.h : d.w) * 0.2;
  const n = Math.floor(len / FINGER_PITCH);
  const fingers = [];
  for (let k = 0; k <= n; k++) {
    const a = k * FINGER_PITCH;
    const fw = Math.min(FINGER_W, len - a);
    if (fw <= 0) continue;
    if (horiz) {
      fingers.push(<rect key={`a${k}`} x={d.x + a} y={d.y} width={fw} height={depth} fill={`url(#${p}-finger)`} stroke="#7a7e80" strokeWidth={0.2} />);
      fingers.push(<rect key={`b${k}`} x={d.x + a} y={d.y + d.h - depth} width={fw} height={depth} fill={`url(#${p}-finger)`} stroke="#7a7e80" strokeWidth={0.2} />);
    } else {
      fingers.push(<rect key={`a${k}`} x={d.x} y={d.y + a} width={depth} height={fw} fill={`url(#${p}-finger)`} stroke="#7a7e80" strokeWidth={0.2} />);
      fingers.push(<rect key={`b${k}`} x={d.x + d.w - depth} y={d.y + a} width={depth} height={fw} fill={`url(#${p}-finger)`} stroke="#7a7e80" strokeWidth={0.2} />);
    }
  }
  const inset = (horiz ? d.h : d.w) * 0.12;
  const c = horiz ? { x: d.x - 0.5, y: d.y + inset, w: d.w + 1, h: d.h - 2 * inset } : { x: d.x + inset, y: d.y - 0.5, w: d.w - 2 * inset, h: d.h + 1 };
  return (
    <g>
      {fingers}
      <g filter={`url(#${p}-shadowSmall)`}>
        <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={1.2} fill={`url(#${p}-ductCover${horiz ? 'H' : 'V'})`} stroke="#75797b" strokeWidth={0.3} />
      </g>
      {horiz
        ? <path d={`M${c.x + 1} ${c.y + 0.6} H${c.x + c.w - 1} M${c.x + 1} ${c.y + c.h * 0.33} H${c.x + c.w - 1} M${c.x + 1} ${c.y + c.h * 0.67} H${c.x + c.w - 1}`} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={0.4} />
        : <path d={`M${c.x + 0.6} ${c.y + 1} V${c.y + c.h - 1} M${c.x + c.w * 0.33} ${c.y + 1} V${c.y + c.h - 1} M${c.x + c.w * 0.67} ${c.y + 1} V${c.y + c.h - 1}`} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={0.4} />}
    </g>
  );
}

function Wire({ w }: { w: WirePath }) {
  const c = WIRE_HEX[w.color];
  return (
    <g>
      <path d={w.d} stroke={c.edge} strokeWidth={w.w + 0.55} fill="none" strokeLinecap="round" />
      <path d={w.d} stroke={c.base} strokeWidth={w.w} fill="none" strokeLinecap="round" />
      {c.stripe && <path d={w.d} stroke={c.stripe} strokeWidth={w.w * 0.36} fill="none" strokeLinecap="round" />}
      <path d={w.d} stroke="#ffffff" strokeOpacity={w.color === 'BK' ? 0.28 : 0.4} strokeWidth={w.w * 0.22} fill="none" transform="translate(-0.45 0)" />
    </g>
  );
}

function Plate({ t, p }: { t: TagPlate; p: string }) {
  return (
    <g filter={`url(#${p}-shadowSmall)`}>
      <rect x={t.x} y={t.y} width={t.w} height={t.h} rx={0.9} fill="#fbfbf8" stroke="#9fa29d" strokeWidth={0.3} />
      <T x={t.x + t.w / 2} y={t.y + t.h / 2 + t.font * 0.36} size={t.font} weight={700} fill="#151617">{t.text}</T>
    </g>
  );
}

function Hinge({ x, y, h, p }: { x: number; y: number; h: number; p: string }) {
  return (
    <g filter={`url(#${p}-shadowSmall)`}>
      <rect x={x - 3.5} y={y} width={7} height={h} rx={3.2} fill={`url(#${p}-hinge)`} stroke="#5b5e5a" strokeWidth={0.3} />
      <line x1={x - 3.5} x2={x + 3.5} y1={y + h / 2} y2={y + h / 2} stroke="#4d504c" strokeWidth={0.5} />
    </g>
  );
}

/** Back of one door device on the open door, drawn in local mm around its centre. */
function DeviceBack({ d, p }: { d: DoorItem; p: string }) {
  if (d.kind === 'hmi') {
    const w = d.w * 0.86, h = d.h * 0.84;
    return (
      <g>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill={`url(#${p}-devMid)`} stroke="#3e4247" strokeWidth={0.6} />
        <rect x={-w / 2 + 8} y={-h / 2 + 8} width={w - 16} height={h * 0.45} rx={2} fill="#6f757b" />
        <rect x={w / 2 - 34} y={h / 2 - 22} width={14} height={11} rx={1} fill="#c4c9cd" />
        <rect x={w / 2 - 32.5} y={h / 2 - 20.5} width={11} height={8} fill="#121314" />
        <rect x={w / 2 - 16} y={h / 2 - 22} width={10} height={11} rx={1} fill={`url(#${p}-tbGreen)`} />
        <rect x={-w / 2 + 10} y={h / 2 - 20} width={30} height={7} rx={1} fill="#f2f2ee" opacity={0.85} />
      </g>
    );
  }
  const blocks = d.kind === 'pilot' ? ['#e9ebe7'] : d.kind === 'estop' ? ['#cf2a2a', '#cf2a2a'] : d.color === 'RED' ? ['#cf2a2a'] : ['#2f9a45'];
  const bh = 13;
  return (
    <g filter={`url(#${p}-shadow)`}>
      <rect x={-15} y={-15} width={30} height={30} rx={3} fill="#2a2c2f" />
      <circle cx={0} cy={0} r={11.5} fill="#3a3d41" stroke="#55595e" strokeWidth={0.6} />
      {blocks.map((c, i) => (
        <g key={i}>
          <rect x={-10} y={-12 + i * (bh + 1)} width={20} height={bh} rx={1.4} fill={c} stroke="#00000055" strokeWidth={0.4} />
          <rect x={-10} y={-12 + i * (bh + 1)} width={6} height={bh} rx={1.4} fill="#000" opacity={0.14} />
          <Screw x={-5} y={-12 + i * (bh + 1) + 3.5} r={1.8} p={p} recess={false} />
          <Screw x={5} y={-12 + i * (bh + 1) + 3.5} r={1.8} p={p} recess={false} />
        </g>
      ))}
    </g>
  );
}

/** The open door: one leaf swung left about its hinge, or both leaves of a double door swung outwards. */
function OpenDoor({ s, p }: { s: Scene; p: string }) {
  return <g>{s.door.leaves.map((_, li) => <OpenLeaf key={li} s={s} p={p} li={li} />)}</g>;
}

function OpenLeaf({ s, p, li }: { s: Scene; p: string; li: number }) {
  const D = s.door;
  const { h: H } = s.enc;
  const lf = D.leaves[li];
  const Wl = lf.x1 - lf.x0;
  const right = D.leaves.length > 1 && li === 1;
  // u = distance from this leaf's hinge, v = height
  const P = (u: number, v: number) => openDoorPoint(D, right ? lf.x1 - u : lf.x0 + u, v, li);
  const poly = (pts: [number, number][]) => pts.map(([u, v]) => { const q = P(u, v); return `${f(q.x)},${f(q.y)}`; }).join(' ');
  const quad = (i: number) => poly([[i, i], [Wl - i, i], [Wl - i, H - i], [i, H - i]]);
  const a = P(Wl, 0), b = P(Wl, H);
  const ret = right ? -9 : 9;
  const mine = (x: number) => leafOf(D, x) === li;
  const handle = s.door.handle && mine(s.door.handle.x) ? s.door.handle : undefined;
  const items = s.door.items.filter((d) => mine(d.cx)).sort((x, y) => (right ? y.cx - x.cx : x.cx - y.cx));
  const P0 = (x: number, y: number) => openDoorPoint(D, x, y, li);
  return (
    <g>
      <g filter={`url(#${p}-shadowSoft)`}>
        <polygon points={quad(0)} fill={`url(#${p}-steelV)`} stroke="#8d908b" strokeWidth={0.6} />
      </g>
      <polygon points={`${f(a.x)},${f(a.y)} ${f(b.x)},${f(b.y)} ${f(b.x - ret)},${f(b.y - 4)} ${f(a.x - ret)},${f(a.y + 4)}`} fill="#9da09b" stroke="#7c7f7a" strokeWidth={0.5} />
      <polygon points={quad(18)} fill={`url(#${p}-doorFace)`} stroke="#a9aca7" strokeWidth={0.6} />
      <polygon points={quad(18)} fill={`url(#${p}-doorSheen)`} opacity={0.6} />
      <polygon points={quad(8)} fill="none" stroke={`url(#${p}-gasket)`} strokeWidth={5.2} strokeLinejoin="round" />
      <polygon points={quad(8)} fill="none" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={1} strokeLinejoin="round" />
      {/* latch mechanism (on the leaf with the devices) */}
      {li === D.leaf && (() => { const q = P(Wl - 24, s.door.latchY); return <rect x={q.x - 4 * q.sx} y={q.y - 16 * q.sy} width={8 * q.sx} height={32 * q.sy} rx={1} fill={`url(#${p}-shaft)`} stroke="#5f666c" strokeWidth={0.4} />; })()}
      {handle && (() => {
        const q = P0(handle.x, handle.y);
        return (
          <g transform={`translate(${f(q.x)} ${f(q.y)}) scale(${f(q.sx)} ${f(q.sy)})`} filter={`url(#${p}-shadow)`}>
            <rect x={-24} y={-24} width={48} height={48} rx={4} fill="#3b3f44" stroke="#22252a" strokeWidth={0.8} />
            <circle r={12} fill="#2a2d31" stroke="#6b7177" strokeWidth={1} />
            <rect x={-4} y={-4} width={8} height={8} fill="#0e0f11" />
          </g>
        );
      })()}
      {items.map((d) => {
        const q = P0(d.cx, d.cy);
        return (
          <g key={d.tag} transform={`translate(${f(q.x)} ${f(q.y)}) scale(${f(q.sx)} ${f(q.sy)})`}>
            <title>{`${d.tag} — ${d.partNumber} (back of door device)`}</title>
            <DeviceBack d={d} p={p} />
          </g>
        );
      })}
    </g>
  );
}

function DoorBundle({ d }: { d: string }) {
  const strands: [string, number][] = [['#1f5fd0', -3], ['#f1f2f0', -1], ['#1f5fd0', 1], ['#cf2a2a', 3], ['#2f9a45', 0]];
  return (
    <g>
      <path d={d} stroke="#0f1012" strokeOpacity={0.35} strokeWidth={13} fill="none" strokeLinecap="round" transform="translate(2 3)" />
      <path d={d} stroke="#16171a" strokeWidth={11.5} fill="none" strokeLinecap="round" />
      {strands.map(([c, o], i) => <path key={i} d={d} stroke={c} strokeWidth={2.2} fill="none" transform={`translate(0 ${o})`} strokeLinecap="round" />)}
      <path d={d} stroke="#e8eef2" strokeOpacity={0.55} strokeWidth={11} strokeDasharray="1.6 3.2" fill="none" />
    </g>
  );
}

export function InsideView({ s, p, showLabels, vb }: { s: Scene; p: string; showLabels: boolean; vb: Rect }) {
  const { w: W, h: H } = s.enc;
  const L = s.layout;
  const bp = L.backplate;
  const F = 14;
  const B = Math.max(F + 4, Math.min(28, bp.x - 5, bp.y - 5));
  const wall = (pts: [number, number][], fill: string) => <polygon points={pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')} fill={fill} />;
  return (
    <g>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={`url(#${p}-backdrop)`} />
      <OpenDoor s={s} p={p} />
      {/* enclosure body */}
      <g filter={`url(#${p}-shadowSoft)`}>
        <rect x={0} y={0} width={W} height={H} rx={7} fill={`url(#${p}-steel)`} stroke="#9a9d98" strokeWidth={0.6} />
      </g>
      {s.enc.finish === 'stainless' && <rect x={0} y={0} width={W} height={H} rx={7} fill={`url(#${p}-brushLines)`} />}
      <rect x={1.2} y={1.2} width={W - 2.4} height={H - 2.4} rx={6} fill="none" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1} />
      <rect x={F} y={F} width={W - 2 * F} height={H - 2 * F} rx={3} fill={`url(#${p}-cavity)`} />
      {wall([[F, F], [W - F, F], [W - B, B], [B, B]], `url(#${p}-wallT)`)}
      {wall([[F, H - F], [W - F, H - F], [W - B, H - B], [B, H - B]], `url(#${p}-wallB)`)}
      {wall([[F, F], [B, B], [B, H - B], [F, H - F]], `url(#${p}-wallL)`)}
      {wall([[W - F, F], [W - B, B], [W - B, H - B], [W - F, H - F]], `url(#${p}-wallR)`)}
      <rect x={F} y={F} width={W - 2 * F} height={H - 2 * F} rx={3} fill="none" stroke="#f4f5f2" strokeOpacity={0.8} strokeWidth={1.2} />
      {/* back panel */}
      <g filter={`url(#${p}-shadowSoft)`}>
        <rect x={bp.x} y={bp.y} width={bp.w} height={bp.h} rx={2} fill={`url(#${p}-bp-${s.backplateFinish})`} stroke="#b9bbb5" strokeWidth={0.5} />
      </g>
      {[[bp.x + 9, bp.y + 9], [bp.x + bp.w - 9, bp.y + 9], [bp.x + 9, bp.y + bp.h - 9], [bp.x + bp.w - 9, bp.y + bp.h - 9]].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={4.4} fill="#c3c6c9" stroke="#7d8388" strokeWidth={0.4} />
          <polygon points={Array.from({ length: 6 }, (_, i) => `${f(x + 3.2 * Math.cos((i * Math.PI) / 3))},${f(y + 3.2 * Math.sin((i * Math.PI) / 3))}`).join(' ')} fill={`url(#${p}-screw)`} stroke="#666c71" strokeWidth={0.3} />
        </g>
      ))}
      {L.ducts.filter((d) => d.w > 1 && d.h > 1).map((d, i) => <DuctBase key={i} d={d} />)}
      {L.rails.map((r, i) => <Rail key={i} r={r} p={p} />)}
      {s.devices.map((d) => <Device key={d.key} d={d} pins={s.pins.get(d.key)!} p={p} />)}
      <g>{s.wires.map((w, i) => <Wire key={i} w={w} />)}</g>
      {s.doorWires.map((w, i) => <Wire key={`dw${i}`} w={w} />)}
      {s.doorBundle && <DoorBundle d={s.doorBundle} />}
      {L.ducts.filter((d) => d.w > 1 && d.h > 1).map((d, i) => <DuctTop key={i} d={d} p={p} />)}
      {showLabels && s.plates.map((t, i) => <Plate key={i} t={t} p={p} />)}
      <Hinge x={0} y={H * 0.15 - 20} h={40} p={p} />
      <Hinge x={0} y={H * 0.85 - 20} h={40} p={p} />
      {s.door.leaves.length > 1 ? (
        <>
          <Hinge x={W} y={H * 0.15 - 20} h={40} p={p} />
          <Hinge x={W} y={H * 0.85 - 20} h={40} p={p} />
        </>
      ) : (
        // latch keeper on the body (a double door latches leaf to leaf)
        <rect x={W - 9} y={s.door.latchY - 14} width={5} height={28} rx={1.5} fill={`url(#${p}-shaft)`} stroke="#6d747a" strokeWidth={0.3} />
      )}
      {s.notShown.length > 0 && (
        <T x={W / 2} y={H + 26} size={9} fill="#9b1c1c" weight={600}>{`Not shown: ${s.notShown.join('; ')}`}</T>
      )}
    </g>
  );
}
