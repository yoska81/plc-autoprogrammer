import { useEffect, useMemo, useState } from 'react';
import { IS_PREVIEW } from '../../../preview/mode';
import { createPortal } from 'react-dom';
import { PrinterIcon, XMarkIcon } from '@heroicons/react/20/solid';
import type { LadderProgram } from '../../core/ladder';
import type { ValidationIssue } from '../../core/validate';
import LadderView from '../ladder/LadderView';
import { useProjectStore, currentRevision } from '../../../store/useProjectStore';
import type { AnalogSetupRow } from '../../core/analog';
import { collectProject } from '../../../deliverables/collect';
import { buildProgramListingPdf } from '../../../deliverables/programListingPdf';
import { printPdf } from '../../../deliverables/printPdf';
import { saveBlob } from '../../../deliverables/files';
import { notify } from '../../../store/useNoticeStore';
import { GENERAL, blockOf, crossReference, issueStatus, naturalAddress } from './programIndex';

interface Props {
  program: LadderProgram;
  projectName: string;
  plcName: string;
  issues: ValidationIssue[];
  /** Address -> I/O description (physical points). */
  labels: Map<string, string>;
  /** Analog channel setup rows (CLICK System Configuration). */
  analog?: AnalogSetupRow[];
  onClose: () => void;
}

const PRINT_CSS = `
@media print {
  body.print-program > #root { display: none !important; }
  body.print-program .program-print { position: static !important; overflow: visible !important; height: auto !important; }
  .program-print .print-block { break-before: page; }
  .program-print .print-block:first-of-type { break-before: auto; }
  .program-print tr, .program-print [data-rung-id] { break-inside: avoid; }
  /* an inline-block can't be split across pages: let the ladder flow as a block */
  .program-print .inline-block { display: block !important; }
  @page { margin: 12mm; }
}`;

/** Printer-friendly program document: cover, block index with rung comments, ladder per block, tag table. */
export default function ProgramPrint({ program, projectName, plcName, issues, labels, analog = [], onClose }: Props) {
  const info = useProjectStore((s) => s.info);
  const rev = currentRevision(info);
  const xref = useMemo(() => crossReference(program), [program]);
  const { byBlock } = issueStatus(program, issues);

  useEffect(() => {
    document.body.classList.add('print-program');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('print-program'); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const blocks = [
    ...(program.blocks ?? []).map((b) => ({ id: b.id, name: b.name || b.id, description: b.description })),
    { id: GENERAL, name: 'General', description: 'Rungs without a block' },
  ].map((b) => ({ ...b, rungs: program.rungs.map((r, i) => ({ r, n: i + 1 })).filter(({ r }) => blockOf(program, r) === b.id) }))
    .filter((b) => b.rungs.length);
  const numberOf = (id: string) => program.rungs.findIndex((r) => r.id === id) + 1;
  const nick = new Map(program.tags.map((t) => [t.address.toUpperCase(), t]));
  const addresses = [...new Set([...xref.keys(), ...nick.keys()])].sort(naturalAddress);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const docNo = info.drawingPrefix ? `${info.drawingPrefix}-PLC` : '';
  const th = 'border-b border-gray-400 px-2 py-1 text-left font-semibold';
  const td = 'border-b border-gray-200 px-2 py-1 align-top';

  // The program listing as a real PDF (works in the Windows app, the browser and the preview window).
  const [busy, setBusy] = useState(false);
  const listing = async (mode: 'print' | 'save') => {
    setBusy(true);
    try {
      const pdf = await buildProgramListingPdf(collectProject());
      if (!pdf) { notify('There is no program to print yet.'); return; }
      const name = `${projectName.replace(/[^\w-]+/g, '_') || 'program'}_program.pdf`;
      if (mode === 'save') saveBlob(name, pdf);
      else if ((await printPdf(pdf, name, { wMm: 215.9, hMm: 279.4 })) === 'saved') notify('Printing is not available here, so the program PDF was saved: open it and print from the PDF reader.');
    } catch (e) {
      notify(`The program PDF could not be made: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="program-print print-page fixed inset-0 z-50 overflow-auto bg-white text-gray-900" role="dialog" aria-label="Print program">
      <style>{PRINT_CSS}</style>
      <div className="no-print sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-6 py-2 shadow-sm">
        <span className="flex-1 text-sm font-semibold">Print program · {program.rungs.length} rungs in {blocks.length} blocks</span>
        <button type="button" onClick={() => void listing('print')} disabled={busy} className="inline-flex items-center gap-1.5 rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          <PrinterIcon className="h-4 w-4" /> {busy ? 'Preparing…' : IS_PREVIEW ? 'Print (save PDF)' : 'Print'}
        </button>
        <button type="button" onClick={() => void listing('save')} disabled={busy} className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60">
          Program PDF
        </button>
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          <XMarkIcon className="h-4 w-4" /> Close
        </button>
      </div>

      <div className="mx-auto max-w-[1100px] px-8 py-6 text-sm">
        <header className="mb-6 border-b-2 border-gray-800 pb-3">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">PLC program</div>
              <h1 className="text-2xl font-bold">{projectName}</h1>
              <p className="text-gray-600">{plcName}{info.customer ? ` · ${info.customer}` : ''}{info.site ? ` · ${info.site}` : ''}</p>
            </div>
            <table className="text-xs">
              <tbody>
                {[['Document', docNo || '—'], ['Project', info.projectNumber || '—'], ['Revision', `${rev.rev} · ${rev.date}`], ['Company', info.company || '—'], ['Printed', new Date().toLocaleDateString()]].map(([k, v]) => (
                  <tr key={k}><td className="pr-3 text-gray-500">{k}</td><td className="font-medium">{v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Checker: {issues.length ? `${errors} error(s), ${issues.length - errors} warning(s)` : 'no problems found'} · {addresses.length} addresses used · each output is driven from one rung unless the checker says otherwise.
          </p>
        </header>

        <section className="mb-8">
          <h2 className="mb-2 text-base font-semibold">1 · Program structure</h2>
          <table className="w-full border border-gray-300 text-xs">
            <thead className="bg-gray-100"><tr><th className={th}>Block</th><th className={th}>Rungs</th><th className={th}>Purpose</th><th className={th}>Checker</th></tr></thead>
            <tbody>
              {blocks.map((b) => {
                const s = byBlock.get(b.id);
                return (
                  <tr key={b.id || '_g'}>
                    <td className={`${td} font-semibold`}>{b.name}</td>
                    <td className={`${td} whitespace-nowrap font-mono`}>{b.rungs[0].n}–{b.rungs[b.rungs.length - 1].n} ({b.rungs.length})</td>
                    <td className={td}>{b.description}</td>
                    <td className={td}>{s ? `${s.errors} err, ${s.warnings} warn` : 'OK'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-base font-semibold">2 · Rung descriptions</h2>
          {blocks.map((b) => (
            <div key={b.id || '_g'} className="mb-3">
              <h3 className="text-sm font-semibold">{b.name}</h3>
              <table className="w-full text-xs">
                <tbody>
                  {b.rungs.map(({ r, n }) => (
                    <tr key={r.id}><td className={`${td} w-10 text-right font-mono font-semibold`}>{n}</td><td className={td}>{r.comment || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>

        <h2 className="mb-2 text-base font-semibold">3 · Ladder logic</h2>
        {blocks.map((b) => (
          <section key={b.id || '_g'} className="print-block mb-6">
            <h3 className="text-sm font-semibold">{b.name} <span className="font-normal text-gray-500">· rungs {b.rungs[0].n}–{b.rungs[b.rungs.length - 1].n}</span></h3>
            <p className="mb-1 text-xs text-gray-600">{b.description}</p>
            <div className="rounded border border-gray-200">
              <LadderView program={{ ...program, rungs: b.rungs.map(({ r }) => r) }} labels={labels} numberOf={numberOf} />
            </div>
          </section>
        ))}

        {analog.length > 0 && (
          <section className="print-block mb-6">
            <h2 className="mb-1 text-base font-semibold">Analog setup</h2>
            <p className="mb-2 text-xs text-gray-600">Enter in the PLC software (CLICK: Setup › System Configuration) for each channel: Data Register = the DF below, Input/Output Range = the signal range, Scale Range = the engineering range, Enable Range Limiter on. The program works in these engineering units.</p>
            <table className="w-full border border-gray-300 text-xs">
              <thead className="bg-gray-100"><tr>{['Register', 'Channel', 'Terminal', 'Signal', 'Scale', 'Point'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {analog.map((r) => (
                  <tr key={r.pointId}>
                    <td className={`${td} font-mono font-semibold`}>{r.address}</td>
                    <td className={td}>{r.channel} <span className="text-gray-500">{r.partNumber}</span></td>
                    <td className={`${td} font-mono`}>{r.terminal}</td>
                    <td className={td}>{r.range} {r.kind}</td>
                    <td className={td}>{r.scaleMin} … {r.scaleMax} {r.units}</td>
                    <td className={td}>{r.pointId} {r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="print-block">
          <h2 className="mb-2 text-base font-semibold">4 · Tag table and cross reference</h2>
          <table className="w-full border border-gray-300 text-xs">
            <thead className="bg-gray-100"><tr><th className={th}>Address</th><th className={th}>Nickname</th><th className={th}>Description</th><th className={th}>Written in rung</th><th className={th}>Read in rung</th></tr></thead>
            <tbody>
              {addresses.map((a) => {
                const t = nick.get(a);
                const u = xref.get(a) ?? [];
                const list = (k: 'read' | 'write') => [...new Set(u.filter((x) => x.kind === k).map((x) => x.number))].join(', ') || '—';
                return (
                  <tr key={a}>
                    <td className={`${td} font-mono font-semibold`}>{a}</td>
                    <td className={`${td} font-mono`}>{t?.nickname ?? ''}</td>
                    <td className={td}>{t?.comment || labels.get(a) || ''}</td>
                    <td className={`${td} font-mono`}>{list('write')}</td>
                    <td className={`${td} font-mono`}>{list('read')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>,
    document.body,
  );
}
