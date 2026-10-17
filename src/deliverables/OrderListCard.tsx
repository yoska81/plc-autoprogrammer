import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectSnapshot } from './collect';
import { buildOrderList, money, unitPrice, orderListCsv, PANEL_ORDER, PASTE_LIMIT, SPARES_ORDER, supplierCsv, supplierText, type SupplierGroup } from './purchasing';
import { priceBasis } from './purchaseSummaryPdf';
import { orderListXlsx } from './orderListXlsx';
import { saveBlob } from './files';
import { Spinner } from '../components/common';
import { useUi } from '../store/useUiStore';
import { useEditsStore } from '../edits/useEditsStore';
import { EditableCell, EditedMark } from '../edits/EditedMark';

const btn = 'px-3 py-1.5 text-sm rounded border border-steel-300 hover:bg-steel-50 disabled:opacity-40 flex items-center gap-2';
const primary = 'px-3 py-1.5 text-sm rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 flex items-center gap-2';
const slug = (s: string) => s.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');

/** Purchasing card on the Deliverables page: order list by supplier, exports and the purchase summary PDF. */
export default function OrderListCard({ p, fileBase }: { p: ProjectSnapshot; fileBase: string }) {
  const [spares, setSpares] = useUi('orders.spares', false);
  const [labels, setLabels] = useUi('orders.labels', true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [paste, setPaste] = useState<SupplierGroup | null>(null);
  // Long tables start collapsed: the page stays short and scrollable.
  const [showParts, setShowParts] = useState(false);
  const [showSpares, setShowSpares] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // The order is the panel parts; recommended spares are a separate, optional order (never mixed in).
  // Prices, quantities, part numbers and descriptions typed over the generated ones (kept by part number).
  const edits = useEditsStore((s) => s.bom);
  const setBom = useEditsStore((s) => s.setBom);
  const resetBom = useEditsStore((s) => s.resetBom);
  const ol = useMemo(() => buildOrderList(p, { ...PANEL_ORDER, labels, edits }), [p, labels, edits]);
  const sp = useMemo(() => (spares ? buildOrderList(p, { ...SPARES_ORDER, edits }) : null), [p, spares, edits]);
  const num = (v: string) => { const n = Number(v.replace(/[$,\s]/g, '')); return v.trim() && Number.isFinite(n) && n >= 0 ? n : undefined; };
  const empty = !ol.groups.length;

  // Deep link from the Electrical page ("Order list").
  // With hash routing the address is …#/export#order-list.
  useEffect(() => { if (location.hash.endsWith('#order-list')) ref.current?.scrollIntoView({ block: 'start' }); }, []);

  const run = (label: string, fn: () => Promise<void> | void) => async () => {
    setBusy(label);
    setNote(null);
    try { await fn(); } catch (e) { setNote(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };
  const copy = async (g: SupplierGroup) => {
    try {
      const text = supplierText(g);
      await navigator.clipboard.writeText(text);
      setNote(`Copied ${g.lines.length} lines for ${g.supplier} (part number,quantity per line).${text.length > PASTE_LIMIT ? ` This is ${text.length} characters: AutomationDirect's paste box takes ${PASTE_LIMIT}, so use the order file (CSV) instead.` : ''}`);
    } catch {
      setPaste(g); // clipboard blocked: show the text to copy by hand
    }
  };

  const group = (g: SupplierGroup, spare: boolean) => (
            <div key={`${spare ? 's' : 'p'}-${g.supplier}`} className={`border rounded-sm ${spare ? 'border-amber-300' : 'border-steel-200'}`}>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-steel-50 border-b border-steel-200">
                <span className="text-sm font-semibold text-steel-800">{g.supplier}{spare ? ' — recommended spares' : ''}</span>
                <span className="text-xs text-steel-500">{g.lines.length} lines · subtotal {money(g.subtotal)}{g.unpriced ? ` · ${g.unpriced} price to confirm` : ''}</span>
                <span className="ml-auto flex gap-2">
                  <button className={btn} disabled={Boolean(busy)} onClick={run(`csv-${spare}-${g.supplier}`, () => saveBlob(spare ? `${fileBase}_${slug(g.supplier)}_spares_order.csv` : `${fileBase}_order_${slug(g.supplier)}.csv`, new Blob([supplierCsv(g)], { type: 'text/csv' })))}>
                    {`${g.supplier === 'AutomationDirect' ? 'AutomationDirect ' : ''}${spare ? 'spares order file' : 'order file'} (CSV)`}
                  </button>
                  <button className={btn} onClick={() => void copy(g)}>Copy part numbers + quantities</button>
                </span>
              </div>
              {g.supplier === 'AutomationDirect' && !spare && (
                <p className="px-3 py-1.5 text-xs text-steel-600 border-b border-steel-100">
                  To order: sign in at automationdirect.com, open the Shopping Cart, click <b>CSV Upload</b>, then either choose the order file or paste the copied lines into <b>Enter Items</b>, and click <b>Upload Items</b>. AutomationDirect reports any part number it does not recognise on the cart page.
                </p>
              )}
              {(spare ? showSpares : showParts) && <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-steel-500 uppercase"><tr>{['Part number', 'Description', 'Needed', 'Spares', 'Order', 'Unit price', 'Extended'].map((h) => <th key={h} className={`py-1 px-2 ${['Part number', 'Description'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-steel-100">
                    {g.lines.map((l) => {
                      // Label supplies come from the Labels tab, spares follow the panel lines: typed over only in the panel order.
                      const editable = !spare && l.source !== 'labels';
                      const key = l.generatedPartNumber;
                      const e = l.edited;
                      return (
                      <tr key={key} data-part={key}>
                        <td className="px-2 py-1 font-mono whitespace-nowrap">
                          {editable ? <EditableCell value={l.partNumber} label={`Part number ${key}`} edited={e?.partNumber !== undefined} generated={e?.partNumber} markLabel="entered by you"
                            onCommit={(v) => setBom(key, { partNumber: v.trim() && v.trim() !== key ? v.trim() : undefined })} onReset={() => resetBom(key, 'partNumber')} inputClassName="font-mono !w-32" /> : l.partNumber}
                        </td>
                        <td className="px-2 py-1 text-steel-700 min-w-56">
                          {editable ? <EditableCell value={l.description} label={`Description of ${key}`} edited={e?.description !== undefined} generated={e?.description} markLabel="entered by you"
                            onCommit={(v) => setBom(key, { description: v.trim() && v !== (e?.description ?? l.description) ? v : undefined })} onReset={() => resetBom(key, 'description')} wrap={45} /> : l.description}
                          {l.note && <div className="text-steel-500 px-1">{l.note}</div>}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">{l.bomQty || ''}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{l.spareQty || ''}</td>
                        <td className="px-2 py-1 text-right tabular-nums font-semibold whitespace-nowrap">
                          {editable ? (
                            <span className="inline-flex items-center gap-1">
                              <EditableCell type="number" align="right" value={String(l.orderQty)} label={`Order quantity of ${key}`} edited={e?.orderQty !== undefined} generated={e?.orderQty !== undefined ? String(e.orderQty) : undefined} markLabel="entered by you"
                                onCommit={(v) => { const n = num(v) !== undefined ? Math.round(num(v)!) : undefined; setBom(key, { qty: n !== (e?.orderQty ?? l.orderQty) ? n : undefined }); }} onReset={() => resetBom(key, 'qty')} inputClassName="!w-14 font-semibold" />
                              {l.packQty > 1 ? `× ${l.source === 'labels' ? 'roll' : 'pack'}` : ''}
                            </span>
                          ) : <>{l.orderQty}{l.packQty > 1 ? ` × ${l.source === 'labels' ? 'roll' : 'pack'}` : ''}</>}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                          {editable ? (
                            <span className="inline-flex flex-col items-end">
                              <EditableCell type="number" align="right" value={l.userPrice !== undefined ? String(l.userPrice) : ''} label={`Unit price of ${key}`}
                                placeholder={l.price ? l.price.price.toFixed(2) : 'to confirm'} edited={l.userPrice !== undefined} mark={false}
                                onCommit={(v) => setBom(key, { price: num(v) })} inputClassName={`!w-[5.5rem] ${l.userPrice === undefined && !l.price ? 'placeholder:text-amber-700' : 'placeholder:text-steel-700'}`} />
                              {l.userPrice !== undefined
                                ? <EditedMark label="entered by you" generated={l.price ? money(l.price.price) : 'price to confirm'} onReset={() => resetBom(key, 'price')} />
                                : l.price && <a href={l.price.sourceUrl} target="_blank" rel="noreferrer" title={`List price as of ${l.price.date}, ${l.price.unit}`} className="text-[10px] text-steel-500 underline decoration-dotted">list price {l.price.date}</a>}
                            </span>
                          ) : unitPrice(l) !== undefined ? money(unitPrice(l)!) : <span className="text-amber-700">price to confirm</span>}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">{l.extended !== undefined ? money(l.extended) : '—'}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>}
            </div>
  );
  const toggle = (open: boolean, set: (v: boolean) => void, what: string, n: number) => (
    <button type="button" aria-expanded={open} onClick={() => set(!open)} className="text-xs font-medium text-brand-700 hover:underline">
      {open ? `Hide ${what}` : `Show ${what} (${n} line${n === 1 ? '' : 's'})`}
    </button>
  );

  return (
    <div ref={ref} id="order-list" className="bg-white rounded-sm border border-steel-200 p-5 space-y-3 scroll-mt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-steel-800">Purchasing — order list</h3>
        <span className="text-xs text-steel-500">{ol.groups.reduce((s, g) => s + g.lines.length, 0)} lines · {ol.groups.length} supplier{ol.groups.length === 1 ? '' : 's'}</span>
      </div>
      <p className="text-xs text-steel-500">Everything to buy for this panel, rolled up per part number and in the supplier's selling units (packs where parts come in packs). Part numbers come from the design. Click a part number, description, quantity or price to type your own: it is marked "entered by you", used in the totals and files, and kept when the design is generated again.</p>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={spares} onChange={(e) => setSpares(e.target.checked)} /> Show recommended spares (separate order)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Include label supplies (printer chosen on the Labels tab)</label>
      </div>
      {empty ? <p className="text-sm text-steel-500">No electrical design yet.</p> : (
        <>
          <div>{toggle(showParts, setShowParts, 'parts list', ol.groups.reduce((n, g) => n + g.lines.length, 0))}</div>
          {ol.groups.map((g) => group(g, false))}
          {sp && sp.groups.length > 0 && (
            <div className="space-y-2 border-t border-amber-200 pt-3">
              <h4 className="text-sm font-semibold text-steel-800">Recommended spares — a separate, optional order</h4>
              <p className="text-xs text-steel-500">Spare parts to keep on site (same recommendation as the maintenance chapter). They are not in the panel order file; order them only if the customer wants spares. Spares total: {money(sp.total)}{sp.unpriced ? ` + ${sp.unpriced} price to confirm` : ''}.</p>
              <div>{toggle(showSpares, setShowSpares, 'spare parts', sp.groups.reduce((n, g) => n + g.lines.length, 0))}</div>
              {sp.groups.map((g) => group(g, true))}
            </div>
          )}
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-sm font-semibold text-steel-800" data-testid="order-total">Panel parts, total of {ol.groups.some((g) => g.lines.some((l) => l.userPrice !== undefined)) ? 'known prices' : 'verified prices'}: {money(ol.parts.total)}</span>
            {ol.parts.unpriced > 0 && <span className="text-xs text-amber-700">+ {ol.parts.unpriced} line{ol.parts.unpriced === 1 ? '' : 's'} with price to confirm (not in the total)</span>}
            {ol.total !== ol.parts.total || ol.unpriced !== ol.parts.unpriced ? <span className="text-xs text-steel-600" data-testid="order-total-labels">With label supplies: {money(ol.total)}{ol.unpriced > ol.parts.unpriced ? ` + ${ol.unpriced - ol.parts.unpriced} to confirm` : ''}</span> : null}
          </div>
          <p className="text-xs text-steel-500">{priceBasis(ol)}</p>
          {ol.toSelect.length > 0 && (
            <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-900">
              <b>Still to select before ordering:</b>
              <ul className="list-disc pl-5">{ol.toSelect.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button className={primary} disabled={Boolean(busy)} onClick={run('pdf', async () => {
              const { buildPurchaseSummaryPdf } = await import('./purchaseSummaryPdf');
              saveBlob(`${fileBase}_purchase_summary.pdf`, await buildPurchaseSummaryPdf(p, { spares, labels }));
            })}>{busy === 'pdf' && <Spinner />}Purchase summary PDF</button>
            <button className={btn} disabled={Boolean(busy)} onClick={run('xlsx', async () => saveBlob(`${fileBase}_order_list.xlsx`, await orderListXlsx(ol, p.projectName, sp)))}>{busy === 'xlsx' && <Spinner />}Order list (Excel)</button>
            <button className={btn} disabled={Boolean(busy)} onClick={run('csv', () => saveBlob(`${fileBase}_order_list.csv`, new Blob([orderListCsv(ol) + (sp?.groups.length ? `\n\nRecommended spares (separate, optional order)\n${orderListCsv(sp)}` : '')], { type: 'text/csv' })))}>Order list (CSV)</button>
          </div>
          {note && <p role="status" className="text-xs text-steel-700 bg-brand-50 border border-brand-200 rounded p-2">{note}</p>}
          {paste && (
            <div className="space-y-1">
              <p className="text-xs text-steel-600">Copying is blocked in this window. Select the text below (Ctrl+A, Ctrl+C) and paste it into {paste.supplier}'s quick order:</p>
              <textarea readOnly aria-label="Part numbers and quantities" value={supplierText(paste)} rows={Math.min(12, paste.lines.length)} className="w-full font-mono text-xs border border-steel-300 rounded p-2" onFocus={(e) => e.currentTarget.select()} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
