/**
 * Floating popover for editing one contact/compare element or one output.
 * Positioned with `position: fixed` from the clicked cell's bounding rect;
 * closes on Escape, outside click, or page scroll.
 */
import { useEffect, useRef } from 'react';
import { TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { CompareOp, LadderElement, LadderOutput, TimeUnit } from '../../core/ladder';
import { defaultElement, defaultOutput, normAddr } from './ladderEdit';
import type { ElementType, OutputType } from './ladderEdit';

export interface Anchor { left: number; top: number; bottom: number }

const inputCls =
  'w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';
const monoCls = `${inputCls} font-mono uppercase`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function AddrInput({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <input
      className={monoCls}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      spellCheck={false}
      onChange={(e) => onChange(normAddr(e.target.value))}
    />
  );
}

const ELEMENT_TYPES: { v: ElementType; l: string }[] = [
  { v: 'NO', l: 'Normally open  -| |-' },
  { v: 'NC', l: 'Normally closed  -|/|-' },
  { v: 'RISE', l: 'Rising edge  -|↑|-' },
  { v: 'FALL', l: 'Falling edge  -|↓|-' },
  { v: 'CMP', l: 'Compare' },
];
const OPS: CompareOp[] = ['==', '<>', '>', '>=', '<', '<='];
const OUTPUT_TYPES: { v: OutputType; l: string }[] = [
  { v: 'OUT', l: 'Out coil  -( )-' },
  { v: 'SET', l: 'Set (latch)  -(S)-' },
  { v: 'RST', l: 'Reset (unlatch)  -(R)-' },
  { v: 'TMR', l: 'Timer' },
  { v: 'CNT', l: 'Counter' },
  { v: 'COPY', l: 'Copy' },
  { v: 'MATH', l: 'Math' },
];
const UNITS: TimeUnit[] = ['ms', 'sec', 'min', 'hour', 'day'];

/** An imported instruction the app can't edit: shown as it was; choosing another instruction replaces it. */
function RawNote({ text }: { text: string }) {
  return (
    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-2">
      From the original program, not converted: <code className="break-all">{text}</code>. It goes back into the PLC as it was; the simulator doesn't run it. Choose an instruction above to replace it.
    </p>
  );
}

function ElementFields({ value, onChange }: { value: LadderElement; onChange: (v: LadderElement) => void }) {
  return (
    <>
      <Field label="Instruction">
        <select className={inputCls} value={value.type} onChange={(e) => onChange(defaultElement(e.target.value as ElementType, value))}>
          {value.type === 'RAW' && <option value="RAW">Not converted (original)</option>}
          {ELEMENT_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </Field>
      {value.type === 'CMP' ? (
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-1.5">
          <Field label="Left"><AddrInput autoFocus value={value.left} onChange={(left) => onChange({ ...value, left })} placeholder="DS1" /></Field>
          <Field label="Op">
            <select className={`${inputCls} font-mono`} value={value.op} onChange={(e) => onChange({ ...value, op: e.target.value as CompareOp })}>
              {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Right"><AddrInput value={value.right} onChange={(right) => onChange({ ...value, right })} placeholder="100" /></Field>
        </div>
      ) : value.type === 'RAW' ? (
        <RawNote text={value.text} />
      ) : (
        <Field label="Address"><AddrInput autoFocus value={value.address} onChange={(address) => onChange({ ...value, address })} placeholder="X001" /></Field>
      )}
    </>
  );
}

function OutputFields({ value, onChange }: { value: LadderOutput; onChange: (v: LadderOutput) => void }) {
  const typeSelect = (
    <Field label="Instruction">
      <select className={inputCls} value={value.type} onChange={(e) => onChange(defaultOutput(e.target.value as OutputType, value))}>
        {value.type === 'RAW' && <option value="RAW">Not converted (original)</option>}
        {OUTPUT_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
      </select>
    </Field>
  );
  switch (value.type) {
    case 'RAW':
      return <>{typeSelect}<RawNote text={value.text} /></>;
    case 'OUT': case 'SET': case 'RST':
      return (
        <>
          {typeSelect}
          <Field label="Address"><AddrInput autoFocus value={value.address} onChange={(address) => onChange({ ...value, address })} placeholder="Y001" /></Field>
        </>
      );
    case 'TMR':
      return (
        <>
          {typeSelect}
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Timer"><AddrInput autoFocus value={value.address} onChange={(address) => onChange({ ...value, address })} placeholder="T1" /></Field>
            <Field label="Mode">
              <select className={inputCls} value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value as 'ON_DELAY' | 'OFF_DELAY' })}>
                <option value="ON_DELAY">On-delay</option>
                <option value="OFF_DELAY">Off-delay</option>
              </select>
            </Field>
            <Field label="Setpoint"><AddrInput value={value.preset} onChange={(preset) => onChange({ ...value, preset })} placeholder="5" /></Field>
            <Field label="Unit">
              <select className={inputCls} value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value as TimeUnit })}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={value.accumulate} onChange={(e) => onChange({ ...value, accumulate: e.target.checked })} />
            Retentive (accumulate)
          </label>
          <Field label="Reset bit (optional)">
            <AddrInput value={value.resetAddress ?? ''} onChange={(v) => onChange({ ...value, resetAddress: v || null })} placeholder="X003" />
          </Field>
        </>
      );
    case 'CNT':
      return (
        <>
          {typeSelect}
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Counter"><AddrInput autoFocus value={value.address} onChange={(address) => onChange({ ...value, address })} placeholder="CT1" /></Field>
            <Field label="Direction">
              <select className={inputCls} value={value.direction} onChange={(e) => onChange({ ...value, direction: e.target.value as 'UP' | 'DOWN' })}>
                <option value="UP">Up</option>
                <option value="DOWN">Down</option>
              </select>
            </Field>
            <Field label="Setpoint"><AddrInput value={value.preset} onChange={(preset) => onChange({ ...value, preset })} placeholder="10" /></Field>
            <Field label="Reset bit"><AddrInput value={value.resetAddress ?? ''} onChange={(v) => onChange({ ...value, resetAddress: v || null })} placeholder="X004" /></Field>
          </div>
        </>
      );
    case 'COPY':
      return (
        <>
          {typeSelect}
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Source"><AddrInput autoFocus value={value.source} onChange={(source) => onChange({ ...value, source })} placeholder="DS1" /></Field>
            <Field label="Destination"><AddrInput value={value.dest} onChange={(dest) => onChange({ ...value, dest })} placeholder="DS2" /></Field>
          </div>
        </>
      );
    case 'MATH':
      return (
        <>
          {typeSelect}
          <Field label="Result"><AddrInput autoFocus value={value.dest} onChange={(dest) => onChange({ ...value, dest })} placeholder="DS2" /></Field>
          <Field label="Formula">
            <input className={`${inputCls} font-mono`} value={value.expression} spellCheck={false} placeholder="DS1 + 1" onChange={(e) => onChange({ ...value, expression: e.target.value })} />
          </Field>
        </>
      );
  }
}

type EditorTarget =
  | { kind: 'element'; value: LadderElement; onChange: (v: LadderElement) => void }
  | { kind: 'output'; value: LadderOutput; onChange: (v: LadderOutput) => void };

export default function ElementEditor({
  anchor, target, onDelete, onClose,
}: { anchor: Anchor; target: EditorTarget; onDelete: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onScroll = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  const width = 290;
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
  const below = window.innerHeight - anchor.bottom > 320;
  const style: React.CSSProperties = below
    ? { left, top: anchor.bottom + 6, width }
    : { left, bottom: window.innerHeight - anchor.top + 6, width };

  return (
    <div ref={ref} className="fixed z-50 rounded-lg border border-slate-300 bg-white p-3 shadow-xl" style={style} role="dialog">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Edit {target.kind === 'element' ? 'condition' : 'output'}
        </span>
        <button type="button" onClick={onClose} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        {target.kind === 'element'
          ? <ElementFields value={target.value} onChange={target.onChange} />
          : <OutputFields value={target.value} onChange={target.onChange} />}
      </div>
      <div className="mt-3 flex justify-between border-t border-slate-100 pt-2">
        <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
          <TrashIcon className="h-3.5 w-3.5" /> Delete
        </button>
        <button type="button" onClick={onClose} className="rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700">
          Done
        </button>
      </div>
    </div>
  );
}
