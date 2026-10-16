/**
 * Engineering-tool chrome: the product block at the top right and the status
 * bar at the bottom.
 */
import type { ReactNode } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

/** Product name block at the top right of the header. */
export function PortalBrand() {
  return (
    <div className="flex flex-col items-end justify-center leading-none pr-1 select-none" aria-label="ISA AUTO PROGRAMMER">
      <span className="text-[11px] font-semibold tracking-[0.12em] text-steel-600 whitespace-nowrap">ISA AUTO PROGRAMMER</span>
      <span className="text-[22px] font-light tracking-[0.18em] text-brand-600 mt-0.5">PORTAL</span>
    </div>
  );
}

/** Status bar: PLC, HMI, revision, review state and the open project. */
export function EditorBar({ projectName, children }: { projectName: string; children?: ReactNode }) {
  return (
    <div className="h-7 flex-shrink-0 bg-[#e3e7ec] border-t border-steel-300 flex items-center gap-4 px-3 text-[11px] text-steel-700 whitespace-nowrap overflow-hidden" data-testid="editor-bar">
      {children}
      <span className="ml-auto flex items-center gap-1"><CheckCircleIcon className="w-4 h-4 text-green-600" /> Project {projectName} opened.</span>
    </div>
  );
}
