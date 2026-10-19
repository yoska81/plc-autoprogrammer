import { ChevronDownIcon } from '@heroicons/react/20/solid';

/** On a folded phone page header: unfolds it to show the page's buttons again. */
export default function HeaderMore({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={false} title="Show the page buttons"
      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-steel-300 text-steel-700 bg-white hover:bg-steel-50">
      More <ChevronDownIcon className="h-4 w-4" />
    </button>
  );
}
