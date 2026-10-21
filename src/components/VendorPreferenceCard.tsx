import { useMemo } from 'react';
import { CATALOG_GROUPS_NOTE, GROUP_TITLE, VENDORS, fallbackCategories, groupOfPart, groupsOf, type VendorGroup } from '../electrical/catalogs';
import type { VendorId } from '../electrical/types';
import { useProjectStore, useVendorPreference } from '../store/useProjectStore';
import { hasPlcProfile, plcPreferenceOf, vendorOf } from '../spec/brand';
import { useHmiStore } from '../store/useHmiStore';
import { getPart } from '../electrical/catalog';
import { getProfile } from '../plc/core/profiles';

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
 * Brand for one group: a dropdown like "Use one brand for everything", listing
 * every brand that offers parts for the group. A project saved with several
 * brands in the group keeps them until another brand is picked.
 */
function BrandSelect({ group, chosen, onChange }: { group: VendorGroup; chosen: VendorId[]; onChange: (ids: VendorId[]) => void }) {
  const title = GROUP_TITLE[group];
  // A brand the project uses although the catalog has no parts of it in this group yet (a Yaskawa MP controller
  // read from the machine's program) is listed too, so the row shows it instead of the first brand.
  const offered = useMemo(() => VENDORS.filter((v) => groupsOf(v.id).includes(group) || chosen.includes(v.id)), [group, chosen]);
  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      <select aria-label={`Brand for ${title}`} value={chosen[0]} onChange={(e) => onChange([e.target.value as VendorId])}
        className="w-64 max-w-full border border-steel-300 rounded px-1.5 py-0.5 text-xs">
        {offered.map((v) => {
          const n = partsInGroup(v.id, group);
          return <option key={v.id} value={v.id}>{nameOf(v.id, group)}{n > 0 ? ` · ${n} parts` : ''}</option>;
        })}
      </select>
      {chosen.length > 1 && <span className="text-xs text-steel-500">also: {chosen.slice(1).map((id) => nameOf(id, group)).join(', ')}</span>}
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
  // Only the groups the user chose are saved: a group left alone stays unset (the default), so editing the sensors
  // never writes a PLC preference (which would move a Siemens or Logix project back to CLICK).
  const saved = useProjectStore((s) => s.info.vendors);
  const setGroup = (g: VendorGroup, ids: VendorId[]) => {
    const next: Partial<Record<VendorGroup, VendorId[]>> = { ...saved };
    if (ids.length) next[g] = ids; else delete next[g];
    setInfo({ vendors: next, ...(g === 'plc' ? { plcChosen: ids.length > 0 } : {}) });
  };
  const setAll = (id: VendorId) => setInfo({
    vendors: Object.fromEntries(GROUPS.filter((g) => groupsOf(id).includes(g)).map((g) => [g, [id]])) as Partial<Record<VendorGroup, VendorId[]>>,
    plcChosen: groupsOf(id).includes('plc'),
  });
  // A PLC or panel brand the user never chose shows what the project uses (a Siemens project: Siemens and its
  // panel's maker), not the untouched default (AutomationDirect CLICK / C-more).
  const plcId = useProjectStore((s) => s.plcId);
  const plcChosen = useProjectStore((s) => s.info.plcChosen);
  const panel = useHmiStore((s) => s.hmiPartNumber);
  const plcVendor = vendorOf(getProfile(plcId)) as VendorId | '';
  const shown = (g: VendorGroup): VendorId[] => {
    if (g === 'plc' && plcVendor && !plcPreferenceOf(saved?.plc, plcChosen).length) return [plcVendor];
    if (g === 'hmi' && !saved?.hmi?.length) {
      const v = panel ? getPart(panel)?.vendor ?? 'automationdirect' : plcVendor;
      if (v) return [v];
    }
    return pref[g];
  };
  const fallback = fallbackCategories(pref);
  return (
    <section className="rounded-lg border border-steel-200 bg-white p-4 space-y-2" aria-label="Preferred brands">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="font-semibold text-steel-900">Preferred brands / customer standard</h3>
        <span className="text-xs text-steel-500">Pick a brand per group; mixed brands are fine, e.g. an Allen-Bradley PLC with ifm sensors and Yaskawa drives.</span>
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
              <BrandSelect group={g} chosen={shown(g)} onChange={(ids) => setGroup(g, ids)} />
            </div>
          </div>
        ))}
      </div>
      {fallback.length > 0 && (
        <p className="text-xs text-steel-500">Not offered by the chosen brands, so AutomationDirect parts are used for: {fallback.join(', ')}.</p>
      )}
      {/* Only brands this tool cannot program yet (Siemens, Allen-Bradley and Unitronics are programmed in their own language). */}
      {pref.plc.some((id) => !hasPlcProfile(id)) && (
        <p className="text-xs rounded bg-amber-50 border border-amber-200 text-amber-900 p-2">The PLC program, I/O addressing and simulator still use the CLICK PLC below until programming support for {pref.plc.filter((id) => !hasPlcProfile(id)).map((id) => nameOf(id)).join(' / ')} is added. The brand's PLC parts are listed in the catalog for the design and the bill of materials.</p>
      )}
      <p className="text-xs text-steel-500">{CATALOG_GROUPS_NOTE} After changing brands, update the electrical design so it uses them.</p>
    </section>
  );
}
