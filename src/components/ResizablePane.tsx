import { useCallback, useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

const read = (key: string): number | null => {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};

interface Props {
  /** Remembered per browser under this id. */
  id: string;
  defaultSize: number;
  min?: number;
  max?: number;
  /** Which edge carries the drag handle: 'right' for a left-hand pane, 'left' for a right-hand pane. */
  handle?: 'right' | 'left';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Fill the free width instead (no splitter): a phone shows the pane on its own. */
  fill?: boolean;
  /** Extra attributes for the pane when it fills (a phone tab panel's role and ids). */
  panel?: HTMLAttributes<HTMLDivElement>;
}

/**
 * A panel whose width the user drags, like a Windows splitter. The width is
 * remembered; double-click the divider to go back to the default width.
 */
export default function ResizablePane({ id, defaultSize, min = 160, max = 1400, handle = 'right', className = '', style, children, fill, panel }: Props) {
  const key = `pane-width:${id}`;
  const [width, setWidth] = useState(() => read(key) ?? defaultSize);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; w: number } | null>(null);

  const clamp = useCallback((w: number) => Math.max(min, Math.min(max, w, window.innerWidth - 120)), [min, max]);

  useEffect(() => {
    try { localStorage.setItem(key, String(Math.round(width))); } catch { /* storage blocked */ }
  }, [key, width]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, w: width };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    setWidth(clamp(start.current.w + (handle === 'right' ? dx : -dx)));
  };
  const end = () => { start.current = null; setDragging(false); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 10;
    const grow = handle === 'right' ? 'ArrowRight' : 'ArrowLeft';
    const shrink = handle === 'right' ? 'ArrowLeft' : 'ArrowRight';
    if (e.key === grow) { e.preventDefault(); setWidth((w) => clamp(w + step)); }
    if (e.key === shrink) { e.preventDefault(); setWidth((w) => clamp(w - step)); }
  };

  if (fill) return <div {...panel} className={`relative flex-1 min-w-0 ${className}`} style={style}>{children}</div>;
  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ ...style, width }}>
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Drag to resize"
        aria-valuenow={Math.round(width)}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={() => setWidth(clamp(defaultSize))}
        onKeyDown={onKeyDown}
        className={`group absolute top-0 bottom-0 z-30 w-[7px] cursor-col-resize outline-none ${handle === 'right' ? '-right-[4px]' : '-left-[4px]'}`}
      >
        <div className={`mx-auto h-full w-[3px] transition-colors ${dragging ? 'bg-brand-500' : 'bg-transparent group-hover:bg-brand-400 group-focus-visible:bg-brand-400'}`} />
      </div>
      {/* Keep the pointer from selecting text or entering iframes while dragging. */}
      {dragging && <div className="fixed inset-0 z-20 cursor-col-resize" />}
    </div>
  );
}
