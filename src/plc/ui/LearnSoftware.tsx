import { useState } from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid';
import { plcBridges } from '../../desktop/plcHelper';

/** What the bridge recorded (tools/click-bridge/src/Learn.cs). */
interface Learned {
  installed: { name: string; version: string; folder: string }[];
  running: { processId: number; title: string }[];
  windows: string[];
  file: string;
  shot: string | null;
}

/** The moments to record in MPE720, in the order a user works: what the app needs to see to drive it later. */
const MPE720_STEPS = [
  { label: '1 project open', text: 'Open MPE720 and your project, as you normally do.' },
  { label: '2 ladder drawing', text: 'Open a ladder drawing (for example H01) so that its rungs show.' },
  { label: '3 rung selected', text: 'Click an empty place in a rung, where you would put a new contact.' },
  { label: '4 contact window', text: 'Open the window for adding a normally open contact (as you would to add one). Leave it open: do not press OK.' },
  { label: '5 coil window', text: 'Close that window (Cancel). Open the window for adding a coil the same way, and leave it open.' },
  { label: '6 save and compile', text: 'Close that window (Cancel). Open the menu where you save and compile (convert) the drawing, and leave it open.' },
  { label: '7 transfer', text: 'Press Esc. Open the window for transferring the program to the controller. Leave it open: do not transfer.' },
];

/**
 * "Teach the app MPE720" (Yaskawa): MPE720 has no way for another program to put a program into it, so the app will
 * work its windows as it does CLICK's. First it has to see them on the user's PC. Here the user does each step in
 * MPE720 and presses Record: the bridge writes every MPE720 window with its controls, and a screenshot, into the
 * log folder. Read only: nothing is clicked, typed or changed in MPE720.
 */
export default function LearnSoftware() {
  const click = plcBridges()?.click;
  const [done, setDone] = useState<Record<string, Learned>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!click) return null;

  const record = async (label: string) => {
    setBusy(label); setError(null);
    try {
      const r = (await click.call('learn', { target: 'mpe720', label })) as Learned;
      setDone((d) => ({ ...d, [label]: r }));
      if (!r.running.length) setError('MPE720 is not open: open it first, then press Record again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  const first = Object.values(done)[0];
  const count = Object.values(done).filter((d) => d.running.length).length;

  return (
    <div className="space-y-2 border-t border-steel-200 pt-3" data-testid="learn-mpe720">
      <p className="font-semibold text-steel-900">Teach the app MPE720</p>
      <p className="text-xs text-steel-600">
        So that the app can put the program into MPE720 by itself, it first needs to see MPE720's windows on your PC. Do each step in
        MPE720, then press Record. The app only looks: it does not click, type or change anything in MPE720.
      </p>
      {first?.installed.length ? <p className="text-xs text-steel-600">Found: {first.installed.map((i) => `${i.name} ${i.version}`).join(', ')}</p> : null}
      <ol className="space-y-1.5">
        {MPE720_STEPS.map((s) => {
          const r = done[s.label];
          return (
            <li key={s.label} className="flex items-start gap-2 text-xs">
              <span className="flex-1 text-steel-800">{s.text}</span>
              {r?.running.length ? <span className="inline-flex items-center gap-0.5 text-green-700" data-testid={`learn-done-${s.label}`}><CheckCircleIcon className="h-4 w-4" />{r.windows.length} window{r.windows.length === 1 ? '' : 's'}</span> : null}
              <button type="button" onClick={() => void record(s.label)} disabled={busy !== null} data-testid={`learn-record-${s.label}`}
                className="flex-none rounded border border-steel-300 bg-white px-2 py-0.5 font-medium text-steel-800 hover:bg-steel-50 disabled:opacity-40">
                {busy === s.label ? 'Recording…' : r ? 'Again' : 'Record'}
              </button>
            </li>
          );
        })}
      </ol>
      {error && <p role="alert" className="flex gap-1 text-xs text-red-700"><ExclamationTriangleIcon className="h-4 w-4 flex-none" />{error}</p>}
      {count > 0 && (
        <p className="text-xs text-steel-700" data-testid="learn-send">
          {count} of {MPE720_STEPS.length} recorded. Send the files named learn-mpe720-… (.txt and .png) from the log folder:{' '}
          <button type="button" onClick={() => void click.showLog?.()} className="rounded border border-steel-300 bg-white px-2 py-0.5 font-medium hover:bg-steel-50">Open log folder</button>
        </p>
      )}
    </div>
  );
}
