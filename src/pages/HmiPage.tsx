import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useHmiStore } from '../store/useHmiStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useStageStore } from '../store/useStageStore';
import { usePlc } from '../plc/usePlc';
import { useFingerprints, useStages, hmiFingerprint } from '../spec/useStages';
import { HMI_MODELS, getHmi, CLICK_HMI_COMMUNICATION, HMI_DESIGN_GUIDELINES } from '../hmi/hmiCatalog';
import { generateHmiDesign } from '../lib/ai/hmiAI';
import HmiScreenView from '../hmi/HmiScreenView';
import StageBanner from '../components/StageBanner';
import { Spinner, ReasoningPanel } from '../components/program/common';
import type { HmiElement } from '../hmi/types';

const input = 'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-petrol-500';

function ElementEditor({ el, onChange, onDelete }: { el: HmiElement; onChange: (e: HmiElement) => void; onDelete: () => void }) {
  const num = (k: 'x' | 'y' | 'w' | 'h') => (
    <label className="text-xs text-gray-500">{k.toUpperCase()}
      <input type="number" value={el[k]} onChange={(e) => onChange({ ...el, [k]: Number(e.target.value) })} className={`${input} w-full`} />
    </label>
  );
  return (
    <div className="space-y-2 text-sm">
      <div className="text-xs font-semibold text-gray-500 uppercase">{el.kind}</div>
      <label className="block text-xs text-gray-500">Label
        <input value={el.label} onChange={(e) => onChange({ ...el, label: e.target.value })} className={`${input} w-full`} />
      </label>
      {el.kind !== 'text' && el.kind !== 'nav' && (
        <label className="block text-xs text-gray-500">PLC address
          <input value={el.address ?? ''} onChange={(e) => onChange({ ...el, address: e.target.value.toUpperCase() || null })} className={`${input} w-full font-mono`} />
        </label>
      )}
      {el.kind === 'button' && (
        <label className="block text-xs text-gray-500">Action
          <select value={el.action ?? 'momentary'} onChange={(e) => onChange({ ...el, action: e.target.value as HmiElement['action'] })} className={`${input} w-full`}>
            <option value="momentary">Momentary (hold)</option><option value="set">Set</option><option value="reset">Reset</option><option value="toggle">Toggle</option>
          </select>
        </label>
      )}
      {el.kind === 'indicator' && (
        <label className="block text-xs text-gray-500">ON color
          <select value={el.style} onChange={(e) => onChange({ ...el, style: e.target.value as HmiElement['style'] })} className={`${input} w-full`}>
            <option value="normal">Normal (white)</option><option value="ok">OK (green)</option><option value="warning">Warning (amber)</option><option value="alarm">Alarm (red)</option>
          </select>
        </label>
      )}
      <div className="grid grid-cols-4 gap-1">{num('x')}{num('y')}{num('w')}{num('h')}</div>
      {el.note && <p className="text-xs text-gray-500">{el.note}</p>}
      <button onClick={onDelete} className="text-xs text-red-600 hover:underline">Delete element</button>
    </div>
  );
}

export default function HmiPage() {
  const hmi = useHmiStore();
  const settings = useSettingsStore();
  const markGenerated = useStageStore((s) => s.markGenerated);
  const { profile, cpu, io, addresses } = usePlc();
  const fp = useFingerprints();
  const stages = useStages();

  const [error, setError] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const screenId = params.get('screen');
  const setScreenId = (id: string | null) => setParams(id ? { screen: id } : {}, { replace: true });
  const [selected, setSelected] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);

  const model = getHmi(hmi.design?.hmiPartNumber ?? hmi.hmiPartNumber);
  const apiKey = settings.anthropicApiKey;
  const screen = hmi.design?.screens.find((s) => s.id === screenId) ?? hmi.design?.screens[0] ?? null;
  const selectedEl = screen?.elements.find((e) => e.id === selected) ?? null;

  const generate = async () => {
    if (!apiKey || !model || hmi.isGenerating) return;
    hmi.setIsGenerating(true);
    setError(null);
    try {
      const r = await generateHmiDesign({
        apiKey, model: settings.anthropicModel, effort: settings.effort,
        hmi: model, guidelines: HMI_DESIGN_GUIDELINES, comms: CLICK_HMI_COMMUNICATION,
        spec: fp.spec, io, addresses, profile, cpu,
      });
      hmi.setDesign(r.design, r.explanation);
      setReasoning(r.reasoning);
      setScreenId(r.design.screens[0]?.id ?? null);
      markGenerated('hmi', { specFp: fp.specFp, spec: fp.spec, ioFp: fp.ioFp, hmiFp: hmiFingerprint(r.design) });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      hmi.setIsGenerating(false);
    }
  };

  const genButton = (label: string) => (
    <button onClick={generate} disabled={hmi.isGenerating || !apiKey || !model}
      className="px-4 py-2 text-sm bg-petrol-600 text-white rounded hover:bg-petrol-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
      {hmi.isGenerating ? <><Spinner /> Designing screens…</> : label}
    </button>
  );

  const picker = (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">Which HMI are you using?</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {HMI_MODELS.filter((m) => m.touch).map((m) => (
          <button key={m.partNumber} onClick={() => { hmi.setHmiPartNumber(m.partNumber); setChoosing(false); }}
            className={`text-left rounded border p-3 ${m.partNumber === (model?.partNumber ?? '') ? 'border-petrol-500 bg-petrol-50' : 'border-gray-200 hover:border-petrol-300'}`}>
            <div className="font-mono text-sm font-semibold text-gray-800">{m.partNumber}</div>
            <div className="text-xs text-gray-600">{m.family} · {m.sizeIn}" · {m.widthPx}×{m.heightPx}{m.ethernet ? ' · Ethernet' : ''}</div>
            {!m.supportsClickEthernet && <div className="text-xs text-amber-700">No built-in Ethernet to CLICK</div>}
            <div className="text-xs text-gray-400 mt-1 line-clamp-2">{m.description}</div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">5 · HMI design</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {model ? `${model.partNumber} · ${model.sizeIn}" · ${model.widthPx}×${model.heightPx}` : 'Choose your HMI'} · every button and lamp is linked to a PLC address the program implements
          </p>
        </div>
        {hmi.design && (
          <div className="flex gap-2">
            <button onClick={() => setChoosing((v) => !v)} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Change HMI</button>
            {genButton('Redesign screens')}
          </div>
        )}
      </header>
      <StageBanner info={stages.hmi} action={genButton('Update screens')} />

      <div className="flex-1 overflow-auto bg-gray-50 p-6 space-y-5">
        {(!hmi.design || choosing) && picker}
        {!hmi.design && (
          <div className="flex items-center gap-3">
            {genButton('Design the HMI screens')}
            {!apiKey && <span className="text-sm text-yellow-800">Add your Anthropic API key in <Link to="/settings" className="underline">Settings</Link>.</span>}
            {!model && <span className="text-sm text-gray-500">Choose an HMI above first.</span>}
          </div>
        )}
        {error && <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>}
        {reasoning && <ReasoningPanel reasoning={reasoning} />}

        {hmi.design && model && screen && (
          <>
            {hmi.explanation && <p className="text-sm text-gray-700 max-w-4xl">{hmi.explanation}</p>}
            <div className="flex flex-wrap gap-1">
              {hmi.design.screens.map((s) => (
                <button key={s.id} onClick={() => { setScreenId(s.id); setSelected(null); }}
                  className={`px-3 py-1.5 text-sm rounded ${s.id === screen.id ? 'bg-gray-800 text-white' : 'bg-white border border-gray-300 hover:bg-gray-100'}`}>{s.name}</button>
              ))}
            </div>
            <div className="flex flex-col lg:flex-row gap-4 items-start">
              <div className="flex-1 min-w-0">
                <div className="bg-gray-800 rounded-xl p-3 shadow-lg">
                  <HmiScreenView screen={screen} widthPx={model.widthPx} heightPx={model.heightPx}
                    onNavigate={(id) => { setScreenId(id); setSelected(null); }}
                    selectedId={selected} onSelect={setSelected} />
                </div>
                <p className="text-xs text-gray-500 mt-2">{screen.purpose} Click an element to edit it. Use the Simulate stage to press the buttons for real.</p>
              </div>
              <aside className="w-full lg:w-72 bg-white rounded-lg border border-gray-200 p-4">
                {selectedEl ? (
                  <ElementEditor el={selectedEl} onChange={(e) => hmi.updateElement(screen.id, e)} onDelete={() => { hmi.removeElement(screen.id, selectedEl.id); setSelected(null); }} />
                ) : (
                  <p className="text-sm text-gray-500">Select an element on the screen to change its label, PLC address, action or position.</p>
                )}
              </aside>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-x-auto">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">HMI tags ({hmi.design.tags.length}) — the PLC program implements these</h3>
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 uppercase"><tr>{['Address', 'Name', 'Type', 'Access', 'What the PLC does'].map((h) => <th key={h} className="text-left py-1 pr-2">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {hmi.design.tags.map((t) => (
                      <tr key={t.address + t.name}><td className="py-1 pr-2 font-mono">{t.address}</td><td className="pr-2">{t.name}</td><td className="pr-2 text-xs">{t.dataType}</td><td className="pr-2 text-xs">{t.access}</td><td className="text-gray-600">{t.description}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Alarms ({hmi.design.alarms.length})</h3>
                <ul className="text-sm space-y-0.5">
                  {hmi.design.alarms.map((a) => (
                    <li key={a.address} className="flex gap-2"><span className="font-mono w-16">{a.address}</span><span className={a.severity === 'alarm' ? 'text-red-700' : 'text-amber-700'}>{a.message}</span></li>
                  ))}
                </ul>
                {hmi.design.notes.length > 0 && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-3">
                    <h4 className="text-xs font-semibold text-amber-900 mb-1">To confirm</h4>
                    <ul className="list-disc pl-5 text-sm text-amber-900">{hmi.design.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
