import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSavedWork, restoreAsNewProject, useProjectsStore, type SavedWork } from '../store/useProjectsStore';
import { useProgramStore } from '../store/useProgramStore';
import { useSpecStore } from '../store/useSpecStore';
import { LADDER, SPEC } from '../preview/sampleProject';
import { deepScan, groupPieces, type Piece } from './recoverScan';


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
    if (pc.program) useProgramStore.getState().setGeneratedLadder(pc.program, 'Recovered from the browser (' + pc.title + ').', null, 'user');
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

  // Pieces grouped by project (where they were found), newest first; per project the program history
  // beyond the latest versions folds away (it is mostly near-duplicate versions).
  const groups = groupPieces(pieces);
  const shownPiece = (pc: Piece) => (
    <li key={pc.id} className="px-3 py-2" data-piece="">
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
        <button onClick={() => setOpenPiece(openPiece === pc.id ? null : pc.id)} className="min-w-0 text-left" aria-expanded={openPiece === pc.id} title={pc.title}>
          <span className="font-medium text-steel-900 break-words line-clamp-2">{pc.title}</span>
          {pc.when && <span className="block text-xs text-steel-500">{new Date(pc.when).toLocaleString()}</span>}
          <span className="text-xs text-steel-500 break-words line-clamp-2" title={previewLine(pc.text)}>{previewLine(pc.text)}</span>
        </button>
        <div className={ACTIONS}>
          <button onClick={() => copy(pc.text)} className="px-2 py-1 text-xs border border-steel-300 rounded-sm hover:bg-steel-50">Copy</button>
          <button onClick={() => startFrom(pc)} className="px-3 py-1 text-xs font-medium bg-brand-600 text-white rounded-sm hover:bg-brand-700 whitespace-nowrap">Start a new project from this</button>
        </div>
      </div>
      {openPiece === pc.id && <pre className="mt-2 p-2 bg-steel-50 border border-steel-200 text-xs whitespace-pre-wrap break-words max-h-72 overflow-auto">{pc.text}</pre>}
    </li>
  );

  return (
    <div className="space-y-4 min-w-0">
    <section className="bg-white border border-steel-200 min-w-0">
      <div className="min-h-8 px-3 py-1 flex flex-wrap items-center justify-between gap-2 bg-[#e9edef] border-b border-steel-200">
        <h4 className="text-xs font-semibold text-steel-700">Pieces of your work found in this browser ({pieces.length})</h4>
        <button onClick={() => setPieces(deepScan({ ladder: LADDER, spec: SPEC as unknown as Record<string, string> }))} className="text-xs text-brand-800 hover:underline">Search again</button>
      </div>
      <p className="px-3 py-2 text-xs text-steel-600">
        Everything that is not part of the built-in example: PLC programs and their history, your requests to the AI, program notes,
        machine descriptions and uploaded document names. Click a line to read it; <b>Start a new project from this</b> puts it in a new project.
        Projects are stored in the browser you worked in — if you used another computer or the Claude app instead of the website, look there too.
      </p>
      {!pieces.length ? <p className="px-3 pb-3 text-steel-500">Nothing besides the example was found in this browser.</p> : (
        <div className="border-t border-steel-100">
          {groups.map((g) => (
            <div key={g.where} data-piece-group="">
              <h5 className="px-3 py-1.5 text-xs font-semibold text-steel-700 bg-steel-50 border-b border-steel-100 break-words">
                {g.where}{g.latest ? <span className="font-normal text-steel-500"> · last saved {new Date(g.latest).toLocaleDateString()}</span> : null}
              </h5>
              <ul className="divide-y divide-steel-100">{g.shown.map(shownPiece)}</ul>
              {g.older.length > 0 && (
                <details className="border-t border-steel-100">
                  <summary className="px-3 py-1.5 text-xs text-brand-800 cursor-pointer hover:underline">{g.older.length} older program version{g.older.length === 1 ? '' : 's'}</summary>
                  <ul className="divide-y divide-steel-100">{g.older.map(shownPiece)}</ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
    <section className="bg-white border border-steel-200 min-w-0">
      <div className="min-h-8 px-3 py-1 flex flex-wrap items-center justify-between gap-2 bg-[#e9edef] border-b border-steel-200">
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
        <ul className="divide-y divide-steel-100 border-t border-steel-100">
          {items.map((w) => (
            <li key={w.key} className="px-3 py-2" data-saved-work="">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
                <div className="min-w-0">
                  <div className="font-medium text-steel-900 break-words line-clamp-2" title={w.name}>{w.name}</div>
                  <div className="text-xs text-steel-500 break-words">
                    {w.kind === 'backup' ? 'Automatic backup' : 'Project copy'}{w.reason ? ` · ${w.reason}` : ''} · {w.at ? new Date(w.at).toLocaleString() : 'when last switched'} · {w.io} I/O · {w.rungs} rungs
                  </div>
                  {w.spec && <div className="text-xs text-steel-500 italic break-words line-clamp-2" title={w.spec}>“{w.spec}”</div>}
                </div>
                <div className={ACTIONS}>
                  <button onClick={() => restore(w)} className="px-3 py-1 text-xs font-medium bg-brand-600 text-white rounded-sm hover:bg-brand-700 whitespace-nowrap">Open as new project</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
    </div>
  );
}

/** The action buttons of every row: one right-hand column of the same width on wide screens, under the text on phones. */
const ACTIONS = 'flex flex-wrap gap-2 sm:justify-end sm:w-72';
