import { useId, useMemo, useRef, useState } from 'react';
import { CATALOG_GROUPS_NOTE, GROUP_TITLE, VENDORS, fallbackCategories, groupOfPart, groupsOf, type VendorGroup } from '../electrical/catalogs';
import type { VendorId } from '../electrical/types';
import { useProjectStore, useVendorPreference } from '../store/useProjectStore';

const GROUPS = Object.keys(GROUP_TITLE) as VendorGroup[];

/** Short row labels; the full title is the tooltip and the accessible name. */
const SHORT: Record<VendorGroup, string> = {
  plc: 'PLC and I/O', hmi: 'Operator panel (HMI)', drives: 'Motor drives (VFD)',
  panel: 'Panel parts', field: 'Sensors and field devices', enclosure: 'Enclosure',
};

const nameOf = (id: VendorId, g?: VendorGroup) => {
  const n = VENDORS.find((v) => v.id === id)?.name ?? id;
  return id === 'automationdirect' && (g === 'plc' || g === 'hmi') ? `${n} (${g === 'plc' ? 'CLICK' : 'C-more'})` : n;
};

/**
 * Brands chosen for one group: chips (first = first choice) and a searchable,
 * scrollable list to add more. Works for any number of brands.
 */
function BrandPicker({ group, chosen, onChange }: { group: VendorGroup; chosen: VendorId[]; onChange: (ids: VendorId[]) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const title = GROUP_TITLE[group];
  const offered = useMemo(() => VENDORS.filter((v) => groupsOf(v.id).includes(group) && !chosen.includes(v.id)), [group, chosen]);
  const matches = offered.filter((v) => !q.trim() || nameOf(v.id, group).toLowerCase().includes(q.trim().toLowerCase()));
  const add = (id: VendorId) => { onChange([...chosen, id]); setQ(''); setActive(0); inputRef.current?.focus(); };
  const remove = (id: VendorId) => onChange(chosen.filter((x) => x !== id));
  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      {chosen.map((id, i) => (
        <span key={id} className="inline-flex items-center gap-1 rounded-full border border-brand-300 bg-brand-50 pl-2.5 pr-1 py-0.5 text-xs text-steel-800">
          {nameOf(id, group)}{chosen.length > 1 && i === 0 && <span className="text-[10px] text-steel-500">· first choice</span>}
          {chosen.length > 1 && (
            <button type="button" onClick={() => remove(id)} aria-label={`Remove ${nameOf(id)} from ${title}`}
              className="ml-0.5 h-4 w-4 rounded-full text-steel-500 hover:bg-steel-200 hover:text-steel-900 leading-none">×</button>
          )}
        </span>
      ))}
      {offered.length > 0 && (
        <div className="relative">
          <input ref={inputRef} value={q} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
            aria-label={`Add a brand for ${title}`} placeholder="+ Add brand…"
            onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
            onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, matches.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === 'Enter' && matches[active]) { e.preventDefault(); add(matches[active].id); }
              else if (e.key === 'Escape') setOpen(false);
            }}
            className="w-36 rounded border border-steel-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500" />
          {open && (
            <ul id={listId} role="listbox" aria-label={`Brands for ${title}`}
              className="absolute z-20 mt-1 max-h-48 w-56 overflow-y-auto rounded border border-steel-200 bg-white py-1 shadow-lg">
              {matches.length ? matches.map((v, i) => (
                <li key={v.id} role="option" aria-selected={i === active}
                  onMouseDown={(e) => { e.preventDefault(); add(v.id); }} onMouseEnter={() => setActive(i)}
                  className={`cursor-pointer px-2.5 py-1 text-xs ${i === active ? 'bg-brand-50 text-steel-900' : 'text-steel-700'}`}>
                  {nameOf(v.id, group)}{partsInGroup(v.id, group) > 0 && <span className="text-steel-400"> · {partsInGroup(v.id, group)} parts</span>}
                </li>
              )) : <li className="px-2.5 py-1 text-xs text-steel-400">No brand matches “{q}”</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Number of catalog parts a vendor offers in a group (AutomationDirect's C-more panels live in the HMI catalog). */
const partsInGroup = (id: VendorId, g: VendorGroup) => (VENDORS.find((x) => x.id === id)?.parts ?? []).filter((p) => groupOfPart(p) === g).length;

/**
 * "Preferred brands / customer standard": which vendors' parts the design may
 * use, per equipment group. Several brands per group are allowed (e.g. an
 * Allen-Bradley PLC, ifm sensors and Yaskawa drives).
 */
export default function VendorPreferenceCard() {
  const pref = useVendorPreference();
  const setInfo = useProjectStore((s) => s.setInfo);
  const setGroup = (g: VendorGroup, ids: VendorId[]) => setInfo({ vendors: { ...pref, [g]: ids.length ? ids : ['automationdirect'] } });
  const setAll = (id: VendorId) => setInfo({ vendors: Object.fromEntries(GROUPS.map((g) => [g, groupsOf(id).includes(g) ? [id] : ['automationdirect']])) as Record<VendorGroup, VendorId[]> });
  const fallback = fallbackCategories(pref);
  return (
    <section className="rounded-lg border border-steel-200 bg-white p-4 space-y-2" aria-label="Preferred brands">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="font-semibold text-steel-900">Preferred brands / customer standard</h3>
        <span className="text-xs text-steel-500">Mixed brands are fine, e.g. an Allen-Bradley PLC with ifm sensors and Yaskawa drives.</span>
        <label className="ml-auto text-xs text-steel-600 flex items-center gap-1.5">Use one brand for everything
          <select aria-label="One brand for everything" value="" onChange={(e) => e.target.value && setAll(e.target.value as VendorId)}
            className="border border-steel-300 rounded px-1.5 py-0.5 text-xs">
            <option value="">choose…</option>
            {VENDORS.filter((v) => groupsOf(v.id).length > 1).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-[minmax(9rem,12rem)_minmax(0,1fr)] gap-x-3">
        {GROUPS.map((g) => (
          <div key={g} className="contents">
            <div className="py-1.5 text-sm text-steel-700 border-t border-steel-100" title={GROUP_TITLE[g]}>{SHORT[g]}</div>
            <div className="py-1.5 border-t border-steel-100" role="group" aria-label={GROUP_TITLE[g]}>
              <BrandPicker group={g} chosen={pref[g]} onChange={(ids) => setGroup(g, ids)} />
            </div>
          </div>
        ))}
      </div>
      {fallback.length > 0 && (
        <p className="text-xs text-steel-500">Not offered by the chosen brands, so AutomationDirect parts are used for: {fallback.join(', ')}.</p>
      )}
      {!pref.plc.includes('automationdirect') && (
        <p className="text-xs rounded bg-amber-50 border border-amber-200 text-amber-900 p-2">The PLC program, I/O addressing and simulator still use the CLICK PLC below until programming support for {pref.plc.map((id) => nameOf(id)).join(' / ')} is added. The brand's PLC parts are listed in the catalog for the design and the bill of materials.</p>
      )}
      <p className="text-xs text-steel-500">{CATALOG_GROUPS_NOTE} After changing brands, update the electrical design so it uses them.</p>
    </section>
  );
}
