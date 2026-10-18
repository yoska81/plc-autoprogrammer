import { useEffect, useState } from 'react';
import { desktopBridge, type DwgReaderStatus } from '../desktop/bridge';

/**
 * Settings → DWG reader (Windows app): the ODA Drawings SDK reader the user built or received with their
 * ODA licence, chosen here and kept on this PC. Nothing of the SDK ships with the app. In the browser the
 * card says DWG is read only by the Windows app.
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
        <p className="text-sm font-semibold text-gray-700">DWG reader</p>
        <p className="text-xs text-gray-500 mt-0.5">Reads AutoCAD DWG drawings on Import → Drawings, with the ODA Drawings SDK (a licence from the Open Design Alliance). PDF and DXF need nothing.</p>
      </div>
      {!dwg ? (
        <p className="text-sm text-gray-600">DWG files are read in the Windows app once its DWG reader is set up here. In the browser: save the drawings as DXF in AutoCAD, or print them to PDF.</p>
      ) : (
        <>
          <p className={`text-sm ${st?.ok ? 'text-emerald-700' : 'text-gray-700'}`} data-testid="dwg-reader-status">
            {!st ? 'Checking…' : st.ok ? <>Set up: {st.path}</> : st.configured ? <>Can't be used: {st.error} ({st.path})</> : 'DWG reader not installed yet.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void run(() => dwg.configure())} className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40">
              {st?.configured ? 'Choose another reader…' : 'Choose the DWG reader…'}
            </button>
            {st?.configured && <button type="button" disabled={busy} onClick={() => void run(() => dwg.clear())} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Remove</button>}
          </div>
          <p className="text-xs text-gray-500">The reader is the file your ODA Drawings SDK build gives you: a Node module (<code>.node</code>, with <code>dwgToDxf(input, output)</code>) or a program (<code>.exe</code>, run as <code>reader input.dwg output.dxf</code>). Its licence activation is inside it; the app only keeps where it is. Until it is set up: save the drawings as DXF in AutoCAD (File → Save As → DXF).</p>
        </>
      )}
    </div>
  );
}
