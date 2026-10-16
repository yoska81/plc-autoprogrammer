import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSpecStore } from '../store/useSpecStore';
import { useProjectStore } from '../store/useProjectStore';
import { useHmiStore } from '../store/useHmiStore';
import { PLC_PROFILES } from '../plc/profiles';
import { getPart } from '../electrical/catalog';
import { getHmi } from '../hmi/hmiCatalog';
import { moduleSlots, ioCapacity } from '../plc/modules';
import { recommendEquipment, modulesInSlotOrder, type EquipmentRecommendation } from '../lib/ai/equipmentAI';
import { applyEquipment } from '../spec/equipment';
import { Spinner, ReasoningPanel } from './program/common';

function cpuById(id: string) {
  for (const p of PLC_PROFILES) {
    const c = p.cpuModels.find((x) => x.id === id);
    if (c) return { profile: p, cpu: c };
  }
  return null;
}

/** Simple product glyphs so cards read at a glance (no vendor imagery). */
function Glyph({ kind }: { kind: 'plc' | 'module' | 'hmi' }) {
  return (
    <svg viewBox="0 0 48 48" className="w-12 h-12 flex-shrink-0" aria-hidden="true">
      {kind === 'hmi' ? (
        <>
          <rect x="3" y="8" width="42" height="30" rx="3" fill="#2f373c" />
          <rect x="7" y="12" width="34" height="22" rx="1" fill="#9db8ee" />
          <rect x="10" y="15" width="12" height="6" fill="#e9edef" />
          <rect x="26" y="15" width="12" height="6" fill="#e9edef" />
          <rect x="10" y="25" width="28" height="5" fill="#d4dbdf" />
        </>
      ) : (
        <>
          <rect x={kind === 'plc' ? 6 : 14} y="6" width={kind === 'plc' ? 36 : 20} height="36" rx="2" fill="#e9edef" stroke="#8a9aa2" />
          <rect x={kind === 'plc' ? 6 : 14} y="6" width={kind === 'plc' ? 36 : 20} height="7" fill="#55646c" />
          <rect x={kind === 'plc' ? 6 : 14} y="35" width={kind === 'plc' ? 36 : 20} height="7" fill="#55646c" />
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={(kind === 'plc' ? 12 : 18) + i * (kind === 'plc' ? 7 : 4)} cy="20" r="1.6" fill={i % 2 ? '#2f9e44' : '#f59f00'} />)}
          {kind === 'plc' && <rect x="30" y="24" width="8" height="6" fill="#2f373c" />}
        </>
      )}
    </svg>
  );
}

function ProductCard({ kind, title, subtitle, specs, why, badge }: { kind: 'plc' | 'module' | 'hmi'; title: string; subtitle: string; specs: string[]; why?: string; badge?: ReactNode }) {
  return (
    <div className="bg-white border border-steel-200 rounded-md p-4 flex gap-4">
      <Glyph kind={kind} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-semibold text-steel-900">{title}</span>
          {badge}
        </div>
        <div className="text-sm text-steel-600">{subtitle}</div>
        {specs.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {specs.map((s) => <li key={s} className="text-xs bg-steel-100 text-steel-700 rounded px-1.5 py-0.5">{s}</li>)}
          </ul>
        )}
        {why && <p className="mt-2 text-sm text-steel-700"><span className="font-medium text-brand-700">Why: </span>{why}</p>}
      </div>
    </div>
  );
}

function CapacityBar({ label, need, have }: { label: string; need: number; have: number }) {
  const spare = have - need;
  const pct = have ? Math.min(100, (need / have) * 100) : 100;
  const ok = spare >= 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-steel-600 mb-1">
        <span>{label}</span>
        <span className={ok ? 'text-steel-700' : 'text-red-700 font-medium'}>{need} needed · {have} available{ok ? ` · ${spare} spare` : ` · ${-spare} short`}</span>
      </div>
      <div className="h-2 rounded bg-steel-100 overflow-hidden">
        <div className={`h-full ${ok ? 'bg-brand-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Recommend, review and accept the control equipment for the project. */
export default function EquipmentPanel({ onApplied }: { onApplied?: () => void }) {
  const settings = useSettingsStore();
  const spec = useSpecStore((s) => s.sections);
  const project = useProjectStore();
  const hmiPart = useHmiStore((s) => s.hmiPartNumber);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [draft, setDraft] = useState<EquipmentRecommendation | null>(null);

  const rec = draft ?? project.recommendation;
  const specEmpty = !Object.values(spec).some((t) => t.trim());
  const apiKey = settings.anthropicApiKey;
  const isApplied = !draft && Boolean(project.recommendation);

  const recommend = async () => {
    if (!apiKey || specEmpty) return;
    setBusy(true);
    setError(null);
    try {
      const r = await recommendEquipment({ apiKey, model: settings.anthropicModel, effort: settings.effort, spec });
      setDraft(r.rec);
      setReasoning(r.reasoning);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const accept = (cpuId?: string, hmi?: string | null) => {
    if (!rec) return;
    applyEquipment(rec, cpuId, hmi === undefined ? undefined : hmi);
    setDraft(null);
    onApplied?.();
  };

  // What is shown: the draft recommendation, or what's currently applied to the project.
  const shownCpuId = isApplied ? project.cpuId : rec?.plc.cpuId ?? '';
  const shownModules = isApplied ? project.modules : rec ? modulesInSlotOrder(rec) : [];
  const shownHmi = isApplied ? hmiPart : rec?.hmi?.partNumber ?? '';
  const found = cpuById(shownCpuId);
  const cap = found ? ioCapacity(found.cpu, moduleSlots(shownModules)) : null;
  const hmi = shownHmi ? getHmi(shownHmi) : undefined;
  const moduleCounts = [...shownModules.reduce((m, pn) => m.set(pn, (m.get(pn) ?? 0) + 1), new Map<string, number>())];

  return (
    <div className="space-y-5">
      <div className="bg-white border border-steel-200 rounded-md p-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-64">
          <h3 className="font-semibold text-steel-900">Let the AI choose the control equipment</h3>
          <p className="text-sm text-steel-600">It reads your description, counts the inputs and outputs, adds spare capacity, and picks the PLC, I/O modules and operator panel. You can switch to an alternative before accepting.</p>
        </div>
        <button onClick={recommend} disabled={busy || !apiKey || specEmpty}
          className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
          {busy ? <><Spinner /> Selecting equipment…</> : rec ? 'Recommend again' : 'Recommend equipment'}
        </button>
        {specEmpty && <p className="w-full text-sm text-amber-800">Describe the machine first on the <Link to="/spec" className="underline">Describe</Link> step.</p>}
        {!apiKey && !specEmpty && <p className="w-full text-sm text-amber-800">Add your Anthropic API key in <Link to="/settings" className="underline">Settings</Link>.</p>}
      </div>
      {error && <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>}
      {reasoning && <ReasoningPanel reasoning={reasoning} />}

      {rec && found && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-steel-500">{isApplied ? 'Your configuration' : 'Recommended configuration'}</h3>
              {isApplied && <span className="text-xs bg-brand-100 text-brand-800 rounded px-2 py-0.5">Applied to the project</span>}
            </div>
            <p className="text-sm text-steel-700">{rec.summary}</p>
            <ProductCard kind="plc" title={found.cpu.id} subtitle={`${found.profile.vendor} ${found.profile.name} CPU`}
              specs={[`${found.cpu.builtInInputs} DC inputs`, `${found.cpu.builtInOutputs} outputs`, ...(found.cpu.label.includes('Ethernet') ? ['Ethernet'] : []), ...(found.cpu.label.includes('analog') ? ['Built-in analog'] : [])]}
              why={shownCpuId === rec.plc.cpuId ? rec.plc.why : undefined} />
            {moduleCounts.map(([pn, qty]) => {
              const part = getPart(pn);
              const why = rec.modules.find((m) => m.partNumber === pn)?.why;
              return <ProductCard key={pn} kind="module" title={pn} subtitle={part?.description ?? 'I/O module'} specs={[`Qty ${qty}`]} why={why} />;
            })}
            {hmi ? (
              <ProductCard kind="hmi" title={hmi.partNumber} subtitle={`${hmi.family} touch panel`}
                specs={[`${hmi.sizeIn}"`, `${hmi.widthPx}×${hmi.heightPx}`, ...(hmi.ethernet ? ['Ethernet'] : [])]}
                why={shownHmi === rec.hmi?.partNumber ? rec.hmi?.why : undefined} />
            ) : (
              <p className="text-sm text-steel-500">No operator panel (pushbuttons and lights only).</p>
            )}
          </div>

          <aside className="space-y-4">
            <div className="bg-white border border-steel-200 rounded-md p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-500">Capacity</h4>
              {cap && <CapacityBar label="Digital inputs" need={rec.estimatedIO.digitalInputs} have={cap.inputs} />}
              {cap && <CapacityBar label="Digital outputs" need={rec.estimatedIO.digitalOutputs} have={cap.outputs} />}
              {(rec.estimatedIO.analogInputs > 0 || rec.estimatedIO.analogOutputs > 0) && (
                <p className="text-xs text-steel-600">Analog: {rec.estimatedIO.analogInputs} in, {rec.estimatedIO.analogOutputs} out</p>
              )}
              {rec.estimatedIO.motionAxes > 0 && <p className="text-xs text-amber-800">{rec.estimatedIO.motionAxes} motion axes in the spec</p>}
              {!isApplied && (
                <button onClick={() => accept()} className="w-full px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded hover:bg-brand-700">
                  Use this configuration
                </button>
              )}
            </div>
            {rec.alternatives.length > 0 && (
              <div className="bg-white border border-steel-200 rounded-md p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-500">Alternatives</h4>
                {rec.alternatives.map((a, i) => (
                  <div key={i} className="border-t border-steel-100 pt-3 first:border-0 first:pt-0">
                    <div className="text-sm font-medium text-steel-800">{a.label}</div>
                    <div className="text-xs font-mono text-steel-600">{a.cpuId}{a.hmiPartNumber ? ` · ${a.hmiPartNumber}` : ''}</div>
                    <p className="text-xs text-steel-600 mt-1">{a.tradeoff}</p>
                    <button onClick={() => accept(a.cpuId, a.hmiPartNumber)} className="mt-1.5 text-xs text-brand-700 font-medium hover:underline">Use this instead</button>
                  </div>
                ))}
              </div>
            )}
            {rec.cautions.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-900 mb-1">Please note</h4>
                <ul className="list-disc pl-4 text-sm text-amber-900 space-y-1">{rec.cautions.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
