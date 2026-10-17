import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStages, type StageInfo } from '../spec/useStages';
import { collectProject } from '../deliverables/collect';
import { buildExcelReport } from '../deliverables/excelReport';
import { buildEngineeringPdf } from '../deliverables/engineering';
import { buildProgramListingPdf } from '../deliverables/programListingPdf';
import { hmiReadme, hmiTagCsv, needsHmiTagList } from '../deliverables/hmiTags';
import { buildDrawingsPdf, buildEverythingZip, buildHmiImages, buildHmiPdf, ioCsv, programFiles, saveBlob } from '../deliverables/files';
import { bomCsv, terminalPlanCsv, wireListCsv } from '../electrical/derive';
import { Spinner } from '../components/common';
import { backPanelDxf, doorDxf } from '../electrical/dxf';
import { cabinetStep, cabinetStepSummary } from '../electrical/step/cabinetStep';
import { printLabelPdf, printMessage } from '../electrical/labels/print';
import OrderListCard from '../deliverables/OrderListCard';
import ReviewCard from '../review/ReviewCard';

const btn = 'px-3 py-1.5 text-sm rounded border border-steel-300 hover:bg-steel-50 disabled:opacity-40';
const csv = (s: string) => new Blob([s], { type: 'text/csv' });

function StatusNote({ info }: { info: StageInfo }) {
  if (info.status === 'stale') return <span className="text-xs text-amber-700">{info.reason}</span>;
  if (info.status === 'empty') return <span className="text-xs text-steel-400">Not done yet</span>;
  return <span className="text-xs text-green-700">Up to date</span>;
}

function Card({ title, info, children, to }: { title: string; info?: StageInfo; children: ReactNode; to?: string }) {
  return (
    <div className="bg-white rounded-sm border border-steel-200 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-steel-800">{title}</h3>
        <div className="flex items-center gap-2">
          {info && <StatusNote info={info} />}
          {to && <Link to={to} className="text-xs text-steel-500 underline">Open</Link>}
        </div>
      </div>
      {children}
    </div>
  );
}

function B({ label, onClick, disabled, primary, busy }: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean; busy: string | null }) {
  return (
    <button onClick={onClick} disabled={disabled || Boolean(busy)}
      className={primary ? 'px-4 py-2 text-sm rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 flex items-center gap-2' : btn}>
      {busy === label || (primary && busy?.startsWith('Building')) ? <><Spinner /> {busy}…</> : label}
    </button>
  );
}

export default function ExportPage() {
  const stages = useStages();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (label: string, fn: () => Promise<void> | void) => async () => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  // Full package: progress of the part being built, and the result of a print.
  const [pkg, setPkg] = useState<{ step: string; done: number; total: number } | null>(null);
  const [pkgNote, setPkgNote] = useState<string | null>(null);
  const fullPackage = async (print: boolean) => {
    if (busy) return;
    setBusy(print ? 'Print full package' : 'Download full package PDF');
    setError(null);
    setPkgNote(null);
    setPkg({ step: 'Starting', done: 0, total: 1 });
    try {
      const { buildFullPackagePdf } = await import('../deliverables/fullPackage');
      const snap = collectProject();
      const pdf = await buildFullPackagePdf(snap, (step, done, total) => setPkg({ step, done, total }));
      const name = `${snap.fileBase}_full_package.pdf`;
      if (print) {
        // Mixed page sizes (Letter documents, ANSI B drawings): the Windows dialog picks the paper.
        const r = await printLabelPdf(pdf, { fileName: name, jobName: `${snap.projectName} full package`, pageWidthMm: 215.9, pageHeightMm: 279.4, uniformPageSize: false });
        setPkgNote(printMessage(r, 'The full package was'));
      } else saveBlob(name, pdf);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      setPkg(null);
    }
  };
  // "Project → Print full package…" opens this page with ?action=print-full.
  const [params, setParams] = useSearchParams();
  const started = useRef(false);
  useEffect(() => {
    if (params.get('action') !== 'print-full' || started.current) return;
    started.current = true;
    setParams({}, { replace: true });
    void fullPackage(true);
  });

  const p = collectProject();
  const hasElec = Boolean(p.drawingCtx);
  const hasHmi = Boolean(p.hmi);
  const progFiles = programFiles(p);
  const stale = (['io', 'electrical', 'hmi', 'program'] as const).filter((s) => stages[s].status === 'stale');


  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-steel-200">
        <h2 className="text-base font-semibold text-steel-800">9 · Deliverables</h2>
        <p className="text-xs text-steel-400 mt-0.5">{p.projectName} · {p.profile.vendor} {p.profile.name} {p.cpu.id}</p>
      </header>

      <div className="flex-1 overflow-auto bg-steel-50 p-6">
        <div className="max-w-4xl space-y-5">
          {stale.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
              Some stages are out of date ({stale.join(', ')}). Update them before sending deliverables to anyone.
            </div>
          )}
          {error && <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>}

          <ReviewCard />

          <div className="bg-white rounded-sm border-2 border-brand-200 p-5 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <h3 className="text-sm font-semibold text-steel-800">Everything in one ZIP</h3>
              <p className="text-xs text-steel-500">Excel report, full package PDF, engineering package, electrical drawings PDF with BOM / wire list / terminal plan, machining DXFs, cabinet STEP model, HMI screens (PDF + PNG), PLC program files, label files, I/O list and the spec.</p>
            </div>
            <B busy={busy} label="Download everything" primary onClick={run('Download everything', async () => {
              saveBlob(`${p.fileBase}_deliverables.zip`, await buildEverythingZip(collectProject(), (s) => setBusy(`Building ${s.toLowerCase()}`)));
            })} />
          </div>

          <Card title="Full package (one PDF to print)" info={stages.spec}>
            <p className="text-xs text-steel-500">The whole project in one PDF: cover, contents with page numbers, engineering package, electrical drawings, HMI screens, PLC program listing, I/O list, bill of materials and label list. Bookmarks for every part and a package page number on every page.</p>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => void fullPackage(false)} disabled={Boolean(busy)} className="px-4 py-2 text-sm rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 flex items-center gap-2">
                {busy === 'Download full package PDF' && <Spinner />}Download full package PDF
              </button>
              <button onClick={() => void fullPackage(true)} disabled={Boolean(busy)} className={`${btn} flex items-center gap-2`}>
                {busy === 'Print full package' && <Spinner />}Print full package
              </button>
            </div>
            {pkg && (
              <div className="space-y-1" role="status">
                <div className="h-2 bg-steel-100 rounded overflow-hidden"><div className="h-full bg-brand-600 transition-all" style={{ width: `${Math.round((pkg.done / pkg.total) * 100)}%` }} /></div>
                <p className="text-xs text-steel-600">Building: {pkg.step} ({pkg.done + 1} of {pkg.total})…</p>
              </div>
            )}
            {pkgNote && <p className="text-xs text-steel-700 bg-brand-50 border border-brand-200 rounded p-2">{pkgNote}</p>}
          </Card>

          <OrderListCard p={p} fileBase={p.fileBase} />

          <Card title="Labels" info={stages.electrical} to="/electrical?tab=labels">
            <p className="text-xs text-steel-500">Wire, terminal, device, cable and door labels. Choose the label size and content, preview and print in Electrical design → Labels.</p>
            <div className="flex flex-wrap gap-2">
              <Link to="/electrical?tab=labels" className={btn}>Open label printing</Link>
              <B busy={busy} label="Label files (ZIP)" disabled={!hasElec} onClick={run('Label files (ZIP)', async () => {
                const [{ default: JSZip }, { labelFiles }] = await Promise.all([import('jszip'), import('../deliverables/fullPackage')]);
                const zip = new JSZip();
                for (const f of await labelFiles(collectProject())) zip.file(f.name, f.data);
                saveBlob(`${p.fileBase}_labels.zip`, await zip.generateAsync({ type: 'blob' }));
              })} />
            </div>
          </Card>

          <Card title="Engineering package (PDF)" info={stages.spec}>
            <p className="text-xs text-steel-500">What an engineer hands over: why each piece of equipment was chosen, power supply / motor circuit / cabinet heat calculations, the factory acceptance test checklist, the operator manual and a program summary.</p>
            <B busy={busy} label="Engineering package" onClick={run('Engineering package', async () => {
              const snap = collectProject();
              saveBlob(`${p.fileBase}_engineering_package.pdf`, await buildEngineeringPdf(snap, snap.equipment));
            })} />
          </Card>

          <Card title="Project report (Excel)" info={stages.spec}>
            <p className="text-xs text-steel-500">One workbook: summary, specification, I/O list, BOM, wire list, terminal plan, design review items, HMI tags/alarms/screens, PLC program and tags, program check.</p>
            <B busy={busy} label="Excel report" onClick={run('Excel report', async () => saveBlob(`${p.fileBase}_report.xlsx`, await buildExcelReport(collectProject())))} />
          </Card>

          <Card title="Electrical drawings" info={stages.electrical} to="/electrical">
            <div className="flex flex-wrap gap-2">
              <B busy={busy} label="Drawings PDF" disabled={!hasElec} onClick={run('Drawings PDF', async () => {
                const pdf = await buildDrawingsPdf(collectProject());
                if (pdf) saveBlob(`${p.fileBase}_drawings.pdf`, pdf);
              })} />
              <B busy={busy} label="BOM CSV" disabled={!hasElec} onClick={run('BOM CSV', () => saveBlob(`${p.fileBase}_BOM.csv`, csv(bomCsv(p.drawingCtx!))))} />
              <B busy={busy} label="Wire list CSV" disabled={!hasElec} onClick={run('Wire list CSV', () => saveBlob(`${p.fileBase}_wire_list.csv`, csv(wireListCsv(p.drawingCtx!))))} />
              <B busy={busy} label="Cabinet pictures (PNG)" disabled={!hasElec} onClick={run('Cabinet pictures (PNG)', async () => {
                const { cabinetPng } = await import('../electrical/render/renderToPng');
                const snap = collectProject();
                for (const v of ['inside', 'door'] as const) {
                  const url = await cabinetPng(snap.drawingCtx!, v, snap.hmi?.hmiPartNumber ?? null, 2400);
                  saveBlob(`${p.fileBase}_cabinet_${v}.png`, await (await fetch(url)).blob());
                }
              })} />
              <B busy={busy} label="Terminal plan CSV" disabled={!hasElec} onClick={run('Terminal plan CSV', () => saveBlob(`${p.fileBase}_terminal_plan.csv`, csv(terminalPlanCsv(p.drawingCtx!))))} />
            </div>
          </Card>

          <Card title="Cabinet machining (for the machine shop)" info={stages.electrical} to="/electrical?tab=cabinet">
            <p className="text-xs text-steel-500">DXF files in millimetres for laser / CNC / punch: every drilling and tapping hole of the back panel, and every cutout of the door (22 mm operators, HMI, disconnect handle). The same holes are on the "Back panel drilling" and "Door cutouts" drawing sheets with a hole table.</p>
            <div className="flex flex-wrap gap-2">
              <B busy={busy} label="Back panel DXF" disabled={!hasElec} onClick={run('Back panel DXF', () => saveBlob(`${p.fileBase}_back_panel_drilling_1to1_in.dxf`, new Blob([backPanelDxf(p.drawingCtx!)], { type: 'application/dxf' })))} />
              <B busy={busy} label="Door cutouts DXF" disabled={!hasElec} onClick={run('Door cutouts DXF', () => saveBlob(`${p.fileBase}_door_cutouts_1to1_in.dxf`, new Blob([doorDxf(p.drawingCtx!)], { type: 'application/dxf' })))} />
            </div>
          </Card>

          <Card title="Cabinet 3D model (STEP)" info={stages.electrical} to="/electrical?tab=picture">
            <p className="text-xs text-steel-500">STEP AP214 assembly in millimetres to place the cabinet in the machine CAD (SolidWorks, Inventor, Fusion, FreeCAD): enclosure, door with real cutouts, back panel, DIN rails, wire duct and every component, named by tag and part number.</p>
            {hasElec && (() => {
              const sum = cabinetStepSummary(p.drawingCtx!);
              return (
                <p className="text-xs text-steel-600">
                  {sum.bodies.length} bodies{sum.estimatedCount ? ` · ${sum.estimatedCount} with estimated size (shapes are generic product models, not manufacturer CAD)` : ''}{sum.warnings.length ? ` · ${sum.warnings.length} to check: ${sum.warnings.slice(0, 2).join('; ')}` : ''}
                </p>
              );
            })()}
            <B busy={busy} label="Cabinet STEP" disabled={!hasElec} onClick={run('Cabinet STEP', () => saveBlob(`${p.fileBase}_cabinet.step`, new Blob([cabinetStep(p.drawingCtx!)], { type: 'application/step' })))} />
          </Card>

          <Card title="HMI screens" info={stages.hmi} to="/hmi">
            <div className="flex flex-wrap gap-2">
              <B busy={busy} label="HMI screens PDF" disabled={!hasHmi} onClick={run('HMI screens PDF', async () => {
                const snap = collectProject();
                const pdf = await buildHmiPdf(snap, await buildHmiImages(snap));
                if (pdf) saveBlob(`${p.fileBase}_hmi_screens.pdf`, pdf);
              })} />
              <B busy={busy} label="Screen images (ZIP)" disabled={!hasHmi} onClick={run('Screen images (ZIP)', async () => {
                const { default: JSZip } = await import('jszip');
                const zip = new JSZip();
                for (const img of await buildHmiImages(collectProject())) zip.file(img.name, await (await fetch(img.dataUrl)).blob());
                saveBlob(`${p.fileBase}_hmi_screens.zip`, await zip.generateAsync({ type: 'blob' }));
              })} />
              {needsHmiTagList(p) && <B busy={busy} label="HMI tag list (CSV)" onClick={run('HMI tag list (CSV)', async () => {
                const snap = collectProject();
                saveBlob(`${p.fileBase}_hmi_tags.csv`, new Blob([hmiTagCsv(snap)], { type: 'text/csv' }));
              })} />}
            </div>
            {needsHmiTagList(p) && <p className="mt-2 text-xs text-steel-500">{hmiReadme(p).split('\r\n')[2]} The ZIP adds the tag list and a short how-to; no project file of that software is made.</p>}
          </Card>

          <Card title="PLC program" info={stages.program} to="/program">
            {progFiles.length ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {progFiles.map((f) => (
                    <B busy={busy} key={f.name} label={f.name} onClick={run(f.name, () => saveBlob(f.name, new Blob([f.content], { type: 'text/plain' })))} />
                  ))}
                  {p.profile.language === 'ladder' && <B busy={busy} label="Program listing PDF" onClick={run('Program listing PDF', async () => { const pdf = await buildProgramListingPdf(p); if (pdf) saveBlob(`${p.fileBase}_program.pdf`, pdf); })} />}
                </div>
                {p.profile.id === 'click' && (
                  <ol className="list-decimal pl-5 text-xs text-steel-600 space-y-1">
                    <li>In CLICK Programming Software: <em>File → Import → Nickname</em> with the nicknames CSV, so every address gets its name.</li>
                    <li>Enter the rungs from the printable ladder or the rungs listing, and finish with an unconditional END rung. CLICK software can't import ladder logic directly.</li>
                    <li>Write the program to the PLC and test every step with the machine in a safe state.</li>
                  </ol>
                )}
              </>
            ) : <p className="text-sm text-steel-500">No program yet.</p>}
          </Card>

          <Card title="I/O list" info={stages.io} to="/io">
            <B busy={busy} label="I/O list CSV" disabled={!p.io.length} onClick={run('I/O list CSV', () => saveBlob(`${p.fileBase}_io.csv`, csv(ioCsv(p))))} />
          </Card>
        </div>
      </div>
    </>
  );
}
