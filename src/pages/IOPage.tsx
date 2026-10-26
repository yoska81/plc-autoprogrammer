import { useNavigate } from 'react-router-dom';
import { IOToolbar, type IOFilter } from '../components/IOToolbar';
import { IOTable } from '../components/IOTable';
import IOFromSpec from '../components/IOFromSpec';
import { useStages } from '../spec/useStages';
import { useUi } from '../store/useUiStore';
import { undoIoDelete, useIoUndo } from '../plc/core/ioChange';

export default function IOPage() {
  const stages = useStages();
  const navigate = useNavigate();
  const [filter, setFilter] = useUi<IOFilter>('io.filter', { text: '', type: 'all' });
  // The last delete stays undoable here until the next edit.
  const undoLabel = useIoUndo((s) => s.label);
  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-steel-200 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-[1_1_16rem]">
          <h2 className="text-base font-semibold text-steel-900">3 · I/O List</h2>
          <p className="text-xs text-steel-500 mt-0.5">Every input and output of the machine, with its PLC address</p>
        </div>
        {undoLabel && (
          <button onClick={() => undoIoDelete()} title="Put back the deleted point, and the program and the HMI as they were" className="px-3 py-2 text-sm border border-steel-300 rounded bg-white hover:bg-steel-50">
            Undo: {undoLabel}
          </button>
        )}
        <button onClick={() => navigate('/electrical?tab=design')} disabled={stages.io.status === 'empty'}
          className="px-4 py-2 text-sm bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-40">Next: Electrical →</button>
      </header>
      <IOFromSpec>
        {(generateButton) => <IOToolbar generateButton={generateButton} filter={filter} onFilter={setFilter} />}
      </IOFromSpec>
      <div className="flex-1 overflow-auto p-4">
        <IOTable filter={filter} />
      </div>
    </>
  );
}
