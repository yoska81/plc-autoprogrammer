import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSavedWork, restoreAsNewProject, type SavedWork } from '../store/useProjectsStore';

const th = 'text-left font-medium text-steel-500 px-3 py-1.5 border-b border-steel-200 bg-steel-50';
const td = 'px-3 py-1.5 border-b border-steel-100 align-top';

/**
 * Every copy of a project saved in this browser (project copies and automatic
 * backups), with a way to open any of them as a new project. Nothing is overwritten.
 */
export default function RecoverWork() {
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedWork[]>(() => listSavedWork());
  const [done, setDone] = useState<string | null>(null);

  const restore = (w: SavedWork) => {
    const name = `${w.name} (recovered${w.at ? ` ${w.at.slice(0, 16).replace('T', ' ')}` : ''})`;
    if (restoreAsNewProject(w.key, name)) {
      setDone(name);
      setItems(listSavedWork());
      navigate('/spec');
    }
  };

  return (
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
                  <button onClick={() => restore(w)} className="px-3 py-1 text-xs font-medium bg-brand-600 text-brand-950 rounded-sm hover:bg-brand-700 whitespace-nowrap">Open as new project</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
