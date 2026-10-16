import { useRef } from 'react';
import { ArrowUturnLeftIcon, ArrowUturnRightIcon, DocumentDuplicateIcon, PhotoIcon, SparklesIcon, TrashIcon } from '@heroicons/react/20/solid';
import { PALETTE, type Align } from './editor';
import type { HmiBackground, HmiElementKind } from './types';

const tool = 'h-7 px-2 inline-flex items-center gap-1 text-[12px] text-steel-800 bg-white border border-steel-300 rounded-sm hover:bg-brand-50 hover:border-brand-300 disabled:opacity-40 disabled:hover:bg-white';
const ALIGNS: [Align, string, string][] = [
  ['left', '⇤', 'Align left edges'], ['hcenter', '↔', 'Align centres (horizontal)'], ['right', '⇥', 'Align right edges'],
  ['top', '⤒', 'Align top edges'], ['vcenter', '↕', 'Align middles (vertical)'], ['bottom', '⤓', 'Align bottom edges'],
];

export interface HmiEditorBarProps {
  selectedCount: number;
  canUndo: boolean;
  canRedo: boolean;
  snap: boolean;
  background: HmiBackground | undefined;
  aiReady: boolean;
  aiBusy: boolean;
  onAdd: (kind: HmiElementKind) => void;
  onAlign: (a: Align) => void;
  onDistribute: (axis: 'h' | 'v') => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSnap: (on: boolean) => void;
  onPicture: (file: File) => void;
  /** Add a picture as a movable element. */
  onAddPicture: (file: File) => void;
  onRestack: (to: 'front' | 'back') => void;
  /** Selected element is a picture: turn it into the screen background. */
  selectedIsPicture: boolean;
  onPictureToBackground: () => void;
  onBackgroundToPicture: () => void;
  hint: string | null;
  onBackground: (patch: Partial<HmiBackground> | null) => void;
  onRecreate: () => void;
  onDone: () => void;
}

/** Tools of the manual screen editor: add elements, arrange, undo, background picture. */
export default function HmiEditorBar(p: HmiEditorBarProps) {
  const file = useRef<HTMLInputElement>(null);
  const picFile = useRef<HTMLInputElement>(null);
  const bg = p.background;
  return (
    <div className="space-y-1.5 mb-2" role="toolbar" aria-label="Screen editor tools">
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-500 mr-1">Add</span>
        {PALETTE.map((k) => (
          <button key={k.kind} onClick={() => p.onAdd(k.kind)} className={tool} aria-label={`Add ${k.label}`}>+ {k.label}</button>
        ))}
        <input ref={picFile} type="file" accept="image/*" className="hidden" aria-label="Upload a movable picture"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onAddPicture(f); e.target.value = ''; }} />
        <button onClick={() => picFile.current?.click()} className={`${tool} border-brand-500`} aria-label="Add Picture"><PhotoIcon className="w-4 h-4" /> + Picture (movable)</button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button onClick={p.onUndo} disabled={!p.canUndo} className={tool} title="Undo (Ctrl+Z)" aria-label="Undo"><ArrowUturnLeftIcon className="w-4 h-4" /></button>
        <button onClick={p.onRedo} disabled={!p.canRedo} className={tool} title="Redo (Ctrl+Y)" aria-label="Redo"><ArrowUturnRightIcon className="w-4 h-4" /></button>
        <span className="w-px h-5 bg-steel-300 mx-1" />
        <button onClick={p.onDuplicate} disabled={!p.selectedCount} className={tool} title="Duplicate (Ctrl+D)"><DocumentDuplicateIcon className="w-4 h-4" /> Duplicate</button>
        <button onClick={p.onDelete} disabled={!p.selectedCount} className={tool} title="Delete (Del)"><TrashIcon className="w-4 h-4" /> Delete</button>
        <button onClick={() => p.onRestack('front')} disabled={!p.selectedCount} className={tool} title="Draw the selection in front of everything">Bring to front</button>
        <button onClick={() => p.onRestack('back')} disabled={!p.selectedCount} className={tool} title="Draw the selection behind everything (e.g. a picture behind buttons)">Send to back</button>
        {p.selectedIsPicture && <button onClick={p.onPictureToBackground} className={tool} title="Use this picture as the whole-screen background">Use as background</button>}
        <span className="w-px h-5 bg-steel-300 mx-1" />
        {ALIGNS.map(([a, icon, title]) => (
          <button key={a} onClick={() => p.onAlign(a)} disabled={p.selectedCount < 2} className={`${tool} w-7 justify-center`} title={title} aria-label={title}>{icon}</button>
        ))}
        <button onClick={() => p.onDistribute('h')} disabled={p.selectedCount < 3} className={tool} title="Equal gaps left to right">Space across</button>
        <button onClick={() => p.onDistribute('v')} disabled={p.selectedCount < 3} className={tool} title="Equal gaps top to bottom">Space down</button>
        <span className="w-px h-5 bg-steel-300 mx-1" />
        <label className="flex items-center gap-1 text-[12px] text-steel-700"><input type="checkbox" checked={p.snap} onChange={(e) => p.onSnap(e.target.checked)} /> Snap to 8 px grid</label>
        <button onClick={p.onDone} className="ml-auto h-7 px-3 text-[12px] font-medium bg-brand-600 text-brand-950 rounded-sm hover:bg-brand-700">Done editing</button>
      </div>
      {p.hint && <div role="status" className="px-2 py-1 text-[12px] bg-brand-50 border border-brand-300 text-steel-800">{p.hint}</div>}
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-steel-700">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-500">Background picture</span>
        <input ref={file} type="file" accept="image/*" className="hidden" aria-label="Upload background picture"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onPicture(f); e.target.value = ''; }} />
        <button onClick={() => file.current?.click()} className={tool}><PhotoIcon className="w-4 h-4" /> {p.background ? 'Replace picture…' : 'Upload picture…'}</button>
        {p.background && (
          <>
            <span className="truncate max-w-[10rem] text-steel-500" title={p.background.name}>{p.background.name ?? 'picture'}</span>
            <label className="flex items-center gap-1">Fit
              <select value={p.background.fit} onChange={(e) => p.onBackground({ fit: e.target.value as HmiBackground['fit'] })} className="h-7 border border-steel-300 rounded-sm bg-white px-1" aria-label="Picture fit">
                <option value="fit">Fit (whole picture)</option>
                <option value="fill">Fill (crop edges)</option>
                <option value="stretch">Stretch</option>
              </select>
            </label>
            <label className="flex items-center gap-1">Dim
              <input type="range" min={0} max={0.9} step={0.05} value={p.background.dim} onChange={(e) => p.onBackground({ dim: Number(e.target.value) })} aria-label="Dim picture" className="accent-brand-600" />
              <span className="w-8 tabular-nums">{Math.round(p.background.dim * 100)}%</span>
            </label>
            <span className="flex items-center gap-1" title="Move & zoom the background picture">Move
              <input type="range" min={-400} max={400} step={4} value={bg?.offsetX ?? 0} onChange={(e) => p.onBackground({ offsetX: Number(e.target.value) })} aria-label="Move picture left/right" className="w-20 accent-brand-600" />
              <input type="range" min={-300} max={300} step={4} value={bg?.offsetY ?? 0} onChange={(e) => p.onBackground({ offsetY: Number(e.target.value) })} aria-label="Move picture up/down" className="w-20 accent-brand-600" />
            </span>
            <label className="flex items-center gap-1">Zoom
              <input type="range" min={0.25} max={3} step={0.05} value={bg?.zoom ?? 1} onChange={(e) => p.onBackground({ zoom: Number(e.target.value) })} aria-label="Zoom picture" className="w-20 accent-brand-600" />
              <span className="w-10 tabular-nums">{Math.round((bg?.zoom ?? 1) * 100)}%</span>
            </label>
            <button onClick={() => p.onBackground({ offsetX: 0, offsetY: 0, zoom: 1 })} className={tool}>Reset</button>
            <button onClick={p.onBackgroundToPicture} className={tool} title="Turn the background into a picture you can drag and resize">Make it a movable picture</button>
            <button onClick={() => p.onBackground(null)} className={tool}>Remove picture</button>
            <button onClick={p.onRecreate} disabled={!p.aiReady || p.aiBusy} className={`${tool} border-brand-500`} title="The AI places buttons, lamps and values where they are in the picture; you review before anything changes">
              <SparklesIcon className="w-4 h-4 text-brand-800" /> {p.aiBusy ? 'Reading the picture…' : 'Let the AI recreate this screen'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
