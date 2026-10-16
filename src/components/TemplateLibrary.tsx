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

  // Track by template ID so renaming an imported point doesn't allow re-importing it.
  const importedTemplateIds = useMemo(
    () => new Set(projectIO.flatMap((p) => (p.templateId ? [p.templateId] : []))),
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

  const availableVisible = visible.filter((t) => !importedTemplateIds.has(t.templateId));
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
      <div className="relative flex flex-col w-full max-w-5xl mx-auto my-8 bg-white rounded-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-steel-800 text-white">
          <div>
            <h2 className="text-lg font-semibold">Template Library</h2>
            <p className="text-xs text-steel-400 mt-0.5">Select I/O points to import into your project</p>
          </div>
          <button onClick={onClose} className="text-steel-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 bg-steel-50 border-r border-steel-200 overflow-y-auto flex-shrink-0">
            <div className="p-3">
              <p className="text-xs font-semibold text-steel-400 uppercase tracking-wide mb-2">Category</p>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm mb-0.5 transition-colors ${
                    categoryFilter === cat
                      ? 'bg-brand-600 text-white font-medium'
                      : 'text-steel-600 hover:bg-steel-200'
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
            <div className="px-4 py-3 border-b border-steel-200 bg-white flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-400" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-steel-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              </div>
              <div className="flex rounded border border-steel-300 overflow-hidden text-sm">
                {(['all', 'input', 'output'] as TypeFilter[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 capitalize transition-colors ${
                      typeFilter === t ? 'bg-steel-700 text-white' : 'bg-white text-steel-600 hover:bg-steel-100'
                    }`}
                  >
                    {t === 'all' ? 'All' : t === 'input' ? 'Inputs' : 'Outputs'}
                  </button>
                ))}
              </div>
              <span className="text-xs text-steel-400">{visible.length} items</span>
            </div>

            {/* Select all row */}
            <div className="px-4 py-2 border-b border-steel-100 bg-steel-50 flex items-center gap-2">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-steel-300 text-brand-800 focus:ring-brand-400"
                disabled={availableVisible.length === 0}
              />
              <span className="text-xs text-steel-500">
                Select all visible ({availableVisible.length} available)
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {visible.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-steel-400 text-sm">
                  No items match your filters
                </div>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-steel-100">
                    {visible.map((t) => {
                      const alreadyImported = importedTemplateIds.has(t.templateId);
                      const isSelected = selected.has(t.templateId);
                      return (
                        <tr
                          key={t.templateId}
                          onClick={() => !alreadyImported && toggleSelect(t.templateId)}
                          className={`transition-colors ${
                            alreadyImported
                              ? 'opacity-50 cursor-not-allowed bg-steel-50'
                              : isSelected
                              ? 'bg-brand-50 cursor-pointer'
                              : 'hover:bg-steel-50 cursor-pointer'
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
                                className="w-4 h-4 rounded border-steel-300 text-brand-800 focus:ring-brand-400"
                              />
                            )}
                          </td>
                          <td className="px-2 py-2 font-mono text-xs font-semibold text-steel-500 whitespace-nowrap w-16">
                            {t.templateId}
                          </td>
                          <td className="px-2 py-2 w-20">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${t.type === 'input' ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-700'}`}>
                              {t.type === 'input' ? 'IN' : 'OUT'}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <CategoryBadge category={t.category} />
                          </td>
                          <td className="px-2 py-2 text-steel-700">{t.description}</td>
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
        <div className="px-6 py-4 bg-steel-50 border-t border-steel-200 flex items-center justify-between">
          <span className="text-sm text-steel-500">
            {selectedCount > 0 ? `${selectedCount} item${selectedCount !== 1 ? 's' : ''} selected` : 'No items selected'}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-steel-600 hover:text-steel-800 border border-steel-300 rounded hover:bg-steel-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selectedCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Import {selectedCount > 0 ? `${selectedCount} Selected` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
