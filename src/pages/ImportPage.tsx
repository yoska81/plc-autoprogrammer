import { useSearchParams } from 'react-router-dom';
import DrawingsImport from '../convert/DrawingsImport';
import ReviewAndConvert from '../convert/ReviewAndConvert';
import PhotosImport from '../convert/photos/PhotosImport';
import UpgradePage from '../plc/import/ui/UpgradePage';

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
          <b>Can be read:</b> PDF drawings and printouts (also scans), photos of the sheets, DXF exports, and DWG files (AutoCAD R13–R2018) in the Windows app. <b>Can't be read:</b> DWG in the browser (use DXF or PDF) and locked native PLC projects — Siemens .ap*, Mitsubishi .gx3 / .gxw, Delta binary projects, CLICK .ckp, Allen-Bradley .ACD. Export those (e.g. L5X, symbol table CSV) or print them to PDF.
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
        {/* Program tab: an exported PLC program read (src/plc/import/), then the original vs now and the download. */}
        {tab === 'program' && <div data-testid="import-program"><UpgradePage embedded /></div>}
        {/* Cabinet photos → as-built record, then the shared review / conversion below (src/convert/photos/). */}
        {tab === 'photos' && <PhotosImport />}
        {/* Every tab hands its reading to the same review, conversion and rebuild. */}
        <ReviewAndConvert />
      </div>
    </>
  );
}
