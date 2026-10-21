import type { LadderProgram } from '../plc/core/ladder';
import type { RungPower } from '../plc/sim/engine';
import { followRung } from './manualCommands';
import { useOnlineStore } from './useOnline';

const POLL_CHOICES = [250, 500, 1000];

/** "Follow this rung": each contact and output of one rung with the value read from the PLC and where power reaches. */
export default function FollowRung({ program, power, rungId, onRung, stale, labelOf }: {
  program: LadderProgram;
  power: Map<string, RungPower>;
  rungId: string | null;
  onRung: (id: string | null) => void;
  stale: boolean;
  labelOf: (address: string) => string;
}) {
  const st = useOnlineStore();
  const index = program.rungs.findIndex((r) => r.id === rungId);
  const rung = index >= 0 ? program.rungs[index] : null;
  const rows = rung ? followRung(rung, power.get(rung.id), st.bits, st.words) : [];
  const pollMs = st.settings.pollMs;
  return (
    <div className="rounded border border-steel-200 bg-white" data-testid="follow-rung">
      <div className="flex flex-wrap items-center gap-3 border-b border-steel-200 px-3 py-2 text-sm">
        <label className="flex items-center gap-2 text-xs text-steel-600">Follow this rung
          <select aria-label="Follow this rung" value={rung?.id ?? ''} onChange={(e) => onRung(e.target.value || null)} className="max-w-md rounded border border-steel-300 px-2 py-1 text-sm">
            <option value="">— choose a rung —</option>
            {program.rungs.map((r, i) => <option key={r.id} value={r.id}>{i + 1}. {r.comment.slice(0, 80) || r.id}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-steel-600">Read every
          <select aria-label="Read every" value={POLL_CHOICES.includes(pollMs) ? pollMs : ''} onChange={(e) => st.setSettings({ pollMs: Number(e.target.value) })} className="rounded border border-steel-300 px-2 py-1 text-sm">
            {!POLL_CHOICES.includes(pollMs) && <option value="">{pollMs} ms</option>}
            {POLL_CHOICES.map((ms) => <option key={ms} value={ms}>{ms < 1000 ? `${ms} ms` : `${ms / 1000} s`}</option>)}
          </select>
        </label>
        {rung && (stale
          ? <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900" role="status">Stale: {st.status === 'connected' ? 'the PLC is not answering' : 'not connected'}. The values below are not live.</span>
          : <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-900" role="status">Live</span>)}
      </div>
      {rung && (
        <div className={stale ? 'opacity-50' : ''}>
          <p className="px-3 pt-2 text-xs text-steel-500">Rung {index + 1}: {rung.comment}</p>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-steel-500"><tr>{['', 'Instruction', 'Name', 'PLC value', 'Contact', 'Power after it'].map((h, i) => <th key={i} className="px-3 py-1 text-left">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-steel-100">
              {rows.map((r, i) => (
                <tr key={i} data-follow={r.addresses[0] ?? r.text}>
                  <td className="px-3 py-1 text-xs text-steel-400">{r.kind === 'output' || r.branch === 0 ? 'out' : rung.branches.length > 1 ? `branch ${r.branch}` : ''}</td>
                  <td className="px-3 py-1 font-mono">{r.text}</td>
                  <td className="px-3 py-1 text-steel-700">{r.addresses.map(labelOf).filter(Boolean).join(' / ')}</td>
                  <td className="px-3 py-1 font-mono tabular-nums">{stale ? '—' : r.value}</td>
                  <td className="px-3 py-1">{r.kind === 'output' || (r.kind === 'other' && r.branch === 0) ? '' : r.closed ? <span className="text-green-700">closed</span> : <span className="text-steel-500">open</span>}</td>
                  <td className="px-3 py-1">
                    {r.kind === 'output'
                      ? <>{r.powered ? <b className="text-green-700">rung true</b> : <span className="text-steel-500">rung false</span>}{r.differs && !stale && <span className="ml-2 text-xs text-amber-800">PLC reads {r.value}: another rung also writes it, or the last scan differed</span>}</>
                      : r.powered ? <b className="text-green-700">power</b> : <span className="text-steel-400">no power</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-steel-500">Values are read every {pollMs < 1000 ? `${pollMs} ms` : `${pollMs / 1000} s`}; a signal shorter than that (a one-scan pulse, an edge contact) may not be seen.</p>
        </div>
      )}
    </div>
  );
}
