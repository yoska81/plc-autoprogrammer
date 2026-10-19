import { useProjectsStore } from '../store/useProjectsStore';
import { saveBlob } from '../deliverables/files';
import { faultLogCsv, useFaultLogStore, type FaultLogEntry } from './useFaultLogStore';

const NONE: FaultLogEntry[] = [];

/** The project's fault log: what was found, when and by whom; saved with the project, downloadable as CSV. */
export default function FaultLog() {
  const projectId = useProjectsStore((s) => s.activeId);
  const name = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeId)?.name ?? 'project');
  const entries = useFaultLogStore((s) => s.byProject[projectId ?? 'default']) ?? NONE;
  const { tech, setTech, remove, update } = useFaultLogStore();

  return (
    <section className="space-y-2 rounded-lg border border-steel-200 bg-white p-4" aria-label="Fault log">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-steel-800">Fault log</h3>
        <span className="text-xs text-steel-500">{entries.length ? `${entries.length} saved with the project` : 'nothing yet: each fault found is saved here'}</span>
        <button type="button" className="ml-auto rounded border border-steel-300 px-3 py-1.5 text-sm disabled:opacity-40" disabled={!entries.length}
          onClick={() => saveBlob(`${name.replace(/[^\w.-]+/g, '_')}_fault_log.csv`, new Blob([faultLogCsv(entries)], { type: 'text/csv' }))}>Download CSV</button>
      </div>
      <label className="flex items-center gap-2 text-sm text-steel-700">Technician
        <input aria-label="Technician name" value={tech} onChange={(e) => setTech(e.target.value)} className="flex-1 rounded border border-steel-300 px-2 py-1" placeholder="your name, for the log" />
      </label>
      {entries.length > 0 && (
        <ul className="divide-y divide-steel-100">
          {entries.map((e) => (
            <li key={e.id} className="space-y-1 py-2 text-sm" data-fault-log>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono font-semibold text-steel-800">{e.address}</span>
                <span className="text-steel-600">{e.description} · {e.symptom}</span>
                {e.practice && <span className="rounded bg-violet-100 px-1.5 text-[11px] font-semibold text-violet-800">practice</span>}
                <span className="ml-auto text-xs text-steel-500">{e.date}{e.by ? ` · ${e.by}` : ''}</span>
              </div>
              <p className="text-steel-900">{e.found}</p>
              {e.fix && <p className="text-xs text-steel-600">{e.fix}</p>}
              <div className="flex items-center gap-2">
                <input aria-label={`Note for ${e.address} ${e.date}`} defaultValue={e.note ?? ''} onBlur={(ev) => update(projectId, e.id, { note: ev.target.value })} className="flex-1 rounded border border-steel-200 px-2 py-1 text-xs" placeholder="what was done (re-terminated, replaced…)" />
                <button type="button" className="rounded px-2 py-1 text-xs text-steel-500 hover:bg-steel-100" onClick={() => remove(projectId, e.id)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
