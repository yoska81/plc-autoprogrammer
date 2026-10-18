import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { Link } from 'react-router-dom';
import { Spinner } from '../../components/common';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { useElectricalStore } from '../../store/useElectricalStore';
import { useDraft } from '../../store/useDraftStore';
import { getPart } from '../../electrical/catalog';
import { startAiJob, useAiJobError, useAiJobRunning, useTakeResult } from '../../lib/ai/jobs';
import type { CatalogCategory } from '../../electrical/types';
import { recogniseCabinet, type PhotoReading, type Sighting } from './recognise';
import { mergeReading } from './merge';
import { asBuiltDesign, itemCategory, itemPart, itemTag, matchPart, reviewItems, type ReviewItem, type ReviewStatus } from './toDesign';

/** Photos chosen, per project and in memory only (like the drawings upload): never carried into another project. */
const usePhotoFiles = create<{ byProject: Record<string, File[]>; set: (projectId: string, files: File[]) => void }>((set) => ({
  byProject: {},
  set: (projectId, files) => set((s) => ({ byProject: { ...s.byProject, [projectId]: files } })),
}));
const NO_FILES: File[] = [];

interface Read { reading: PhotoReading; photos: string[]; at: string }

const CONF = { high: 'bg-green-100 text-green-800', medium: 'bg-amber-100 text-amber-800', low: 'bg-red-100 text-red-800' } as const;
const card = 'rounded-sm border border-steel-200 bg-white p-4 space-y-3';
const input = 'w-full rounded-sm border border-steel-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500';
const KINDS: CatalogCategory[] = ['disconnect', 'breaker', 'fuse', 'powerSupply', 'contactor', 'overload', 'motorProtector', 'vfd', 'relay', 'safetyRelay', 'plc', 'plcModule', 'terminal', 'groundBar', 'fan', 'other'];

/** The part of a photo a device was seen in (the review shows it next to the reading). */
function Crop({ file, s }: { file: File | undefined; s: Sighting }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!file || !ref.current || typeof createImageBitmap !== 'function') return;
    let cancelled = false;
    void createImageBitmap(file).then((bmp) => {
      const c = ref.current;
      if (cancelled || !c) return;
      // a little margin around the box, so the label next to the device shows too
      const mx = s.w * 0.15, my = s.h * 0.15;
      const x = Math.max(0, s.x - mx) * bmp.width, y = Math.max(0, s.y - my) * bmp.height;
      const w = Math.min(1, s.w + 2 * mx) * bmp.width, h = Math.min(1, s.h + 2 * my) * bmp.height;
      const scale = Math.min(140 / w, 100 / h);
      c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
      c.getContext('2d')?.drawImage(bmp, x, y, w, h, 0, 0, c.width, c.height);
    }).catch(() => { /* not an image the browser can decode: no crop */ });
    return () => { cancelled = true; };
  }, [file, s]);
  if (!file) return <div className="flex h-[60px] w-[84px] items-center justify-center rounded-sm bg-steel-100 text-center text-[10px] text-steel-500">photo {s.photo + 1}</div>;
  return <canvas ref={ref} className="rounded-sm border border-steel-200 bg-steel-50" aria-label={`Crop of photo ${s.photo + 1}`} />;
}

/**
 * Import → Cabinet photos: photos of an existing cabinet (door open, several angles, close-ups of
 * nameplates and terminal strips) → the devices, their nameplates, rails and wire numbers → REVIEW
 * (a crop of the photo for every item, its confidence; confirm, correct or reject) → as-built panel
 * layout and BOM, marked "as-built from photos, verify". What the photos can't show is asked on the
 * Machine description page.
 */
export default function PhotosImport() {
  const settings = useSettingsStore();
  const apiKey = settings.provider === 'anthropic' ? settings.anthropicApiKey : '';
  const projectId = useProjectsStore((s) => s.activeId) ?? 'default';
  const files = usePhotoFiles((s) => s.byProject[projectId]) ?? NO_FILES;
  const setFiles = (f: File[]) => usePhotoFiles.getState().set(projectId, f);
  const [note, setNote] = useDraft('photos.note', '');
  const [read, setRead] = useDraft<Read | null>('photos.read', null);
  const [items, setItems] = useDraft<ReviewItem[]>('photos.items', []);
  const [done, setDone] = useDraft<string | null>('photos.applied', null);
  const busy = useAiJobRunning('photos');
  const error = useAiJobError('photos');
  const [fileError, setFileError] = useState<string | null>(null);
  useTakeResult<Read>('photos', (r) => { setRead(r); setItems(reviewItems(r.reading)); setDone(null); });

  const run = () => {
    if (!apiKey || !files.length || busy) return;
    const snap = [...files];
    void startAiJob({
      kind: 'photos', label: 'Reading the cabinet photos', keepResult: true,
      run: async (h) => {
        const { reading } = await recogniseCabinet({ apiKey, model: settings.anthropicModel, effort: settings.effort, signal: h.signal, photos: snap, note });
        return { reading: mergeReading(reading), photos: snap.map((f) => f.name), at: new Date().toISOString() } satisfies Read;
      },
    });
  };
  const patch = (key: string, p: Partial<ReviewItem>) => setItems(items.map((it) => (it.key === key ? { ...it, ...p } : it)));
  const counts = useMemo(() => ({ confirmed: items.filter((i) => i.status === 'confirmed').length, pending: items.filter((i) => i.status === 'pending').length, rejected: items.filter((i) => i.status === 'rejected').length }), [items]);
  const apply = () => {
    if (!read) return;
    const el = useElectricalStore.getState();
    if (el.design && !confirm('Replace the current electrical design with the as-built one from the photos?')) return;
    const r = asBuiltDesign(items, read.reading, el.inputs, getPart);
    el.setDesign(r.design, 'imported', `As-built from ${read.photos.length} cabinet photo${read.photos.length === 1 ? '' : 's'}: ${r.design.components.length} devices on ${r.design.asBuilt?.rails.length ?? 0} rails. Verify on the cabinet.`);
    setDone(`${r.design.components.length} devices${r.questions.length ? ` · ${r.questions.length} question${r.questions.length === 1 ? '' : 's'} on the Machine description page` : ''}${r.notInCatalog.length ? ` · ${r.notInCatalog.length} not in the catalog` : ''}`);
  };

  return (
    <div className="space-y-4" data-testid="photos-tab">
      <section className={card}>
        <h3 className="text-sm font-semibold text-steel-800">1 · Photos of the cabinet</h3>
        <p className="text-xs text-steel-600">Door open, the whole back panel, then close-ups of each DIN rail, the nameplates and the terminal strips. Several photos of the same cabinet are read together: a device seen twice is counted once.</p>
        <input type="file" multiple accept="image/*" aria-label="Cabinet photos"
          onChange={(e) => { const list = [...(e.target.files ?? [])]; const bad = list.filter((f) => !f.type.startsWith('image/')); setFileError(bad.length ? `Not a photo: ${bad.map((f) => f.name).join(', ')}` : null); setFiles(list.filter((f) => f.type.startsWith('image/')).slice(0, 20)); }}
          className="block text-sm" />
        {fileError && <p role="alert" className="text-xs text-red-700">{fileError}</p>}
        {files.length > 0 && <p className="text-xs text-steel-600">{files.length} photo{files.length === 1 ? '' : 's'}: {files.map((f) => f.name).join(', ')}</p>}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder='Optional: what this cabinet is, e.g. "Line 3 conveyor starter panel"' aria-label="Note about the cabinet"
          className="w-full rounded border border-steel-300 px-2 py-1 text-sm" />
        <div className="flex items-center gap-2">
          <button type="button" onClick={run} disabled={!apiKey || !files.length || busy} className="inline-flex items-center gap-1.5 rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
            {busy ? <><Spinner /> Reading the photos…</> : 'Read the photos'}
          </button>
          {!apiKey && <span className="text-xs text-amber-800">Add your API key in Settings to read photos.</span>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </section>

      {read && (
        <section className={card} data-testid="photos-review">
          <h3 className="text-sm font-semibold text-steel-800">2 · Review what was read</h3>
          <p className="text-xs text-steel-600">{read.reading.summary} Check each item against its photo: confirm it, correct the tag, part number or kind, or reject it. Items left unconfirmed are asked on the Machine description page.</p>
          <p className="text-xs font-medium text-steel-700" data-testid="photos-counts">{counts.confirmed} confirmed · {counts.pending} to check · {counts.rejected} rejected</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-steel-500">{['Photo', 'Kind', 'Tag', 'Part number', 'Nameplate', 'Rail / pos.', 'Read', ''].map((h) => <th key={h} className="py-1 pr-2 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-steel-100">
                {items.map((it) => {
                  const src = it.device ?? it.strip!;
                  const seen = src.seen[0];
                  const part = itemPart(it);
                  const inCatalog = part ? Boolean(matchPart(part, getPart)) : false;
                  return (
                    <tr key={it.key} data-photo-item={it.key} className={it.status === 'rejected' ? 'opacity-40' : ''}>
                      <td className="py-1.5 pr-2 align-top">{seen ? <Crop file={files[seen.photo]} s={seen} /> : '—'}{src.seen.length > 1 && <div className="text-[10px] text-steel-500">seen in {src.seen.length} photos</div>}</td>
                      <td className="pr-2 align-top">{it.kind === 'strip' ? 'Terminal strip' : (
                        <select value={itemCategory(it)} onChange={(e) => patch(it.key, { category: e.target.value as CatalogCategory })} aria-label={`Kind of ${itemTag(it) || it.key}`} className={input}>
                          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>)}
                      </td>
                      <td className="w-20 pr-2 align-top"><input value={itemTag(it)} onChange={(e) => patch(it.key, { tag: e.target.value })} aria-label={`Tag of ${it.key}`} placeholder="(none)" className={input} /></td>
                      <td className="w-36 pr-2 align-top">{it.kind === 'strip' ? <span className="text-steel-500">{it.strip!.terminals.length} terminals read</span> : <>
                        <input value={part} onChange={(e) => patch(it.key, { partNumber: e.target.value })} aria-label={`Part number of ${itemTag(it) || it.key}`} placeholder="unreadable" className={input} />
                        {part && <div className={`text-[10px] ${inCatalog ? 'text-green-700' : 'text-amber-700'}`}>{inCatalog ? 'in the catalog' : 'not in the catalog — kept as read'}</div>}
                      </>}</td>
                      <td className="pr-2 align-top text-steel-600">{it.device ? [it.device.manufacturer, it.device.ratings].filter(Boolean).join(' · ') : it.strip!.terminals.map((t) => `${t.terminal}:${t.wire}`).join(' ')}{it.device?.wires.length ? <div className="text-[10px]">wires {it.device.wires.map((w) => `${w.terminal}:${w.wire}`).join(' ')}</div> : null}</td>
                      <td className="pr-2 align-top text-steel-600">{src.rail ? `${src.rail} / ${src.order}` : 'door / wall'}</td>
                      <td className="pr-2 align-top"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${CONF[src.confidence]}`}>{src.confidence}</span></td>
                      <td className="align-top">
                        <div className="flex gap-1" role="group" aria-label={`Review ${itemTag(it) || it.key}`}>
                          {(['confirmed', 'rejected'] as ReviewStatus[]).map((st) => (
                            <button key={st} type="button" aria-pressed={it.status === st} onClick={() => patch(it.key, { status: it.status === st ? 'pending' : st })}
                              className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${it.status === st ? (st === 'confirmed' ? 'border-green-600 bg-green-600 text-white' : 'border-steel-500 bg-steel-500 text-white') : 'border-steel-300 bg-white text-steel-700'}`}>
                              {st === 'confirmed' ? 'Confirm' : 'Reject'}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {read.reading.unseen.length > 0 && (
            <div className="text-xs text-steel-600"><span className="font-semibold">Not visible in the photos (asked on the Machine description page):</span>
              <ul className="list-disc pl-5">{read.reading.unseen.map((u) => <li key={u}>{u}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {read && (
        <section className={card}>
          <h3 className="text-sm font-semibold text-steel-800">3 · As-built drawings</h3>
          <p className="text-xs text-steel-600">The confirmed devices become the electrical design: the panel layout in the photographed rail order and the bill of materials, marked "as-built from photos — verify".</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={apply} disabled={!counts.confirmed} className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">Make the as-built panel layout and BOM</button>
            {done && <span className="text-xs text-green-800" data-testid="photos-applied">Done: {done}.</span>}
            {done && <Link to="/electrical?tab=cabinet" className="text-xs text-brand-700 underline">Open the drawings</Link>}
            {done && <Link to="/spec#questions-and-answers" className="text-xs text-brand-700 underline">Answer the questions</Link>}
          </div>
        </section>
      )}
    </div>
  );
}
