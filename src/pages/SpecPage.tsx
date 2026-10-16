import { useNavigate } from 'react-router-dom';
import { useSpecStore } from '../store/useSpecStore';
import { SPEC_SECTIONS } from '../spec/types';
import SpecIntake from '../components/SpecIntake';

export default function SpecPage() {
  const navigate = useNavigate();
  const spec = useSpecStore();
  const filled = SPEC_SECTIONS.filter((s) => spec.sections[s.id]?.trim()).length;

  return (
    <>
      <header className="px-6 py-4 bg-white border-b border-steel-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-steel-900">1 · Describe the machine</h2>
          <p className="text-xs text-steel-500 mt-0.5">The spec drives every step. Change it any time; the steps after it are marked out of date and can be updated in one click.</p>
        </div>
        <button onClick={() => navigate('/equipment')} disabled={!filled}
          className="px-4 py-2 text-sm bg-petrol-600 text-white rounded hover:bg-petrol-700 disabled:opacity-40 whitespace-nowrap">
          Next: Equipment →
        </button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl space-y-5">
          <SpecIntake />

          {/* Sections */}
          <div className="bg-white rounded-lg border border-steel-200 divide-y divide-steel-100">
            <div className="px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-steel-800">Specification</h3>
              <span className="text-xs text-steel-400">{filled} of {SPEC_SECTIONS.length} sections filled</span>
            </div>
            {SPEC_SECTIONS.map((s) => (
              <div key={s.id} className="px-5 py-3">
                <label htmlFor={`spec-${s.id}`} className="block text-sm font-medium text-steel-700">{s.title}</label>
                <textarea
                  id={`spec-${s.id}`}
                  value={spec.sections[s.id] ?? ''}
                  onChange={(e) => spec.setSection(s.id, e.target.value)}
                  placeholder={s.hint}
                  rows={Math.min(12, Math.max(2, (spec.sections[s.id] ?? '').split('\n').length + 1))}
                  className="mt-1 w-full border border-steel-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-petrol-500 placeholder:text-steel-400"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
