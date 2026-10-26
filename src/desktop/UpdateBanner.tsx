import { useEffect, useState } from 'react';
import { desktopBridge, type UpdateState } from './bridge';

/**
 * A small bar under the menu: "A new version is ready — Restart to update" once an update has downloaded
 * (it downloads quietly). Restart closes the app through its usual save checks and installs; nothing happens
 * without that click. The answer to "Check for updates" (latest version, downloading, no connection) shows here too.
 */
export default function UpdateBanner() {
  const [s, setS] = useState<UpdateState | null>(null);
  const [later, setLater] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const u = desktopBridge()?.update;
    if (!u) return;
    let live = true;
    void u.state().then((x) => { if (live) setS(x); });
    const off = u.onState((x) => { setS(x); if (x.manual) setLater(null); });
    return () => { live = false; off(); };
  }, []);
  // The answer to a manual check goes away by itself.
  useEffect(() => {
    if (!s?.manual || s.status === 'ready' || s.status === 'downloading' || s.status === 'checking') return;
    const t = setTimeout(() => setS((x) => (x ? { ...x, manual: false } : x)), 8000);
    return () => clearTimeout(t);
  }, [s]);
  if (!s) return null;

  if (s.status === 'ready' && later !== s.version) {
    return (
      <div role="status" data-testid="update-banner" className="flex flex-wrap items-center gap-3 border-b border-green-200 bg-green-50 px-4 py-1.5 text-xs text-green-900">
        <span><b>A new version is ready</b>{s.version ? ` (${s.version})` : ''} — Restart to update. Your projects and settings stay as they are.</span>
        <button className="rounded bg-green-700 px-3 py-1 font-medium text-white hover:bg-green-800 disabled:opacity-50" disabled={busy}
          onClick={() => { setBusy(true); void desktopBridge()?.update?.install().finally(() => setBusy(false)); }}>
          {busy ? 'Closing…' : 'Restart to update'}
        </button>
        <button className="text-green-800 hover:underline" onClick={() => setLater(s.version ?? '')}>Later</button>
      </div>
    );
  }
  if (!s.manual) return null;
  const text = s.status === 'checking' ? 'Checking for updates…'
    : s.status === 'downloading' ? `Downloading version ${s.version ?? ''}… ${s.percent ?? 0}%. You can keep working.`
      : s.status === 'none' ? `You have the latest version (${s.current}).`
        : s.status === 'error' ? s.message ?? 'The update check did not work.'
          : null;
  if (!text) return null;
  return (
    <div role="status" data-testid="update-banner" className={`border-b px-4 py-1.5 text-xs ${s.status === 'error' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-steel-200 bg-white text-steel-700'}`}>{text}</div>
  );
}
