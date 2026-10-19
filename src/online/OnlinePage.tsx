import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useActiveHmiDesign } from '../hmi/projectPanel';
import { useProgramStore } from '../store/useProgramStore';
import { usePlc } from '../plc/core/usePlc';
import { naturalCompare } from '../electrical/derive';
import { getHmi } from '../hmi/hmiCatalog';
import HmiScreenView from '../hmi/HmiScreenView';
import LiveLadder from '../plc/sim/LiveLadder';
import { programBlocks, rungAllAddresses } from '../plc/sim/blocks';
import { collectProject } from '../deliverables/collect';
import { saveBlob } from '../deliverables/files';
import { Spinner } from '../components/common';
import LoadIntoPlc from '../plc/ui/LoadIntoPlc';
import { clickModbus, isWritable, modbus984 } from './clickModbus';
import { rungPowerFromValues } from './power';
import { connectPlc, disconnectPlc, modbusBridge, refsFor, useOnlineStore, writePlc } from './useOnline';
import { firstScanRanges, programCheck, testConnection, type CheckLine } from './programCheck';
import { wordValueError } from './poll';
import { useCheckoutStore, type CheckoutEntry } from './useCheckoutStore';
import { buildCheckoutPdf, checkoutRows, checkoutSummary } from './checkoutPdf';
import { useProjectsStore } from '../store/useProjectsStore';
import { useDraft } from '../store/useDraftStore';
import { useUi } from '../store/useUiStore';
import TroubleshootPanel from '../troubleshoot/TroubleshootPanel';

type Tab = 'monitor' | 'ladder' | 'hmi' | 'checkout' | 'troubleshoot';

const input = 'border border-steel-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const btn = 'px-3 py-1.5 text-sm rounded border border-steel-300 bg-white hover:bg-steel-50 disabled:opacity-40';
const NO_TIMERS = new Map();
const NO_CHECKS: Record<string, CheckoutEntry> = {};

/** PLC program → Online: live values from a real CLICK PLC, I/O check-out, and (only when allowed) writes. */
export default function OnlinePage() {
  const ladder = useProgramStore((s) => s.ladder);
  const hmi = useActiveHmiDesign();
  const { io, addresses, profile, cpu } = usePlc();
  const st = useOnlineStore();
  const projectId = useProjectsStore((s) => s.activeId);
  const checkout = useCheckoutStore((s) => s.byProject[projectId ?? 'default']) ?? NO_CHECKS;
  const { tech, setTech, set: setCheck } = useCheckoutStore();
  const [tab, setTab] = useUi<Tab>('online.tab', 'monitor');
  // A link can open a tab directly (the navigation's "Fault finding" opens ?tab=troubleshoot).
  const [params] = useSearchParams();
  const linked = params.get('tab');
  useEffect(() => {
    if (linked === 'monitor' || linked === 'ladder' || linked === 'hmi' || linked === 'checkout' || linked === 'troubleshoot') setTab(linked);
  }, [linked, setTab]);
  const [filter, setFilter] = useUi('online.filter', '');
  const [screenId, setScreenId] = useUi<string | null>('online.screen', null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [dsDraft, setDsDraft] = useDraft<Record<string, string>>('online.writeValues', {});
  const desktop = Boolean(modbusBridge());
  const [checks, setChecks] = useState<{ title: string; lines: CheckLine[] } | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const isClick = profile.id === 'click';

  // Every address the project uses: I/O, program, HMI.
  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of hmi?.tags ?? []) if (t.address) m.set(t.address.toUpperCase(), t.name.replace(/_/g, ' '));
    for (const t of ladder.tags) if (t.nickname) m.set(t.address.toUpperCase(), t.nickname.replace(/_/g, ' '));
    for (const x of io) { const a = addresses.get(x.id); if (a) m.set(a.toUpperCase(), x.description); }
    return m;
  }, [io, addresses, ladder, hmi]);
  const all = useMemo(() => {
    const set = new Set<string>();
    for (const x of io) { const a = addresses.get(x.id); if (a) set.add(a.toUpperCase()); }
    for (const r of ladder.rungs) for (const a of rungAllAddresses(r)) set.add(a.toUpperCase());
    for (const t of ladder.tags) set.add(t.address.toUpperCase());
    for (const t of hmi?.tags ?? []) if (t.address) set.add(t.address.toUpperCase());
    return [...set].filter((a) => !/^-?\d/.test(a)).sort(naturalCompare);
  }, [io, addresses, ladder, hmi]);
  const { unsupported } = useMemo(() => refsFor(all), [all]);

  // Leave the PLC connection when the page closes.
  useEffect(() => () => { void disconnectPlc(); }, []);

  const connected = st.status === 'connected';
  const value = (a: string): string => {
    const k = a.toUpperCase();
    if (st.failed.has(k)) return 'read error';
    if (st.bits.has(k)) return st.bits.get(k) ? 'ON' : 'OFF';
    if (st.words.has(k)) { const v = st.words.get(k)!; return Number.isInteger(v) ? String(v) : v.toFixed(3); }
    return connected ? '…' : '—';
  };
  const power = useMemo(() => rungPowerFromValues(ladder, st.bits, st.words), [ladder, st.bits, st.words]);
  const groups = useMemo(() => {
    const bl = programBlocks(ladder);
    return bl.length > 1 ? bl.map((b) => ({ id: b.id, name: b.name, description: b.description, rungIds: b.rungIds })) : undefined;
  }, [ladder]);

  // Ranges the project declares for its registers: HMI entries' min / max and the program's first-scan limits.
  const declared = useMemo(() => {
    const m = new Map<string, { min: number | null; max: number | null }>();
    const put = (a: string, min: number | null, max: number | null) => {
      const k = a.toUpperCase(), cur = m.get(k) ?? { min: null, max: null };
      m.set(k, { min: min === null ? cur.min : cur.min === null ? min : Math.max(cur.min, min), max: max === null ? cur.max : cur.max === null ? max : Math.min(cur.max, max) });
    };
    for (const sc of hmi?.screens ?? []) for (const e of sc.elements) if (e.address && (e.min !== null || e.max !== null)) put(e.address, e.min, e.max);
    for (const f of firstScanRanges(ladder)) put(f.address, f.min, f.max);
    return m;
  }, [hmi, ladder]);
  const write = async (address: string, v: boolean | number) => {
    // A value the register cannot hold, or outside its declared range, is refused before anything is asked or sent.
    const r = clickModbus(address);
    const bad = typeof v === 'number' && r && r.table !== 'coil' ? wordValueError(address.toUpperCase(), v, r.type, declared.get(address.toUpperCase())) : null;
    if (bad) { setMsg({ text: bad, error: true }); return; }
    if (!confirm(`Write ${typeof v === 'boolean' ? (v ? 'ON' : 'OFF') : v} to ${address}${names.get(address) ? ` (${names.get(address)})` : ''} in the running PLC?\n\nThe machine may move. Make sure the area is clear.`)) return;
    try { await writePlc(address, v, modbusBridge(), declared.get(address.toUpperCase())); setMsg({ text: `${address} written.` }); } catch (e) { setMsg({ text: e instanceof Error ? e.message : String(e), error: true }); }
  };
  const allowWrites = (on: boolean) => {
    if (on && !confirm('Allow writes to the PLC?\n\nWrites change values in a running machine (C bits and DS registers only; X inputs and Y outputs are never written). Only do this when you are at the machine and it is safe.')) return;
    st.setAllowWrites(on);
  };

  const runTest = async () => {
    setChecking('test'); setChecks(null);
    try { setChecks({ title: 'Test connection', lines: await testConnection(modbusBridge(), st.settings, st.status === 'connected', cpu.id) }); } finally { setChecking(null); }
  };
  const runProgramCheck = async () => {
    const bridge = modbusBridge();
    if (!bridge || st.status !== 'connected') return;
    setChecking('program'); setChecks(null);
    try {
      const r = await programCheck(bridge, all, ladder, st.settings.swapWords);
      setChecks({ title: 'Program check', lines: r.lines });
    } catch (e) { setChecks({ title: 'Program check', lines: [{ ok: false, text: e instanceof Error ? e.message : String(e) }] }); } finally { setChecking(null); }
  };

  const shown = all.filter((a) => !filter.trim() || `${a} ${names.get(a) ?? ''}`.toLowerCase().includes(filter.toLowerCase()));
  const rows = checkoutRows(collectProject(), checkout);
  const sum = checkoutSummary(rows);
  const model = hmi ? getHmi(hmi.hmiPartNumber) : undefined;
  const screen = hmi?.screens.find((s) => s.id === screenId) ?? hmi?.screens[0];
  const tabBtn = (t: Tab, label: string) => (
    <button key={t} onClick={() => setTab(t)} className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 ${tab === t ? 'border-brand-600 text-steel-900' : 'border-transparent text-steel-500 hover:text-steel-700'}`}>{label}</button>
  );

  return (
    <>
      <header className="px-4 sm:px-6 pt-4 bg-white border-b border-steel-200">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <h2 className="min-w-0 flex-[1_1_16rem] text-base font-semibold text-steel-800">Online — connect to the PLC</h2>
          <LoadIntoPlc />
        </div>
        <p className="text-xs text-steel-500 mt-0.5">Live values from the real {profile.name} {cpu.id} over Ethernet (Modbus TCP). Read-only unless you switch on writes. Use it at the machine during commissioning: watch the ladder, the HMI and every I/O point, and tick the I/O check-out.</p>
        <div className="flex mt-2 overflow-x-auto">{tabBtn('monitor', 'Monitor')}{tabBtn('ladder', 'Live ladder')}{tabBtn('hmi', 'Live HMI')}{tabBtn('checkout', `I/O check-out (${sum.verified}/${sum.total})`)}{tabBtn('troubleshoot', 'Fault finding')}</div>
      </header>

      {/* Connection bar */}
      <div className="px-4 sm:px-6 py-2 bg-white border-b border-steel-200 flex flex-wrap items-end gap-3 text-sm">
        <label className="text-xs text-steel-600">PLC IP address<br />
          <input aria-label="PLC IP address" value={st.settings.host} onChange={(e) => st.setSettings({ host: e.target.value })} disabled={connected} className={`${input} w-36 font-mono`} /></label>
        <label className="text-xs text-steel-600">Port<br />
          <input aria-label="Modbus port" type="number" value={st.settings.port} onChange={(e) => st.setSettings({ port: Number(e.target.value) || 502 })} disabled={connected} className={`${input} w-20`} /></label>
        <label className="text-xs text-steel-600">Unit id<br />
          <input aria-label="Unit id" type="number" min={0} max={255} value={st.settings.unitId} onChange={(e) => st.setSettings({ unitId: Math.max(0, Math.min(255, Number(e.target.value) || 0)) })} disabled={connected} className={`${input} w-16`} /></label>
        {connected || st.status === 'connecting'
          ? <button className={btn} onClick={() => void disconnectPlc()}>Disconnect</button>
          : <button className="px-4 py-1.5 text-sm rounded bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-40" disabled={!desktop || !isClick} onClick={() => void connectPlc(all)}>Connect</button>}
        <button className={btn} disabled={!desktop || !isClick || Boolean(checking) || st.status === 'connecting'} onClick={() => void runTest()}
          title="Does the PLC answer on Modbus TCP, is it in RUN, any PLC error?">{checking === 'test' ? 'Testing…' : 'Test connection'}</button>
        <button className={btn} disabled={!connected || Boolean(checking)} onClick={() => void runProgramCheck()}
          title="Read every address of the project and the first-scan setpoints: is the program you typed in running?">{checking === 'program' ? 'Checking…' : 'Program check'}</button>
        <span className="flex items-center gap-2 text-xs" role="status">
          <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-600' : st.status === 'connecting' ? 'bg-amber-500' : st.status === 'error' ? 'bg-red-600' : 'bg-steel-300'}`} />
          {st.status === 'connecting' ? <><Spinner /> Connecting…</> : connected ? `Connected · ${st.polls} reads · ${st.lastUpdate ? new Date(st.lastUpdate).toLocaleTimeString() : ''}` : st.status === 'error' ? 'Not connected' : 'Offline'}
        </span>
        <label className="ml-auto flex items-center gap-2 text-xs text-steel-600" title="32-bit values (DD, DF, CTD): CLICK's word order is not documented; switch if values look wrong">
          <input type="checkbox" checked={st.settings.swapWords} onChange={(e) => st.setSettings({ swapWords: e.target.checked })} /> 32-bit high word first
        </label>
        <label className={`flex items-center gap-2 text-xs font-semibold ${st.allowWrites ? 'text-red-700' : 'text-steel-600'}`}>
          <input type="checkbox" aria-label="Allow writes" checked={st.allowWrites} disabled={!connected} onChange={(e) => allowWrites(e.target.checked)} /> Allow writes
        </label>
      </div>
      {st.allowWrites && connected && (
        <div role="alert" className="px-6 py-2 bg-red-600 text-white text-sm font-semibold">WRITES ENABLED — values you set go to the running machine. Only C bits and DS registers can be written; X inputs and Y outputs never.</div>
      )}
      {!desktop && (
        <div className="mx-6 mt-3 bg-brand-50 border border-brand-200 rounded p-3 text-sm text-steel-800">
          Connecting to a real PLC needs the <b>ISA Auto Programmer desktop app</b> for Windows (a web browser cannot open a connection to the PLC). Here you can still see the Modbus address of every point and fill in the I/O check-out by hand.
        </div>
      )}
      {!isClick && <div className="mx-6 mt-3 bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">Online monitoring is available for AutomationDirect CLICK PLCs.</div>}
      {st.error && <div role="alert" className="mx-6 mt-3 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{st.error}</div>}
      {checks && (
        <div className="mx-6 mt-3 rounded border border-steel-200 bg-white p-3 text-sm" data-testid="online-checks">
          <div className="mb-1 flex items-center"><b className="flex-1 text-steel-800">{checks.title}</b><button className="text-xs text-steel-500 hover:underline" onClick={() => setChecks(null)}>Close</button></div>
          <ul className="space-y-0.5">{checks.lines.map((l, k) => (
            <li key={k} className={l.ok === true ? 'text-green-800' : l.ok === false ? 'text-red-800' : 'text-steel-600'}>{l.ok === true ? '✓' : l.ok === false ? '✗' : '•'} {l.text}</li>
          ))}</ul>
        </div>
      )}
      {msg && <div role={msg.error ? 'alert' : 'status'} className={`mx-6 mt-3 rounded p-2 text-sm ${msg.error ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-green-50 border border-green-200 text-green-900'}`}>{msg.text}</div>}

      <div className="flex-1 overflow-auto bg-steel-50 p-4">
        {tab === 'monitor' && (
          <div className="bg-white border border-steel-200 rounded-sm">
            <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-steel-200">
              <input aria-label="Filter addresses" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter: address or name" className={`${input} w-56`} />
              <span className="text-xs text-steel-500">{all.length} addresses{unsupported.length ? ` · not readable over Modbus: ${unsupported.join(', ')}` : ''}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-steel-100 text-xs text-steel-500 uppercase"><tr>{['Address', 'Modbus', 'Name', 'Value', st.allowWrites ? 'Write' : ''].map((h, i) => <th key={i} className="text-left px-3 py-1.5">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-steel-100">
                {shown.map((a) => {
                  const r = clickModbus(a);
                  const v = value(a);
                  const wr = st.allowWrites && connected && isWritable(a);
                  return (
                    <tr key={a} data-address={a}>
                      <td className="px-3 py-1 font-mono font-semibold">{a}</td>
                      <td className="px-3 py-1 font-mono text-xs text-steel-500">{r ? modbus984(r) : '—'}</td>
                      <td className="px-3 py-1 text-steel-700">{names.get(a) ?? ''}</td>
                      <td className={`px-3 py-1 font-mono tabular-nums ${v === 'ON' ? 'text-green-700 font-semibold' : v === 'read error' ? 'text-red-700' : ''}`} aria-label={`Value of ${a}`}>{v}</td>
                      <td className="px-3 py-1">
                        {wr && r?.table === 'coil' && <span className="flex gap-1"><button className={btn} onClick={() => void write(a, true)}>Set ON</button><button className={btn} onClick={() => void write(a, false)}>Set OFF</button></span>}
                        {wr && r?.table === 'holding' && (
                          <span className="flex gap-1">
                            <input aria-label={`New value for ${a}`} type="number" value={dsDraft[a] ?? ''} onChange={(e) => setDsDraft({ ...dsDraft, [a]: e.target.value })} className={`${input} w-24 py-0.5`} />
                            <button className={btn} disabled={dsDraft[a] === undefined || dsDraft[a] === ''} onClick={() => void write(a, Number(dsDraft[a]))}>Write</button>
                          </span>
                        )}
                        {st.allowWrites && connected && !isWritable(a) && <span className="text-xs text-steel-400">read only</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {st.writes.length > 0 && (
              <div className="px-3 py-2 border-t border-steel-200 text-xs text-steel-600">
                <b>Writes this session:</b> {st.writes.slice(0, 8).map((w) => `${w.at} ${w.address}=${w.value}${w.ok ? '' : ` (failed: ${w.error})`}`).join(' · ')}
              </div>
            )}
          </div>
        )}

        {tab === 'ladder' && (
          <div className="space-y-2">
            <p className="text-xs text-steel-500">Power flow from the values read from the PLC{connected ? '' : ' (not connected: everything shows OFF)'}. Edge contacts (one-shots) show the bit's present state; timers and counters show their done bits.</p>
            <LiveLadder program={ladder} power={power} bits={st.bits} words={st.words} timers={NO_TIMERS} counters={NO_TIMERS}
              labelOf={(a) => names.get(a.toUpperCase()) ?? ''} groups={groups} />
          </div>
        )}

        {tab === 'hmi' && (
          hmi && model && screen ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">{hmi.screens.map((s) => (
                <button key={s.id} onClick={() => setScreenId(s.id)} className={`rounded px-2.5 py-1 text-xs border ${s.id === screen.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-steel-300 bg-white'}`}>{s.name}</button>
              ))}</div>
              <div className="max-w-4xl">
                <HmiScreenView screen={screen} widthPx={model.widthPx} heightPx={model.heightPx} design={hmi}
                  read={(a) => { const k = a.toUpperCase(); return st.bits.has(k) ? st.bits.get(k)! : st.words.get(k) ?? 0; }}
                  onNavigate={(id) => setScreenId(id)} />
              </div>
              <p className="text-xs text-steel-500">Shows the HMI screens with the PLC's live values (view only — buttons here do not write to the PLC).</p>
            </div>
          ) : <p className="text-sm text-steel-500">No HMI design yet.</p>
        )}

        {tab === 'troubleshoot' && <TroubleshootPanel />}

        {tab === 'checkout' && (
          <div className="bg-white border border-steel-200 rounded-sm">
            <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-steel-200 text-sm">
              <span className="font-semibold text-steel-800">{sum.verified} of {sum.total} points verified</span>
              <label className="text-xs text-steel-600 flex items-center gap-1">Technician <input aria-label="Technician" value={tech} onChange={(e) => setTech(e.target.value)} className={`${input} w-40`} /></label>
              <button className={`${btn} ml-auto`} onClick={() => { const snap = collectProject(); void buildCheckoutPdf(snap, checkout).then((b) => saveBlob(`${snap.fileBase}_IO_checkout.pdf`, b)); }}>Check-out sheet (PDF)</button>
            </div>
            <p className="px-3 py-1.5 text-xs text-steel-500 border-b border-steel-100">Inputs: operate the field device and watch the PLC value change. Outputs: run the output from the program (or the HMI) and confirm the device responds. Tick each point; the PLC value at that moment is recorded. The result goes into the SAT checklist and the deliverables.</p>
            <table className="w-full text-sm">
              <thead className="bg-steel-100 text-xs text-steel-500 uppercase"><tr>{['OK', 'Address', 'Description', 'PLC value', 'By / date', 'Note'].map((h) => <th key={h} className="text-left px-3 py-1.5">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-steel-100">
                {rows.map((r) => (
                  <tr key={r.id} className={r.entry?.verified ? 'bg-green-50/50' : ''}>
                    <td className="px-3 py-1"><input type="checkbox" aria-label={`Verified ${r.address}`} checked={Boolean(r.entry?.verified)}
                      onChange={(e) => setCheck(projectId, r.id, { verified: e.target.checked, observed: r.address ? value(r.address) : undefined })} /></td>
                    <td className="px-3 py-1 font-mono font-semibold">{r.address || '—'}</td>
                    <td className="px-3 py-1">{r.description}<span className="ml-2 text-xs text-steel-400">{r.type === 'input' ? 'input' : 'output'}</span></td>
                    <td className="px-3 py-1 font-mono">{r.address ? value(r.address) : '—'}</td>
                    <td className="px-3 py-1 text-xs text-steel-500">{r.entry?.verified ? `${r.entry.by || '—'} · ${r.entry.date}` : ''}</td>
                    <td className="px-3 py-1"><input aria-label={`Note for ${r.address}`} value={r.entry?.note ?? ''} onChange={(e) => setCheck(projectId, r.id, { note: e.target.value })} className={`${input} w-full py-0.5`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
