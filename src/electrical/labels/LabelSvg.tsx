import { PT, type LabelLayout } from './layout';

/** One label drawn at true size (CSS millimetres) times `zoom`. */
export default function LabelSvg({ lay, border, zoom = 1, title }: { lay: LabelLayout; border: boolean; zoom?: number; title?: string }) {
  const r = Math.min(1.2, Math.min(lay.w, lay.h) * 0.08);
  return (
    <svg width={`${lay.w * zoom}mm`} height={`${lay.h * zoom}mm`} viewBox={`0 0 ${lay.w} ${lay.h}`} className="bg-white shadow-sm flex-shrink-0" role="img" aria-label={title}>
      {title && <title>{title}</title>}
      <rect x={0.05} y={0.05} width={lay.w - 0.1} height={lay.h - 0.1} fill="#fff" stroke="#b8c0cc" strokeWidth={0.1} />
      {lay.printable && <rect x={lay.printable.x} y={lay.printable.y} width={lay.printable.w} height={lay.printable.h} fill="#f6f8fa" stroke="#9aa5b1" strokeWidth={0.15} strokeDasharray="0.8 0.6" />}
      {border && (() => {
        const b = lay.printable ?? { x: 0, y: 0, w: lay.w, h: lay.h };
        return <rect x={b.x + 0.35} y={b.y + 0.35} width={b.w - 0.7} height={b.h - 0.7} rx={r} fill="none" stroke="#000" strokeWidth={0.25} />;
      })()}
      <g transform={lay.rotate ? `translate(0 ${lay.h}) rotate(-90)` : undefined} fontFamily="Helvetica, Arial, sans-serif" fill="#000">
        {lay.runs.map((t, i) => (
          <text key={i} x={t.x} y={t.y} fontSize={t.size * PT} fontWeight={t.bold ? 700 : 400} textAnchor={t.align === 'center' ? 'middle' : 'start'} style={{ whiteSpace: 'pre' }}>{t.text}</text>
        ))}
      </g>
    </svg>
  );
}
