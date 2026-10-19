/**
 * Drawing primitives for ladder symbols: contacts, compare boxes, coils and
 * instruction boxes. Each component draws a fixed-size cell whose horizontal
 * wire sits at WIRE_Y so neighbouring cells line up.
 */
import { useContext } from 'react';
import { MnemonicsContext, PlcNamesContext, withPlcNames } from './mnemonics';
import type { LadderElement, LadderOutput } from '../../core/ladder';
import {
  BOX_HEADER, BOX_LINE, BOX_TOP, CELL_W, OUT_W, ROW_H, SYM_H, SYM_TOP, WIRE_Y,
  boxHeight, boxLines, isBox, outputAddress, outputRowHeight,
} from './ladderEdit';

const STROKE = '#1e293b'; // slate-800


/** Small vendor instruction name in the corner of a contact / coil cell. */
function Mnemonic({ k }: { k: string }) {
  const m = useContext(MnemonicsContext)?.[k];
  if (!m) return null;
  return <div className="absolute right-1 font-mono text-[9px] font-bold leading-none text-brand-700" style={{ top: SYM_TOP + SYM_H + 1 }}>{m}</div>;
}

interface CellProps {
  label?: string;
  selected?: boolean;
  /** Draw struck-through text (removed rung). */
  struck?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}

function Address({ text, struck }: { text: string; struck?: boolean }) {
  // The PLC's own tag name on top when it has one (Siemens / Logix); the app operand goes in the small line.
  const native = useContext(PlcNamesContext)?.(text);
  const shown = native?.name ?? text;
  return (
    <div
      className={`absolute inset-x-0 top-0 h-[18px] truncate px-1 text-center font-mono text-[12px] font-bold leading-[18px] ${
        text ? 'text-slate-900' : 'text-red-500'
      } ${struck ? 'line-through' : ''}`}
      title={native ? `${native.name} — app operand ${text}${native.io ? `, ${native.io}` : ''}` : text}
    >
      {shown || '???'}
    </div>
  );
}

/** The small line under a symbol: with a PLC name on top, the app operand (and the PLC's I/O address) first. */
function useSubLabel(address: string, label?: string): string | undefined {
  const native = useContext(PlcNamesContext)?.(address);
  if (!native) return label;
  return [address, native.io, label && label !== native.name ? `· ${label}` : ''].filter(Boolean).join(' ');
}

function Label({ text, top, mnemonic }: { text?: string; top: number; mnemonic?: string }) {
  // Clear of the vendor mnemonic in the corner (Mnemonic) when the cell shows one.
  const pad = useContext(MnemonicsContext)?.[mnemonic ?? ''] ? 30 : undefined;
  if (!text) return null;
  return (
    <div
      className="absolute inset-x-0 truncate px-1 text-center text-[10.5px] leading-[14px] text-slate-500"
      style={{ top, ...(pad ? { paddingRight: pad } : {}) }}
      title={text}
    >
      {text}
    </div>
  );
}

/** Wrapper that makes a cell clickable when editing is enabled. */
function CellShell({
  width, height, selected, onClick, children, title,
}: { width: number; height: number; selected?: boolean; onClick?: CellProps['onClick']; children: React.ReactNode; title?: string }) {
  const interactive = !!onClick;
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      title={title}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e as unknown as React.MouseEvent<HTMLElement>); } } : undefined}
      className={`relative rounded ${interactive ? 'cursor-pointer hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400' : ''} ${
        selected ? 'bg-sky-100 ring-2 ring-sky-400' : ''
      }`}
      style={{ width, height }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- contacts

function ContactSvg({ type }: { type: 'NO' | 'NC' | 'RISE' | 'FALL' }) {
  const c = CELL_W / 2;
  const half = 9;
  const y = SYM_H / 2;
  return (
    <svg width={CELL_W} height={SYM_H} className="absolute left-0" style={{ top: SYM_TOP }} aria-hidden>
      <line x1={0} y1={y} x2={c - half} y2={y} stroke={STROKE} strokeWidth={2} />
      <line x1={c + half} y1={y} x2={CELL_W} y2={y} stroke={STROKE} strokeWidth={2} />
      <line x1={c - half} y1={1} x2={c - half} y2={SYM_H - 1} stroke={STROKE} strokeWidth={2.5} />
      <line x1={c + half} y1={1} x2={c + half} y2={SYM_H - 1} stroke={STROKE} strokeWidth={2.5} />
      {type === 'NC' && <line x1={c - half - 4} y1={SYM_H - 2} x2={c + half + 4} y2={2} stroke={STROKE} strokeWidth={2} />}
      {(type === 'RISE' || type === 'FALL') && (
        <g stroke={STROKE} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1={c} y1={6} x2={c} y2={SYM_H - 6} />
          {type === 'RISE'
            ? <polyline points={`${c - 4},${10} ${c},${6} ${c + 4},${10}`} />
            : <polyline points={`${c - 4},${SYM_H - 10} ${c},${SYM_H - 6} ${c + 4},${SYM_H - 10}`} />}
        </g>
      )}
    </svg>
  );
}

export function ElementCell({ element, label, selected, struck, onClick }: CellProps & { element: LadderElement }) {
  const names = useContext(PlcNamesContext);
  const sub = useSubLabel(element.type === 'CMP' || element.type === 'RAW' ? '' : element.address, label);
  if (element.type === 'CMP') {
    const text = withPlcNames(`${element.left || '?'} ${element.op} ${element.right || '?'}`, names);
    const bw = CELL_W - 12;
    return (
      <CellShell width={CELL_W} height={ROW_H} selected={selected} onClick={onClick} title={text}>
        <div className="absolute left-0 h-[2px] bg-slate-800" style={{ top: WIRE_Y - 1, width: 6 }} />
        <div className="absolute right-0 h-[2px] bg-slate-800" style={{ top: WIRE_Y - 1, width: 6 }} />
        <div className="absolute inset-x-0 top-0 text-center text-[10px] font-semibold uppercase leading-[18px] tracking-wider text-slate-400">
          <CompareTitle op={element.op} />
        </div>
        <div
          className={`absolute flex items-center justify-center rounded-sm border-2 border-slate-800 bg-white px-1 font-mono ${names ? 'text-[10px]' : 'text-[11.5px]'} font-bold text-slate-900 ${struck ? 'line-through' : ''}`}
          style={{ left: 6, top: SYM_TOP, width: bw, height: SYM_H }}
        >
          <span className="truncate">{text}</span>
        </div>
        <Label text={label} top={SYM_TOP + SYM_H + 3} />
      </CellShell>
    );
  }
  if (element.type === 'RAW') {
    // An imported instruction the app can't draw: its original text, dashed (not simulated).
    return (
      <CellShell width={CELL_W} height={ROW_H} selected={selected} onClick={onClick} title={`Not converted: ${element.text}`}>
        <div className="absolute left-0 h-[2px] bg-slate-800" style={{ top: WIRE_Y - 1, width: 6 }} />
        <div className="absolute right-0 h-[2px] bg-slate-800" style={{ top: WIRE_Y - 1, width: 6 }} />
        <div className="absolute inset-x-0 top-0 text-center text-[10px] font-semibold uppercase leading-[18px] tracking-wider text-amber-600">Not converted</div>
        <div
          className={`absolute flex items-center justify-center rounded-sm border-2 border-dashed border-amber-500 bg-amber-50 px-1 font-mono text-[11px] font-bold text-amber-900 ${struck ? 'line-through' : ''}`}
          style={{ left: 6, top: SYM_TOP, width: CELL_W - 12, height: SYM_H }}
        >
          <span className="truncate">{element.text}</span>
        </div>
      </CellShell>
    );
  }
  return (
    <CellShell width={CELL_W} height={ROW_H} selected={selected} onClick={onClick}>
      <Address text={element.address} struck={struck} />
      <ContactSvg type={element.type} />
      <Mnemonic k={element.type} />
      <Label text={sub} top={SYM_TOP + SYM_H + 3} mnemonic={element.type} />
    </CellShell>
  );
}

// ---------------------------------------------------------------- outputs

function CoilSvg({ type }: { type: 'OUT' | 'SET' | 'RST' }) {
  const c = OUT_W / 2;
  const r = 13;
  const y = SYM_H / 2;
  return (
    <svg width={OUT_W} height={SYM_H} className="absolute left-0" style={{ top: SYM_TOP }} aria-hidden>
      <line x1={0} y1={y} x2={c - r} y2={y} stroke={STROKE} strokeWidth={2} />
      <line x1={c + r} y1={y} x2={OUT_W} y2={y} stroke={STROKE} strokeWidth={2} />
      <path d={`M ${c - r + 5} 1 Q ${c - r - 3} ${y} ${c - r + 5} ${SYM_H - 1}`} stroke={STROKE} strokeWidth={2.2} fill="none" />
      <path d={`M ${c + r - 5} 1 Q ${c + r + 3} ${y} ${c + r - 5} ${SYM_H - 1}`} stroke={STROKE} strokeWidth={2.2} fill="none" />
      {type !== 'OUT' && (
        <text x={c} y={y + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fontFamily="ui-monospace, monospace" fill={STROKE}>
          {type === 'SET' ? 'S' : 'R'}
        </text>
      )}
    </svg>
  );
}

const BOX_TITLE: Record<string, string> = { TMR: 'TMR', CNT: 'CNT', COPY: 'COPY', MATH: 'MATH', RAW: 'NOT CONVERTED' };

function CompareTitle({ op }: { op: string }) {
  return <>{useContext(MnemonicsContext)?.[op] ?? 'Compare'}</>;
}

/** Box title: the vendor's instruction (TON / RTO / CTU / MOV / CPT…) when the profile names it. */
function boxTitle(o: LadderOutput, m: Record<string, string> | undefined): string {
  const key = o.type === 'TMR' ? (o.accumulate ? 'TMR_RTO' : `TMR_${o.mode}`) : o.type === 'CNT' ? `CNT_${o.direction}` : o.type;
  return m?.[key] ?? BOX_TITLE[o.type];
}

export function OutputCell({ output, label, selected, struck, onClick }: CellProps & { output: LadderOutput }) {
  const mn = useContext(MnemonicsContext);
  const names = useContext(PlcNamesContext);
  const h = outputRowHeight(output);
  const addr = outputAddress(output);
  const sub = useSubLabel(addr, label);
  if (!isBox(output)) {
    return (
      <CellShell width={OUT_W} height={h} selected={selected} onClick={onClick}>
        <Address text={addr} struck={struck} />
        <CoilSvg type={output.type as 'OUT' | 'SET' | 'RST'} />
        <Mnemonic k={output.type} />
        <Label text={sub} top={SYM_TOP + SYM_H + 3} mnemonic={output.type} />
      </CellShell>
    );
  }
  const bh = boxHeight(output);
  const lines = boxLines(output).map((l) => withPlcNames(l, names));
  const showAddr = output.type === 'TMR' || output.type === 'CNT';
  return (
    <CellShell width={OUT_W} height={h} selected={selected} onClick={onClick}>
      <div className="absolute left-0 h-[2px] bg-slate-800" style={{ top: WIRE_Y - 1, width: 8 }} />
      <div className="absolute right-0 h-[2px] bg-slate-800" style={{ top: WIRE_Y - 1, width: 8 }} />
      <div
        className={`absolute overflow-hidden rounded-sm border-2 border-slate-800 bg-white ${struck ? 'line-through' : ''}`}
        style={{ left: 8, right: 8, top: BOX_TOP, height: bh }}
      >
        <div className="flex items-center gap-2 border-b border-slate-300 bg-slate-100 px-2" style={{ height: BOX_HEADER - 2 }}>
          <span className="text-[11px] font-bold tracking-wider text-slate-600">{boxTitle(output, mn)}</span>
          {showAddr && (
            <span className={`truncate font-mono text-[12px] font-bold ${addr ? 'text-slate-900' : 'text-red-500'}`} title={addr}>{withPlcNames(addr, names).replace(/\.(Q|DN)$/, '') || '???'}</span>
          )}
        </div>
        <div className="px-2 pt-[3px]">
          {lines.map((l, i) => (
            <div key={i} className="truncate font-mono text-[11px] text-slate-700" style={{ height: BOX_LINE, lineHeight: `${BOX_LINE}px` }} title={l}>
              {l}
            </div>
          ))}
        </div>
      </div>
      <Label text={sub} top={BOX_TOP + bh + 3} />
    </CellShell>
  );
}
