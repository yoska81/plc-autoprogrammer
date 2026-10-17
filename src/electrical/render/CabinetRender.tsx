/**
 * Realistic, to-scale picture of the control cabinet built from the design.
 *  - view 'inside': open enclosure with back panel, DIN rails, wire duct, every placed device
 *    (positions/sizes from panelLayout), wiring into the ducts, tag plates and the open door.
 *  - view 'door':   closed door with operators, HMI, disconnect handle, warning label, nameplate.
 * Only parts that are in the design are drawn; coordinates are millimetres (SVG viewBox).
 */
import { useId, useMemo } from 'react';
import type { DrawingContext } from '../derive';
import { RenderDefs } from './Defs';
import { DoorView } from './DoorView';
import { InsideView } from './InsideView';
import { buildScene, openDoorPoint } from './scene';

export interface CabinetRenderProps {
  ctx: DrawingContext;
  view: 'inside' | 'door';
  /** HMI chosen on the HMI page (shown on the door when the design itself has no HMI). */
  hmiPartNumber?: string | null;
  /** Engraved device-tag plates (CB1, K1, PS1...). Default true. */
  showLabels?: boolean;
  className?: string;
}

export default function CabinetRender({ ctx, view, hmiPartNumber = null, showLabels = true, className }: CabinetRenderProps) {
  const rawId = useId();
  const p = `cr${rawId.replace(/[^A-Za-z0-9]/g, '')}`;
  const scene = useMemo(() => buildScene(ctx, hmiPartNumber ?? null), [ctx, hmiPartNumber]);
  const { w: W, h: H } = scene.enc;
  const vb = useMemo(() => {
    if (view === 'door') {
      const extra = scene.door.hmiOverflow ? 30 : 0;
      return { x: -40, y: -40, w: W + 80, h: H + 95 + extra };
    }
    // free edge of each open leaf (top and bottom corners): the left one swings left, a right leaf swings right
    const D = scene.door;
    const far = D.leaves.flatMap((l, li) => [0, H].map((v) => openDoorPoint(D, D.leaves.length > 1 && li === 1 ? l.x0 : l.x1, v, li)));
    const x0 = Math.min(0, ...far.map((q) => q.x)) - 40;
    const x1 = Math.max(W, ...far.map((q) => q.x)) + 40;
    const y0 = Math.min(-40, ...far.map((q) => q.y - 25));
    const y1 = Math.max(H + 55, ...far.map((q) => q.y + 25)) + (scene.notShown.length ? 30 : 0);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }, [view, W, H, scene]);
  const label = view === 'door'
    ? `Cabinet door of ${scene.title}: ${scene.door.items.length} door devices`
    : `Inside of ${scene.title}: ${scene.devices.length} devices on the back panel`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className={className}
      width={className ? undefined : '100%'}
      height={className ? undefined : '100%'}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
      fontFamily="Arial, Helvetica, sans-serif"
      style={{ display: 'block' }}
    >
      <RenderDefs p={p} encColor={scene.enc.color} />
      {view === 'door'
        ? <DoorView s={scene} p={p} vb={vb} />
        : <InsideView s={scene} p={p} showLabels={showLabels} vb={vb} />}
    </svg>
  );
}
