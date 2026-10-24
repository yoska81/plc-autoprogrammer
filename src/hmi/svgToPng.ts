/** Render an SVG element to a PNG data URL (for HMI screen image downloads). */
export async function svgToPngDataUrl(svg: SVGSVGElement, widthPx: number, heightPx: number): Promise<string> {
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  canvas.getContext('2d')!.drawImage(img, 0, 0, widthPx, heightPx);
  return canvas.toDataURL('image/png');
}
