import { useEffect, useState } from 'react';
import { desktopBridge, type ClaudeHelperStatus } from '../../desktop/bridge';

/**
 * Settings › Send from the web page (Windows app): lets the Claude desktop app use the ISA PLC Helper that comes
 * with this app, so "Send to PLC software" also works on the web page opened in the Claude app
 * (electron/claudeConfig.cjs, tools/plc-helper). Changed only on a press; the Claude app reads it when it starts.
 */
export default function PlcHelperCard() {
  const helper = desktopBridge()?.claudeHelper;
  const [st, setSt] = useState<ClaudeHelperStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  useEffect(() => { if (helper) void helper.status().then(setSt).catch(() => setSt(null)); }, [helper]);
  if (!helper) return null;
  const change = async (on: boolean) => {
    setBusy(true);
    try { const r = await helper.set(on); setSt(r); setChanged(!r.error); }
    finally { setBusy(false); }
  };
  const btn = 'rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40';
  return (
    <div id="plc-helper" className="bg-white rounded-lg border border-gray-200 p-5 space-y-3 scroll-mt-4" data-testid="plc-helper-settings">
      <div>
        <p className="text-sm font-semibold text-gray-700">Send from the web page</p>
        <p className="text-xs text-gray-500 mt-0.5">The ISA PLC Helper comes with this app. Connect it to the Claude desktop app, and "Send to PLC software" also works on the web page opened there.</p>
      </div>
      <p className={`text-sm ${st?.connected && st.current ? 'text-emerald-700' : 'text-gray-700'}`} data-testid="plc-helper-status">
        {!st ? 'Checking…'
          : st.error ? st.error
          : !st.claude ? 'The Claude desktop app is not installed on this PC.'
          : st.connected && st.current ? 'Connected: the Claude app can use the ISA PLC Helper.'
          : st.connected ? 'Connected to another installation of this app: connect again to use this one.'
          : 'Not connected.'}
      </p>
      {st?.claude && (
        <div className="flex flex-wrap gap-2">
          {!(st.connected && st.current) && <button type="button" disabled={busy} onClick={() => void change(true)} data-testid="plc-helper-connect" className={btn}>Connect the Claude app</button>}
          {st.connected && <button type="button" disabled={busy} onClick={() => void change(false)} data-testid="plc-helper-disconnect" className={btn}>Disconnect</button>}
        </div>
      )}
      {changed && <p className="text-sm text-gray-700" data-testid="plc-helper-restart">Close the Claude app and open it again to finish.</p>}
    </div>
  );
}
