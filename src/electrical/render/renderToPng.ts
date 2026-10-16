/**
 * Off-screen PNG of the cabinet render for reports: renders CabinetRender into a hidden
 * container, serialises the SVG, rasterises it on a canvas and returns a PNG data URL.
 */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { DrawingContext } from '../derive';
import CabinetRender from './CabinetRender';

export async function cabinetPng(
  ctx: DrawingContext,
  view: 'inside' | 'door',
  hmiPartNumber: string | null = null,
  widthPx = 1600,
): Promise<string> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1200px;height:1200px;overflow:hidden;pointer-events:none;opacity:0;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(CabinetRender, { ctx, view, hmiPartNumber })));
    const svg = host.querySelector('svg');
    if (!svg) throw new Error('Cabinet render produced no SVG');
    const vb = svg.viewBox.baseVal;
    const w = Math.max(1, Math.round(widthPx));
    const h = Math.max(1, Math.round((w * vb.height) / vb.width));
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.removeAttribute('class');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const xml = new XMLSerializer().serializeToString(clone);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not rasterise the cabinet render'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('Canvas 2D context unavailable');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } finally {
    root.unmount();
    host.remove();
  }
}
