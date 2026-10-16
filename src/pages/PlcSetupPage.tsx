import { Link } from 'react-router-dom';
import { PLC_PROFILES } from '../plc/profiles';
import { useProjectStore } from '../store/useProjectStore';
import { usePlc } from '../plc/usePlc';

export default function PlcSetupPage() {
  const setPlc = useProjectStore((s) => s.setPlc);
  const { profile, cpu } = usePlc();

  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">PLC Setup</h2>
        <p className="text-xs text-gray-400 mt-0.5">Choose the controller. The AI writes the program in that PLC's own language and addresses.</p>
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-3xl space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PLC_PROFILES.map((p) => {
              const selected = p.id === profile.id;
              return (
                <button
                  key={p.id}
                  disabled={!p.available}
                  onClick={() => setPlc(p.id, p.defaultCpuId)}
                  className={`text-left rounded-lg border p-4 transition-colors ${
                    selected
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                      : p.available
                        ? 'border-gray-200 bg-white hover:border-brand-300'
                        : 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{p.vendor}</span>
                    {!p.available && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Coming soon</span>}
                    {selected && <span className="text-xs bg-brand-600 text-white px-2 py-0.5 rounded">Selected</span>}
                  </div>
                  <div className="text-base font-semibold text-gray-800 mt-1">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{p.language === 'ladder' ? 'Ladder logic' : 'Structured Text'}</div>
                </button>
              );
            })}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <div>
              <label htmlFor="cpu" className="block text-sm font-medium text-gray-700 mb-1">CPU model</label>
              <select
                id="cpu"
                value={cpu.id}
                onChange={(e) => setPlc(profile.id, e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {profile.cpuModels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              {profile.language === 'ladder' && (
                <p className="text-xs text-gray-500 mt-2">
                  Built-in I/O: {cpu.builtInInputs} inputs, {cpu.builtInOutputs} outputs.{cpu.notes ? ` ${cpu.notes}` : ''}
                </p>
              )}
            </div>

            {profile.id === 'click' && (
              <div className="text-sm text-gray-600 space-y-2 border-t border-gray-100 pt-4">
                <p className="font-medium text-gray-700">How addressing works on CLICK</p>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li>Inputs and outputs are assigned in I/O-list order: CPU points first (X001, Y001…), then expansion slot 1 (X101–X116), slot 2 (X201–X216) and so on, assuming 16-point modules.</li>
                  <li>If your wiring differs, type the real address for any point in the <Link to="/io" className="underline">I/O List</Link>.</li>
                  <li>The AI uses C bits, T timers, CT counters and DS registers for internal logic and gives each one a nickname.</li>
                  <li>Export gives you the ladder printout to enter in CLICK Programming Software and the nickname list for its Address Picker.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
