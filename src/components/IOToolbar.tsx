import { useState } from 'react';
import { PlusIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import { useIOStore } from '../store/useIOStore';
import { TemplateLibrary } from './TemplateLibrary';

export function IOToolbar() {
  const { projectIO, addBlankInput, addBlankOutput } = useIOStore();
  const [showTemplate, setShowTemplate] = useState(false);

  const inputCount = projectIO.filter((p) => p.type === 'input').length;
  const outputCount = projectIO.filter((p) => p.type === 'output').length;

  return (
    <>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={addBlankInput}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Input
          </button>
          <button
            onClick={addBlankOutput}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Output
          </button>
          <button
            onClick={() => setShowTemplate(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            <BookOpenIcon className="w-4 h-4" />
            Import from Template
          </button>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>
            <span className="font-semibold text-blue-600">{inputCount}</span> Input{inputCount !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-300">|</span>
          <span>
            <span className="font-semibold text-amber-600">{outputCount}</span> Output{outputCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {showTemplate && <TemplateLibrary onClose={() => setShowTemplate(false)} />}
    </>
  );
}
