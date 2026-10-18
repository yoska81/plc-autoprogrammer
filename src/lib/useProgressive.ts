import { useEffect, useState } from 'react';

/**
 * How many items of a long list to draw: `first` at once, then `step` more each time the browser is
 * idle, up to `total` (a long ladder opens without blocking the page; everything is drawn in the end).
 */
export function useProgressiveCount(total: number, first: number, step = 30): number {
  const [drawn, setDrawn] = useState(0);
  const shown = Math.min(total, Math.max(first, drawn));
  useEffect(() => {
    if (shown >= total) return;
    const next = () => setDrawn((d) => Math.max(d, first) + step);
    if (typeof requestIdleCallback === 'function') { const h = requestIdleCallback(next, { timeout: 300 }); return () => cancelIdleCallback(h); }
    const h = setTimeout(next, 16);
    return () => clearTimeout(h);
  }, [shown, total, first, step]);
  return shown;
}
