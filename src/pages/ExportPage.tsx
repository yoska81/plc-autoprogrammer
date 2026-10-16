import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { useProgramStore } from '../store/useProgramStore';
import { usePlc } from '../plc/usePlc';
import { validateProgram } from '../plc/validate';
import { clickNicknameCsv, clickRungListing } from '../plc/clickExport';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

function downloadFile(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const btn = 'px-3 py-1.5 text-sm rounded transition-colors';

export default function ExportPage() {
  const { generatedCode, projectName, ladder } = useProgramStore();
  const { profile, cpu, io, addresses, ioAddressSet, labels } = usePlc();
  const base = projectName.trim().replace(/[^\w-]+/g, '_') || 'plc_program';
  const isLadder = profile.language === 'ladder';
  const hasProgram = isLadder ? ladder.rungs.length > 0 : Boolean(generatedCode);
  const errors = isLadder ? validateProgram(ladder, profile, ioAddressSet).filter((i) => i.severity === 'error') : [];

  const exportIoCsv = () => {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = io.map((p) => [p.id, addresses.get(p.id) ?? '', p.type, p.category, p.description].map(cell).join(','));
    downloadFile(`${base}_io.csv`, ['ID,PLC Address,Type,Category,Description', ...rows].join('\n'), 'text/csv');
  };

  return (
    <>
      <header className="px-6 py-4 bg-white border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Export</h2>
        <p className="text-xs text-gray-400 mt-0.5">{profile.vendor} {profile.name} · {cpu.id}</p>
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        {!hasProgram ? (
          <div className="text-center text-gray-500 mt-16">
            <p className="text-sm mb-2">No program yet.</p>
            <Link to="/program" className="text-blue-600 text-sm underline">Go to Program</Link>
          </div>
        ) : isLadder ? (
          <div className="max-w-3xl space-y-5">
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                The checker found {errors.length} error{errors.length !== 1 && 's'} in this program. Fix them on the{' '}
                <Link to="/program" className="underline">Program</Link> page before loading it into a PLC.
              </div>
            )}

            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Load this program into CLICK Programming Software</h3>
              <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-1.5">
                <li>Open your project (or a new one with the {cpu.id} CPU) in CLICK Programming Software.</li>
                <li>
                  <button onClick={() => downloadFile(`${base}_nicknames.csv`, clickNicknameCsv(ladder, io, addresses), 'text/csv')} className={`${btn} bg-blue-600 text-white hover:bg-blue-700 mr-2`}>
                    Download nickname CSV
                  </button>
                  then <em>File → Import → Nickname</em>. Every input, output, bit, timer and counter gets its name.
                </li>
                <li>
                  Enter the rungs using{' '}
                  <Link to="/print" target="_blank" className={`${btn} inline-block bg-gray-800 text-white hover:bg-gray-900 mx-1`}>Printable ladder</Link>
                  or the{' '}
                  <button onClick={() => downloadFile(`${base}_rungs.txt`, clickRungListing(ladder, labels, `${projectName} — ${profile.name} ${cpu.id}`), 'text/plain')} className={`${btn} border border-gray-300 hover:bg-gray-50 mx-1`}>
                    rung-by-rung listing
                  </button>
                  , and finish with an unconditional END rung.
                </li>
                <li>Check the program in the software, write it to the PLC, and test every step with the machine in a safe state.</li>
              </ol>
              <p className="text-xs text-gray-400">
                CLICK software can only import nicknames, not ladder logic, so the rungs are entered by hand. Direct download from this app is planned for the PC connector.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5 flex items-center justify-between">
              <div className="text-sm text-gray-700">I/O list with {profile.name} addresses</div>
              <button onClick={exportIoCsv} className={`${btn} border border-gray-300 hover:bg-gray-50`}>Download I/O CSV</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => downloadFile(`${base}.st`, generatedCode, 'text/plain')} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>Download .st</button>
              <button onClick={() => navigator.clipboard.writeText(generatedCode)} className={`${btn} bg-gray-700 text-white hover:bg-gray-800`}>Copy to Clipboard</button>
              <button onClick={exportIoCsv} className={`${btn} border border-gray-300 hover:bg-gray-50`}>Download I/O CSV</button>
              <span className="ml-auto text-xs text-gray-400">Read-only preview — edit on the <Link to="/program" className="underline">Program</Link> page</span>
            </div>
            <div className="flex-1 min-h-80 rounded overflow-hidden border border-gray-300">
              <Suspense fallback={<div className="p-4 text-gray-400 text-sm">Loading editor…</div>}>
                <MonacoEditor height="100%" defaultLanguage="pascal" value={generatedCode} theme="vs-dark"
                  options={{ readOnly: true, fontSize: 12, minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: 'on' }} />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
