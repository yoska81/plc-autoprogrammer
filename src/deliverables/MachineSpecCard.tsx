import { useMemo, useState } from 'react';
import { collectProject } from './collect';
import { machineSpecText } from './machineSpec';
import { saveBlob } from './files';
import { MACHINE_SPEC_KEY, useEditsStore } from '../edits/useEditsStore';
import { EditedMark } from '../edits/EditedMark';
import VoiceTextarea from '../voice/VoiceTextarea';
import SpeakButton from '../voice/SpeakButton';

/** The whole machine specification as one text: show it, rewrite it, read it aloud, copy it, or save it. */
export default function MachineSpecCard() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const p = useMemo(() => collectProject(), []);
  const generated = useMemo(() => machineSpecText(p), [p]);
  // The user's own version (kept with the project, also when the design changes) or the generated one.
  const edit = useEditsStore((s) => s.texts[MACHINE_SPEC_KEY]);
  const setText = useEditsStore((s) => s.setText);
  const resetText = useEditsStore((s) => s.resetText);
  const text = edit?.value ?? generated;
  const outdated = Boolean(edit && edit.generated !== generated);

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setOpen(true); } // clipboard blocked: show the text so it can be selected by hand
  };

  return (
    <div className="bg-white rounded-sm border-2 border-brand-200 p-5 space-y-3" data-testid="machine-spec">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-64">
          <h3 className="text-sm font-semibold text-steel-800 flex items-center gap-2">Full machine specification {edit && <EditedMark label="edited by hand" onReset={() => resetText(MACHINE_SPEC_KEY)} />}</h3>
          <p className="text-xs text-steel-500">One document with everything: machine description, questions and answers, control equipment, power and motors, I/O list, electrical components, HMI screens and alarms, and the PLC program structure. Copy it into an e-mail, Word or a quote. Open it to rewrite any part: your version is kept with the project and used for Copy, Save and the ZIP.</p>
        </div>
        <SpeakButton text={text} label="Read the specification aloud" />
        <button onClick={() => void copy()} className="px-4 py-2 text-sm font-medium rounded bg-brand-600 text-white hover:bg-brand-700">{copied ? 'Copied ✓' : 'Copy'}</button>
        <button onClick={() => setOpen((v) => !v)} className="px-3 py-2 text-sm border border-steel-300 rounded hover:bg-steel-50">{open ? 'Hide' : 'Show / edit'}</button>
        <button onClick={() => saveBlob(`${p.fileBase}_machine_specification.md`, new Blob([text], { type: 'text/markdown' }))} className="px-3 py-2 text-sm border border-steel-300 rounded hover:bg-steel-50">Save (.md)</button>
      </div>
      {outdated && (
        <p className="text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-900" role="status">
          The project changed after you rewrote this text, so it may miss the latest changes. Your text is kept.{' '}
          <button type="button" onClick={() => { if (confirm('Replace your text with the newly generated specification? Your changes to it are lost.')) resetText(MACHINE_SPEC_KEY); }} className="underline font-medium">Use the new generated text</button>
        </p>
      )}
      {open && (
        <VoiceTextarea value={text} onValueChange={(v) => setText(MACHINE_SPEC_KEY, v, edit?.generated ?? generated)} rows={24} aria-label="Machine specification text"
          className="w-full font-mono text-xs border border-steel-200 rounded p-3 bg-steel-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
      )}
    </div>
  );
}
