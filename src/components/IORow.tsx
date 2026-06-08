import { useState } from 'react';
import { TrashIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { IOPoint, IOCategory } from '../types/io';
import { useIOStore } from '../store/useIOStore';

const ALL_CATEGORIES: IOCategory[] = [
  'Safety', 'Operator/HMI', 'External Machine', 'Product Detection',
  'Conveyor', 'Pneumatic', 'Vacuum', 'Servo/Axis', 'Station 1',
  'Station 2', 'Analog/Process', 'Spare',
];

export function IORow({ point }: { point: IOPoint }) {
  const { updateDescription, updateCategory, deletePoint } = useIOStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(point.description);

  function commitEdit() {
    updateDescription(point.id, draft);
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(point.description);
    setEditing(false);
  }

  const rowBg = point.type === 'input' ? 'bg-blue-50 hover:bg-blue-100' : 'bg-amber-50 hover:bg-amber-100';

  return (
    <tr className={`${rowBg} transition-colors`}>
      <td className="px-4 py-2 font-mono text-sm font-semibold text-gray-700 whitespace-nowrap">
        {point.id}
      </td>
      <td className="px-4 py-2 text-xs">
        <span className={`px-2 py-0.5 rounded font-medium ${point.type === 'input' ? 'bg-blue-200 text-blue-800' : 'bg-amber-200 text-amber-800'}`}>
          {point.type === 'input' ? 'INPUT' : 'OUTPUT'}
        </span>
      </td>
      <td className="px-4 py-2">
        <select
          value={point.category}
          onChange={(e) => updateCategory(point.id, e.target.value as IOCategory)}
          className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2 w-full">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              className="flex-1 text-sm border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button onClick={commitEdit} className="text-green-600 hover:text-green-800">
              <CheckIcon className="w-4 h-4" />
            </button>
            <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group">
            <span className={`text-sm flex-1 ${point.description ? 'text-gray-800' : 'text-gray-400 italic'}`}>
              {point.description || 'Click to add description'}
            </span>
            <button
              onClick={() => { setDraft(point.description); setEditing(true); }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-2">
        <button
          onClick={() => deletePoint(point.id)}
          className="text-gray-300 hover:text-red-500 transition-colors"
          title="Delete"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
