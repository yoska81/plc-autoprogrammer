/**
 * Pictures behind HMI screens: an uploaded photo / screenshot / drawing is scaled
 * down to the panel resolution and kept as a data URL in the project.
 */

/** Above this the project gets heavy for browser storage (all projects share ~5 MB). */
export const BACKGROUND_WARN_BYTES = 1024 * 1024;

export interface LoadedPicture {
  src: string;
  /** Size of the stored data in bytes. */
  bytes: number;
  width: number;
  height: number;
  /** Plain-English warning, e.g. when the picture is still large after scaling. */
  warning?: string;
}

const ACCEPTED = /^image\/(png|jpe?g|webp|gif|bmp|svg\+xml)$/;

/** Read an image file and scale it down so it just covers a widthPx × heightPx panel. */
export async function loadPicture(file: File, widthPx: number, heightPx: number): Promise<LoadedPicture> {
  if (!ACCEPTED.test(file.type)) throw new Error(`"${file.name}" is not a picture. Use a PNG, JPG, WebP, GIF, BMP or SVG file.`);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => { throw new Error(`"${file.name}" could not be opened as a picture.`); });
    const iw = img.naturalWidth || widthPx;
    const ih = img.naturalHeight || heightPx;
    // Enough pixels to cover the panel (also for "fill"), never more than the original.
    const scale = Math.min(1, Math.max(widthPx / iw, heightPx / ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    // Screenshots stay sharpest as PNG, photos are much smaller as JPEG: keep the smaller one.
    const png = canvas.toDataURL('image/png');
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const jpg = canvas.toDataURL('image/jpeg', 0.85);
    const src = png.length <= jpg.length * 1.15 ? png : jpg;
    const bytes = Math.round((src.length - src.indexOf(',') - 1) * 0.75);
    const warning = bytes > BACKGROUND_WARN_BYTES
      ? `This picture is ${(bytes / 1024 / 1024).toFixed(1)} MB even after scaling to ${w}×${h}. Projects are stored in this browser with limited room; a simpler picture keeps the project small.`
      : undefined;
    return { src, bytes, width: w, height: h, warning };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The background as it lies on the panel (fit / fill / stretch, no dimming), as a
 * W×H JPEG: what the AI sees when it recreates a screen, so its coordinates are panel pixels.
 */
export async function panelImage(bg: { src: string; fit: 'fit' | 'fill' | 'stretch'; offsetX?: number; offsetY?: number; zoom?: number }, widthPx: number, heightPx: number): Promise<string> {
  const img = new Image();
  img.src = bg.src;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, widthPx, heightPx);
  const iw = img.naturalWidth, ih = img.naturalHeight;
  // Same box as the screen view: zoom around the centre, then the Move offset.
  const z = bg.zoom && bg.zoom > 0 ? bg.zoom : 1;
  const bw = widthPx * z, bh = heightPx * z;
  const bx = (widthPx - bw) / 2 + (bg.offsetX ?? 0), by = (heightPx - bh) / 2 + (bg.offsetY ?? 0);
  if (bg.fit === 'stretch') {
    ctx.drawImage(img, bx, by, bw, bh);
  } else {
    const s = bg.fit === 'fill' ? Math.max(bw / iw, bh / ih) : Math.min(bw / iw, bh / ih);
    const w = iw * s, h = ih * s;
    ctx.save();
    ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
    ctx.drawImage(img, bx + (bw - w) / 2, by + (bh - h) / 2, w, h);
    ctx.restore();
  }
  return canvas.toDataURL('image/jpeg', 0.9);
}

/** Where the background picture box sits after Move & zoom (zoom around the panel centre, then shift). */
export function bgBox(bg: { offsetX?: number; offsetY?: number; zoom?: number }, w: number, h: number) {
  const z = bg.zoom && bg.zoom > 0 ? bg.zoom : 1;
  return { x: (w - w * z) / 2 + (bg.offsetX ?? 0), y: (h - h * z) / 2 + (bg.offsetY ?? 0), width: w * z, height: h * z };
}

/** Where a fit / stretch background's picture is drawn (panel pixels), for an iw×ih picture. */
export function pictureRect(bg: { fit: 'fit' | 'fill' | 'stretch'; offsetX?: number; offsetY?: number; zoom?: number }, w: number, h: number, iw: number, ih: number) {
  const box = bgBox(bg, w, h);
  if (bg.fit === 'stretch' || !(iw > 0 && ih > 0)) return { x: box.x, y: box.y, w: box.width, h: box.height };
  const s = bg.fit === 'fill' ? Math.max(box.width / iw, box.height / ih) : Math.min(box.width / iw, box.height / ih);
  return { x: box.x + (box.width - iw * s) / 2, y: box.y + (box.height - ih * s) / 2, w: iw * s, h: ih * s };
}

/** "Use as background" for a picture element: a "fit" background whose picture lies where the element was. */
export function backgroundAt(rect: { x: number; y: number; w: number; h: number }, w: number, h: number) {
  // A fitted picture fills the width when it is wider (relative to the screen) than tall.
  const zoom = rect.w / rect.h >= w / h ? rect.w / w : rect.h / h;
  return { fit: 'fit' as const, zoom: Math.round(zoom * 1000) / 1000, offsetX: Math.round(rect.x + rect.w / 2 - w / 2), offsetY: Math.round(rect.y + rect.h / 2 - h / 2) };
}

/** Natural size of a picture (data URL). */
export async function pictureSize(src: string): Promise<{ width: number; height: number }> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return { width: img.naturalWidth, height: img.naturalHeight };
}

/** The picture of a "fill" background cropped to the screen, as it is shown (transparent PNG). */
export async function croppedBackground(bg: { src: string; fit: 'fit' | 'fill' | 'stretch'; offsetX?: number; offsetY?: number; zoom?: number }, w: number, h: number): Promise<string> {
  const img = new Image();
  img.src = bg.src;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const box = bgBox(bg, w, h);
  const r = pictureRect(bg, w, h, img.naturalWidth, img.naturalHeight);
  ctx.beginPath(); ctx.rect(box.x, box.y, box.width, box.height); ctx.clip();
  ctx.drawImage(img, r.x, r.y, r.w, r.h);
  return canvas.toDataURL('image/png');
}
