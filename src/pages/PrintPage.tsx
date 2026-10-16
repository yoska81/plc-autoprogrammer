import { useProgramStore } from '../store/useProgramStore';
import { usePlc } from '../plc/usePlc';
import LadderView from '../components/ladder/LadderView';

/** Full-page, printer-friendly ladder + I/O sheet (opened from Export). */
export default function PrintPage() {
  const { projectName, ladder } = useProgramStore();
  const { profile, cpu, io, addresses, labels } = usePlc();

  return (
    <div className="print-page bg-white min-h-screen p-8 text-gray-900">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{projectName}</h1>
          <p className="text-sm text-gray-600">{profile.vendor} {profile.name} · {cpu.label} · printed {new Date().toLocaleString()}</p>
        </div>
        <button onClick={() => window.print()} className="no-print px-4 py-2 bg-brand-600 text-brand-950 text-sm rounded hover:bg-brand-700">
          Print / Save as PDF
        </button>
      </div>

      <h2 className="text-base font-semibold mb-2">I/O list</h2>
      <table className="w-full text-sm border border-gray-300 mb-8">
        <thead className="bg-gray-100">
          <tr>
            {['Address', 'Description', 'Type', 'Category'].map((h) => <th key={h} className="text-left px-2 py-1 border-b border-gray-300">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {io.map((p) => (
            <tr key={p.id} className="border-b border-gray-200">
              <td className="px-2 py-1 font-mono font-semibold">{addresses.get(p.id)}</td>
              <td className="px-2 py-1">{p.description}</td>
              <td className="px-2 py-1 capitalize">{p.type}</td>
              <td className="px-2 py-1">{p.category}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-base font-semibold mb-2">Ladder program ({ladder.rungs.length} rungs + END)</h2>
      <LadderView program={ladder} labels={labels} />
    </div>
  );
}
