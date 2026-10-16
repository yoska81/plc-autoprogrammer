import { Link } from 'react-router-dom';
import { openCounts, useReviewStore } from './useReviewStore';

function useBlocking() {
  return useReviewStore((s) => {
    const c = openCounts(s);
    return `${c.critical}:${c.major}`;
  }).split(':').map(Number) as [number, number];
}

/** Count of open critical + major findings for the project tree (nothing when clean). */
export function ReviewTreeBadge() {
  const [critical, major] = useBlocking();
  if (!critical && !major) return null;
  return (
    <span title={`${critical} critical, ${major} major open design review findings`} aria-label={`${critical + major} open critical or major findings`}
      className={`ml-auto rounded-full px-1.5 text-[10px] font-bold leading-4 ${critical ? 'bg-red-600 text-white' : 'bg-amber-500 text-amber-950'}`}>
      {critical + major}
    </span>
  );
}

/** Status bar item: open critical / major findings, links to the review. */
export function ReviewStatus() {
  const [critical, major] = useBlocking();
  return (
    <Link to="/review" className={`hover:underline ${critical ? 'text-red-300 font-semibold' : major ? 'text-amber-300' : ''}`} title="Design review: open findings">
      Review: {critical || major ? `${critical} critical · ${major} major open` : 'no critical/major open'}
    </Link>
  );
}
