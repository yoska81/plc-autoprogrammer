import { useSearchParams } from 'react-router-dom';
import DrawingsImport from '../convert/DrawingsImport';
import ReviewAndConvert from '../convert/ReviewAndConvert';

type Tab = 'drawings' | 'program' | 'photos';
const TABS: { id: Tab; label: string }[] = [{ id: 'drawings', label: 'Drawings' }, { id: 'program', label: 'Program' }, { id: 'photos', label: 'Cabinet photos' }];

/**
 * Import an existing machine: the one entry point for an existing machine's drawings (read, reviewed,
 * converted to the target standard and rebuilt: src/convert/) and its PLC program (src/plc/import/).
 * Both share the read step (src/convert/derive.ts deriveFromUpload) and write the same project data.
 */
export default function ImportPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'drawings';
  return (
    <>
      <header className="border-b border-steel-200 bg-white px-4 py-2.5">
        <h2 className="text-base font-semibold text-steel-800">Import an existing machine</h2>
        <p className="mt-0.5 text-xs text-steel-500">
          The app reads the existing machine, writes its description, converts it to the project's standard and rebuilds the design, keeping everything the machine does. You check every reading before anything is built.
        </p>
        <p className="mt-1 text-xs text-steel-600" data-testid="import-limits">
          <b>Can be read:</b> PDF drawings and printouts (also scans), photos of the sheets, DXF exports, and DWG files in the Windows app once its DWG reader is set up in Settings. <b>Can't be read:</b> DWG without the DWG reader (save as DXF in AutoCAD, or print to PDF) and locked native PLC projects — Siemens .ap*, Mitsubishi .gx3 / .gxw, Delta binary projects, CLICK .ckp, Allen-Bradley .ACD. Export those (e.g. L5X, symbol table CSV) or print them to PDF.
        </p>
      </header>
      <nav className="flex gap-1 border-b border-steel-200 bg-white px-4" aria-label="Import from">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setParams({ tab: t.id }, { replace: true })} aria-current={tab === t.id ? 'page' : undefined}
            className={`border-b-2 px-3 py-2 text-sm ${tab === t.id ? 'border-brand-600 font-medium text-brand-800' : 'border-transparent text-steel-600 hover:text-steel-900'}`}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="flex-1 space-y-4 overflow-y-auto bg-steel-50 p-4">
        {tab === 'drawings' && <DrawingsImport />}
        {/* Program tab: the program reader (src/plc/import/) plugs in here. */}
        {tab === 'program' && (
          <div className="max-w-3xl rounded-sm border border-steel-200 bg-white p-4 text-sm text-steel-700" data-testid="import-program">
            Reading PLC program files is being added. Until then, print the program and its I/O list (symbol table) to PDF and upload them on the <button type="button" className="text-brand-700 underline" onClick={() => setParams({ tab: 'drawings' }, { replace: true })}>Drawings</button> tab with the electrical drawings.
          </div>
        )}
        {/* Cabinet photos tab: the photo recogniser (src/convert/photos/) plugs in here. */}
        {tab === 'photos' && (
          <div className="max-w-3xl rounded-sm border border-steel-200 bg-white p-4 text-sm text-steel-700" data-testid="import-photos">
            Reading the devices from photos of the cabinet is being added. Until then, upload the photos on the <button type="button" className="text-brand-700 underline" onClick={() => setParams({ tab: 'drawings' }, { replace: true })}>Drawings</button> tab with the drawings.
          </div>
        )}
        {/* Every tab hands its reading to the same review, conversion and rebuild. */}
        <ReviewAndConvert />
      </div>
    </>
  );
}
