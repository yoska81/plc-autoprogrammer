import { useEffect, useRef, useState } from 'react';
import type { ManualCommand } from './manualCommands';
import { pressCommand, releaseAllCommands, releaseCommand, useOnlineStore } from './useOnline';

/**
 * "Manual commands": hold-to-run buttons for the program's HMI command bits (jog, start, stop…). ON while
 * held; OFF on release, when the window loses focus, when the page closes and before a disconnect. The first
 * press of each command after connecting asks for a confirmation (that press writes nothing).
 */
export default function ManualCommands({ commands, live, stale, labelOf }: {
  commands: ManualCommand[];
  /** Live bit value (null when not read). */
  live: (address: string) => boolean | null;
  stale: boolean;
  labelOf: (address: string) => string;
}) {
  const st = useOnlineStore();
  const connected = st.status === 'connected';
  const confirmed = useRef(new Set<string>());
  const [note, setNote] = useState<string | null>(null);

  // A new connection asks again; a lost focus, a hidden tab or leaving the page releases everything held.
  useEffect(() => { if (!connected) confirmed.current.clear(); }, [connected]);
  useEffect(() => {
    const off = () => { if (useOnlineStore.getState().held.length) void releaseAllCommands(); };
    const vis = () => { if (document.visibilityState === 'hidden') off(); };
    window.addEventListener('blur', off);
    window.addEventListener('pagehide', off);
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('blur', off); window.removeEventListener('pagehide', off); document.removeEventListener('visibilitychange', vis); off(); };
  }, []);
  // Writes switched off while a command is held: release it.
  useEffect(() => { if (!st.allowWrites && st.held.length) void releaseAllCommands(); }, [st.allowWrites, st.held.length]);

  const why = (c: ManualCommand): string | null => {
    if (!connected) return 'Not connected';
    if (!st.allowWrites) return 'Switch on "Allow writes" first';
    if (stale) return 'Values are stale: the PLC is not answering';
    if (c.interlock && live(c.interlock) !== true) return `Interlock ${c.interlock}${labelOf(c.interlock) ? ` (${labelOf(c.interlock)})` : ''} is OFF`;
    return null;
  };
  const start = (c: ManualCommand): boolean => {
    if (why(c)) return false;
    if (!confirmed.current.has(c.address)) {
      const ok = confirm(`Use "${c.label}" (${c.address}) on the running machine?\n\nWhile you hold the button, ${c.address} is ON in the PLC, exactly as if the operator held it on the touch panel. The machine may move. Make sure the area is clear.\n\nAfter this, press and hold the button to run.`);
      if (ok) { confirmed.current.add(c.address); setNote(`${c.label}: confirmed. Press and hold to run.`); }
      return false;
    }
    setNote(null);
    void pressCommand(c.address);
    return true;
  };
  const stop = (c: ManualCommand) => { void releaseCommand(c.address); };

  return (
    <div className="space-y-3" data-testid="manual-commands">
      <p className="max-w-3xl rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Hold a button to send that command to the PLC, the same bit the touch-panel button sets. It goes OFF when you let go, when this window loses focus, and before a disconnect.
        Only the program&apos;s HMI command bits are offered. CLICK can&apos;t force inputs or outputs over the network: use the CLICK programming software to force. There is no Run / Stop here.
        If this computer or the network fails while you hold a button, the bit stays ON in the PLC until the program or the CLICK software turns it OFF.
      </p>
      {/* Fixed height: the buttons never move under a finger when the line changes. */}
      <p role="status" className="min-h-5 text-sm text-green-800">{note}</p>
      {commands.length === 0
        ? <p className="text-sm text-steel-500">The program has no HMI command bits (a touch-panel push button&apos;s C bit that the program reads).</p>
        : (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))]">
            {commands.map((c) => {
              const blocked = why(c);
              const held = st.held.includes(c.address);
              const v = live(c.address);
              return (
                <div key={c.address} className="rounded border border-steel-200 bg-white p-3" data-command={c.address}>
                  <button type="button" aria-label={`Hold ${c.label}`} aria-pressed={held} disabled={Boolean(blocked)}
                    className={`w-full select-none touch-none rounded px-3 py-4 text-base font-semibold disabled:opacity-40 ${held ? 'bg-green-600 text-white ring-4 ring-green-300' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
                    onPointerDown={(e) => { if (e.button !== 0) return; if (start(c)) e.currentTarget.setPointerCapture(e.pointerId); }}
                    onPointerUp={() => stop(c)} onPointerCancel={() => stop(c)} onLostPointerCapture={() => stop(c)}
                    onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(c); } }}
                    onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') stop(c); }}
                    onBlur={() => stop(c)} onContextMenu={(e) => e.preventDefault()}>
                    {held ? `${c.label} — held` : c.label}
                  </button>
                  <div className="mt-1.5 text-xs text-steel-600">
                    <span className="font-mono">{c.address}</span> reads <b aria-label={`Command ${c.address} value`}>{stale || v === null ? '—' : v ? 'ON' : 'OFF'}</b>
                    {c.interlock && <> · interlock <span className="font-mono">{c.interlock}</span> {stale || live(c.interlock) === null ? '—' : live(c.interlock) ? 'ON' : 'OFF'}</>}
                  </div>
                  {blocked && <div className="text-xs text-steel-500">{blocked}</div>}
                  {c.usedBy.length > 0 && <div className="mt-1 text-xs text-steel-500" title={c.usedBy.join('\n')}>Program: {c.usedBy[0]}{c.usedBy.length > 1 ? ` (+${c.usedBy.length - 1})` : ''}</div>}
                </div>
              );
            })}
          </div>
        )}
      {st.writes.length > 0 && (
        <div className="rounded border border-steel-200 bg-white p-2 text-xs text-steel-600" data-testid="write-log">
          <b>Writes this session</b>
          <ul className="mt-1 max-h-40 overflow-auto font-mono">{st.writes.map((w, i) => (
            <li key={i} className={w.ok ? '' : 'text-red-700'}>{w.at} {w.address} = {w.value}{w.ok ? '' : ` — failed: ${w.error}`}</li>
          ))}</ul>
        </div>
      )}
    </div>
  );
}
