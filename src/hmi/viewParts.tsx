import type { HmiElement } from './types';
import { fitSize, fitText, type HmiTheme } from './theme';

/** Text centred in the element, shrunk (then shortened) to fit. */
export function Label({ el, t, children, color, size, weight = 500, spacing = 1.5, dy = 0, dx = 0, maxW }: {
  el: HmiElement; t: HmiTheme; children: string; color?: string; size?: number; weight?: number; spacing?: number; dy?: number; dx?: number; maxW?: number;
}) {
  const ls = t.ls(spacing);
  const w = maxW ?? el.w - 16;
  const fs = fitSize(children, w, size ?? Math.max(11, Math.min(18, el.h * 0.3)), 10, ls);
  return (
    <text x={el.x + el.w / 2 + dx} y={el.y + el.h / 2 + dy} fill={color ?? t.text} fontSize={fs} fontFamily={t.font} fontWeight={weight} letterSpacing={ls}
      textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none' }}>{fitText(children, w, fs, ls)}</text>
  );
}
