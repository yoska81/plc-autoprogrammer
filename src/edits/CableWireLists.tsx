import { useMemo } from 'react';
import { cableSchedule, wireNumbers, type DrawingContext } from '../electrical/derive';
import { useUi } from '../store/useUiStore';
import { cableKey, wireKey } from './lists';
import { useEditsStore } from './useEditsStore';
import { EditableCell } from './EditedMark';

const th = 'px-2 py-1.5 text-left font-medium text-steel-500 bg-steel-50 border-b border-steel-200 whitespace-nowrap';
const td = 'px-2 py-1 border-b border-steel-100 align-top';
/** Rows shown before "Show all" (big panels have thousands of wires). */
const PAGE = 300;

/** Electrical page tab: the cable schedule and the wire list, with a note the user can write on every row. */
export default function CableWireLists({ ctx }: { ctx: DrawingContext | null }) {
  const notes = useEditsStore((s) => s.notes);
  const setNote = useEditsStore((s) => s.setNote);
  const [filter, setFilter] = useUi('lists.filter', '');
  const [all, setAll] = useUi('lists.all', false);
  const cables = useMemo(() => (ctx ? cableSchedule(ctx) : []), [ctx]);
  const wires = useMemo(() => (ctx ? wireNumbers(ctx) : []), [ctx]);
  if (!ctx) return <div className="flex-1 p-6 text-sm text-steel-500">No electrical design yet.</div>;
  const q = filter.trim().toLowerCase();
  const match = (...v: string[]) => !q || v.join(' ').toLowerCase().includes(q);
  const shownCables = cables.filter((c) => match(c.tag, c.from, c.to, c.type, c.zone, notes[cableKey(c)] ?? ''));
  const shownWires = wires.filter((w) => match(w.wire, w.from, w.to, w.function, notes[wireKey(w)] ?? ''));
  const noteCell = (key: string, label: string) => (
    <EditableCell value={notes[key] ?? ''} label={label} placeholder="Add a note…" mark={false}
      onCommit={(v) => setNote(key, v)} inputClassName={`min-w-48 ${notes[key] ? 'text-sky-900' : 'placeholder:text-steel-300'}`} />
  );
  return (
    <div className="flex-1 overflow-auto bg-steel-50 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 min-w-64 text-xs text-steel-500">The field cables and every wire of the design. Write a note on any row (e.g. "pulled", "route through the left gland", "check length on site"): notes are saved with the project, kept when the design is generated again, and written into the CSV and Excel files.</p>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search cables and wires" aria-label="Search cables and wires"
          className="w-56 rounded border border-steel-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      <section className="rounded-sm border border-steel-200 bg-white" aria-label="Cable schedule">
        <h3 className="px-3 py-2 text-sm font-semibold text-steel-800 border-b border-steel-200">Cable schedule <span className="font-normal text-steel-500">({cables.length})</span></h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr>{['Cable', 'Zone', 'From', 'To', 'Type', 'Cores', 'Length', 'Note'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {shownCables.map((c) => (
                <tr key={c.tag} data-cable={c.tag}>
                  <td className={`${td} font-mono font-semibold`}>{c.tag}</td>
                  <td className={td}>{c.zone}</td>
                  <td className={`${td} font-mono`}>{c.from}</td>
                  <td className={`${td} font-mono`}>{c.to}</td>
                  <td className={td}>{c.type}{c.partNumber ? <span className="text-steel-500"> · {c.partNumber}</span> : ''}</td>
                  <td className={`${td} tabular-nums`}>{c.cores.length}{c.spareCores ? ` (${c.spareCores} spare)` : ''}</td>
                  <td className={td}>{c.length}</td>
                  <td className={`${td} w-1/4`}>{noteCell(cableKey(c), `Note for cable ${c.tag}`)}</td>
                </tr>
              ))}
              {!shownCables.length && <tr><td colSpan={8} className="p-4 text-center text-steel-400">{cables.length ? 'No cables match.' : 'No field cables in this design.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-sm border border-steel-200 bg-white" aria-label="Wire list">
        <h3 className="px-3 py-2 text-sm font-semibold text-steel-800 border-b border-steel-200">Wire list <span className="font-normal text-steel-500">({wires.length})</span></h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr>{['Wire', 'From', 'To', 'Color', 'Size', 'Function', 'Note'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {(all ? shownWires : shownWires.slice(0, PAGE)).map((w) => (
                <tr key={wireKey(w)}>
                  <td className={`${td} font-mono font-semibold`}>{w.wire}</td>
                  <td className={`${td} font-mono`}>{w.from}</td>
                  <td className={`${td} font-mono`}>{w.to}</td>
                  <td className={td}>{w.color}</td>
                  <td className={td}>{w.size}</td>
                  <td className={td}>{w.function}</td>
                  <td className={`${td} w-1/4`}>{noteCell(wireKey(w), `Note for wire ${w.wire} ${w.from} to ${w.to}`)}</td>
                </tr>
              ))}
              {!shownWires.length && <tr><td colSpan={7} className="p-4 text-center text-steel-400">No wires match.</td></tr>}
            </tbody>
          </table>
        </div>
        {!all && shownWires.length > PAGE && (
          <button type="button" onClick={() => setAll(true)} className="m-2 rounded border border-steel-300 px-3 py-1 text-sm hover:bg-steel-50">Show all {shownWires.length} wires</button>
        )}
      </section>
    </div>
  );
}
