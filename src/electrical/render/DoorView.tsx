/** Closed door, front view: operators, HMI, disconnect handle, latch, warning label, nameplate. */
import type { DoorItem, Rect } from '../derive';
import { T } from './Devices';
import { opColor } from './scene';
import type { HandleInfo, Scene } from './scene';

const fit = (text: string, width: number, max: number) => Math.min(max, width / Math.max(1, text.length * 0.6));

function Bezel({ r, p }: { r: number; p: string }) {
  return (
    <g>
      <circle r={r + 0.6} fill="#000" opacity={0.25} transform="translate(0.8 1.2)" />
      <circle r={r} fill={`url(#${p}-chrome)`} stroke="#6d747a" strokeWidth={0.35} />
      <circle r={r - 2.2} fill="#1d1e21" />
    </g>
  );
}

function LegendPlate({ lines, p, yellow }: { lines: string[]; p: string; yellow?: boolean }) {
  const fs = Math.min(3.6, ...lines.map((l) => fit(l, 27, 3.6)));
  return (
    <g filter={`url(#${p}-shadowSmall)`}>
      <rect x={-16} y={-35} width={32} height={54} rx={2.2} fill={yellow ? `url(#${p}-yellow)` : '#1b1c1e'} stroke="#000" strokeOpacity={0.4} strokeWidth={0.3} />
      <rect x={-15.2} y={-34.2} width={30.4} height={1.2} rx={0.6} fill="#fff" opacity={0.12} />
      {lines.slice(0, 2).map((l, i, a) => (
        <T key={i} x={0} y={(a.length === 2 ? -27.6 : -25.4) + i * (fs + 1)} size={fs} fill={yellow ? '#111' : '#f4f4f0'} weight={700}>{l}</T>
      ))}
    </g>
  );
}

function Operator({ d, p }: { d: DoorItem; p: string }) {
  const r = d.w / 2;
  const c = opColor(d.color || (d.kind === 'selector' ? 'BLACK' : 'BLACK'));
  const gid = `${p}-op-${d.tag.replace(/[^A-Za-z0-9]/g, '')}`;
  if (d.kind === 'estop') {
    const R = 30;
    return (
      <g transform={`translate(${d.cx} ${d.cy})`}>
        <title>{`${d.tag} — ${d.partNumber} — Emergency stop`}</title>
        <defs>
          <radialGradient id={gid} cx={0.38} cy={0.32} r={0.75}>
            <stop offset={0} stopColor="#ff8b7d" />
            <stop offset={0.35} stopColor="#e2241f" />
            <stop offset={0.85} stopColor="#8f0d0b" />
            <stop offset={1} stopColor="#5f0807" />
          </radialGradient>
          <path id={`${gid}-t`} d={`M${-23.5} 0 A23.5 23.5 0 0 1 23.5 0`} />
          <path id={`${gid}-b`} d={`M${-27.2} 0 A27.2 27.2 0 0 0 27.2 0`} />
        </defs>
        <g filter={`url(#${p}-shadowSmall)`}>
          <circle r={R} fill={`url(#${p}-yellow)`} stroke="#a37c00" strokeWidth={0.4} />
        </g>
        <text fontSize={4} fontWeight={800} fill="#111" letterSpacing={0.4}><textPath href={`#${gid}-t`} startOffset="50%" textAnchor="middle">EMERGENCY</textPath></text>
        <text fontSize={4} fontWeight={800} fill="#111" letterSpacing={0.6}><textPath href={`#${gid}-b`} startOffset="50%" textAnchor="middle">STOP</textPath></text>
        <circle r={16} fill={`url(#${p}-chrome)`} stroke="#5d646a" strokeWidth={0.3} />
        <g filter={`url(#${p}-shadow)`}>
          <circle r={r} fill={`url(#${gid})`} stroke="#5a0706" strokeWidth={0.4} />
        </g>
        <ellipse cx={-r * 0.25} cy={-r * 0.38} rx={r * 0.55} ry={r * 0.3} fill="#fff" opacity={0.28} />
        <path d={`M${-r * 0.45} ${r * 0.42} A${r * 0.62} ${r * 0.62} 0 0 0 ${r * 0.45} ${r * 0.42}`} stroke="#fff" strokeOpacity={0.55} strokeWidth={0.9} fill="none" />
        <path d={`M${r * 0.45} ${r * 0.42} l -0.4 -2.4 l 2.3 0.9 z`} fill="#fff" fillOpacity={0.6} />
      </g>
    );
  }
  if (d.kind === 'hmi') return null;
  return (
    <g transform={`translate(${d.cx} ${d.cy})`}>
      <title>{`${d.tag} — ${d.partNumber} — ${d.legend.join(' ')}${d.color ? ` (${d.color.toLowerCase()})` : ''}`}</title>
      <defs>
        <radialGradient id={gid} cx={0.38} cy={0.32} r={0.75}>
          <stop offset={0} stopColor={c.light} />
          <stop offset={0.5} stopColor={c.base} />
          <stop offset={1} stopColor={c.dark} />
        </radialGradient>
      </defs>
      <LegendPlate lines={d.legend} p={p} />
      <Bezel r={r} p={p} />
      {d.kind === 'pilot' && (
        <g>
          <circle r={r * 1.25} fill={c.base} opacity={0.22} filter={`url(#${p}-glow)`} />
          <circle r={r - 3} fill={`url(#${gid})`} filter={`url(#${p}-glow)`} />
          {[0.35, 0.6].map((k) => <circle key={k} r={(r - 3) * k} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={0.4} />)}
          <circle cx={-(r - 3) * 0.3} cy={-(r - 3) * 0.35} r={(r - 3) * 0.28} fill="#fff" opacity={0.75} />
        </g>
      )}
      {d.kind === 'pushbutton' && (
        <g>
          <circle r={r - 3.2} fill={`url(#${gid})`} stroke={c.dark} strokeWidth={0.4} />
          <ellipse cx={-(r - 3) * 0.15} cy={-(r - 3) * 0.42} rx={(r - 3) * 0.6} ry={(r - 3) * 0.3} fill="#fff" opacity={0.3} />
        </g>
      )}
      {(d.kind === 'selector' || d.kind === 'other') && (
        <g>
          <circle r={r - 3.2} fill={`url(#${p}-devBlack)`} />
          {d.kind === 'selector' && (
            <g transform="rotate(-45)">
              <rect x={-3.2} y={-(r - 4)} width={6.4} height={2 * (r - 4)} rx={2.4} fill="#2b2d31" stroke="#4d5157" strokeWidth={0.5} />
              <rect x={-0.6} y={-(r - 5)} width={1.2} height={r - 6} rx={0.5} fill="#f2f2f2" />
            </g>
          )}
          {d.kind === 'selector' && <>
            <line x1={-r - 1} y1={-r - 1} x2={-r + 1.5} y2={-r + 1.5} stroke="#f4f4f0" strokeWidth={0.6} />
            <line x1={r + 1} y1={-r - 1} x2={r - 1.5} y2={-r + 1.5} stroke="#f4f4f0" strokeWidth={0.6} />
          </>}
        </g>
      )}
    </g>
  );
}

function Hmi({ d, s, p }: { d: DoorItem; s: Scene; p: string }) {
  const { w, h } = d;
  const x = d.cx - w / 2, y = d.cy - h / 2;
  const mx = Math.max(8, w * 0.085), my = Math.max(8, h * 0.11);
  const sx = x + mx, sy = y + my, sw = w - 2 * mx, sh = h - 2 * my;
  const hb = sh * 0.13;
  const scr = s.door.hmiScreen;
  const lamps = scr.lamps.slice(0, 3);
  const bh = sh * 0.2;
  return (
    <g>
      <title>{`${d.tag} — ${d.partNumber} — operator touch panel${d.estimated ? ' (size estimated)' : ''}`}</title>
      <g filter={`url(#${p}-shadow)`}>
        <rect x={x} y={y} width={w} height={h} rx={5} fill={`url(#${p}-hmiBezel)`} stroke="#0c0d0e" strokeWidth={0.5} />
      </g>
      <rect x={x + 1.2} y={y + 1.2} width={w - 2.4} height={h - 2.4} rx={4.2} fill="none" stroke="#fff" strokeOpacity={0.12} strokeWidth={0.8} />
      <rect x={sx - 1.5} y={sy - 1.5} width={sw + 3} height={sh + 3} rx={1.2} fill="#0b0c0d" />
      <rect x={sx} y={sy} width={sw} height={sh} fill={`url(#${p}-screen)`} />
      <rect x={sx} y={sy} width={sw} height={hb} fill="#2b4a6f" />
      <T x={sx + 3} y={sy + hb * 0.68} size={hb * 0.5} fill="#ffffff" anchor="start" weight={700}>{scr.title.slice(0, 28)}</T>
      <T x={sx + sw - 3} y={sy + hb * 0.68} size={hb * 0.42} fill="#cfe0f2" anchor="end">MAIN</T>
      {lamps.map((l, i) => {
        const ly = sy + hb + sh * 0.12 + i * sh * 0.15;
        const col = opColor(l.color || 'GREEN');
        return (
          <g key={i}>
            <circle cx={sx + sw * 0.07} cy={ly} r={sh * 0.045} fill={col.base} stroke="#333" strokeWidth={0.3} />
            <T x={sx + sw * 0.13} y={ly + sh * 0.025} size={sh * 0.065} fill="#1f2328" anchor="start" weight={600}>{l.text.slice(0, 18)}</T>
          </g>
        );
      })}
      {scr.buttons.map((bt, i) => {
        const col = opColor(bt.color || 'BLACK');
        const n = scr.buttons.length;
        const gap = sw * 0.03;
        const bw2 = Math.min(sw * 0.3, (sw - gap * (n + 1)) / n);
        const bx = sx + sw - (n - i) * (bw2 + gap);
        const by = sy + sh - sh * 0.14 - bh - 2;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={bw2} height={bh} rx={1.4} fill={col.base} stroke={col.dark} strokeWidth={0.4} />
            <rect x={bx + 0.8} y={by + 0.8} width={bw2 - 1.6} height={bh * 0.35} rx={1} fill="#fff" opacity={0.18} />
            <T x={bx + bw2 / 2} y={by + bh / 2 + sh * 0.022} size={Math.min(sh * 0.065, (bw2 - 2) / Math.max(1, bt.text.length * 0.62))} fill={bt.color === 'WHITE' || bt.color === 'YELLOW' ? '#111' : '#fff'} weight={700}>{bt.text}</T>
          </g>
        );
      })}
      <rect x={sx} y={sy + sh - sh * 0.11} width={sw} height={sh * 0.11} fill="#3b4652" />
      {['MAIN', 'ALARMS', 'I/O'].map((t, i) => <T key={t} x={sx + sw * (0.17 + i * 0.33)} y={sy + sh - sh * 0.035} size={sh * 0.05} fill="#e5ebf1" weight={600}>{t}</T>)}
      <rect x={sx} y={sy} width={sw} height={sh} fill={`url(#${p}-glossDiag)`} />
      <circle cx={x + w - mx / 2} cy={y + h - my / 2} r={1.1} fill="#3cff6a" filter={`url(#${p}-ledGlow)`} />
      {s.door.hmiOverflow && <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={6} fill="none" stroke="#d32f2f" strokeWidth={1.2} strokeDasharray="5 3" />}
    </g>
  );
}

function DisconnectHandle({ h, p }: { h: HandleInfo; p: string }) {
  const plate = h.plate === 'yellow' ? `url(#${p}-yellow)` : h.plate === 'blue' ? '#3f5a7a' : h.plate === 'black' ? '#202226' : '#6a6f75';
  const lever = h.lever === 'red' ? ['#e2362e', '#8f100c'] : ['#3a3c40', '#0f1012'];
  const ink = h.plate === 'yellow' ? '#111' : '#f2f2f2';
  return (
    <g transform={`translate(${h.x} ${h.y})`}>
      <title>{`${h.tag}${h.partNumber ? ` — ${h.partNumber}` : ''} — disconnect handle (OFF)`}</title>
      <g filter={`url(#${p}-shadow)`}>
        <rect x={-33} y={-33} width={66} height={66} rx={5} fill={plate} stroke="#00000066" strokeWidth={0.4} />
      </g>
      <T x={-22} y={2} size={6} fill={ink} weight={800}>O</T>
      <T x={0} y={-22} size={6} fill={ink} weight={800}>I</T>
      <T x={-21} y={10} size={3.4} fill={ink} weight={700}>OFF</T>
      <T x={11} y={-21} size={3.4} fill={ink} weight={700}>ON</T>
      <circle r={17} fill="#00000022" />
      <g filter={`url(#${p}-shadow)`}>
        <circle r={14} fill={lever[0]} stroke={lever[1]} strokeWidth={0.6} />
        <rect x={-30} y={-6.5} width={44} height={13} rx={6.5} fill={lever[0]} stroke={lever[1]} strokeWidth={0.6} />
      </g>
      <rect x={-28} y={-5.5} width={38} height={3} rx={1.5} fill="#fff" opacity={0.25} />
      <circle r={5} fill={lever[1]} opacity={0.35} />
      <rect x={-38} y={-4} width={7} height={8} rx={1.2} fill={`url(#${p}-chrome)`} />
      <circle cx={-34.5} cy={0} r={1.6} fill="#333" />
    </g>
  );
}

function WarningLabel({ r, p }: { r: Rect; p: string }) {
  const band = r.h * 0.3;
  const tri = band * 0.8;
  const lines = ['HAZARDOUS VOLTAGE', 'Arc flash and shock hazard.', 'Lock out power before', 'opening this door.'];
  const fs = Math.min((r.w - 6) / (17 * 0.6), (r.h - band - 5) / (lines.length * 1.18));
  return (
    <g filter={`url(#${p}-shadowSmall)`}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={1.6} fill="#ffffff" stroke="#111" strokeWidth={0.6} />
      <rect x={r.x + 1} y={r.y + 1} width={r.w - 2} height={band} rx={1} fill="#f47b20" />
      <g transform={`translate(${r.x + 3 + tri / 2} ${r.y + 1 + band / 2})`}>
        <path d={`M0 ${-tri / 2} L${tri / 2} ${tri / 2.4} L${-tri / 2} ${tri / 2.4} Z`} fill="#111" stroke="#111" strokeWidth={0.8} strokeLinejoin="round" />
        <path d={`M0 ${-tri / 2 + 2.2} L${tri / 2 - 2.4} ${tri / 2.4 - 1.2} L${-tri / 2 + 2.4} ${tri / 2.4 - 1.2} Z`} fill="#f47b20" />
        <path d={`M${tri * 0.04} ${-tri * 0.22} L${-tri * 0.1} ${tri * 0.04} L${tri * 0.02} ${tri * 0.04} L${-tri * 0.06} ${tri * 0.28} L${tri * 0.12} ${-tri * 0.02} L${0} ${-tri * 0.02} Z`} fill="#111" />
      </g>
      <T x={r.x + 6 + tri + (r.w - 6 - tri) / 2} y={r.y + 1 + band * 0.7} size={band * 0.58} weight={900} fill="#111">WARNING</T>
      {lines.map((l, i) => <T key={i} x={r.x + r.w / 2} y={r.y + band + 2 + fs * 1.18 * (i + 1)} size={i === 0 ? fs * 1.05 : fs * 0.86} fill="#111" weight={i === 0 ? 900 : 600}>{l}</T>)}
    </g>
  );
}

function Nameplate({ r, lines, p }: { r: Rect; lines: string[]; p: string }) {
  const f0 = fit(lines[0], r.w - 12, r.h * 0.24);
  const f1 = Math.min(r.h * 0.15, ...lines.slice(1).map((l) => fit(l, r.w - 12, r.h * 0.15)));
  return (
    <g filter={`url(#${p}-shadowSmall)`}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={2} fill={`url(#${p}-brushed)`} stroke="#80868c" strokeWidth={0.5} />
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={2} fill={`url(#${p}-brushLines)`} />
      {[[r.x + 3.5, r.y + 3.5], [r.x + r.w - 3.5, r.y + 3.5], [r.x + 3.5, r.y + r.h - 3.5], [r.x + r.w - 3.5, r.y + r.h - 3.5]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} fill={`url(#${p}-screw)`} stroke="#5f666c" strokeWidth={0.2} />
      ))}
      <T x={r.x + r.w / 2} y={r.y + r.h * 0.38} size={f0} fill="#1d2024" weight={800}>{lines[0]}</T>
      {lines.slice(1).map((l, i) => <T key={i} x={r.x + r.w / 2} y={r.y + r.h * 0.38 + f0 * 0.5 + f1 * 1.35 * (i + 1)} size={f1} fill="#2c3036" weight={600}>{l}</T>)}
    </g>
  );
}

export function DoorView({ s, p, vb }: { s: Scene; p: string; vb: Rect }) {
  const D = s.door;
  const { w: W, h: H } = D;
  const hinge = (y: number) => (
    <g key={y} filter={`url(#${p}-shadowSmall)`}>
      <rect x={-5} y={y - 20} width={8} height={40} rx={3.6} fill={`url(#${p}-hinge)`} stroke="#5b5e5a" strokeWidth={0.3} />
      <line x1={-5} x2={3} y1={y} y2={y} stroke="#4d504c" strokeWidth={0.5} />
    </g>
  );
  return (
    <g>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={`url(#${p}-backdrop)`} />
      <g filter={`url(#${p}-shadowSoft)`}>
        <rect x={0} y={0} width={W} height={H} rx={7} fill={`url(#${p}-steelV)`} stroke="#8f928d" strokeWidth={0.6} />
      </g>
      {/* door leaf */}
      <rect x={3} y={3} width={W - 6} height={H - 6} rx={6} fill={`url(#${p}-doorFace)`} stroke="#9b9e99" strokeWidth={0.6} />
      {D.finish === 'stainless' && <rect x={3} y={3} width={W - 6} height={H - 6} rx={6} fill={`url(#${p}-brushLines)`} />}
      <rect x={3} y={3} width={W - 6} height={H - 6} rx={6} fill={`url(#${p}-doorSheen)`} />
      <rect x={4.2} y={4.2} width={W - 8.4} height={H - 8.4} rx={5.4} fill="none" stroke="#ffffff" strokeOpacity={0.7} strokeWidth={1} />
      <rect x={10} y={10} width={W - 20} height={H - 20} rx={4} fill="none" stroke="#000" strokeOpacity={0.06} strokeWidth={1.4} />
      {hinge(H * 0.15)}
      {hinge(H * 0.85)}
      {/* latch */}
      {D.latch === 'quarter-turn' ? (
        <g transform={`translate(${W - 22} ${D.latchY})`} filter={`url(#${p}-shadowSmall)`}>
          <circle r={9} fill={`url(#${p}-chrome)`} stroke="#5f666c" strokeWidth={0.4} />
          <circle r={6} fill="#2a2c30" />
          <rect x={-4.5} y={-1.1} width={9} height={2.2} rx={0.6} fill="#9aa1a7" transform="rotate(-20)" />
        </g>
      ) : (
        <g transform={`translate(${W - 24} ${D.latchY})`} filter={`url(#${p}-shadow)`}>
          <rect x={-9} y={-34} width={18} height={68} rx={4} fill="#2b2d31" stroke="#16171a" strokeWidth={0.5} />
          <rect x={-5} y={-30} width={10} height={44} rx={4} fill={`url(#${p}-devBlack)`} stroke="#4b4f55" strokeWidth={0.4} />
          <rect x={-3.6} y={-28} width={2.2} height={38} rx={1} fill="#fff" opacity={0.16} />
          <circle cx={0} cy={24} r={4} fill={`url(#${p}-chrome)`} />
          <rect x={-0.8} y={21.6} width={1.6} height={4.8} fill="#333" />
        </g>
      )}
      {D.handle && <DisconnectHandle h={D.handle} p={p} />}
      {D.items.map((d) => (d.kind === 'hmi' ? <Hmi key={d.tag} d={d} s={s} p={p} /> : <Operator key={d.tag} d={d} p={p} />))}
      <WarningLabel r={D.warning} p={p} />
      <Nameplate r={D.nameplate} lines={D.nameLines} p={p} />
      {D.hmiOverflow && <T x={W / 2} y={H + 24} size={9} fill="#9b1c1c" weight={600}>HMI does not fit the door at the standard spacing — choose a larger enclosure or a smaller HMI.</T>}
    </g>
  );
}
