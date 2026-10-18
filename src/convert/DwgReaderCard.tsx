import { useEffect, useState } from 'react';
import { desktopBridge, type DwgReaderStatus } from '../desktop/bridge';

/**
 * Settings → DWG drawings (Windows app): DWG files are read by GNU LibreDWG's converter, which comes with
 * the app (nothing to set up). Advanced: another reader instead. In the browser: DWG opens in the Windows app.
 */
export default function DwgReaderCard() {
  const dwg = desktopBridge()?.dwg;
  const [st, setSt] = useState<DwgReaderStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (dwg) void dwg.status().then(setSt).catch(() => setSt({ configured: false, ok: false })); }, [dwg]);
  const run = async (f: () => Promise<DwgReaderStatus>) => { setBusy(true); try { setSt(await f()); } finally { setBusy(false); } };
  return (
    <div id="dwg-reader" className="bg-white rounded-lg border border-gray-200 p-5 space-y-3 scroll-mt-4" data-testid="dwg-reader-settings">
      <div>
        <p className="text-sm font-semibold text-gray-700">DWG drawings</p>
        <p className="text-xs text-gray-500 mt-0.5">AutoCAD DWG files (R13–R2018) open on Import → Drawings. PDF and DXF open everywhere.</p>
      </div>
      {!dwg ? (
        <p className="text-sm text-gray-600">DWG opens in the Windows app; here use DXF or PDF.</p>
      ) : (
        <>
          <p className={`text-sm ${st?.ok ? 'text-emerald-700' : 'text-gray-700'}`} data-testid="dwg-reader-status">
            {!st ? 'Checking…' : st.ok && st.builtIn ? 'Ready: DWG files are converted by GNU LibreDWG, which comes with the app.'
              : st.ok ? <>Using another reader: {st.path}</> : st.configured ? <>The reader chosen below can't be used: {st.error}</> : <>Not available in this installation ({st.error}). Save the drawings as DXF in AutoCAD, or install the app again.</>}
          </p>
          <details className="text-sm" open={Boolean(st?.configured)}>
            <summary className="cursor-pointer text-xs text-gray-500">Advanced: use another DWG reader</summary>
            <div className="mt-2 space-y-2">
              <p className="text-xs text-gray-500">A program run as <code>reader input.dwg output.dxf</code>, or a Node module (<code>.node</code>) with <code>dwgToDxf(input, output)</code>. Only if the built-in converter can't read your files.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void run(() => dwg.configure())} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40">Choose another reader…</button>
                {st?.configured && <button type="button" disabled={busy} onClick={() => void run(() => dwg.clear())} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Use the built-in converter</button>}
              </div>
            </div>
          </details>
          <p className="text-xs text-gray-400">LibreDWG is free software (GNU GPL v3), run as a separate program; its licence and source link are in the app's resources/libredwg folder.</p>
        </>
      )}
    </div>
  );
}
