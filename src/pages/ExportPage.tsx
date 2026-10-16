import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStages, type StageInfo } from '../spec/useStages';
import { collectProject } from '../deliverables/collect';
import { buildExcelReport } from '../deliverables/excelReport';
import { buildEngineeringPdf } from '../deliverables/engineering';
import { buildDrawingsPdf, buildEverythingZip, buildHmiImages, buildHmiPdf, ioCsv, programFiles, saveBlob } from '../deliverables/files';
import { bomCsv, terminalPlanCsv, wireListCsv } from '../electrical/derive';
import { Spinner } from '../components/program/common';

const btn = 'px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40';
const csv = (s: string) => new Blob([s], { type: 'text/csv' });

function StatusNote({ info }: { info: StageInfo }) {
  if (info.status === 'stale') return <span className="text-xs text-amber-700">{info.reason}</span>;
  if (info.status === 'empty') return <span className="text-xs text-gray-400">Not done yet</span>;
  return <span className="text-xs text-green-700">Up to date</span>;
}

function Card({ title, info, children, to }: { title: string; info?: StageInfo; children: ReactNode; to?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center gap-2">
          {info && <StatusNote info={info} />}
          {to && <Link to={to} className="text-xs text-gray-500 underline">Open</Link>}
        </div>
      </div>
      {children}
    </div>
  );
}

function B({ label, onClick, disabled, primary, busy }: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean; busy: string | null }) {
  return (
    <button onClick={onClick} disabled={disabled || Boolean(busy)}
      className={primary ? 'px-4 py-2 text-sm rounded bg-petrol-600 text-white hover:bg-petrol-700 disabled:opacity-40 flex items-center gap-2' : btn}>
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

  const p = collectProject();
  const hasElec = Boolean(p.drawingCtx);
  const hasHmi = Boolean(p.hmi);
  const progFiles = programFiles(p);
  const stale = (['io', 'electrical', 'hmi', 'program'] as const).filter((s) => stages[s].status === 'stale');


  return (
    <>
      <header className="px-6 py-4 bg-white border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">8 · Deliverables</h2>
        <p className="text-xs text-gray-400 mt-0.5">{p.projectName} · {p.profile.vendor} {p.profile.name} {p.cpu.id}</p>
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-4xl space-y-5">
          {stale.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
              Some stages are out of date ({stale.join(', ')}). Update them before sending deliverables to anyone.
            </div>
          )}
          {error && <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>}

          <div className="bg-white rounded-lg border-2 border-petrol-200 p-5 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <h3 className="text-sm font-semibold text-gray-800">Everything in one ZIP</h3>
              <p className="text-xs text-gray-500">Excel report, electrical drawings PDF with BOM / wire list / terminal plan, HMI screens (PDF + PNG), PLC program files, I/O list and the spec.</p>
            </div>
            <B busy={busy} label="Download everything" primary onClick={run('Download everything', async () => {
              saveBlob(`${p.fileBase}_deliverables.zip`, await buildEverythingZip(collectProject(), (s) => setBusy(`Building ${s.toLowerCase()}`)));
            })} />
          </div>

          <Card title="Engineering package (PDF)" info={stages.spec}>
            <p className="text-xs text-steel-500">What an engineer hands over: why each piece of equipment was chosen, power supply / motor circuit / cabinet heat calculations, the factory acceptance test checklist, the operator manual and a program summary.</p>
            <B busy={busy} label="Engineering package" onClick={run('Engineering package', async () => {
              const snap = collectProject();
              saveBlob(`${p.fileBase}_engineering_package.pdf`, await buildEngineeringPdf(snap, snap.equipment));
            })} />
          </Card>

          <Card title="Project report (Excel)" info={stages.spec}>
            <p className="text-xs text-gray-500">One workbook: summary, specification, I/O list, BOM, wire list, terminal plan, design review items, HMI tags/alarms/screens, PLC program and tags, program check.</p>
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
              <B busy={busy} label="Terminal plan CSV" disabled={!hasElec} onClick={run('Terminal plan CSV', () => saveBlob(`${p.fileBase}_terminal_plan.csv`, csv(terminalPlanCsv(p.drawingCtx!))))} />
            </div>
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
            </div>
          </Card>

          <Card title="PLC program" info={stages.program} to="/program">
            {progFiles.length ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {progFiles.map((f) => (
                    <B busy={busy} key={f.name} label={f.name} onClick={run(f.name, () => saveBlob(f.name, new Blob([f.content], { type: 'text/plain' })))} />
                  ))}
                  {p.profile.language === 'ladder' && <Link to="/print" target="_blank" className={btn}>Printable ladder</Link>}
                </div>
                {p.profile.id === 'click' && (
                  <ol className="list-decimal pl-5 text-xs text-gray-600 space-y-1">
                    <li>In CLICK Programming Software: <em>File → Import → Nickname</em> with the nicknames CSV, so every address gets its name.</li>
                    <li>Enter the rungs from the printable ladder or the rungs listing, and finish with an unconditional END rung. CLICK software can't import ladder logic directly.</li>
                    <li>Write the program to the PLC and test every step with the machine in a safe state.</li>
                  </ol>
                )}
              </>
            ) : <p className="text-sm text-gray-500">No program yet.</p>}
          </Card>

          <Card title="I/O list" info={stages.io} to="/io">
            <B busy={busy} label="I/O list CSV" disabled={!p.io.length} onClick={run('I/O list CSV', () => saveBlob(`${p.fileBase}_io.csv`, csv(ioCsv(p))))} />
          </Card>
        </div>
      </div>
    </>
  );
}
