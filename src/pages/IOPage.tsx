import { IOToolbar } from '../components/IOToolbar';
import { IOTable } from '../components/IOTable';
import IOFromSpec from '../components/IOFromSpec';

export default function IOPage() {
  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">3 · I/O List</h2>
        <p className="text-xs text-gray-400 mt-0.5">Manage project inputs and outputs</p>
      </header>
      <IOFromSpec />
      <IOToolbar />
      <div className="flex-1 overflow-auto bg-white">
        <IOTable />
      </div>
    </>
  );
}
