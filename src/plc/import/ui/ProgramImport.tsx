import { useState } from 'react';
import { FORMAT_LABEL, fileText as decodeFile, type ImportedProgram } from '../index';
import { parseOffThread } from '../../../lib/parseWorker';
import { programSummary } from '../upgrade';
import { applyUpgrade } from './applyUpgrade';
import PrintoutReader from './PrintoutReader';
import type { UpgradePlan } from '../upgrade';

const ACCEPT = '.l5x,.L5X,.l5k,.L5K,.xml,.st,.scl,.csv,.txt,.il,.sdf,.awl,.stl,.acd,.ACD,.rss,.ckp,.ap13,.ap14,.ap15,.ap16,.ap17,.ap18,.ap19,.ap20,.s7p,.gx3,.gxw,.isp,.vlp,.ulpr,.ccwsln,.project';

const CONF: Record<ImportedProgram['io'][number]['confidence'], { label: string; cls: string }> = {
  high: { label: 'sure', cls: 'bg-green-100 text-green-800' },
  medium: { label: 'likely', cls: 'bg-amber-100 text-amber-800' },
  low: { label: 'check', cls: 'bg-red-100 text-red-800' },
};

/**
 * Program tab of "From an existing machine": read an exported program, show what was found, and
 * make it the project. `onApplied` gets the plan and a plain summary (for the shared step that
 * writes the machine description with the AI).
 */
export default function ProgramImport({ onApplied }: { onApplied?: (plan: UpgradePlan, summary: string) => void }) {
  const [imp, setImp] = useState<ImportedProgram | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | false>(false);

  const read = async (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (!files.length) return;
    setError(null); setImp(null);
    setBusy(`Reading ${files.map((f) => f.name).join(', ')} (${(files.reduce((n, f) => n + f.size, 0) / 1e6).toFixed(1)} MB)…`);
    try {
      const texts = await Promise.all(files.map(async (f) => ({ name: f.name, text: decodeFile(f.name, new Uint8Array(await f.arrayBuffer())) })));
      // a long program takes seconds to read: off the main thread
      const { program, main } = await parseOffThread({ op: 'program', files: texts });
      setImp(program);
      setFileText(main.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const apply = () => {
    if (!imp) return;
    const plan = applyUpgrade(imp, fileText ?? undefined);
    onApplied?.(plan, programSummary(imp));
  };

  const r = imp?.report;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">The machine's PLC program</h3>
        <p className="text-xs text-gray-500">Export the program from the PLC software and choose the file here. Rockwell: File › Save As › .L5X (or .L5K). CODESYS and others: PLCopen XML. Siemens: SCL or STL (AWL) source, or LAD blocks exported as XML (TIA Openness). Mitsubishi GX Works: Export to CSV for the program and the device comments (choose both). Delta / Inovance / Xinje: the instruction list as text, with the device comment list. Siemens: add the PLC tag table. CLICK: the nickname list (.csv).</p>
        <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg py-6 cursor-pointer border-gray-300 hover:border-blue-400">
          <span className="text-sm font-medium text-gray-700">{busy || 'Choose the program file (and its comment file)'}</span>
          <span className="text-xs text-gray-400 mt-1">.L5X · .L5K · PLCopen .xml · .scl · .st · Mitsubishi GX Works .csv · Delta / Inovance / Xinje instruction list · CLICK .csv</span>
          <input data-testid="program-file" type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { void read(e.target.files); e.target.value = ''; }} />
        </label>
        {error && <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>}
      </div>

      {!imp && <PrintoutReader onRead={(p) => { setImp(p); setFileText(null); setError(null); }} />}

      {imp && r && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4" data-testid="program-found">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">What the program shows</h3>
            <p className="text-xs text-gray-500 mt-0.5">{FORMAT_LABEL[imp.source.format]} · {[imp.source.vendor, imp.source.controller].filter(Boolean).join(' ')} · {imp.source.projectName}</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="px-2 py-1 rounded bg-gray-100"><b>{r.converted}</b> of {r.rungs} rungs converted</span>
            <span className="px-2 py-1 rounded bg-gray-100"><b>{imp.io.filter((p) => p.type === 'input').length}</b> inputs</span>
            <span className="px-2 py-1 rounded bg-gray-100"><b>{imp.io.filter((p) => p.type === 'output').length}</b> outputs</span>
            <span className="px-2 py-1 rounded bg-gray-100"><b>{(imp.program.blocks ?? []).length}</b> program parts</span>
          </div>

          {r.notConverted.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
              <p className="font-medium">Not converted — you'll be asked what each one does:</p>
              <ul className="list-disc ml-5 mt-1 text-xs space-y-0.5">
                {r.notConverted.map((n, i) => (
                  <li key={i}><code>{n.text}</code> — {n.where}{n.kept ? ' (kept as it was: it goes back into the PLC, the simulator skips it)' : ' (left out)'}</li>
                ))}
              </ul>
            </div>
          )}
          {r.notes.length > 0 && <ul className="text-xs text-gray-600 list-disc ml-5 space-y-0.5">{r.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}

          <div className="overflow-auto max-h-80 border border-gray-200 rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 text-left"><tr><th className="px-2 py-1">Name in the program</th><th className="px-2 py-1">What it is</th><th className="px-2 py-1">In / out</th><th className="px-2 py-1">Original address</th><th className="px-2 py-1"></th></tr></thead>
              <tbody>
                {imp.io.map((p, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-2 py-1 font-mono">{p.name}</td>
                    <td className="px-2 py-1">{p.description || <span className="text-gray-400">no description</span>}</td>
                    <td className="px-2 py-1">{p.type === 'input' ? 'input' : 'output'}{p.analog ? ' (analog)' : ''}</td>
                    <td className="px-2 py-1 font-mono text-gray-500">{p.original}</td>
                    <td className="px-2 py-1"><span className={`px-1.5 py-0.5 rounded ${CONF[p.confidence].cls}`}>{CONF[p.confidence].label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button data-testid="program-apply" onClick={apply} className="px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded hover:bg-brand-700">Use this program</button>
            <span className="text-xs text-gray-500">Replaces this project's I/O list and program (the current program is kept as a version) and fills the empty parts of the machine description.</span>
          </div>
        </div>
      )}
    </div>
  );
}
