import type { DrawingContext } from './derive';

/** Placeholder until the cabinet rendering is integrated. */
export default function CabinetPictures({ ctx }: { ctx: DrawingContext | null }) {
  return (
    <div className="flex-1 flex items-center justify-center text-sm text-steel-500">
      {ctx ? 'The cabinet picture is being prepared.' : 'No design yet. Fill in the Design tab and click Generate.'}
    </div>
  );
}
