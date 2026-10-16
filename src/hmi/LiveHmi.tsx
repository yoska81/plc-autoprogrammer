import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SimHandle } from '../plc/sim/controller';
import HmiScreenView from './HmiScreenView';
import { getHmi } from './hmiCatalog';
import { HmiRuntimeTracker, type HmiRuntime } from './runtime';
import type { HmiDesign, HmiElement } from './types';
import { LEVEL_LABEL } from './theme';

/**
 * The HMI running against the simulated PLC: buttons write bits, lamps and
 * values read them, the panel keeps its own clock, alarm log and trend buffers.
 */
export default function LiveHmi({ handle, design }: { handle: SimHandle; design: HmiDesign }) {
  const model = getHmi(design.hmiPartNumber);
  const [screenId, setScreenId] = useState(design.screens[0]?.id ?? '');
  const tracker = useMemo(() => new HmiRuntimeTracker(design), [design]);
  const [runtime, setRuntime] = useState<HmiRuntime | null>(null);

  // Re-draw whenever the simulator publishes new values, and once a second for the clock.
  useEffect(() => {
    const tick = () => setRuntime(tracker.sample(handle.read, Date.now()));
    tick();
    const unsub = handle.subscribe(tick);
    const timer = window.setInterval(tick, 1000);
    return () => { unsub(); window.clearInterval(timer); };
  }, [handle, tracker]);

  const press = useCallback((el: HmiElement, down: boolean) => {
    if (!el.address) return;
    // The panel itself ignores a press while the PLC's permissive bit is off (the PLC interlocks too).
    if (down && el.interlock && !handle.read(el.interlock)) return;
    switch (el.action ?? 'momentary') {
      case 'momentary': handle.write(el.address, down); break;
      case 'set': if (down) handle.write(el.address, true); break;
      case 'reset': if (down) handle.write(el.address, false); break;
      case 'toggle': if (down) handle.write(el.address, !handle.read(el.address)); break;
    }
  }, [handle]);

  if (!model) return <p className="text-sm text-gray-500">HMI model {design.hmiPartNumber} not found.</p>;
  const screen = design.screens.find((s) => s.id === screenId) ?? design.screens[0];
  if (!screen) return <p className="text-sm text-gray-500">The HMI design has no screens.</p>;
  const active = runtime?.alarms.filter((a) => a.off === null).length ?? 0;

  return (
    <div className="space-y-2">
      {/* The panel's own navigation bar switches screens; this reaches screens that have no button to them. */}
      <label className="flex items-center gap-2 text-xs text-gray-600">
        Screen
        <select aria-label="HMI screen" value={screen.id} onChange={(e) => setScreenId(e.target.value)} className="border border-gray-300 rounded px-1.5 py-0.5 bg-white">
          {design.screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <div className="bg-gray-900 rounded-xl p-2 shadow-lg ring-1 ring-black/40">
        <HmiScreenView screen={screen} widthPx={model.widthPx} heightPx={model.heightPx} design={design}
          read={handle.read} onPress={press} onNavigate={setScreenId} runtime={runtime ?? undefined} />
      </div>
      <p className="text-xs text-gray-500">
        {model.partNumber} · {model.widthPx}×{model.heightPx} · press and hold buttons like a real touch panel
        {active ? ` · ${active} active alarm${active > 1 ? 's' : ''}` : ''}
        {screen.level ? ` · ${LEVEL_LABEL[screen.level]} password on the real panel` : ''}
      </p>
    </div>
  );
}
