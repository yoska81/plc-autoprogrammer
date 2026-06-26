import { IOToolbar } from '../components/IOToolbar';
import { IOTable } from '../components/IOTable';

export default function IOPage() {
  return (
    <>
      <header className="px-6 py-4 bg-white border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">I/O List</h2>
        <p className="text-xs text-gray-400 mt-0.5">Manage project inputs and outputs</p>
      </header>
      <IOToolbar />
      <div className="flex-1 overflow-auto bg-white">
        <IOTable />
      </div>
    </>
  );
}
