import { recordConversion } from '../tidy/changeLog';
import { Link } from 'react-router-dom';
import { PLC_PROFILES } from '../core/profiles';
import { useProjectStore } from '../../store/useProjectStore';
import { undoIoDelete, useIoUndo } from '../core/ioChange';
import { choosePlc, choosePlcBrand } from '../core/choosePlc';
import { notify } from '../../store/useNoticeStore';
import { usePlc } from '../core/usePlc';
import { useIOStore } from '../../store/useIOStore';
import { hardwareShortfall } from '../../spec/equipmentRules';

export default function PlcSetupPage() {
  // A PLC / CPU / module change renumbers the I/O: the program and the HMI follow it (one remap), and say so.
  // The last PLC change (or I/O delete) stays undoable here until the next edit.
  const undoLabel = useIoUndo((s) => s.label);
  const remapped = (notes: string[]) => { if (notes.length) notify(`The I/O was renumbered for the new PLC; the program and the HMI followed. ${notes.join(' ')}`, { label: 'Undo', run: () => { undoIoDelete(); } }); };
  const modules = useProjectStore((s) => s.modules);
  const io = useIOStore((s) => s.projectIO);
  const { profile, cpu } = usePlc();
  const short = hardwareShortfall(cpu.id, modules, io);

  // Nothing fits: the CPU is still set and the shortfall is shown below (never applied silently).
  // A move to another brand is in the session's Change report.
  const choose = (plcId: string, cpuId: string) => remapped(recordConversion(plcId, () => choosePlc(plcId, cpuId)));
  const chooseBrand = (plcId: string) => remapped(recordConversion(plcId, () => choosePlcBrand(plcId)));

  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">I/O addressing</h2>
        <p className="text-xs text-gray-400 mt-0.5">The PLC the program is written for (chosen in Equipment) and how each input and output gets its address.</p>
        {undoLabel && (
          <button onClick={() => undoIoDelete()} title="Put back the PLC, the I/O addresses, the program and the HMI as they were" className="mt-2 px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50">
            Undo: {undoLabel}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-3xl space-y-6">
          {profile.readOnly && (
            <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded px-3 py-2" data-testid="plc-read-only">
              This project is on the machine's own {profile.vendor} controller ({cpu.id}), read only: the app cannot program it yet. Choose the PLC to move it to; the I/O, the program and the HMI follow it.
            </p>
          )}
          {/* the PLC is chosen once, in Equipment: shown here; changing it here is still possible, folded away */}
          <div className="rounded-lg border border-brand-200 bg-white p-4" data-testid="plc-chosen">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Your PLC</p>
            <p className="mt-0.5 text-base font-semibold text-gray-800">{profile.vendor} {profile.name} · {cpu.id}</p>
            <p className="mt-1 text-xs text-gray-500">Chosen in <Link to="/equipment" className="text-brand-700 underline">Equipment</Link>: the program, the I/O addresses and the drawings follow it. Nothing to choose again here.</p>
          </div>
          <details className="rounded-lg border border-gray-200 bg-white p-3" data-testid="plc-change">
            <summary className="cursor-pointer text-sm text-gray-700">Change the PLC here instead</summary>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PLC_PROFILES.map((p) => {
              const selected = p.id === profile.id;
              return (
                <button
                  key={p.id}
                  disabled={!p.available}
                  onClick={() => chooseBrand(p.id)}
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
          </details>

          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <div>
              <label htmlFor="cpu" className="block text-sm font-medium text-gray-700 mb-1">CPU model</label>
              <select
                id="cpu"
                value={cpu.id}
                onChange={(e) => choose(profile.id, e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {profile.cpuModels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              {profile.language === 'ladder' && (
                <p className="text-xs text-gray-500 mt-2">
                  Built-in I/O: {cpu.builtInInputs} inputs, {cpu.builtInOutputs} outputs.{cpu.notes ? ` ${cpu.notes}` : ''}
                </p>
              )}
              {modules.length > 0 && <p className="text-xs text-gray-500 mt-1">Modules: {modules.join(', ')}</p>}
              {short && (
                <p role="alert" className="text-xs bg-red-50 border border-red-200 text-red-800 px-2 py-1.5 mt-2">
                  This PLC cannot hold the I/O list: {short} Choose a larger CPU, or add modules on the <Link to="/equipment" className="underline">Equipment</Link> page.
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
