/**
 * On a phone a workspace shows one of its panes at a time: this strip picks which one. The strip
 * scrolls sideways when the tab names do not fit.
 */
export default function PhoneTabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void; label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex shrink-0 overflow-x-auto border-b border-steel-200 bg-white" data-phone-tabs="">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm border-b-2 -mb-px ${value === t.id ? 'border-brand-600 font-medium text-steel-900' : 'border-transparent text-steel-500'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
