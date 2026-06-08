import { useState, useMemo } from 'react';
import { XMarkIcon, MagnifyingGlassIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { ALL_TEMPLATES } from '../data/ioTemplates';
import type { IOCategory } from '../types/io';
import { useIOStore } from '../store/useIOStore';
import { CategoryBadge } from './CategoryBadge';

const CATEGORIES: (IOCategory | 'All')[] = [
  'All', 'Safety', 'Operator/HMI', 'External Machine', 'Product Detection',
  'Conveyor', 'Pneumatic', 'Vacuum', 'Servo/Axis', 'Station 1',
  'Station 2', 'Analog/Process', 'Spare',
];

type TypeFilter = 'all' | 'input' | 'output';

interface Props {
  onClose: () => void;
}

export function TemplateLibrary({ onClose }: Props) {
  const { projectIO, importFromTemplate } = useIOStore();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<IOCategory | 'All'>('All');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const importedDescriptions = useMemo(
    () => new Set(projectIO.map((p) => p.description)),
    [projectIO]
  );

  const visible = useMemo(() => {
    return ALL_TEMPLATES.filter((t) => {
      if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !t.templateId.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, categoryFilter, typeFilter]);

  const availableVisible = visible.filter((t) => !importedDescriptions.has(t.description));
  const allVisibleSelected = availableVisible.length > 0 && availableVisible.every((t) => selected.has(t.templateId));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        availableVisible.forEach((t) => next.delete(t.templateId));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        availableVisible.forEach((t) => next.add(t.templateId));
        return next;
      });
    }
  }

  function handleImport() {
    const toImport = ALL_TEMPLATES.filter((t) => selected.has(t.templateId));
    importFromTemplate(toImport);
    setSelected(new Set());
    onClose();
  }

  const selectedCount = selected.size;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black bg-opacity-60">
      <div className="relative flex flex-col w-full max-w-5xl mx-auto my-8 bg-white rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-800 text-white">
          <div>
            <h2 className="text-lg font-semibold">Template Library</h2>
            <p className="text-xs text-gray-400 mt-0.5">Select I/O points to import into your project</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 bg-gray-50 border-r border-gray-200 overflow-y-auto flex-shrink-0">
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Category</p>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm mb-0.5 transition-colors ${
                    categoryFilter === cat
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Filters */}
            <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div className="flex rounded border border-gray-300 overflow-hidden text-sm">
                {(['all', 'input', 'output'] as TypeFilter[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 capitalize transition-colors ${
                      typeFilter === t ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {t === 'all' ? 'All' : t === 'input' ? 'Inputs' : 'Outputs'}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-400">{visible.length} items</span>
            </div>

            {/* Select all row */}
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                disabled={availableVisible.length === 0}
              />
              <span className="text-xs text-gray-500">
                Select all visible ({availableVisible.length} available)
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {visible.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                  No items match your filters
                </div>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {visible.map((t) => {
                      const alreadyImported = importedDescriptions.has(t.description);
                      const isSelected = selected.has(t.templateId);
                      return (
                        <tr
                          key={t.templateId}
                          onClick={() => !alreadyImported && toggleSelect(t.templateId)}
                          className={`transition-colors ${
                            alreadyImported
                              ? 'opacity-50 cursor-not-allowed bg-gray-50'
                              : isSelected
                              ? 'bg-blue-50 cursor-pointer'
                              : 'hover:bg-gray-50 cursor-pointer'
                          }`}
                        >
                          <td className="px-4 py-2 w-8">
                            {alreadyImported ? (
                              <CheckCircleIcon className="w-4 h-4 text-green-500" />
                            ) : (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(t.templateId)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                              />
                            )}
                          </td>
                          <td className="px-2 py-2 font-mono text-xs font-semibold text-gray-500 whitespace-nowrap w-16">
                            {t.templateId}
                          </td>
                          <td className="px-2 py-2 w-20">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${t.type === 'input' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                              {t.type === 'input' ? 'IN' : 'OUT'}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <CategoryBadge category={t.category} />
                          </td>
                          <td className="px-2 py-2 text-gray-700">{t.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {selectedCount > 0 ? `${selectedCount} item${selectedCount !== 1 ? 's' : ''} selected` : 'No items selected'}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selectedCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Import {selectedCount > 0 ? `${selectedCount} Selected` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
