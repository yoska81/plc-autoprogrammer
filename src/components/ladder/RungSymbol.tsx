/**
 * Drawing primitives for ladder symbols: contacts, compare boxes, coils and
 * instruction boxes. Each component draws a fixed-size cell whose horizontal
 * wire sits at WIRE_Y so neighbouring cells line up.
 */
import type { LadderElement, LadderOutput } from '../../plc/ladder';
import {
  BOX_HEADER, BOX_LINE, BOX_TOP, CELL_W, OUT_W, ROW_H, SYM_H, SYM_TOP, WIRE_Y,
  boxHeight, boxLines, isBox, outputAddress, outputRowHeight,
} from './ladderEdit';

const STROKE = '#1e293b'; // slate-800

interface CellProps {
  label?: string;
  selected?: boolean;
  /** Draw struck-through text (removed rung). */
  struck?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}

function Address({ text, struck }: { text: string; struck?: boolean }) {
  return (
    <div
      className={`absolute inset-x-0 top-0 h-[18px] truncate px-1 text-center font-mono text-[12px] font-bold leading-[18px] ${
        text ? 'text-slate-900' : 'text-red-500'
      } ${struck ? 'line-through' : ''}`}
      title={text}
    >
      {text || '???'}
    </div>
  );
}

function Label({ text, top }: { text?: string; top: number }) {
  if (!text) return null;
  return (
    <div
      className="absolute inset-x-0 truncate px-1 text-center text-[10.5px] leading-[14px] text-slate-500"
      style={{ top }}
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
  if (element.type === 'CMP') {
    const text = `${element.left || '?'} ${element.op} ${element.right || '?'}`;
    const bw = CELL_W - 12;
    return (
      <CellShell width={CELL_W} height={ROW_H} selected={selected} onClick={onClick} title={text}>
        <div className="absolute left-0 h-[2px] bg-slate-800" style={{ top: WIRE_Y - 1, width: 6 }} />
        <div className="absolute right-0 h-[2px] bg-slate-800" style={{ top: WIRE_Y - 1, width: 6 }} />
        <div className="absolute inset-x-0 top-0 text-center text-[10px] font-semibold uppercase leading-[18px] tracking-wider text-slate-400">
          Compare
        </div>
        <div
          className={`absolute flex items-center justify-center rounded-sm border-2 border-slate-800 bg-white px-1 font-mono text-[11.5px] font-bold text-slate-900 ${struck ? 'line-through' : ''}`}
          style={{ left: 6, top: SYM_TOP, width: bw, height: SYM_H }}
        >
          <span className="truncate">{text}</span>
        </div>
        <Label text={label} top={SYM_TOP + SYM_H + 3} />
      </CellShell>
    );
  }
  return (
    <CellShell width={CELL_W} height={ROW_H} selected={selected} onClick={onClick}>
      <Address text={element.address} struck={struck} />
      <ContactSvg type={element.type} />
      <Label text={label} top={SYM_TOP + SYM_H + 3} />
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

const BOX_TITLE: Record<string, string> = { TMR: 'TMR', CNT: 'CNT', COPY: 'COPY', MATH: 'MATH' };

export function OutputCell({ output, label, selected, struck, onClick }: CellProps & { output: LadderOutput }) {
  const h = outputRowHeight(output);
  const addr = outputAddress(output);
  if (!isBox(output)) {
    return (
      <CellShell width={OUT_W} height={h} selected={selected} onClick={onClick}>
        <Address text={addr} struck={struck} />
        <CoilSvg type={output.type as 'OUT' | 'SET' | 'RST'} />
        <Label text={label} top={SYM_TOP + SYM_H + 3} />
      </CellShell>
    );
  }
  const bh = boxHeight(output);
  const lines = boxLines(output);
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
          <span className="text-[11px] font-bold tracking-wider text-slate-600">{BOX_TITLE[output.type]}</span>
          {showAddr && (
            <span className={`truncate font-mono text-[12px] font-bold ${addr ? 'text-slate-900' : 'text-red-500'}`}>{addr || '???'}</span>
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
      <Label text={label} top={BOX_TOP + bh + 3} />
    </CellShell>
  );
}
