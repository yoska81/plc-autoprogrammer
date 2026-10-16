import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectSnapshot } from './collect';
import { buildOrderList, money, orderListCsv, PASTE_LIMIT, supplierCsv, supplierText, type OrderList, type SupplierGroup } from './purchasing';
import { priceBasis } from './purchaseSummaryPdf';
import { saveBlob } from './files';
import { Spinner } from '../components/common';

const btn = 'px-3 py-1.5 text-sm rounded border border-steel-300 hover:bg-steel-50 disabled:opacity-40 flex items-center gap-2';
const primary = 'px-3 py-1.5 text-sm rounded bg-brand-600 text-brand-950 hover:bg-brand-700 disabled:opacity-40 flex items-center gap-2';
const slug = (s: string) => s.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');

async function orderListXlsx(ol: OrderList, projectName: string): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISA Auto Programmer';
  const ws = wb.addWorksheet('Order list', { views: [{ state: 'frozen', ySplit: 2 }] });
  ws.addRow([`${projectName} — order list`]).font = { bold: true, size: 13 };
  const head = ws.addRow(['Supplier', 'Part number', 'Manufacturer', 'Description', 'Needed (pcs)', 'Spares (pcs)', 'Unit', 'Order qty', 'Unit price (USD)', 'Extended (USD)', 'Price source', 'Note']);
  head.font = { bold: true };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5FFC4' } };
  for (const g of ol.groups) {
    for (const l of g.lines) {
      ws.addRow([g.supplier, l.partNumber, l.manufacturer, l.description, l.bomQty, l.spareQty, l.packQty > 1 ? `pack of ${l.packQty}` : 'each', l.orderQty,
        l.price ? l.price.price : 'price to confirm', l.extended ?? null, l.price ? `${l.price.sourceUrl} (${l.price.date})` : '', l.note ?? '']);
    }
    const sub = ws.addRow(['', '', '', `Subtotal ${g.supplier}${g.unpriced ? ` (${g.unpriced} price to confirm)` : ''}`, null, null, '', null, null, g.subtotal]);
    sub.font = { bold: true };
  }
  const tot = ws.addRow(['', '', '', 'Total of verified prices', null, null, '', null, null, ol.total]);
  tot.font = { bold: true };
  ws.addRow([]);
  ws.addRow([priceBasis(ol)]);
  ws.columns.forEach((c, i) => { c.width = [18, 20, 16, 60, 11, 11, 13, 10, 15, 15, 50, 40][i]; });
  ws.getColumn(9).numFmt = '#,##0.00';
  ws.getColumn(10).numFmt = '#,##0.00';
  return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Purchasing card on the Deliverables page: order list by supplier, exports and the purchase summary PDF. */
export default function OrderListCard({ p, fileBase }: { p: ProjectSnapshot; fileBase: string }) {
  const [spares, setSpares] = useState(true);
  const [labels, setLabels] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [paste, setPaste] = useState<SupplierGroup | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const ol = useMemo(() => buildOrderList(p, { spares, labels }), [p, spares, labels]);
  const empty = !ol.groups.length;

  // Deep link from the Electrical page ("Order list").
  useEffect(() => { if (location.hash === '#order-list') ref.current?.scrollIntoView({ block: 'start' }); }, []);

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

  return (
    <div ref={ref} id="order-list" className="bg-white rounded-sm border border-steel-200 p-5 space-y-3 scroll-mt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-steel-800">Purchasing — order list</h3>
        <span className="text-xs text-steel-500">{ol.groups.reduce((s, g) => s + g.lines.length, 0)} lines · {ol.groups.length} supplier{ol.groups.length === 1 ? '' : 's'}</span>
      </div>
      <p className="text-xs text-steel-500">Everything to buy for this panel, rolled up per part number and in the supplier's selling units (packs where parts come in packs). Part numbers come from the design.</p>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={spares} onChange={(e) => setSpares(e.target.checked)} /> Include recommended spares</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Include label supplies (printer chosen on the Labels tab)</label>
      </div>
      {empty ? <p className="text-sm text-steel-500">No electrical design yet.</p> : (
        <>
          {ol.groups.map((g) => (
            <div key={g.supplier} className="border border-steel-200 rounded-sm">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-steel-50 border-b border-steel-200">
                <span className="text-sm font-semibold text-steel-800">{g.supplier}</span>
                <span className="text-xs text-steel-500">{g.lines.length} lines · subtotal {money(g.subtotal)}{g.unpriced ? ` · ${g.unpriced} price to confirm` : ''}</span>
                <span className="ml-auto flex gap-2">
                  <button className={btn} disabled={Boolean(busy)} onClick={run(`csv-${g.supplier}`, () => saveBlob(`${fileBase}_order_${slug(g.supplier)}.csv`, new Blob([supplierCsv(g)], { type: 'text/csv' })))}>
                    {g.supplier === 'AutomationDirect' ? 'AutomationDirect order file (CSV)' : 'Order file (CSV)'}
                  </button>
                  <button className={btn} onClick={() => void copy(g)}>Copy part numbers + quantities</button>
                </span>
              </div>
              {g.supplier === 'AutomationDirect' && (
                <p className="px-3 py-1.5 text-xs text-steel-600 border-b border-steel-100">
                  To order: sign in at automationdirect.com, open the Shopping Cart, click <b>CSV Upload</b>, then either choose the order file or paste the copied lines into <b>Enter Items</b>, and click <b>Upload Items</b>. AutomationDirect reports any part number it does not recognise on the cart page.
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-steel-500 uppercase"><tr>{['Part number', 'Description', 'Needed', 'Spares', 'Order', 'Unit price', 'Extended'].map((h) => <th key={h} className={`py-1 px-2 ${['Part number', 'Description'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-steel-100">
                    {g.lines.map((l) => (
                      <tr key={l.partNumber}>
                        <td className="px-2 py-1 font-mono whitespace-nowrap">{l.partNumber}</td>
                        <td className="px-2 py-1 text-steel-700">{l.description}{l.note && <div className="text-steel-500">{l.note}</div>}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{l.bomQty || ''}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{l.spareQty || ''}</td>
                        <td className="px-2 py-1 text-right tabular-nums font-semibold whitespace-nowrap">{l.orderQty}{l.packQty > 1 ? ` × ${l.source === 'labels' ? 'roll' : 'pack'}` : ''}</td>
                        <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{l.price ? <a href={l.price.sourceUrl} target="_blank" rel="noreferrer" title={`List price as of ${l.price.date}, ${l.price.unit}`} className="underline decoration-dotted">{money(l.price.price)}</a> : <span className="text-amber-700">price to confirm</span>}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{l.extended !== undefined ? money(l.extended) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-sm font-semibold text-steel-800">Total of verified prices: {money(ol.total)}</span>
            {ol.unpriced > 0 && <span className="text-xs text-amber-700">+ {ol.unpriced} line{ol.unpriced === 1 ? '' : 's'} with price to confirm (not in the total)</span>}
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
            <button className={btn} disabled={Boolean(busy)} onClick={run('xlsx', async () => saveBlob(`${fileBase}_order_list.xlsx`, await orderListXlsx(ol, p.projectName)))}>{busy === 'xlsx' && <Spinner />}Order list (Excel)</button>
            <button className={btn} disabled={Boolean(busy)} onClick={run('csv', () => saveBlob(`${fileBase}_order_list.csv`, new Blob([orderListCsv(ol)], { type: 'text/csv' })))}>Order list (CSV)</button>
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
