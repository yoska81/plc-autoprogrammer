import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgramStore } from '../store/useProgramStore';
import { useActiveHmiDesign } from '../hmi/projectPanel';
import { usePlc } from '../plc/core/usePlc';
import { canRebuildForHmi, hmiTagsNotInProgram, rebuildProgramForHmi } from '../plc/programForHmi';
import { notify } from '../store/useNoticeStore';

/**
 * On the HMI and PLC Program pages: the screens use tags the program does not implement yet (after "Redesign
 * screens", a new panel or a PLC change), so the checker blocks the program exports. One click rebuilds the
 * program's standard blocks around its cycle; a program written another way is updated on the Program page.
 */
export default function ProgramOutOfStep({ where }: { where: 'hmi' | 'program' }) {
  const ladder = useProgramStore((s) => s.ladder);
  const design = useActiveHmiDesign();
  const { io, addresses } = usePlc();
  const missing = useMemo(() => hmiTagsNotInProgram(ladder, design, io, addresses), [ladder, design, io, addresses]);
  const [busy, setBusy] = useState(false);
  if (!missing.length) return null;
  const rebuild = async () => {
    const cycle = ladder.sequence ? 'Its cycle steps are kept.' : 'Its cycle is rebuilt from the I/O list (the default steps): check them afterwards.';
    if (!confirm(`Rebuild the program so it implements every HMI tag? ${cycle} The current program is kept in History.`)) return;
    setBusy(true);
    try { await rebuildProgramForHmi(); notify('Program rebuilt: every HMI tag is implemented.'); } catch (err) { notify(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  };
  const list = `${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}`;
  return (
    <div role="status" data-testid="program-out-of-step" className="px-4 sm:px-6 py-2 text-sm bg-amber-50 border-b border-amber-200 text-amber-900 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="min-w-0 flex-[1_1_20rem]">
        The HMI screens use {missing.length} tag{missing.length === 1 ? '' : 's'} the PLC program does not implement yet ({list}). Until it does, the program exports are blocked.
      </span>
      {canRebuildForHmi()
        ? <button onClick={() => void rebuild()} disabled={busy} className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded disabled:opacity-50">{busy ? 'Rebuilding…' : 'Rebuild program'}</button>
        : where === 'hmi'
          ? <Link to="/program" className="underline">Update it on the PLC Program page</Link>
          : <span>Use "Update program", or add the rungs by hand.</span>}
    </div>
  );
}
