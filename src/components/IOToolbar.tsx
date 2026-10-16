import { useState, type ReactNode } from 'react';
import { PlusIcon, BookOpenIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useIOStore } from '../store/useIOStore';
import { TemplateLibrary } from './TemplateLibrary';

export interface IOFilter { text: string; type: 'all' | 'input' | 'output' }

const tool = 'h-7 flex items-center gap-1.5 px-2.5 text-[13px] text-steel-800 bg-white border border-steel-300 rounded-sm hover:bg-brand-50 hover:border-brand-300';

export function IOToolbar({ generateButton, filter, onFilter }: { generateButton: ReactNode; filter: IOFilter; onFilter: (f: IOFilter) => void }) {
  const { projectIO, addBlankInput, addBlankOutput } = useIOStore();
  const [showTemplate, setShowTemplate] = useState(false);

  const inputCount = projectIO.filter((p) => p.type === 'input').length;
  const outputCount = projectIO.length - inputCount;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-1.5 bg-[#f7f8f9] border-b border-steel-200">
        {generateButton}
        <span className="w-px h-5 bg-steel-300 mx-1" />
        <button onClick={addBlankInput} className={tool}><PlusIcon className="w-4 h-4 text-brand-600" />Add input</button>
        <button onClick={addBlankOutput} className={tool}><PlusIcon className="w-4 h-4 text-amber-600" />Add output</button>
        <button onClick={() => setShowTemplate(true)} className={tool}><BookOpenIcon className="w-4 h-4" />From template…</button>
        <span className="w-px h-5 bg-steel-300 mx-1" />
        <div className="relative">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-2 top-1.5 text-steel-400" />
          <input value={filter.text} onChange={(e) => onFilter({ ...filter, text: e.target.value })} placeholder="Filter"
            aria-label="Filter I/O" className="h-7 w-44 pl-7 pr-2 border border-steel-300 rounded-sm bg-white focus:outline-none focus:border-brand-500" />
        </div>
        <select value={filter.type} onChange={(e) => onFilter({ ...filter, type: e.target.value as IOFilter['type'] })}
          aria-label="Show" className="h-7 border border-steel-300 rounded-sm bg-white px-1.5">
          <option value="all">Inputs and outputs</option>
          <option value="input">Inputs only</option>
          <option value="output">Outputs only</option>
        </select>
        <div className="ml-auto flex items-center gap-3 text-xs text-steel-600">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-brand-600" />{inputCount} input{inputCount !== 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500" />{outputCount} output{outputCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {showTemplate && <TemplateLibrary onClose={() => setShowTemplate(false)} />}
    </>
  );
}
