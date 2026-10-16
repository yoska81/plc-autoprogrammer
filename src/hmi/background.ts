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
export async function panelImage(bg: { src: string; fit: 'fit' | 'fill' | 'stretch' }, widthPx: number, heightPx: number): Promise<string> {
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
  if (bg.fit === 'stretch') {
    ctx.drawImage(img, 0, 0, widthPx, heightPx);
  } else {
    const s = bg.fit === 'fill' ? Math.max(widthPx / iw, heightPx / ih) : Math.min(widthPx / iw, heightPx / ih);
    const w = iw * s, h = ih * s;
    ctx.drawImage(img, (widthPx - w) / 2, (heightPx - h) / 2, w, h);
  }
  return canvas.toDataURL('image/jpeg', 0.9);
}
