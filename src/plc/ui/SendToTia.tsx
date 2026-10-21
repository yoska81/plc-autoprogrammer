import { useEffect, useState } from 'react';
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { desktopBridge, type TiaDetect } from '../../desktop/bridge';

/**
 * "Send to TIA Portal": the Windows desktop app drives the user's own TIA Portal through TIA Openness
 * (electron/tiaBridge.cjs → tools/tia-bridge). Shown for a Siemens S7 project in the desktop app only (a browser
 * cannot start programs). This first step checks the PC: TIA Portal, TIA Openness and the user's permission,
 * with what to do when something is missing.
 */
export default function SendToTia({ profileId }: { profileId: string }) {
  const tia = desktopBridge()?.tia;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [found, setFound] = useState<TiaDetect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logPath, setLogPath] = useState('');

  useEffect(() => (open && tia ? tia.onProgress((p) => setProgress(p.text)) : undefined), [open, tia]);

  if (!tia || profileId !== 'siemens-s7') return null;

  const check = async () => {
    setBusy(true); setError(null); setFound(null); setProgress('');
    try { setFound(await tia.call('detect')); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); setProgress(''); }
    tia.logPath().then(setLogPath, () => undefined);
  };
  const show = () => { setOpen(true); void check(); };

  return (
    <>
      <button onClick={show} data-testid="send-to-tia" title="Open TIA Portal on this PC and put the program into it"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-brand-300 bg-white text-brand-800 hover:bg-brand-50">
        <PaperAirplaneIcon className="h-4 w-4" /> Send to TIA Portal
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <div role="dialog" aria-label="Send to TIA Portal" className="w-full max-w-2xl rounded bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-steel-200 px-5 py-3">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-steel-900">Send to TIA Portal</h2>
                <p className="text-xs text-steel-500">The app opens TIA Portal on this PC and puts the program into it. TIA Portal asks once whether to allow this app: choose Yes.</p>
              </div>
              <button onClick={() => setOpen(false)} disabled={busy} aria-label="Close" className="rounded p-1 text-steel-400 hover:bg-steel-100 hover:text-steel-700 disabled:opacity-40"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm" data-testid="tia-check">
              <h3 className="font-semibold text-steel-900">1. Check this PC</h3>
              {busy && <p className="flex items-center gap-2 text-steel-600" role="status"><ArrowPathIcon className="h-4 w-4 animate-spin" /> {progress || 'Checking…'}</p>}
              {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-red-800">{error}</p>}
              {found && (
                <>
                  <ul className="space-y-1 text-steel-700">
                    <Line ok={found.installed.length > 0}>TIA Portal {found.installed.length ? found.installed.join(', ') : 'not found'}</Line>
                    <Line ok={found.openness.length > 0}>TIA Openness {found.openness.length ? `${found.openness.map((o) => o.version).join(', ')} (the app uses ${found.openness[0].version})` : 'not installed'}</Line>
                    {found.openness.length > 0 && <Line ok={found.inOpennessGroup}>{found.user} {found.inOpennessGroup ? 'may use TIA Openness' : 'is not in the "Siemens TIA Openness" group'}</Line>}
                  </ul>
                  {found.ready
                    ? <p className="rounded border border-green-200 bg-green-50 p-2 text-green-900" data-testid="tia-ready">This PC is ready. Sending the program to TIA Portal comes in the next update of the app; until then use Load into PLC.</p>
                    : (
                      <div className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-900" data-testid="tia-steps">
                        <p className="font-medium">To fix:</p>
                        <ol className="ml-5 list-decimal space-y-1">{found.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                      </div>
                    )}
                </>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button onClick={() => void check()} disabled={busy} className="rounded border border-steel-300 px-2.5 py-1 text-xs font-medium text-steel-800 hover:bg-steel-50 disabled:opacity-40">Check again</button>
                {logPath && <span className="text-xs text-steel-500">Log for support: <span className="select-all font-mono">{logPath}</span></span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Line({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-label="OK" /> : <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="Missing" />}
      <span>{children}</span>
    </li>
  );
}
