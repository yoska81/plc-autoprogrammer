import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from '../components/common';
import { bomCost } from '../electrical/pricing';
import { useEditsStore } from '../edits/useEditsStore';
import { useDrawingContext } from '../electrical/useDrawingContext';
import { billOfMaterials, type BomLine } from '../electrical/derive';
import { useElectricalStore } from '../store/useElectricalStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useDraft } from '../store/useDraftStore';
import { useUi } from '../store/useUiStore';
import { startAiJob, useAiJobError, useAiJobRunning, useTakeResult } from '../lib/ai/jobs';
import { IS_PREVIEW } from '../preview/mode';
import { equivalentsOf, sourcingFlags, sourcingOf, LEAD_LABEL, LIFECYCLE_LABEL, type Sourcing } from '../sourcing/data';
import { impactOf, swapInDesign, type ImpactLine } from '../sourcing/swap';
import { liveCheck, type LiveCheck, type LiveResult } from '../sourcing/liveCheck';
import { optimise, DEFAULT_GOALS, type Goals } from '../sourcing/optimise';
import type { WebSource } from '../lib/ai/anthropic';
import type { ElectricalDesign } from '../electrical/types';

const money = (n: number, currency: 'USD' | 'EUR' = 'USD') => `${currency === 'EUR' ? '€' : '$'}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PREVIEW_LIVE_OFF = 'Live stock check runs in the Windows app (it searches distributor sites); in this browser preview it is off.';
const flagCls = { red: 'bg-red-50 text-red-700 border-red-200', orange: 'bg-orange-50 text-orange-800 border-orange-200' };
const th = 'text-left py-1.5 pr-3 font-medium';

/** Last swap: what was replaced, what changed, and the design before it (Undo). */
interface SwapRecord { from: string; to: string; impact: ImpactLine[]; before: ElectricalDesign }

function PriceCell({ s, qty }: { s: Sourcing; qty: number }) {
  if (!s.price) return <span className="text-steel-400">to confirm</span>;
  return <span title={`${s.price.unit}, read ${s.price.date}`}>{money(s.price.price, s.price.currency)}{qty > 1 && s.price.unit === 'each' ? <span className="text-steel-400"> ×{qty} = {money(s.price.price * qty, s.price.currency)}</span> : <span className="text-steel-400"> / {s.price.unit}</span>}</span>;
}

function LiveCell({ r }: { r?: LiveResult }) {
  if (!r) return <span className="text-steel-400">—</span>;
  if (!r.url) return <span className="text-steel-500" title={r.note}>not found · {r.checkedOn}</span>;
  return (
    <span className="text-[12px]">
      {[r.stock, r.leadTime, r.price].filter(Boolean).join(' · ') || 'no figures on the page'}
      <a href={r.url} target="_blank" rel="noreferrer" className="block text-brand-700 hover:underline truncate max-w-56">{r.distributor ?? new URL(r.url).host} · {r.checkedOn}</a>
    </span>
  );
}

export default function SourcingPage() {
  const ctx = useDrawingContext();
  const design = useElectricalStore((s) => s.design);
  const settings = useSettingsStore();
  const apiKey = settings.provider === 'anthropic' ? settings.anthropicApiKey : '';
  // The preview's AI path (the viewer's Claude account) has no web search: Live check is off there, not a key problem.
  const liveReady = !IS_PREVIEW && !!apiKey;
  const liveOff = IS_PREVIEW ? PREVIEW_LIVE_OFF : !apiKey ? 'Needs an Anthropic API key (Settings)' : null;
  const [tab, setTab] = useUi<'bom' | 'optimise'>('sourcing.tab', 'bom');
  const [open, setOpen] = useState<string | null>(null);
  const [live, setLive] = useDraft<Record<string, LiveResult>>('sourcing.live', {});
  const [liveSources, setLiveSources] = useDraft<WebSource[]>('sourcing.sources', []);
  const [last, setLast] = useDraft<SwapRecord | null>('sourcing.lastSwap', null);
  const [goals, setGoals] = useUi<Goals>('sourcing.goals', DEFAULT_GOALS);
  const busy = useAiJobRunning('sourcing');
  const error = useAiJobError('sourcing');

  useTakeResult<LiveCheck>('sourcing', (r) => {
    setLive({ ...live, ...Object.fromEntries(r.results.map((x) => [x.partNumber, x])) });
    setLiveSources([...new Map([...liveSources, ...r.sources].map((s) => [s.url, s])).values()]);
  });

  const groups = useMemo(() => (ctx ? billOfMaterials(ctx).map((g) => ({ ...g, lines: g.lines.filter((l) => l.partNumber && !l.note) })).filter((g) => g.lines.length) : []), [ctx]);
  const lines = useMemo(() => groups.flatMap((g) => g.lines), [groups]);
  const flagged = lines.filter((l) => sourcingFlags(sourcingOf(l.partNumber)).length);
  // The same total as the order list and Improve design (src/electrical/pricing.ts): packs, your typed prices.
  const editsBom = useEditsStore((s) => s.bom);
  const cost = useMemo(() => (ctx ? bomCost(ctx, editsBom) : { total: 0, unpriced: 0 }), [ctx, editsBom]);
  const proposals = useMemo(() => optimise(lines.map((l) => ({ partNumber: l.partNumber, qty: l.qty })), goals), [lines, goals]);

  const check = (subset: BomLine[]) => {
    if (!liveReady || !subset.length) return;
    const parts = subset.slice(0, 12).map((l) => ({ partNumber: l.partNumber, manufacturer: l.manufacturer, description: l.description }));
    void startAiJob({
      kind: 'sourcing', label: `Live check of ${parts.length} part${parts.length > 1 ? 's' : ''}`, keepResult: true,
      run: (h) => liveCheck({ apiKey, model: settings.anthropicModel, effort: 'low', signal: h.signal, parts }),
    });
  };

  /** Replace a part everywhere in the design; the drawings, SCCR, layout and BOM follow. */
  const swap = (from: string, to: string) => {
    if (!ctx || !design) return;
    const next = swapInDesign(design, from, to);
    const impact = impactOf(ctx, { ...ctx, design: swapInDesign(ctx.design, from, to) });
    useElectricalStore.getState().setDesign(next, 'generated', useElectricalStore.getState().explanation);
    setLast({ from, to, impact, before: design });
    setOpen(null);
  };
  const undo = () => { if (last) { useElectricalStore.getState().setDesign(last.before, 'generated', useElectricalStore.getState().explanation); setLast(null); } };

  if (!ctx || !design) return (
    <div className="p-6 text-sm text-steel-600">No electrical design yet. Design the panel on the <Link to="/electrical?tab=design" className="underline">Electrical design</Link> page first; its parts are sourced here.</div>
  );

  const tabBtn = (id: 'bom' | 'optimise', label: string) => (
    <button onClick={() => setTab(id)} className={`px-3 py-1.5 text-sm border-b-2 ${tab === id ? 'border-brand-600 text-brand-800 font-semibold' : 'border-transparent text-steel-600 hover:text-steel-900'}`}>{label}</button>
  );

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-steel-200 bg-white px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-steel-800">Sourcing</h2>
          <p className="mt-0.5 text-xs text-steel-500">Price, availability and lifecycle of every part in the panel, with cross-brand alternatives. Prices and dates come from the supplier pages they were read on; what is not known says so.</p>
        </div>
        {tab === 'bom' && (
          <button onClick={() => check(flagged.length ? flagged : lines)} disabled={!liveReady || busy} title={liveOff ?? undefined}
            className="inline-flex items-center gap-1.5 rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {busy ? <><Spinner /> Checking…</> : `Live check ${flagged.length ? `${flagged.length} flagged` : `${Math.min(12, lines.length)} parts`}`}
          </button>
        )}
      </header>
      <nav className="flex gap-1 border-b border-steel-200 bg-white px-4">{tabBtn('bom', 'Parts')}{tabBtn('optimise', `Optimise${proposals.length ? ` (${proposals.length})` : ''}`)}</nav>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {IS_PREVIEW
          ? <div data-testid="live-off" className="rounded border border-steel-200 bg-steel-50 p-3 text-sm text-steel-700">{PREVIEW_LIVE_OFF} Everything else on this page works here.</div>
          : !apiKey && <div data-testid="live-off" className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">Live check searches the distributors' sites with the AI and needs an Anthropic API key in <Link to="/settings" className="underline">Settings</Link>. Everything else on this page works without it.</div>}
        {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"><b>Live check failed:</b> {error}</div>}
        {last && (
          <section className="rounded border border-brand-200 bg-brand-50 p-3 text-sm" data-testid="swap-impact">
            <div className="flex items-center gap-3">
              <b className="flex-1">Swapped {last.from} → {last.to}. The design, drawings, wiring, layout and SCCR are updated.</b>
              <button onClick={undo} className="text-xs underline">Undo</button>
              <button onClick={() => setLast(null)} className="text-xs underline">Close</button>
            </div>
            {last.impact.length ? (
              <div className="overflow-x-auto">
              <table className="mt-2 w-full text-[13px]">
                <thead className="text-[11px] uppercase text-steel-500"><tr><th className={th}>What changed</th><th className={th}>Before</th><th className={th}>After</th></tr></thead>
                <tbody>{last.impact.map((i, k) => (
                  <tr key={k} className={i.level === 'bad' ? 'text-red-700' : i.level === 'good' ? 'text-emerald-700' : ''}><td className="pr-3 py-0.5">{i.what}</td><td className="pr-3">{i.before}</td><td>{i.after}</td></tr>
                ))}</tbody>
              </table>
              </div>
            ) : <p className="mt-1 text-steel-600">Nothing else changes (same SCCR, fit, heat and wiring).</p>}
          </section>
        )}

        {tab === 'bom' && (
          <>
            <div className="flex flex-wrap gap-4 text-sm text-steel-700">
              <span><b>{lines.length}</b> parts</span>
              <span data-testid="sourcing-total">List price <b>{money(cost.total)}</b>{cost.unpriced ? <span className="text-steel-500"> + {cost.unpriced} to confirm</span> : ''}</span>
              <span className={flagged.length ? 'text-red-700 font-medium' : ''}>{flagged.length} flagged</span>
            </div>
            {groups.map((g) => (
              <section key={g.title} className="rounded border border-steel-200 bg-white">
                <h3 className="border-b border-steel-200 bg-steel-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-steel-600">{g.title}</h3>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase text-steel-500"><tr className="border-b border-steel-100">
                    {['Qty', 'Part', 'Price', 'Availability', 'Lifecycle', 'Checked on', 'Live check', ''].map((h) => <th key={h} className={`${th} px-3`}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-steel-100">
                    {g.lines.map((l) => {
                      const s = sourcingOf(l.partNumber);
                      const flags = sourcingFlags(s);
                      const alts = equivalentsOf(l.partNumber);
                      const isOpen = open === l.partNumber;
                      return (
                        <Fragment key={l.partNumber}>
                          <tr className="align-top" data-part={l.partNumber}>
                            <td className="px-3 py-1.5 tabular-nums">{l.qty}</td>
                            <td className="px-3 py-1.5"><span className="font-mono">{l.partNumber}</span> <span className="text-steel-500">{l.manufacturer}</span>
                              <div className="text-xs text-steel-500 line-clamp-1">{l.tags.join(', ')} · {l.description}</div>
                              {flags.map((f) => <span key={f.text} className={`mr-1 mt-0.5 inline-block rounded border px-1.5 text-[11px] font-semibold ${flagCls[f.level]}`}>{f.text}</span>)}
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap"><PriceCell s={s} qty={l.qty} /></td>
                            <td className="px-3 py-1.5">{LEAD_LABEL[s.lead]}{s.leadText ? <div className="text-xs text-steel-500">{s.leadText}</div> : null}</td>
                            <td className="px-3 py-1.5">{LIFECYCLE_LABEL[s.lifecycle]}</td>
                            <td className="px-3 py-1.5 text-xs text-steel-500 whitespace-nowrap">{s.checkedOn ?? s.price?.date ?? '—'}</td>
                            <td className="px-3 py-1.5"><LiveCell r={live[l.partNumber]} />
                              {!live[l.partNumber] && liveReady && <button onClick={() => check([l])} disabled={busy} className="block text-xs text-brand-700 hover:underline disabled:opacity-40">Check now</button>}
                            </td>
                            <td className="px-3 py-1.5 text-right">{alts.length > 0 && <button onClick={() => setOpen(isOpen ? null : l.partNumber)} className="text-xs text-brand-700 hover:underline whitespace-nowrap" aria-expanded={isOpen}>Alternatives ({alts.length})</button>}</td>
                          </tr>
                          {isOpen && (
                            <tr><td colSpan={8} className="bg-steel-50 px-3 py-2">
                              <table className="w-full text-[13px]" data-testid={`alternatives-${l.partNumber}`}>
                                <thead className="text-[11px] uppercase text-steel-500"><tr>{['Part', 'Price', 'Availability', 'Differences', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                                <tbody>{alts.map((a) => (
                                  <tr key={a.part.partNumber} className="align-top">
                                    <td className="pr-3 py-1"><span className="font-mono">{a.part.partNumber}</span> <span className="text-steel-500">{a.part.manufacturer}</span></td>
                                    <td className="pr-3 whitespace-nowrap"><PriceCell s={a.sourcing} qty={l.qty} /></td>
                                    <td className="pr-3">{LEAD_LABEL[a.sourcing.lead]}</td>
                                    <td className="pr-3 text-xs text-steel-600">{a.differences.join('; ') || 'same ratings'}</td>
                                    <td className="text-right"><button onClick={() => swap(l.partNumber, a.part.partNumber)} className="rounded bg-brand-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-brand-700">Swap</button></td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </td></tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </section>
            ))}
            {liveSources.length > 0 && (
              <section className="rounded border border-steel-200 bg-white p-3 text-xs text-steel-600">
                <b className="text-steel-700">Pages the live check read</b>
                <ul className="mt-1 list-disc pl-4">{liveSources.slice(0, 30).map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{s.title || s.url}</a>{s.pageAge ? ` · ${s.pageAge}` : ''}</li>)}</ul>
              </section>
            )}
          </>
        )}

        {tab === 'optimise' && (
          <>
            <section className="rounded border border-steel-200 bg-white p-3 text-sm">
              <h3 className="font-semibold text-steel-800">What matters most</h3>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
                {([['lead', 'Short lead time'], ['price', 'Low price'], ['quality', 'Quality (verified, current parts)'], ['oneBrand', 'One brand']] as const).map(([k, label]) => (
                  <label key={k} className="text-xs text-steel-600">{label}
                    <input type="range" min={0} max={3} step={1} value={goals[k]} onChange={(e) => setGoals({ ...goals, [k]: Number(e.target.value) })} className="block w-full" aria-label={label} />
                    <span className="text-[11px] text-steel-400">{['off', 'low', 'medium', 'high'][goals[k]]}</span>
                  </label>
                ))}
              </div>
            </section>
            {proposals.length === 0 ? <p className="text-sm text-steel-600">No change scores better for these goals: the current parts are the best choice the catalog knows (alternatives without a known price or lead time are not proposed on those grounds).</p> : (
              <div className="overflow-x-auto">
              <table className="w-full rounded border border-steel-200 bg-white text-sm" data-testid="optimise-proposals">
                <thead className="text-[11px] uppercase text-steel-500"><tr className="border-b border-steel-200">{['Part', 'Replacement', 'Saving', 'Lead time', 'Risks', ''].map((h) => <th key={h} className={`${th} px-3`}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-steel-100">{proposals.map((p) => (
                  <tr key={p.from} className="align-top">
                    <td className="px-3 py-1.5 font-mono">{p.qty}× {p.from}</td>
                    <td className="px-3 py-1.5"><span className="font-mono">{p.to}</span> <span className="text-steel-500">{p.manufacturer}</span></td>
                    <td className="px-3 py-1.5">{p.saving === null ? <span className="text-steel-400">not known</span> : p.saving >= 0 ? <span className="text-emerald-700">{money(p.saving, p.currency)}</span> : <span className="text-red-700">costs {money(-p.saving, p.currency)} more</span>}</td>
                    <td className="px-3 py-1.5">{p.leadGain ?? '—'}</td>
                    <td className="px-3 py-1.5 text-xs text-steel-600">{p.risks.join('; ') || 'none known'}</td>
                    <td className="px-3 py-1.5 text-right"><button onClick={() => swap(p.from, p.to)} className="rounded bg-brand-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-brand-700">Accept</button></td>
                  </tr>
                ))}</tbody>
              </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
