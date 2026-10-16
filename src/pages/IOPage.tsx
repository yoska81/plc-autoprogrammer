import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IOToolbar, type IOFilter } from '../components/IOToolbar';
import { IOTable } from '../components/IOTable';
import IOFromSpec from '../components/IOFromSpec';
import { useStages } from '../spec/useStages';

export default function IOPage() {
  const stages = useStages();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<IOFilter>({ text: '', type: 'all' });
  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-steel-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-steel-900">3 · I/O List</h2>
          <p className="text-xs text-steel-500 mt-0.5">Every input and output of the machine, with its PLC address</p>
        </div>
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
