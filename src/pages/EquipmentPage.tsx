import { useNavigate } from 'react-router-dom';
import EquipmentPanel from '../components/EquipmentPanel';
import StageBanner from '../components/StageBanner';
import { useStages } from '../spec/useStages';

export default function EquipmentPage() {
  const stages = useStages();
  const navigate = useNavigate();
  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-steel-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-steel-900">2 · Equipment</h2>
          <p className="text-xs text-steel-500 mt-0.5">PLC, I/O modules and operator panel, chosen from your description</p>
        </div>
        <button onClick={() => navigate('/io')} disabled={stages.equipment.status === 'empty'}
          className="px-4 py-2 text-sm bg-brand-600 text-brand-950 rounded hover:bg-brand-700 disabled:opacity-40">Next: I/O →</button>
      </header>
      <StageBanner info={stages.equipment} />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl">
          <EquipmentPanel />
        </div>
      </div>
    </>
  );
}
