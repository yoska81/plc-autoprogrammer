import { useMemo, useState } from 'react';
import ResizablePane from '../../components/ResizablePane';
import { Link } from 'react-router-dom';
import SimulatorPanel from '../sim/SimulatorPanel';
import type { SimHandle } from '../sim/controller';
import LiveHmi from '../../hmi/LiveHmi';
import { useProgramStore } from '../../store/useProgramStore';
import { useElectricalStore } from '../../store/useElectricalStore';
import { useHmiStore } from '../../store/useHmiStore';
import { usePlc } from '../core/usePlc';

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
    <header className="px-4 py-2.5 bg-white border-b border-gray-200">
      <h2 className="text-base font-semibold text-gray-800">7 · Simulate</h2>
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
          <ResizablePane id="sim.hmi" defaultSize={460} min={280} max={1100} handle="left" className="border-l border-steel-200 bg-steel-50 p-4 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">HMI (live)</h3>
            {handle ? <LiveHmi handle={handle} design={hmiDesign} /> : <p className="text-sm text-gray-500">Starting simulator…</p>}
          </ResizablePane>
        )}
      </div>
    </>
  );
}
