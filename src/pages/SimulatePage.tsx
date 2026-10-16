import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SimulatorPanel from '../sim/SimulatorPanel';
import type { SimHandle } from '../sim/controller';
import HmiScreenView from '../hmi/HmiScreenView';
import { getHmi } from '../hmi/hmiCatalog';
import type { HmiDesign, HmiElement } from '../hmi/types';
import { useProgramStore } from '../store/useProgramStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useHmiStore } from '../store/useHmiStore';
import { usePlc } from '../plc/usePlc';

/** The HMI running against the simulated PLC: buttons write bits, lamps and values read them. */
function LiveHmi({ handle, design }: { handle: SimHandle; design: HmiDesign }) {
  const model = getHmi(design.hmiPartNumber);
  const [screenId, setScreenId] = useState(design.screens[0]?.id ?? '');
  const [, setTick] = useState(0);

  // Re-draw whenever the simulator publishes new values.
  useEffect(() => handle.subscribe(() => setTick((t) => t + 1)), [handle]);

  const press = useCallback((el: HmiElement, down: boolean) => {
    if (!el.address) return;
    switch (el.action ?? 'momentary') {
      case 'momentary': handle.write(el.address, down); break;
      case 'set': if (down) handle.write(el.address, true); break;
      case 'reset': if (down) handle.write(el.address, false); break;
      case 'toggle': if (down) handle.write(el.address, !handle.read(el.address)); break;
    }
  }, [handle]);

  if (!model) return <p className="text-sm text-gray-500">HMI model {design.hmiPartNumber} not found.</p>;
  const screen = design.screens.find((s) => s.id === screenId) ?? design.screens[0];
  const activeAlarms = design.alarms.filter((a) => Boolean(handle.read(a.address))).map((a) => a.message);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {design.screens.map((s) => (
          <button key={s.id} onClick={() => setScreenId(s.id)}
            className={`px-2 py-1 text-xs rounded ${s.id === screen.id ? 'bg-gray-800 text-white' : 'bg-white border border-gray-300'}`}>{s.name}</button>
        ))}
      </div>
      <div className="bg-gray-800 rounded-xl p-2 shadow-lg">
        <HmiScreenView screen={screen} widthPx={model.widthPx} heightPx={model.heightPx}
          read={handle.read} onPress={press} onNavigate={setScreenId} activeAlarms={activeAlarms} />
      </div>
      <p className="text-xs text-gray-500">{model.partNumber} · press and hold buttons like a real touch panel.</p>
    </div>
  );
}

export default function SimulatePage() {
  const ladder = useProgramStore((s) => s.ladder);
  const wiring = useElectricalStore((s) => s.design?.ioWiring);
  const hmiDesign = useHmiStore((s) => s.design);
  const { profile, io, addresses, labels } = usePlc();
  const [handle, setHandle] = useState<SimHandle | null>(null);

  const simIO = useMemo(() => io.map((p) => ({ address: addresses.get(p.id) ?? '', description: p.description, type: p.type, category: p.category })), [io, addresses]);

  // Without an electrical design, use the device types the spec/I-O stage found.
  const simWiring = useMemo(() => wiring ?? io.flatMap((p) => (p.deviceType ? [{
    address: addresses.get(p.id) ?? '', deviceTag: '', deviceType: p.deviceType as never, description: p.description,
  }] : [])), [wiring, io, addresses]);

  const header = (
    <header className="px-6 py-4 bg-white border-b border-gray-200">
      <h2 className="text-lg font-semibold text-gray-800">7 · Simulate</h2>
      <p className="text-xs text-gray-400 mt-0.5">Run the PLC program against a model of the machine. Press buttons, trip the E-stop, watch parts move and the logic light up.</p>
    </header>
  );

  if (profile.language !== 'ladder' || !ladder.rungs.length) {
    return (
      <>
        {header}
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
          {profile.language !== 'ladder' ? 'Simulation is available for ladder PLCs (CLICK).' : <span>No program yet. Write it on the <Link to="/program" className="underline">PLC Program</Link> page first.</span>}
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          <SimulatorPanel program={ladder} io={simIO} wiring={simWiring} labels={labels} onHandle={setHandle} />
        </div>
        {hmiDesign && (
          <aside className="w-[34%] max-w-[540px] min-w-[300px] flex-shrink-0 border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">HMI (live)</h3>
            {handle ? <LiveHmi handle={handle} design={hmiDesign} /> : <p className="text-sm text-gray-500">Starting simulator…</p>}
          </aside>
        )}
      </div>
    </>
  );
}
