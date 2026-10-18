import { useEffect, useState } from 'react';
import { columnCrop, parseSource, sheetPicture, useProjectUploads } from './thumbs';

/** The thumbnail next to a review item (nothing when the source names no sheet or the files are gone). */
export default function SourceThumb({ source }: { source: string }) {
  const files = useProjectUploads();
  const ref = parseSource(source);
  const [shown, setShown] = useState<{ files: File[]; sheet: number; url: string | null } | null>(null);
  const [big, setBig] = useState(false);
  useEffect(() => {
    let live = true;
    if (ref && files.length) void sheetPicture(files, ref.sheet).then((url) => { if (live) setShown({ files, sheet: ref.sheet, url }); });
    return () => { live = false; };
  }, [files, ref?.sheet]); // eslint-disable-line react-hooks/exhaustive-deps
  // a picture of other files or another sheet is not shown while the right one loads
  const url = shown && ref && shown.files === files && shown.sheet === ref.sheet ? shown.url : null;
  if (!url || !ref) return null;
  const crop = columnCrop(ref.column);
  const width = 96;
  const scale = crop ? 1 / (crop.right - crop.left) : 1;
  return (
    <>
      <button type="button" onClick={() => setBig(true)} title={`Open ${source}`} data-testid="source-thumb"
        className="block h-14 overflow-hidden rounded-sm border border-steel-200 bg-white" style={{ width }}>
        <img src={url} alt={`Drawing: ${source}`} style={{ width: width * scale, maxWidth: 'none', marginLeft: crop ? -crop.left * width * scale : 0 }} />
      </button>
      {big && (
        <div role="dialog" aria-label={source} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setBig(false)}>
          <div className="max-h-full max-w-6xl overflow-auto rounded bg-white p-2">
            <p className="mb-1 text-xs text-steel-600">{source}{ref.column ? ` (column ${ref.column} marked)` : ''} · click to close</p>
            <div className="relative">
              <img src={url} alt={`Drawing: ${source}`} className="w-full" />
              {crop && <div className="pointer-events-none absolute inset-y-0 border-2 border-red-500/70 bg-red-500/10" style={{ left: `${crop.left * 100}%`, width: `${(crop.right - crop.left) * 100}%` }} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
