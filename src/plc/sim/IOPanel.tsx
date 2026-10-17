/**
 * Right column of the simulator: I/O with forcing, internal memory (C bits,
 * timers, counters, registers) and the event log.
 */
import type { CounterState, TimerState } from './engine';
import { isBitAddress } from './engine';
import type { LogEntry } from './controller';

interface Props {
  inputs: string[];
  outputs: string[];
  cBits: string[];
  timerAddrs: string[];
  counterAddrs: string[];
  registers: string[];
  fieldInputs: Map<string, boolean>;
  bits: Map<string, boolean>;
  words: Map<string, number>;
  forces: Map<string, boolean | number>;
  /** Values held from outside the selected block. */
  holds?: Map<string, boolean | number>;
  /** Input address -> label of the bypassed device driving it. */
  bypassedInputs?: Map<string, string>;
  timers: Map<string, TimerState>;
  counters: Map<string, CounterState>;
  log: LogEntry[];
  labelOf: (address: string) => string;
  onForce: (address: string, value: boolean | null) => void;
  onWrite: (address: string, value: boolean | number) => void;
}

function Dot({ on, color }: { on: boolean; color: 'sky' | 'emerald' | 'violet' }) {
  const bg = { sky: 'bg-brand-500', emerald: 'bg-emerald-500', violet: 'bg-violet-500' }[color];
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/10 ${on ? bg : 'bg-steel-200'}`} />;
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="sticky top-0 z-[1] flex items-center gap-1 border-b border-steel-200 bg-steel-50/95 px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide text-steel-500 backdrop-blur">
        {title}{count !== undefined && <span className="font-normal text-steel-400">({count})</span>}
      </h4>
      <div className="px-1.5 py-1">{children}</div>
    </section>
  );
}

function ForceButtons({ address, force, onForce }: { address: string; force: boolean | number | undefined; onForce: Props['onForce'] }) {
  const btn = (active: boolean, extra: string) =>
    `px-1.5 py-px text-[9.5px] font-bold first:rounded-l last:rounded-r border border-steel-300 -ml-px first:ml-0 ${active ? extra : 'bg-white text-steel-500 hover:bg-steel-50'}`;
  return (
    <div className="flex shrink-0" title="Force: override the field/program value">
      <button type="button" className={btn(force === undefined, 'bg-steel-600 text-white')} onClick={() => onForce(address, null)}>AUTO</button>
      <button type="button" className={btn(force === true, 'bg-amber-500 text-amber-950')} onClick={() => onForce(address, true)}>ON</button>
      <button type="button" className={btn(force === false, 'bg-amber-500 text-amber-950')} onClick={() => onForce(address, false)}>OFF</button>
    </div>
  );
}

type Mark = { text: string; title: string } | null;

function BitRow({ address, on, color, label, right, mark }: { address: string; on: boolean; color: 'sky' | 'emerald' | 'violet'; label: string; right?: React.ReactNode; mark?: Mark }) {
  return (
    <div className={`flex items-center gap-2 rounded px-1.5 py-[3px] ${mark ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : on ? 'bg-steel-50' : ''}`}>
      <Dot on={on} color={color} />
      <span className="w-11 shrink-0 font-mono text-[12px] font-bold text-steel-700">{address}</span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-steel-600" title={label}>{label}</span>
      {mark && <span className="shrink-0 rounded bg-amber-500 px-1 text-[9.5px] font-bold text-amber-950" title={mark.title}>{mark.text}</span>}
      {right}
    </div>
  );
}

const onOff = (v: boolean | number) => (typeof v === 'number' ? String(v) : v ? 'ON' : 'OFF');

function markOf(p: Props, a: string): Mark {
  const f = p.forces.get(a);
  if (f !== undefined) return { text: `FORCED ${onOff(f)}`, title: 'Forced by you: overrides the field / program value' };
  const h = p.holds?.get(a);
  if (h !== undefined) return { text: `HELD ${onOff(h)}`, title: 'Held because it comes from outside the selected block' };
  const b = p.bypassedInputs?.get(a);
  if (b !== undefined) return { text: 'BYPASS', title: `Driven by bypassed device: ${b}` };
  return null;
}

function fmtTime(ms: number) {
  return `${(ms / 1000).toFixed(2)} s`;
}

export default function IOPanel(p: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Inputs X" count={p.inputs.length}>
          {p.inputs.map((a) => (
            <BitRow key={a} address={a} on={p.fieldInputs.get(a) ?? false} color="sky" label={p.labelOf(a)} mark={markOf(p, a)}
              right={<ForceButtons address={a} force={p.forces.get(a)} onForce={p.onForce} />} />
          ))}
          {!p.inputs.length && <p className="px-2 py-1 text-[11px] text-steel-400">none</p>}
        </Section>
        <Section title="Outputs Y" count={p.outputs.length}>
          {p.outputs.map((a) => (
            <BitRow key={a} address={a} on={p.bits.get(a) ?? false} color="emerald" label={p.labelOf(a)} mark={markOf(p, a)}
              right={<ForceButtons address={a} force={p.forces.get(a)} onForce={p.onForce} />} />
          ))}
          {!p.outputs.length && <p className="px-2 py-1 text-[11px] text-steel-400">none</p>}
        </Section>
        {p.cBits.length > 0 && (
          <Section title="Control bits C" count={p.cBits.length}>
            {p.cBits.map((a) => {
              const on = p.bits.get(a) ?? false;
              return (
                <BitRow key={a} address={a} on={on} color="violet" label={p.labelOf(a)} mark={markOf(p, a)}
                  right={<ForceButtons address={a} force={p.forces.get(a)} onForce={p.onForce} />} />
              );
            })}
          </Section>
        )}
        {p.timerAddrs.length > 0 && (
          <Section title="Timers T / TD" count={p.timerAddrs.length}>
            {p.timerAddrs.map((a) => {
              const t = p.timers.get(a);
              const pct = t && t.presetMs > 0 ? Math.min(100, (t.accMs / t.presetMs) * 100) : 0;
              return (
                <div key={a} className="px-1.5 py-1">
                  <div className="flex items-center gap-2">
                    <Dot on={t?.done ?? false} color="emerald" />
                    <span className="w-11 shrink-0 font-mono text-[11px] font-bold text-steel-700">{a}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-steel-600">{p.labelOf(a)}</span>
                    <span className="font-mono text-[10.5px] text-steel-600">TD{a.slice(1)} = {p.words.get(`TD${a.slice(1)}`) ?? 0}</span>
                  </div>
                  <div className="ml-[18px] mt-0.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded bg-steel-200"><div className="h-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
                    <span className="w-24 text-right font-mono text-[10px] text-steel-500">{t ? `${(t.accMs / 1000).toFixed(2)} / ${(t.presetMs / 1000).toFixed(2)} s` : '—'}</span>
                  </div>
                </div>
              );
            })}
          </Section>
        )}
        {p.counterAddrs.length > 0 && (
          <Section title="Counters CT / CTD" count={p.counterAddrs.length}>
            {p.counterAddrs.map((a) => {
              const c = p.counters.get(a);
              return (
                <BitRow key={a} address={a} on={c?.done ?? false} color="emerald" label={p.labelOf(a)} mark={markOf(p, a)}
                  right={<span className="font-mono text-[10.5px] text-steel-600">{c ? `${c.value} / ${c.preset}` : '0'}</span>} />
              );
            })}
          </Section>
        )}
        {p.registers.length > 0 && (
          <Section title="Registers" count={p.registers.length}>
            {p.registers.map((a) => {
              const mark = markOf(p, a);
              return (
              <div key={a} className={`flex items-center gap-2 rounded px-1.5 py-[3px] ${mark ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : ''}`}>
                <span className="w-11 shrink-0 font-mono text-[12px] font-bold text-steel-700">{a}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-steel-600">{p.labelOf(a)}</span>
                {mark && <span className="shrink-0 rounded bg-amber-500 px-1 text-[9.5px] font-bold text-amber-950" title={mark.title}>{mark.text}</span>}
                <input
                  key={`${a}:${p.words.get(a) ?? 0}`}
                  type="number"
                  step="any"
                  defaultValue={p.words.get(a) ?? 0}
                  title="Type a value and press Enter to write it"
                  className="w-20 rounded border border-steel-300 px-1 py-px text-right font-mono text-[11px] focus:border-brand-400 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) p.onWrite(a, v); }
                  }}
                />
              </div>
              );
            })}
          </Section>
        )}
      </div>
      <div className="flex h-[34%] min-h-[130px] flex-col border-t border-steel-200">
        <h4 className="flex items-center justify-between bg-steel-50 px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide text-steel-500">
          Event log <span className="font-normal normal-case text-steel-400">{p.log.length} events</span>
        </h4>
        <ol className="min-h-0 flex-1 overflow-y-auto px-2 py-1 font-mono text-[11px]">
          {p.log.map((e) => {
            const bit = isBitAddress(e.address);
            return (
              <li key={e.id} className="flex gap-2 py-px">
                <span className="w-[62px] shrink-0 text-right text-steel-400">{fmtTime(e.timeMs)}</span>
                <span className="w-10 shrink-0 font-bold text-steel-700">{e.address}</span>
                <span className="min-w-0 flex-1 truncate font-sans text-steel-600">{p.labelOf(e.address)}</span>
                {bit && <span className={`w-7 shrink-0 font-bold ${e.value ? 'text-emerald-600' : 'text-steel-400'}`}>{e.value ? 'ON' : 'OFF'}</span>}
              </li>
            );
          })}
          {!p.log.length && <li className="py-2 text-center font-sans text-steel-400">Press Run, then operate the machine.</li>}
        </ol>
      </div>
    </div>
  );
}
