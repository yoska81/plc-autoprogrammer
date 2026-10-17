import { useEffect, useRef, useState } from 'react';
import type { HmiLook } from './types';
import { HMI_LOOKS, hmiTheme, LOOK_LABEL, LOOK_NOTE, shade } from './theme';

/**
 * Small preview of a look: header band, a START and a STOP key, two lamps, a value
 * field and the navigation band, drawn with the look's colours and shapes.
 */
export function LookSwatch({ look, width = 72 }: { look: HmiLook; width?: number }) {
  const t = hmiTheme(look);
  const s = t.shape;
  const r = Math.min(4, s.radius * 0.5);
  const key = (x: number, fill: string, edge: string, label: string, color: string) => (
    <g>
      {s.button === 'flat'
        ? <rect x={x + 0.25} y={15.25} width={21.5} height={11.5} rx={r} fill={fill} stroke={edge} strokeWidth={0.5} />
        : <><rect x={x} y={15} width={22} height={12} rx={r} fill={edge} /><rect x={x + 0.6} y={15.6} width={20.8} height={s.button === 'bevel' ? 10.2 : 10.8} rx={Math.max(0, r - 0.6)} fill={fill} /></>}
      {s.button === 'gloss' && <rect x={x + 1} y={16} width={20} height={4.6} rx={Math.max(0, r - 1)} fill="#ffffff" opacity={0.3} />}
      <text x={x + 11} y={21} fill={color} fontSize={4.6} fontFamily={t.font} fontWeight={700} textAnchor="middle" dominantBaseline="central">{label}</text>
    </g>
  );
  const lamp = (cx: number, on: boolean) => {
    const fill = on ? t.ok : t.lampOff;
    return (
      <g>
        {s.lamp === 'round'
          ? <circle cx={cx} cy={21} r={4} fill={fill} stroke={t.bevel} strokeWidth={0.5} />
          : <rect x={cx - 4} y={17} width={8} height={8} rx={s.lamp === 'rounded' ? 1.8 : 0.5} fill={fill} stroke={t.bevel} strokeWidth={0.5} />}
        {s.lampGloss && <circle cx={cx - 1.2} cy={19.7} r={1.3} fill="#ffffff" opacity={0.55} />}
      </g>
    );
  };
  const start = s.colorKeys ? { fill: t.ok, edge: shade(t.ok, -0.25), color: '#ffffff' } : { fill: t.button, edge: t.bevel, color: t.buttonText };
  const stop = s.colorKeys ? { fill: t.alarm, edge: shade(t.alarm, -0.25), color: '#ffffff' } : { fill: t.button, edge: t.bevel, color: t.buttonText };
  const startLabel = t.caps('Start'), stopLabel = t.caps('Stop');
  return (
    <svg viewBox="0 0 88 52" width={width} height={(width * 52) / 88} aria-hidden="true" className="block shrink-0 rounded-sm border border-gray-300">
      <rect x={0} y={0} width={88} height={52} fill={t.screen} />
      <rect x={0} y={0} width={88} height={10} fill={t.header} />
      {s.header === 'gloss' && <rect x={0} y={0} width={88} height={5} fill="#ffffff" opacity={0.12} />}
      <rect x={0} y={t.headerAccent !== t.header ? 8.5 : 9.5} width={88} height={t.headerAccent !== t.header ? 1.5 : 0.5} fill={t.headerAccent !== t.header ? t.headerAccent : t.headerLine} />
      <rect x={4} y={3.5} width={22} height={2.4} rx={0.6} fill={t.headerText} />
      <rect x={30} y={3.5} width={16} height={2.4} rx={0.6} fill={t.headerDim} opacity={0.8} />
      <rect x={68} y={2.6} width={16} height={4.4} rx={Math.min(2.2, s.badgeRadius)} fill={t.headerBadge} stroke={t.headerBadgeLine} strokeWidth={0.4} />
      {key(5, start.fill, start.edge, startLabel, start.color)}
      {key(31, stop.fill, stop.edge, stopLabel, stop.color)}
      {lamp(64, true)}
      {lamp(77, false)}
      <rect x={5.25} y={30.25} width={48} height={7} rx={Math.min(1.5, s.boxRadius)} fill={t.field} stroke={t.line} strokeWidth={0.5} />
      <rect x={38} y={32.4} width={12} height={2.6} rx={0.5} fill={t.text} />
      <rect x={58} y={31.5} width={26} height={4.5} rx={0.5} fill={t.trend} opacity={0.85} />
      <rect x={0} y={41} width={88} height={11} fill={t.navBand} />
      {[0, 1, 2].map((i) => {
        const x = 4 + i * 28, active = i === 0;
        return s.nav === 'tabs'
          ? <g key={i}><rect x={x} y={42.5} width={24} height={8} rx={Math.min(2, r)} fill={active ? t.navActive : t.navBand} stroke={active ? t.accent : t.lineSoft} strokeWidth={0.4} />{active && <rect x={x + 2} y={49} width={20} height={1.2} fill={t.accent} />}</g>
          : <rect key={i} x={x} y={42.5} width={24} height={8} rx={Math.min(2, r)} fill={active ? t.navActive : t.button} stroke={active ? shade(t.navActive, -0.25) : t.bevel} strokeWidth={0.5} />;
      })}
    </svg>
  );
}

/**
 * The Look picker of the HMI page: the current look with its preview, opening a list of every
 * look with a thumbnail. "Match the panel" (no look stored) follows the panel's maker.
 */
export default function LookPicker({ value, makerLook, makerName, onChange }: {
  /** The look the user picked; undefined = match the panel's maker. */
  value: HmiLook | undefined;
  makerLook: HmiLook;
  makerName: string;
  onChange: (look: HmiLook | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const shown = value ?? makerLook;
  const pick = (l: HmiLook | undefined) => { onChange(l); setOpen(false); };
  const option = (key: string, look: HmiLook, label: string, note: string, selected: boolean, l: HmiLook | undefined) => (
    <button key={key} type="button" role="option" aria-selected={selected} data-look={key} onClick={() => pick(l)}
      className={`w-full flex items-center gap-2 px-2 py-1.5 text-left rounded ${selected ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-gray-50'}`}>
      <LookSwatch look={look} width={64} />
      <span className="min-w-0">
        <span className="block text-xs font-medium text-gray-800">{label}</span>
        <span className="block text-[11px] leading-tight text-gray-600">{note}</span>
      </span>
    </button>
  );
  return (
    <div ref={box} className="relative flex-1 min-w-0">
      <button type="button" aria-label="HMI look" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 border border-gray-300 rounded px-1.5 py-1 bg-white text-left hover:border-gray-400">
        <LookSwatch look={shown} width={44} />
        <span className="flex-1 min-w-0 truncate text-gray-800">{LOOK_LABEL[shown]}{value === undefined ? ' (panel)' : ''}</span>
        <span aria-hidden="true" className="text-gray-500">▾</span>
      </button>
      {open && (
        <div role="listbox" aria-label="HMI looks" className="absolute z-30 right-0 mt-1 w-72 max-h-[26rem] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg p-1">
          {option('auto', makerLook, `Match the panel (${LOOK_LABEL[makerLook]})`, `Follows the ${makerName} panel; changes with the panel.`, value === undefined, undefined)}
          <div className="my-1 border-t border-gray-100" />
          {HMI_LOOKS.map((l) => option(l, l, l === makerLook ? `${LOOK_LABEL[l]} · panel maker` : LOOK_LABEL[l], LOOK_NOTE[l], value === l, l))}
        </div>
      )}
    </div>
  );
}
