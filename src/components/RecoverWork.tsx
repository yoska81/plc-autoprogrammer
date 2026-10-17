import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSavedWork, restoreAsNewProject, useProjectsStore, type SavedWork } from '../store/useProjectsStore';
import { useProgramStore } from '../store/useProgramStore';
import { useSpecStore } from '../store/useSpecStore';
import { LADDER, SPEC } from '../preview/sampleProject';
import { deepScan, type Piece } from './recoverScan';

const th = 'text-left font-medium text-steel-500 px-3 py-1.5 border-b border-steel-200 bg-steel-50';
const td = 'px-3 py-1.5 border-b border-steel-100 align-top';

/**
 * Every copy of a project saved in this browser (project copies and automatic
 * backups), with a way to open any of them as a new project. Nothing is overwritten.
 */
/** First line with content: skips "overview:"-style headings and blank lines. */
function previewLine(text: string): string {
  const line = text.split('\n').map((l) => l.trim()).find((l) => l && !/^[\w .\-/]+:$/.test(l)) ?? '';
  return line.replace(/^[a-z][\w]*:\s+/i, '');
}

export default function RecoverWork() {
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedWork[]>(() => listSavedWork());
  const [done, setDone] = useState<string | null>(null);
  const [pieces, setPieces] = useState<Piece[]>(() => deepScan({ ladder: LADDER, spec: SPEC as unknown as Record<string, string> }));
  const [openPiece, setOpenPiece] = useState<string | null>(null);

  const copy = (text: string) => { void navigator.clipboard?.writeText(text).catch(() => {}); };
  const startFrom = (pc: Piece) => {
    const name = `Recovered ${pc.kind === 'program' ? 'program' : 'project'} ${new Date().toLocaleDateString()}`;
    if (!useProjectsStore.getState().createProject(name)) return;
    if (pc.program) useProgramStore.getState().setGeneratedLadder(pc.program, 'Recovered from the browser (' + pc.title + ').', null);
    const spec = useSpecStore.getState();
    const note = pc.kind === 'program' ? `Recovered PLC program, rung by rung:\n${pc.text}` : pc.text;
    spec.setSections({ ...spec.sections, overview: `${spec.sections.overview ? spec.sections.overview + '\n\n' : ''}${note}` });
    setDone(name);
    navigate(pc.program ? '/program' : '/spec');
  };

  const restore = (w: SavedWork) => {
    const name = `${w.name} (recovered${w.at ? ` ${w.at.slice(0, 16).replace('T', ' ')}` : ''})`;
    if (restoreAsNewProject(w.key, name)) {
      setDone(name);
      setItems(listSavedWork());
      navigate('/spec');
    }
  };

  return (
    <div className="space-y-4">
    <section className="bg-white border border-steel-200">
      <div className="h-8 px-3 flex items-center justify-between bg-[#e9edef] border-b border-steel-200">
        <h4 className="text-xs font-semibold text-steel-700">Pieces of your work found in this browser ({pieces.length})</h4>
        <button onClick={() => setPieces(deepScan({ ladder: LADDER, spec: SPEC as unknown as Record<string, string> }))} className="text-xs text-brand-800 hover:underline">Search again</button>
      </div>
      <p className="px-3 py-2 text-xs text-steel-600">
        Everything that is not part of the built-in example: PLC programs and their history, your requests to the AI, program notes,
        machine descriptions and uploaded document names. Click a line to read it; <b>Start a new project from this</b> puts it in a new project.
        Projects are stored in the browser you worked in — if you used another computer or the Claude app instead of the website, look there too.
      </p>
      {!pieces.length ? <p className="px-3 pb-3 text-steel-500">Nothing besides the example was found in this browser.</p> : (
        <ul className="divide-y divide-steel-100 border-t border-steel-100">
          {pieces.map((pc) => (
            <li key={pc.id} className="px-3 py-2">
              <div className="flex items-center gap-3">
                <button onClick={() => setOpenPiece(openPiece === pc.id ? null : pc.id)} className="flex-1 text-left">
                  <span className="font-medium text-steel-900">{pc.title}</span>
                  <span className="text-xs text-steel-500"> · {pc.where}{pc.when ? ` · ${new Date(pc.when).toLocaleString()}` : ''}</span>
                  <span className="block text-xs text-steel-500 truncate">{previewLine(pc.text)}</span>
                </button>
                <button onClick={() => copy(pc.text)} className="px-2 py-1 text-xs border border-steel-300 rounded-sm hover:bg-steel-50">Copy</button>
                <button onClick={() => startFrom(pc)} className="px-3 py-1 text-xs font-medium bg-brand-600 text-white rounded-sm hover:bg-brand-700 whitespace-nowrap">Start a new project from this</button>
              </div>
              {openPiece === pc.id && <pre className="mt-2 p-2 bg-steel-50 border border-steel-200 text-xs whitespace-pre-wrap max-h-72 overflow-auto">{pc.text}</pre>}
            </li>
          ))}
        </ul>
      )}
    </section>
    <section className="bg-white border border-steel-200">
      <div className="h-8 px-3 flex items-center justify-between bg-[#e9edef] border-b border-steel-200">
        <h4 className="text-xs font-semibold text-steel-700">Recover saved work ({items.length})</h4>
        <button onClick={() => setItems(listSavedWork())} className="text-xs text-brand-800 hover:underline">Refresh</button>
      </div>
      <p className="px-3 py-2 text-xs text-steel-600">
        Every copy of a project kept in this browser, including automatic backups taken before the example project is updated.
        Open one as a <b>new</b> project to continue working on it — nothing you have now is changed.
        Your PLC program is also kept in <b>PLC program → History</b> ("Before new generation").
      </p>
      {done && <div className="mx-3 mb-2 px-3 py-2 text-xs bg-green-50 border border-green-200 text-green-800">Opened “{done}”.</div>}
      {!items.length ? (
        <p className="px-3 pb-3 text-steel-500">Nothing saved yet.</p>
      ) : (
        <table className="w-full">
          <thead><tr>{['Project', 'Saved', 'Contents', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.key}>
                <td className={td}>
                  <div className="font-medium text-steel-900">{w.name}</div>
                  <div className="text-xs text-steel-500">{w.kind === 'backup' ? 'Automatic backup' : 'Project copy'}{w.reason ? ` · ${w.reason}` : ''}</div>
                </td>
                <td className={`${td} whitespace-nowrap text-xs text-steel-600`}>{w.at ? new Date(w.at).toLocaleString() : 'when last switched'}</td>
                <td className={`${td} text-xs text-steel-600`}>
                  {w.io} I/O · {w.rungs} rungs
                  {w.spec && <div className="text-steel-500 italic truncate max-w-md" title={w.spec}>“{w.spec}”</div>}
                </td>
                <td className={`${td} text-right`}>
                  <button onClick={() => restore(w)} className="px-3 py-1 text-xs font-medium bg-brand-600 text-white rounded-sm hover:bg-brand-700 whitespace-nowrap">Open as new project</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
    </div>
  );
}
