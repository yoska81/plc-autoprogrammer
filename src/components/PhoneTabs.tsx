import { useRef } from 'react';
import { phonePanelId, phoneTabId } from './phoneTabIds';

/**
 * On a phone a workspace shows one of its panes at a time: this strip picks which one. The strip
 * scrolls sideways when the tab names do not fit. Arrow keys, Home and End move between tabs; each
 * pane carries the matching phonePanel() props.
 */
export default function PhoneTabs<T extends string>({ tabs, value, onChange, label, idBase }: {
  tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void; label: string; idBase: string;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === value);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const t = tabs[(next + tabs.length) % tabs.length];
    onChange(t.id);
    strip.current?.querySelector<HTMLElement>(`#${CSS.escape(phoneTabId(idBase, t.id))}`)?.focus();
  };
  return (
    <div ref={strip} role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex shrink-0 overflow-x-auto border-b border-steel-200 bg-white" data-phone-tabs="">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" id={phoneTabId(idBase, t.id)} aria-controls={phonePanelId(idBase, t.id)}
          aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1} onClick={() => onChange(t.id)}
          className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm border-b-2 -mb-px ${value === t.id ? 'border-brand-600 font-medium text-steel-900' : 'border-transparent text-steel-500'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
