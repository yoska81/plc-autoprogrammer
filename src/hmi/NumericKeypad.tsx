import { useEffect, useState } from 'react';
import type { HmiElement } from './types';
import { parseEntry } from './keypad';

/**
 * The panel's numeric keypad for a setpoint: digits, sign, decimal point, limits shown; Enter
 * writes the value when it is within the element's min / max, Esc or Cancel closes it.
 */
export default function NumericKeypad({ el, current, onEnter, onClose }: { el: HmiElement; current: number | boolean | undefined; onEnter: (value: number) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const type = (k: string) => {
    setError(null);
    setText((t) => {
      if (k === '±') return t.startsWith('-') ? t.slice(1) : `-${t}`;
      if (k === '.' && t.includes('.')) return t;
      return t.length >= 12 ? t : t + k;
    });
  };
  const enter = () => {
    const r = parseEntry(text, el);
    if ('error' in r) { setError(r.error); return; }
    onEnter(r.value);
    onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9.]$/.test(e.key)) type(e.key);
      else if (e.key === '-') type('±');
      else if (e.key === 'Backspace') setText((t) => t.slice(0, -1));
      else if (e.key === 'Enter') enter();
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const limits = [el.min !== null ? `min ${el.min}` : null, el.max !== null ? `max ${el.max}` : null].filter(Boolean).join(' · ');
  const key = 'h-11 rounded bg-gray-700 text-white text-lg font-medium hover:bg-gray-600 active:bg-gray-500';
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-label={`Enter ${el.label}`} className="w-64 rounded-lg bg-gray-800 p-3 shadow-xl ring-1 ring-black/50 space-y-2" data-testid="hmi-keypad">
        <div className="text-xs text-gray-300">{el.label}{el.units ? ` (${el.units})` : ''}</div>
        <div className="text-[11px] text-gray-400">Now {typeof current === 'number' ? current : '—'}{limits ? ` · ${limits}` : ''}</div>
        <output aria-label="Entered value" className="block h-10 rounded bg-white px-2 text-right font-mono text-xl leading-10 text-gray-900">{text || ' '}</output>
        {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
        <div className="grid grid-cols-3 gap-1.5">
          {['7', '8', '9', '4', '5', '6', '1', '2', '3', '±', '0', '.'].map((k) => (
            <button key={k} type="button" className={key} onClick={() => type(k)}>{k}</button>
          ))}
          <button type="button" className={`${key} text-sm`} onClick={() => setText((t) => t.slice(0, -1))} aria-label="Backspace">⌫</button>
          <button type="button" className={`${key} text-sm`} onClick={onClose}>Cancel</button>
          <button type="button" className="h-11 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500" onClick={enter}>Enter</button>
        </div>
      </div>
    </div>
  );
}
