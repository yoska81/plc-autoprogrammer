import { useMemo, useState } from 'react';
import { collectProject } from './collect';
import { machineSpecText } from './machineSpec';
import { saveBlob } from './files';

/** The whole machine specification as one text: show it, copy it, or save it. */
export default function MachineSpecCard() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const p = useMemo(() => collectProject(), []);
  const text = useMemo(() => machineSpecText(p), [p]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setOpen(true); } // clipboard blocked: show the text so it can be selected by hand
  };

  return (
    <div className="bg-white rounded-sm border-2 border-brand-200 p-5 space-y-3" data-testid="machine-spec">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-64">
          <h3 className="text-sm font-semibold text-steel-800">Full machine specification</h3>
          <p className="text-xs text-steel-500">One document with everything: machine description, questions and answers, control equipment, power and motors, I/O list, electrical components, HMI screens and alarms, and the PLC program structure. Copy it into an e-mail, Word or a quote.</p>
        </div>
        <button onClick={() => void copy()} className="px-4 py-2 text-sm font-medium rounded bg-brand-600 text-white hover:bg-brand-700">{copied ? 'Copied ✓' : 'Copy'}</button>
        <button onClick={() => setOpen((v) => !v)} className="px-3 py-2 text-sm border border-steel-300 rounded hover:bg-steel-50">{open ? 'Hide' : 'Show'}</button>
        <button onClick={() => saveBlob(`${p.fileBase}_machine_specification.md`, new Blob([text], { type: 'text/markdown' }))} className="px-3 py-2 text-sm border border-steel-300 rounded hover:bg-steel-50">Save (.md)</button>
      </div>
      {open && (
        <textarea readOnly value={text} rows={24} onFocus={(e) => e.currentTarget.select()} aria-label="Machine specification text"
          className="w-full font-mono text-xs border border-steel-200 rounded p-3 bg-steel-50" />
      )}
    </div>
  );
}
