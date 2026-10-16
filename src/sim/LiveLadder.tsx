/**
 * Compact live ladder: every rung with its power flow from the last scan.
 * Conducting contacts and wires are green, closed-but-unpowered contacts have
 * a green outline, energized outputs are filled.
 */
import type { LadderElement, LadderOutput, LadderProgram, Rung } from '../plc/ladder';
import type { CounterState, RungPower, TimerState } from './engine';
import { normAddress, unitMs } from './engine';

interface Props {
  program: LadderProgram;
  power: Map<string, RungPower>;
  bits: Map<string, boolean>;
  words: Map<string, number>;
  timers: Map<string, TimerState>;
  counters: Map<string, CounterState>;
  labelOf: (address: string) => string;
  /** Rungs bypassed by the engineer. */
  rungBypass?: Set<string>;
  /** Rungs skipped by a block-only run. */
  skipped?: Set<string>;
  onBypassRung?: (rungId: string, bypassed: boolean) => void;
  /** Rung groups to show (blocks). Omitted = every rung, ungrouped. */
  groups?: { id: string; name: string; description?: string; rungIds: string[] }[];
}

type RungProps = Omit<Props, 'program' | 'power' | 'rungBypass' | 'skipped' | 'onBypassRung' | 'groups'> & {
  rung: Rung; index: number; p: RungPower | undefined;
  bypassed: boolean; skippedByBlock: boolean; onBypass?: (on: boolean) => void;
};

const ROW = 52; // px per branch / output row
const MID = ROW / 2;
const ON = '#16a34a';
const OFF = '#94a3b8';

function HWire({ on, grow }: { on: boolean; grow?: boolean }) {
  return <div className={`${grow ? 'min-w-[10px] flex-1' : 'w-3 shrink-0'} h-[2px]`} style={{ background: on ? ON : OFF }} />;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function ElementChip({ el, conducting, closed, words, labelOf }: {
  el: LadderElement; conducting: boolean; closed: boolean; words: Map<string, number>; labelOf: (a: string) => string;
}) {
  const cls = conducting
    ? 'border-emerald-500 bg-emerald-100 text-emerald-900'
    : closed ? 'border-emerald-400 border-dashed bg-white text-steel-800' : 'border-steel-300 bg-white text-steel-700';
  if (el.type === 'CMP') {
    const val = (a: string) => (/^[-+]?\d/.test(a.trim()) ? '' : `=${fmt(words.get(normAddress(a)) ?? 0)}`);
    return (
      <div className={`flex h-[42px] w-[124px] shrink-0 flex-col justify-center rounded border px-1.5 ${cls}`} title={`${el.left} ${el.op} ${el.right}`}>
        <div className="truncate font-mono text-[11px] font-bold">{el.left} {el.op} {el.right}</div>
        <div className="truncate font-mono text-[10px] text-steel-500">{el.left}{val(el.left)} {val(el.right) && `${el.right}${val(el.right)}`}</div>
      </div>
    );
  }
  const sym = el.type === 'NO' ? '┤ ├' : el.type === 'NC' ? '┤/├' : el.type === 'RISE' ? '┤↑├' : '┤↓├';
  const label = labelOf(el.address);
  return (
    <div className={`flex h-[42px] w-[96px] shrink-0 flex-col justify-center rounded border px-1.5 ${cls}`} title={`${el.type} ${el.address}${label ? ` — ${label}` : ''}`}>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-[12px] font-bold tracking-tighter">{sym}</span>
        <span className="truncate font-mono text-[11.5px] font-bold">{el.address}</span>
      </div>
      <div className="truncate text-[10px] leading-tight text-steel-500">{label || ' '}</div>
    </div>
  );
}

function OutputChip({ o, rungOn, bits, words, timers, counters, labelOf }: {
  o: LadderOutput; rungOn: boolean; bits: Map<string, boolean>; words: Map<string, number>;
  timers: Map<string, TimerState>; counters: Map<string, CounterState>; labelOf: (a: string) => string;
}) {
  const box = (active: boolean) => `flex h-[42px] w-[172px] shrink-0 flex-col justify-center rounded border px-1.5 ${
    active ? 'border-emerald-500 bg-emerald-100 text-emerald-900' : rungOn ? 'border-emerald-400 bg-white' : 'border-steel-300 bg-white text-steel-700'}`;
  switch (o.type) {
    case 'OUT': case 'SET': case 'RST': {
      const on = bits.get(normAddress(o.address)) ?? false;
      const sym = o.type === 'OUT' ? '( )' : o.type === 'SET' ? '(S)' : '(R)';
      const label = labelOf(o.address);
      return (
        <div className={box(on)} title={`${o.type} ${o.address}${label ? ` — ${label}` : ''}`}>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[12px] font-bold">{sym}</span>
            <span className="font-mono text-[11.5px] font-bold">{o.address}</span>
            <span className={`ml-auto text-[9.5px] font-bold ${on ? 'text-emerald-700' : 'text-steel-400'}`}>{on ? 'ON' : 'OFF'}</span>
          </div>
          <div className="truncate text-[10px] leading-tight text-steel-500">{label || ' '}</div>
        </div>
      );
    }
    case 'TMR': {
      const t = timers.get(normAddress(o.address));
      const done = t?.done ?? false;
      const pct = t && t.presetMs > 0 ? Math.min(100, (t.accMs / t.presetMs) * 100) : 0;
      const shown = t ? fmt(Math.round((t.accMs / unitMs(o.unit)) * 100) / 100) : '0';
      return (
        <div className={box(done)} title={`${o.mode} timer ${o.address}`}>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[11px] font-bold">TMR {o.address}</span>
            <span className="truncate text-[9.5px] text-steel-500">{o.mode === 'ON_DELAY' ? 'on-delay' : 'off-delay'}{o.accumulate ? ' retentive' : ''}</span>
            <span className={`ml-auto text-[9.5px] font-bold ${done ? 'text-emerald-700' : 'text-steel-400'}`}>{done ? 'DONE' : ''}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <div className="h-1.5 flex-1 overflow-hidden rounded bg-steel-200">
              <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="font-mono text-[10px] text-steel-600">{shown}/{o.preset} {o.unit}</span>
          </div>
        </div>
      );
    }
    case 'CNT': {
      const c = counters.get(normAddress(o.address));
      const done = c?.done ?? false;
      const pct = c && c.preset > 0 ? Math.max(0, Math.min(100, (o.direction === 'UP' ? c.value / c.preset : 1 - c.value / c.preset) * 100)) : 0;
      return (
        <div className={box(done)} title={`${o.direction} counter ${o.address}`}>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[11px] font-bold">CNT {o.address}</span>
            <span className="text-[9.5px] text-steel-500">{o.direction === 'UP' ? 'up' : 'down'}</span>
            <span className={`ml-auto text-[9.5px] font-bold ${done ? 'text-emerald-700' : 'text-steel-400'}`}>{done ? 'DONE' : ''}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <div className="h-1.5 flex-1 overflow-hidden rounded bg-steel-200"><div className="h-full bg-violet-500" style={{ width: `${pct}%` }} /></div>
            <span className="font-mono text-[10px] text-steel-600">{c?.value ?? 0}/{o.preset}</span>
          </div>
        </div>
      );
    }
    case 'COPY':
      return (
        <div className={box(rungOn)} title="COPY">
          <div className="font-mono text-[11px] font-bold">COPY {o.source} → {o.dest}</div>
          <div className="font-mono text-[10px] text-steel-500">{o.dest} = {fmt(words.get(normAddress(o.dest)) ?? 0)}</div>
        </div>
      );
    case 'MATH':
      return (
        <div className={box(rungOn)} title={`MATH ${o.dest} = ${o.expression}`}>
          <div className="truncate font-mono text-[11px] font-bold">{o.dest} = {o.expression}</div>
          <div className="font-mono text-[10px] text-steel-500">{o.dest} = {fmt(words.get(normAddress(o.dest)) ?? 0)}</div>
        </div>
      );
  }
}

function LiveRung({ rung, index, p, bypassed, skippedByBlock, onBypass, ...rest }: RungProps) {
  const off = bypassed || skippedByBlock;
  const on = (p?.rungTrue ?? false) && !off;
  const rows = Math.max(1, rung.branches.length);
  const outs = Math.max(1, rung.outputs.length);
  const frame = bypassed ? 'border-amber-400 bg-amber-50/60 ring-1 ring-amber-300'
    : skippedByBlock ? 'border-dashed border-steel-300 bg-steel-50 opacity-60'
    : on ? 'border-emerald-300 bg-emerald-50/70' : 'border-steel-200 bg-white';
  return (
    <div className={`group rounded-md border transition-colors ${frame}`}>
      <div className="flex items-center gap-2 px-2 pt-1.5">
        <span className="w-6 text-right font-mono text-xs font-bold text-steel-400">{index + 1}</span>
        {bypassed ? <span className="rounded bg-amber-500 px-1.5 py-px text-[10px] font-bold tracking-wide text-white">BYPASSED</span>
          : skippedByBlock ? <span className="rounded bg-steel-300 px-1.5 py-px text-[10px] font-bold tracking-wide text-steel-700">SKIPPED</span>
          : <span className={`rounded px-1.5 py-px text-[10px] font-bold tracking-wide ${on ? 'bg-emerald-600 text-white' : 'bg-steel-200 text-steel-500'}`}>{on ? 'TRUE' : 'FALSE'}</span>}
        <span className="min-w-0 flex-1 truncate text-[12px] italic text-steel-500" title={rung.comment}>
          {bypassed ? 'Not executed: outputs hold their last value. ' : skippedByBlock ? 'Outside the selected block: not executed. ' : ''}{rung.comment}
        </span>
        {onBypass && !skippedByBlock && (
          <button type="button" onClick={() => onBypass(!bypassed)}
            title={bypassed ? 'Execute this rung again' : 'Skip this rung while testing; its outputs hold their last value'}
            className={`shrink-0 rounded border px-1.5 py-px text-[10.5px] font-semibold ${bypassed
              ? 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600'
              : 'border-steel-300 bg-white text-steel-500 opacity-60 hover:border-amber-400 hover:text-amber-700 hover:opacity-100 group-hover:opacity-100'}`}>
            {bypassed ? 'Un-bypass' : 'Bypass rung'}
          </button>
        )}
      </div>
      <div className="flex overflow-x-auto px-2 pb-1.5">
        {/* left rail */}
        <div className="w-[3px] shrink-0 rounded" style={{ background: ON, height: Math.max(rows, outs) * ROW }} />
        {/* branches */}
        <div className="relative flex flex-1 flex-col">
          {rung.branches.length === 0 && <div className="flex items-center" style={{ height: ROW }}><HWire on grow /></div>}
          {rung.branches.map((br, b) => (
            <div key={b} className="flex items-center" style={{ height: ROW }}>
              {br.map((el, i) => {
                const before = i === 0 ? true : p?.branches[b]?.[i - 1] ?? false;
                return (
                  <div key={i} className="flex items-center">
                    <HWire on={before} />
                    <ElementChip el={el} conducting={p?.branches[b]?.[i] ?? false} closed={p?.closed[b]?.[i] ?? false} words={rest.words} labelOf={rest.labelOf} />
                  </div>
                );
              })}
              <HWire on={br.length === 0 || (p?.branches[b]?.[br.length - 1] ?? false)} grow />
            </div>
          ))}
          {rows > 1 && <div className="absolute right-0 w-[2px]" style={{ top: MID - 1, height: (rows - 1) * ROW + 2, background: on ? ON : OFF }} />}
        </div>
        {/* outputs */}
        <div className="relative flex shrink-0 flex-col pl-3">
          {outs > 1 && <div className="absolute left-0 w-[2px]" style={{ top: MID - 1, height: (outs - 1) * ROW + 2, background: on ? ON : OFF }} />}
          {rung.outputs.length === 0 && (
            <div className="flex items-center text-[11px] text-red-500" style={{ height: ROW }}>no output</div>
          )}
          {rung.outputs.map((o, k) => (
            <div key={k} className="relative flex items-center" style={{ height: ROW }}>
              <div className="absolute -left-3 h-[2px] w-3" style={{ top: MID - 1, background: on ? ON : OFF }} />
              <OutputChip o={o} rungOn={on} {...rest} />
              <HWire on={on} />
            </div>
          ))}
        </div>
        <div className="w-[3px] shrink-0 rounded bg-steel-400" style={{ height: Math.max(rows, outs) * ROW }} />
      </div>
    </div>
  );
}

export default function LiveLadder({ program, power, rungBypass, skipped, onBypassRung, groups, ...rest }: Props) {
  if (!program.rungs.length) {
    return <p className="p-6 text-center text-sm text-steel-500">No rungs to simulate yet.</p>;
  }
  const index = new Map(program.rungs.map((r, i) => [r.id, i]));
  const one = (r: Rung) => (
    <LiveRung key={r.id} rung={r} index={index.get(r.id)!} p={power.get(r.id)} {...rest}
      bypassed={rungBypass?.has(r.id) ?? false} skippedByBlock={skipped?.has(r.id) ?? false}
      onBypass={onBypassRung ? (on) => onBypassRung(r.id, on) : undefined} />
  );
  if (!groups) return <div className="space-y-2">{program.rungs.map(one)}</div>;
  const byId = new Map(program.rungs.map((r) => [r.id, r]));
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <section key={g.id} className="space-y-2">
          <h3 className="flex items-baseline gap-2 border-b border-steel-200 pb-0.5 text-[13px] font-semibold text-brand-800">
            {g.name}
            <span className="text-[11px] font-normal text-steel-400">{g.rungIds.length} rung{g.rungIds.length === 1 ? '' : 's'}{g.description ? ` · ${g.description}` : ''}</span>
          </h3>
          {g.rungIds.map((id) => byId.get(id)).filter((r): r is Rung => !!r).map(one)}
        </section>
      ))}
    </div>
  );
}
