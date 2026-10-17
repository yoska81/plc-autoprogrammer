import { useEffect, useMemo, useRef, useState } from 'react';
import type { DrawingContext } from '../derive';
import { LABEL_KINDS, labelsCsv, type LabelKind } from '../labels';
import { listLabels, type ListedLabel } from './list';
import { saveBlob } from '../../deliverables/files';
import { desktop, desktopPrinters, printLabelPdf, printMessage, type DesktopPrinter } from './print';
import ResizablePane from '../../components/ResizablePane';
import { Spinner } from '../../components/common';
import { canvasMeasure, expandCopies, layoutLabel } from './layout';
import { labelPrinterPdf, labelSheetPdf, labelsXlsx, PAPER, printable } from './labelOutput';
import { fmtSize, MM_PER_IN, rollOf, SIZE_PRESETS, sizeOf, useLabelSetupStore, type LabelSetup } from './setup';
import { useProjectsStore } from '../../store/useProjectsStore';
import LabelSvg from './LabelSvg';
import { BRANDS, PRINTERS, printerById, SUPPLY_KIND_TITLE, supplyByPart, suppliesFor, supplyText, type SupplyKind } from './printers';
import { useDraft } from '../../store/useDraftStore';
import { useUi } from '../../store/useUiStore';
import { useEditsStore } from '../../edits/useEditsStore';
import { EditableCell } from '../../edits/EditedMark';

const input = 'border border-steel-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const btn = 'px-3 py-1.5 text-sm rounded border border-steel-300 bg-white hover:bg-steel-50 disabled:opacity-40 flex items-center gap-2';
const primary = 'px-3 py-1.5 text-sm rounded bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-40 flex items-center gap-2';
const PREVIEW_MAX = 60;
/** Distinct labels shown in the preview (each once, with its copy count). */
const PREVIEW_DISTINCT_MAX = 400;
/** Fixed row height of the label list (px) and extra rows rendered above / below the view. */
const ROW_H = 33;
const OVERSCAN = 15;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-steel-500">{title}</h3>
      {children}
    </section>
  );
}

/** Number input shown in the chosen units, stored in mm. */
function MmInput({ mm, units, onChange, label, min = 3 }: { mm: number; units: LabelSetup['units']; onChange: (mm: number) => void; label: string; min?: number }) {
  const v = units === 'in' ? +(mm / MM_PER_IN).toFixed(3) : +mm.toFixed(1);
  return (
    <input type="number" aria-label={label} step={units === 'in' ? 0.05 : 0.5} min={0} value={v} className={`${input} w-20`}
      onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.max(min, units === 'in' ? n * MM_PER_IN : n)); }} />
  );
}

export default function LabelsPanel({ ctx, fileBase, projectName }: { ctx: DrawingContext | null; fileBase: string; projectName: string }) {
  const activeId = useProjectsStore((s) => s.activeId);
  const setup = useLabelSetupStore((s) => (activeId && s.byProject[activeId]) || s.last);
  const setFor = useLabelSetupStore((s) => s.set);
  const set = (patch: Partial<LabelSetup>) => setFor(activeId, patch);
  // Label texts typed over the generated ones (kept by label id when the design is generated again).
  const labelEdits = useEditsStore((s) => s.labels);
  const setLabel = useEditsStore((s) => s.setLabel);
  const resetLabel = useEditsStore((s) => s.resetLabel);
  const all = useMemo(() => (ctx ? listLabels(ctx, labelEdits) : []), [ctx, labelEdits]);
  // Kept with the project (as arrays), so ticks and copy counts survive leaving the page.
  const [kindList, setKindList] = useDraft<LabelKind[]>('labels.kinds', LABEL_KINDS.map((k) => k.kind));
  const [offList, setOffList] = useDraft<string[]>('labels.off', []);
  const [copyList, setCopyList] = useDraft<[string, number][]>('labels.copies', []);
  const kinds = useMemo(() => new Set(kindList), [kindList]);
  const off = useMemo(() => new Set(offList), [offList]);
  const copies = useMemo(() => new Map(copyList), [copyList]);
  const setKinds = (f: (s: Set<LabelKind>) => Set<LabelKind>) => setKindList((l) => [...f(new Set(l))]);
  const setOff = (f: (s: Set<string>) => Set<string>) => setOffList((l) => [...f(new Set(l))]);
  const setCopies = (f: (m: Map<string, number>) => Map<string, number>) => setCopyList((l) => [...f(new Map(l))]);
  const [filter, setFilter] = useUi('labels.filter', '');
  const [range, setRange] = useDraft('labels.range', { from: '', to: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [zoom, setZoom] = useUi('labels.zoom', 1);
  // Progress (0..1) of a long PDF build; null when idle.
  const [prog, setProg] = useState<number | null>(null);
  const onProgress = (done: number, total: number) => setProg(total ? done / total : null);
  // Virtualised list: only the rows in view are rendered (big projects have thousands of labels).
  const listRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ top: 0, height: 600 });
  const last = useRef<number | null>(null);
  const measure = useMemo(() => canvasMeasure(), []);
  // Windows printers (desktop app only).
  const [winPrinters, setWinPrinters] = useState<DesktopPrinter[]>([]);
  useEffect(() => { void desktopPrinters().then(setWinPrinters); }, []);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScroll({ top: el.scrollTop, height: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ctx]);

  const withCopies = (l: ListedLabel): ListedLabel => (copies.has(l.id) ? { ...l, copies: copies.get(l.id)! } : l);
  const counts = useMemo(() => {
    const c = new Map<LabelKind, number>();
    for (const l of all) c.set(l.kind, (c.get(l.kind) ?? 0) + 1);
    return c;
  }, [all]);
  const q = filter.trim().toLowerCase();
  const shown = all.filter((l) => kinds.has(l.kind) && (!q || `${l.code} ${l.description} ${l.group}`.toLowerCase().includes(q)));
  const win = {
    from: Math.max(0, Math.floor(scroll.top / ROW_H) - OVERSCAN),
    to: Math.min(shown.length, Math.ceil((scroll.top + scroll.height) / ROW_H) + OVERSCAN),
  };
  const chosen = all.filter((l) => kinds.has(l.kind) && !off.has(l.id)).map(withCopies).filter((l) => l.copies > 0);
  const totalPrinted = chosen.reduce((s, l) => s + (setup.useCopies ? l.copies : 1), 0);
  const size = sizeOf(setup);
  const printer = printerById(setup.printerId);
  const roll = rollOf(setup);
  const byRoll = setup.pageLayout === 'roll' && Boolean(roll);
  const supply = setup.supply ? supplyByPart(setup.supply) : undefined;
  const tapeAuto = Boolean(size.tape) && !setup.tapeLength;

  // Roll preview: every printed label at its real position on the liner. Otherwise each label once
  // with its copy count, so a long run of copies (20 x 0V, 20 x 24+) never hides the other numbers.
  const preview = (byRoll ? expandCopies(chosen, setup.useCopies).slice(0, PREVIEW_MAX) : chosen.slice(0, PREVIEW_DISTINCT_MAX))
    .map((l) => ({ l, lay: layoutLabel(printable(l), setup, measure) }));
  const previewMore = byRoll ? totalPrinted - preview.length : chosen.length - preview.length;
  // Labels of the ticked kinds that were unticked in the list (kept with the project).
  const unticked = all.filter((l) => kinds.has(l.kind) && off.has(l.id));

  const toggle = (ids: string[], on: boolean) => setOff((s) => {
    const n = new Set(s);
    for (const id of ids) { if (on) n.delete(id); else n.add(id); }
    return n;
  });
  const clickRow = (i: number, e: React.MouseEvent | React.ChangeEvent) => {
    const l = shown[i];
    const on = off.has(l.id);
    if ('shiftKey' in e && e.shiftKey && last.current !== null) {
      const [a, b] = [Math.min(last.current, i), Math.max(last.current, i)];
      toggle(shown.slice(a, b + 1).map((x) => x.id), on);
    } else toggle([l.id], on);
    last.current = i;
  };
  const selectRange = () => {
    const a = Math.max(1, Number(range.from) || 1), b = Math.min(shown.length, Number(range.to) || shown.length);
    if (a > b) return;
    const ids = new Set(shown.slice(a - 1, b).map((l) => l.id));
    setOff((s) => { const n = new Set(s); for (const l of shown) { if (ids.has(l.id)) n.delete(l.id); else n.add(l.id); } return n; });
  };

  const run = (label: string, fn: () => Promise<string | void>) => async () => {
    setBusy(label);
    setMsg(null);
    try {
      const r = await fn();
      if (r) setMsg({ text: r });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(null);
      setProg(null);
    }
  };
  const b = (label: string, onClick: () => Promise<string | void>, main = false) => (
    <button className={main ? primary : btn} disabled={!chosen.length || Boolean(busy)} onClick={run(label, onClick)}>
      {busy === label && <Spinner />}{label}
    </button>
  );

  if (!ctx) {
    return <div className="flex-1 flex items-center justify-center text-sm text-steel-500 bg-steel-50">No design yet. Generate the electrical design first; the labels come from it.</div>;
  }

  const sizeName = `${supply ? `${supply.partNumber} · ` : ''}${tapeAuto ? `${size.h} mm tape` : fmtSize(size.w, size.h, setup.units)}`;
  const allShownOn = shown.length > 0 && shown.every((l) => !off.has(l.id));

  return (
    <div className="flex-1 flex overflow-hidden bg-steel-50">
      {/* Setup */}
      <ResizablePane id="labels.setup" defaultSize={330} min={260} max={520} className="bg-white border-r border-steel-200 overflow-y-auto">
        <div className="p-4 space-y-5">
          <Section title="1. Which labels">
            {LABEL_KINDS.map((k) => (
              <label key={k.kind} className="flex items-start gap-2 text-sm cursor-pointer" title={k.hint}>
                <input type="checkbox" className="mt-0.5" checked={kinds.has(k.kind)} disabled={!counts.get(k.kind)}
                  onChange={(e) => setKinds((s) => { const n = new Set(s); if (e.target.checked) n.add(k.kind); else n.delete(k.kind); return n; })} />
                <span className="flex-1">{k.title}<span className="block text-xs text-steel-400">{k.hint}</span></span>
                <span className="text-xs tabular-nums text-steel-500 bg-steel-100 rounded px-1.5">{counts.get(k.kind) ?? 0}</span>
              </label>
            ))}
          </Section>

          <Section title="2. What to print">
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="content" checked={setup.content === 'code'} onChange={() => set({ content: 'code' })} /> Number only <span className="text-xs text-steel-400">(101, TB1-4, K1)</span></label>
              <label className="flex items-center gap-2"><input type="radio" name="content" checked={setup.content === 'code+description'} onChange={() => set({ content: 'code+description' })} /> Number + description beside it</label>
            </div>
          </Section>

          <Section title="3. Printer and label size">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 text-sm">
              <span className="text-steel-600">Printer</span>
              <select aria-label="Label printer" value={setup.printerId} onChange={(e) => set({ printerId: e.target.value, supply: suppliesFor(e.target.value).some((x) => x.partNumber === setup.supply) ? setup.supply : '' })} className={`${input} w-full min-w-0`}>
                <option value="">Any printer (generic sizes)</option>
                {BRANDS.map((b) => (
                  <optgroup key={b.brand} label={b.available ? b.brand : `${b.brand} (coming later)`}>
                    {PRINTERS.filter((p) => p.brand === b.brand).map((p) => <option key={p.id} value={p.id}>{p.brand} {p.model}</option>)}
                  </optgroup>
                ))}
              </select>
              {printer && (
                <>
                  <span className="text-steel-600">Labels</span>
                  <select aria-label="Printer labels" value={setup.supply} onChange={(e) => set({ supply: e.target.value })} className={`${input} w-full min-w-0`}>
                    <option value="">Generic size (below)</option>
                    {(Object.keys(SUPPLY_KIND_TITLE) as SupplyKind[]).map((k) => {
                      const list = suppliesFor(printer.id).filter((x) => x.kind === k);
                      return list.length ? (
                        <optgroup key={k} label={SUPPLY_KIND_TITLE[k]}>
                          {list.map((x) => <option key={x.partNumber} value={x.partNumber}>{x.partNumber} — {x.continuous ? `${x.heightMm} mm tape` : `${x.widthMm} x ${x.heightMm} mm`}</option>)}
                        </optgroup>
                      ) : null;
                    })}
                  </select>
                </>
              )}
            </div>
            {printer && <p className="text-xs text-steel-500">{printer.brand} {printer.model}{printer.dpi ? ` · ${printer.dpi} dpi` : ''}{printer.maxWidthMm ? ` · supplies up to ${printer.maxWidthMm} mm wide` : ''}{printer.note ? ` · ${printer.note}` : ''} · <a href={printer.source} target="_blank" rel="noreferrer" className="underline">source</a></p>}
            {supply ? (
              <div className="text-xs bg-steel-50 border border-steel-200 rounded p-2 space-y-0.5">
                <div><b>{supply.partNumber}</b> · {SUPPLY_KIND_TITLE[supply.kind]}</div>
                <div>{supplyText(supply)}</div>
                {supply.printable && <div>Printable area {supply.printable.w} x {supply.printable.h} mm (dashed in the preview)</div>}
                {supply.band && <div>Printable band {supply.band.h} mm of the {supply.heightMm} mm tape (dashed in the preview)</div>}
                {supply.across && supply.across > 1 && <div>{supply.across} labels across the liner{supply.liner ? ` (liner ${supply.liner.widthMm} mm)` : ''}: see “Page layout” below.</div>}
                {supply.liner?.derived && setup.pageLayout === 'roll' && <div className="text-amber-800">To check: {supply.liner.derived}.</div>}
                {supply.note && <div className="text-steel-500">{supply.note}</div>}
                {supply.check && <div className="text-amber-800">To check: {supply.check}</div>}
                <a href={supply.source} target="_blank" rel="noreferrer" className="underline text-steel-500">Source</a>
              </div>
            ) : (
              <>
                <select aria-label="Label size" value={setup.sizeId} onChange={(e) => set({ sizeId: e.target.value })} className={`${input} w-full`}>
                  {SIZE_PRESETS.map((s) => <option key={s.id} value={s.id}>{s.tape || s.id === 'custom' ? s.name : `${s.name}${setup.units === 'in' ? ` (${fmtSize(s.w, s.h, 'in')})` : ''}`}</option>)}
                </select>
                <p className="text-xs text-steel-500">{size.use}</p>
              </>
            )}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-steel-600">Units</span>
              {(['mm', 'in'] as const).map((u) => <label key={u} className="flex items-center gap-1"><input type="radio" name="units" checked={setup.units === u} onChange={() => set({ units: u })} />{u === 'mm' ? 'mm' : 'inches'}</label>)}
            </div>
            {!supply && setup.sizeId === 'custom' && (
              <div className="flex items-center gap-2 text-sm">
                <MmInput label="Label width" mm={setup.customW} units={setup.units} onChange={(v) => set({ customW: v })} /> x
                <MmInput label="Label height" mm={setup.customH} units={setup.units} onChange={(v) => set({ customH: v })} />
                <span className="text-steel-500">{setup.units}</span>
              </div>
            )}
            {size.tape && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={setup.tapeLength > 0} onChange={(e) => set({ tapeLength: e.target.checked ? 40 : 0 })} /> Fixed length
                {setup.tapeLength > 0 && <><MmInput label="Tape length" mm={setup.tapeLength} units={setup.units} min={10} onChange={(v) => set({ tapeLength: v })} /><span className="text-steel-500">{setup.units}</span></>}
              </label>
            )}
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={setup.border} onChange={(e) => set({ border: e.target.checked })} /> Print a border</label>
              <label className="flex items-center gap-2" title={tapeAuto ? 'Tape text always runs along the tape' : undefined}>
                <input type="checkbox" disabled={tapeAuto} checked={setup.orientation === 'vertical' && !tapeAuto} onChange={(e) => set({ orientation: e.target.checked ? 'vertical' : 'horizontal' })} /> Turn text 90° (reads bottom to top)
              </label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={setup.useCopies} onChange={(e) => set({ useCopies: e.target.checked })} /> Print every copy (e.g. 2 markers per wire)</label>
            </div>
          </Section>

          <Section title="4. Print or export">
            <p className="text-xs text-steel-600">{chosen.length} labels selected · <b>{totalPrinted}</b> to print · {sizeName}</p>
            {unticked.length > 0 && (
              <p className="text-xs text-amber-700" role="status" data-testid="labels-unticked">
                {unticked.length} label{unticked.length > 1 ? 's are' : ' is'} unticked in the list and will not print ({unticked.slice(0, 4).map((l) => l.code).join(', ')}{unticked.length > 4 ? ', …' : ''}).{' '}
                <button className="underline" onClick={() => toggle(unticked.map((l) => l.id), true)}>Tick all</button>
              </p>
            )}
            <fieldset className="text-sm space-y-1" aria-label="Page layout">
              <legend className="text-xs text-steel-600 mb-1">Page layout of the label-printer PDF</legend>
              <label className="flex items-start gap-2">
                <input type="radio" name="pageLayout" className="mt-1" checked={!byRoll} onChange={() => set({ pageLayout: 'single' })} />
                <span>One label per page <span className="text-xs text-steel-500">(default — the printer driver arranges the labels on the roll)</span></span>
              </label>
              <label className={`flex items-start gap-2 ${roll ? '' : 'text-steel-400'}`}
                title={roll ? undefined : supply?.across && supply.across > 1 ? 'The liner width and gaps of this supply are not confirmed yet, so this layout is not offered.' : 'Only for die-cut rolls with several labels across the liner.'}>
                <input type="radio" name="pageLayout" className="mt-1" disabled={!roll} checked={byRoll} onChange={() => set({ pageLayout: 'roll' })} />
                <span>Match the roll{roll ? `: ${roll.across} across per page (page = ${roll.widthMm} mm liner)` : ''}</span>
              </label>
              <p className="text-xs text-steel-500">Use one per page when Brady Workstation or the printer driver is set to this supply. Use “match the roll” when printing the PDF from a generic PDF viewer onto a multi-across roll.</p>
            </fieldset>
            <div className="flex flex-col gap-2">
              {b('Labels PDF for label printer', async () => { saveBlob(`${fileBase}_labels_${size.tape && !setup.tapeLength ? `tape${size.h}mm` : `${Math.round(size.w)}x${Math.round(size.h)}mm`}${byRoll && roll ? `_${roll.across}across` : ''}.pdf`, await labelPrinterPdf(chosen, setup, `${projectName} labels`, onProgress)); }, true)}
              {desktop() && winPrinters.length > 0 && (
                <label className="text-xs text-steel-600 flex items-center gap-2">Windows printer
                  <select aria-label="Windows printer" value={setup.windowsPrinter} onChange={(e) => set({ windowsPrinter: e.target.value })} className={`${input} flex-1 min-w-0`}>
                    <option value="">Choose when printing</option>
                    {winPrinters.map((p) => <option key={p.name} value={p.name}>{p.name}{p.isDefault ? ' (default)' : ''}</option>)}
                  </select>
                </label>
              )}
              {b('Print labels', async () => {
                const first = preview[0]?.lay;
                const r = await printLabelPdf(await labelPrinterPdf(chosen, setup, `${projectName} labels`, onProgress), {
                  fileName: `${fileBase}_labels.pdf`, jobName: `${projectName} labels`,
                  pageWidthMm: byRoll && roll ? roll.widthMm : first?.w ?? size.w, pageHeightMm: first?.h ?? size.h,
                  uniformPageSize: !tapeAuto, printerName: winPrinters.some((p) => p.name === setup.windowsPrinter) ? setup.windowsPrinter : '',
                });
                return printMessage(r, 'The labels were');
              })}
              <div className="flex items-center gap-2">
                {b('Sheet PDF', async () => { saveBlob(`${fileBase}_labels_sheet_${setup.paper}.pdf`, await labelSheetPdf(chosen, setup, projectName, onProgress)); })}
                <select aria-label="Sheet paper" value={setup.paper} onChange={(e) => set({ paper: e.target.value as LabelSetup['paper'] })} className={input}>
                  {(Object.keys(PAPER) as LabelSetup['paper'][]).map((k) => <option key={k} value={k}>{PAPER[k].name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                {b('CSV', async () => { saveBlob(`${fileBase}_labels.csv`, new Blob([labelsCsv(chosen, setup.content, setup.rowPerCopy)], { type: 'text/csv' })); })}
                {b('Excel', async () => { saveBlob(`${fileBase}_labels.xlsx`, await labelsXlsx(chosen, setup, projectName)); })}
              </div>
              <label className="flex items-center gap-2 text-xs text-steel-600"><input type="checkbox" checked={setup.rowPerCopy} onChange={(e) => set({ rowPerCopy: e.target.checked })} /> CSV / Excel: one row per printed label (instead of a copies column)</label>
            </div>
            {prog !== null && (
              <div role="progressbar" aria-label="Building the labels PDF" aria-valuenow={Math.round(prog * 100)} aria-valuemin={0} aria-valuemax={100} className="space-y-1">
                <div className="h-2 bg-steel-100 rounded overflow-hidden"><div className="h-full bg-brand-600 transition-all" style={{ width: `${Math.round(prog * 100)}%` }} /></div>
                <p className="text-xs text-steel-600">{busy}: {Math.round(prog * 100)} % of {totalPrinted} labels…</p>
              </div>
            )}
            {msg && <div role={msg.error ? 'alert' : 'status'} className={`text-xs rounded p-2 ${msg.error ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-brand-50 text-steel-800 border border-brand-200'}`}>{msg.text}</div>}
            <p className="text-xs text-steel-400">The label-printer PDF has one page per label and each page is exactly the label size, so Brady, Brother, Weidmüller and Phoenix Contact printer drivers print it 1:1. CSV / Excel import into Brady Workstation, P-touch Editor, M-Print PRO and PROJECT complete.</p>
          </Section>
        </div>
      </ResizablePane>

      {/* Label list */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-4 py-2 bg-white border-b border-steel-200 flex flex-wrap items-center gap-2 text-sm">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter: number, text or group" aria-label="Filter labels" className={`${input} w-56`} />
          <button className={btn} onClick={() => toggle(shown.map((l) => l.id), true)}>Select all</button>
          <button className={btn} onClick={() => toggle(shown.map((l) => l.id), false)}>Select none</button>
          <span className="flex items-center gap-1 text-steel-600">Rows
            <input aria-label="Range from" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} placeholder="1" className={`${input} w-14`} />
            to
            <input aria-label="Range to" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} placeholder={String(shown.length)} className={`${input} w-14`} />
          </span>
          <button className={btn} onClick={selectRange}>Select only these</button>
          <span className="ml-auto text-xs text-steel-400">Shift-click to select a range</span>
        </div>
        <div ref={listRef} className="flex-1 overflow-auto" onScroll={(e) => setScroll({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight })}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-steel-100 text-xs text-steel-500 uppercase z-10">
              <tr>
                <th className="w-8 py-1.5 pl-3 text-left"><input type="checkbox" aria-label="Select all shown" checked={allShownOn} onChange={(e) => toggle(shown.map((l) => l.id), e.target.checked)} /></th>
                <th className="w-10 text-right pr-2">#</th>
                <th className="text-left pr-2">Number</th>
                <th className="text-left pr-2">Description</th>
                <th className="text-left pr-2">Type</th>
                <th className="text-left pr-2">Group</th>
                <th className="text-left pr-3 w-20">Copies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-100 bg-white">
              {win.from > 0 && <tr aria-hidden style={{ height: win.from * ROW_H }} />}
              {shown.slice(win.from, win.to).map((l, k) => {
                const i = win.from + k;
                const on = !off.has(l.id);
                return (
                  <tr key={l.id} style={{ height: ROW_H }} className={on ? '' : 'text-steel-400 bg-steel-50'}>
                    <td className="pl-3 py-1"><input type="checkbox" aria-label={`Print ${l.code}`} checked={on} onClick={(e) => clickRow(i, e)} onChange={() => {}} /></td>
                    <td className="text-right pr-2 text-xs tabular-nums text-steel-400">{i + 1}</td>
                    <td className="pr-2 font-mono font-semibold whitespace-nowrap">
                      <EditableCell value={l.code} label={`Label text ${l.id}`} edited={l.edited?.code !== undefined} generated={l.edited?.code}
                        onCommit={(v) => setLabel(l.id, { code: v.trim() && v !== (l.edited?.code ?? l.code) ? v : undefined })} onReset={() => resetLabel(l.id, 'code')} inputClassName="font-mono font-semibold w-28" />
                    </td>
                    <td className="pr-2 max-w-md" title={l.description}>
                      <EditableCell value={l.description} label={`Label description ${l.id}`} edited={l.edited?.description !== undefined} generated={l.edited?.description}
                        onCommit={(v) => setLabel(l.id, { description: v !== (l.edited?.description ?? l.description) ? v : undefined })} onReset={() => resetLabel(l.id, 'description')} inputClassName="truncate" />
                    </td>
                    <td className="pr-2 text-xs whitespace-nowrap">{LABEL_KINDS.find((k) => k.kind === l.kind)?.title}</td>
                    <td className="pr-2 text-xs text-steel-500 whitespace-nowrap">{l.group}</td>
                    <td className="pr-3"><input type="number" min={0} max={99} aria-label={`Copies of ${l.code}`} value={withCopies(l).copies}
                      onChange={(e) => { const n = Math.max(0, Math.min(99, Math.round(Number(e.target.value) || 0))); setCopies((m) => new Map(m).set(l.id, n)); }}
                      className={`${input} w-16 py-0.5`} /></td>
                  </tr>
                );
              })}
              {win.to < shown.length && <tr aria-hidden style={{ height: (shown.length - win.to) * ROW_H }} />}
              {!shown.length && <tr><td colSpan={7} className="p-6 text-center text-steel-400">No labels match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview */}
      <ResizablePane id="labels.preview" handle="left" defaultSize={420} min={260} max={900} className="bg-steel-100 border-l border-steel-200 flex flex-col">
        <div className="px-3 py-2 bg-white border-b border-steel-200 flex items-center gap-2 text-sm">
          <span className="font-semibold text-steel-700">Preview</span>
          <span className="text-xs text-steel-500">{sizeName}</span>
          <select aria-label="Preview zoom" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className={`${input} ml-auto py-0.5`}>
            <option value={1}>Actual size</option><option value={1.5}>150 %</option><option value={2}>200 %</option><option value={3}>300 %</option>
          </select>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <div className="mb-3 flex items-end gap-2 text-[10px] text-steel-500">
            <div style={{ width: `${50 * zoom}mm` }} className="h-2 flex-shrink-0 border-x border-b border-steel-600" />
            <span>50 mm{zoom === 1 ? ' — hold a ruler to the screen; most screens are close to actual size' : ` at ${zoom * 100} %`}</span>
          </div>
          <div className="flex flex-wrap gap-2 items-start" data-testid="label-preview">
            {byRoll && roll ? (
              // One liner row per PDF page, labels at their real positions.
              Array.from({ length: Math.ceil(preview.length / roll.across) }, (_, r) => preview.slice(r * roll.across, (r + 1) * roll.across)).map((row, r) => (
                <div key={r} className="relative bg-steel-300 flex-shrink-0" style={{ width: `${roll.widthMm * zoom}mm`, height: `${row[0].lay.h * zoom}mm` }}>
                  {row.map(({ l, lay }, k) => (
                    <div key={k} className="absolute top-0" style={{ left: `${(roll.marginMm + k * (lay.w + roll.gapMm)) * zoom}mm` }}>
                      <LabelSvg lay={lay} border={setup.border} zoom={zoom} title={`${l.code} ${l.description}`} />
                    </div>
                  ))}
                </div>
              ))
            ) : preview.map(({ l, lay }, i) => (
              <div key={i} className="relative flex-shrink-0">
                <LabelSvg lay={lay} border={setup.border} zoom={zoom} title={`${l.code} ${l.description}`} />
                {setup.useCopies && l.copies > 1 && <span className="absolute -top-1.5 -right-1.5 rounded-full bg-steel-700 text-white text-[10px] leading-none px-1 py-0.5" title={`${l.copies} copies print`}>×{l.copies}</span>}
              </div>
            ))}
          </div>
          {!byRoll && chosen.length > 0 && <p className="mt-3 text-xs text-steel-500">Each label shown once{setup.useCopies ? ' (×N = copies printed)' : ''}: {preview.length} of {chosen.length} labels, {totalPrinted} printed.</p>}
          {previewMore > 0 && <p className="mt-1 text-xs text-steel-500">{previewMore} more not shown in the preview; all of them print.</p>}
          {!chosen.length && <p className="text-sm text-steel-500">Select labels to see them here.</p>}
        </div>
      </ResizablePane>
    </div>
  );
}
