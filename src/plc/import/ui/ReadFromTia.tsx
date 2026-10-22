import { useState } from 'react';
import { desktopBridge, type TiaDetect } from '../../../desktop/bridge';
import { readBackFiles, type TiaReadBack } from '../../tia/tiaReadBack';

interface Portal { processId: number; project: string | null }

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * "Read from TIA Portal" on the Upgrade page (desktop app, TIA Openness): the program of the project open in the
 * user's TIA Portal, read through the TIA bridge (readBack: every block as SimaticML, every PLC tag; nothing is
 * changed or saved) and handed to the program import as its files. TIA Openness cannot read a PLC directly: a
 * program only in the PLC is first uploaded in TIA Portal (Online › Upload device as new station).
 */
export default function ReadFromTia({ onFiles, disabled }: { onFiles: (files: { name: string; text: string }[], label: string) => void; disabled?: boolean }) {
  const tia = desktopBridge()?.tia;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<TiaDetect | null>(null);
  const [portals, setPortals] = useState<Portal[] | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [failed, setFailed] = useState<TiaReadBack['failed']>([]);
  if (!tia) return null;

  const run = async <T,>(f: () => Promise<T>): Promise<T | null> => {
    setBusy(true); setError(null);
    try { return await f(); } catch (e) { setError(message(e)); return null; } finally { setBusy(false); }
  };
  const look = async () => {
    setPortals(null); setFailed([]);
    const d = await run(() => tia.call('detect'));
    setFound(d);
    if (!d?.ready) return;
    const r = await run(() => tia.call('portals') as Promise<{ portals: Portal[] }>);
    const withProject = (r?.portals ?? []).filter((x) => x.project);
    setPortals(withProject);
    setPick(withProject[0]?.processId ?? null);
  };
  const readIt = async () => {
    const x = portals?.find((q) => q.processId === pick);
    if (!x?.project) return;
    const r = await run(async () => {
      await tia.call('open', { processId: x.processId });
      return await tia.call('readBack') as TiaReadBack;
    });
    if (!r) return;
    setFailed(r.failed);
    if (!r.blocks.length) { setError('TIA Portal gave no program blocks from this project. Compile the PLC in TIA Portal, then read again.'); return; }
    onFiles(readBackFiles(r, x.project), `TIA Portal: ${x.project.replace(/^.*[\\/]/, '')}`);
  };

  return (
    <div className="border-t border-gray-100 pt-3 space-y-2" data-testid="read-from-tia">
      <p className="text-xs text-gray-600"><span className="font-medium text-gray-800">Siemens, on this PC:</span> read the program straight from the project open in TIA Portal (its blocks and PLC tags; nothing in TIA Portal is changed). A program that is only in the PLC: in TIA Portal, Online › Upload device as new station first.</p>
      <button onClick={() => void look()} disabled={busy || disabled} data-testid="read-from-tia-find"
        className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-40">{busy && !portals ? 'Looking…' : 'Find TIA Portal'}</button>
      {found && !found.ready && <ol className="ml-5 list-decimal text-xs text-amber-900 space-y-0.5">{found.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
      {portals && !portals.length && <p className="text-xs text-amber-900">No TIA Portal with a project open. Open the machine's project in TIA Portal, then Find TIA Portal again.</p>}
      {portals && portals.length > 0 && (
        <div className="space-y-1">
          {portals.map((x) => (
            <label key={x.processId} className="flex items-start gap-2 text-xs text-gray-700">
              <input type="radio" name="tia-read" className="mt-0.5" checked={pick === x.processId} onChange={() => setPick(x.processId)} disabled={busy} />
              <span className="font-mono">{x.project}</span>
            </label>
          ))}
          <button onClick={() => void readIt()} disabled={busy || disabled || pick === null} data-testid="read-from-tia-read"
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40">{busy ? 'Reading from TIA Portal…' : 'Read the program'}</button>
        </div>
      )}
      {failed.length > 0 && <ul className="ml-5 list-disc text-xs text-amber-900" data-testid="read-from-tia-failed">{failed.map((f) => <li key={f.name}>{f.name}: not read ({f.error})</li>)}</ul>}
      {error && <p role="alert" className="text-xs text-red-800">{error}</p>}
    </div>
  );
}
