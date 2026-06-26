import { useIOStore } from '../store/useIOStore';
import { IORow } from './IORow';

export function IOTable() {
  const { projectIO } = useIOStore();

  if (projectIO.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <svg className="w-16 h-16 mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V9l-6-6z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 3v6h6" />
        </svg>
        <p className="text-lg font-medium text-gray-400">No I/O points yet</p>
        <p className="text-sm text-gray-300 mt-1">Add inputs/outputs manually or import from the template library</p>
      </div>
    );
  }

  const inputs = projectIO.filter((p) => p.type === 'input');
  const outputs = projectIO.filter((p) => p.type === 'output');

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-2 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">ID</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Type</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Category</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Description</th>
            <th className="px-4 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {inputs.length > 0 && (
            <>
              <tr className="bg-blue-600">
                <td colSpan={5} className="px-4 py-1 text-xs font-semibold text-white uppercase tracking-wider">
                  Inputs ({inputs.length})
                </td>
              </tr>
              {inputs.map((p) => <IORow key={p.id} point={p} />)}
            </>
          )}
          {outputs.length > 0 && (
            <>
              <tr className="bg-amber-600">
                <td colSpan={5} className="px-4 py-1 text-xs font-semibold text-white uppercase tracking-wider">
                  Outputs ({outputs.length})
                </td>
              </tr>
              {outputs.map((p) => <IORow key={p.id} point={p} />)}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
