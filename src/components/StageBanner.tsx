import type { ReactNode } from 'react';
import type { StageInfo } from '../spec/useStages';

/** Out-of-date / not-started notice shown at the top of a stage page. */
export default function StageBanner({ info, action, emptyText }: { info: StageInfo; action?: ReactNode; emptyText?: string }) {
  if (info.status === 'ready') return null;
  if (info.status === 'empty' && !emptyText) return null;
  const stale = info.status === 'stale';
  return (
    <div className={`px-6 py-2.5 border-b flex items-center gap-3 text-sm ${stale ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-petrol-50 border-petrol-200 text-petrol-900'}`}>
      <span className="flex-1">{stale ? info.reason : emptyText}</span>
      {action}
    </div>
  );
}
