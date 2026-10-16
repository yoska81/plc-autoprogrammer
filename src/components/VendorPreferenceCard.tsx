import { CATALOG_GROUPS_NOTE, GROUP_TITLE, VENDORS, fallbackCategories, groupsOf, type VendorGroup } from '../electrical/catalogs';
import type { VendorId } from '../electrical/types';
import { useProjectStore, useVendorPreference } from '../store/useProjectStore';

const GROUPS = Object.keys(GROUP_TITLE) as VendorGroup[];

/**
 * "Preferred brands / customer standard": which vendors' parts the design may
 * use, per equipment group. Several brands per group are allowed (e.g. an
 * Allen-Bradley PLC, ifm sensors and Yaskawa drives).
 */
export default function VendorPreferenceCard() {
  const pref = useVendorPreference();
  const setInfo = useProjectStore((s) => s.setInfo);
  const toggle = (g: VendorGroup, id: VendorId) => {
    const cur = pref[g];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setInfo({ vendors: { ...pref, [g]: next.length ? next : ['automationdirect'] } });
  };
  const setAll = (id: VendorId) => setInfo({ vendors: Object.fromEntries(GROUPS.map((g) => [g, groupsOf(id).includes(g) ? [id] : ['automationdirect']])) as Record<VendorGroup, VendorId[]> });
  const fallback = fallbackCategories(pref);
  return (
    <section className="rounded-lg border border-steel-200 bg-white p-4 space-y-3" aria-label="Preferred brands">
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
      <table className="w-full text-sm">
        <tbody>
          {GROUPS.map((g) => {
            const offered = VENDORS.filter((v) => groupsOf(v.id).includes(g));
            return (
              <tr key={g} className="border-t border-steel-100">
                <td className="py-1.5 pr-3 text-steel-700 align-top w-64">{GROUP_TITLE[g]}</td>
                <td className="py-1.5">
                  <div className="flex flex-wrap gap-x-4 gap-y-1" role="group" aria-label={GROUP_TITLE[g]}>
                    {offered.map((v) => (
                      <label key={v.id} className="flex items-center gap-1.5">
                        <input type="checkbox" checked={pref[g].includes(v.id)} onChange={() => toggle(g, v.id)} aria-label={`${GROUP_TITLE[g]}: ${v.name}`} />
                        {v.id === 'automationdirect' && (g === 'plc' || g === 'hmi') ? `${v.name} (${g === 'plc' ? 'CLICK' : 'C-more'})` : v.name}{pref[g].length > 1 && pref[g][0] === v.id && <span className="text-[11px] text-steel-400">(first choice)</span>}
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {fallback.length > 0 && (
        <p className="text-xs text-steel-500">Not offered by the chosen brands, so AutomationDirect parts are used for: {fallback.join(', ')}.</p>
      )}
      {!pref.plc.includes('automationdirect') && (
        <p className="text-xs rounded bg-amber-50 border border-amber-200 text-amber-900 p-2">The PLC program, I/O addressing and simulator still use the CLICK PLC below until programming support for {pref.plc.map((id) => VENDORS.find((v) => v.id === id)?.name).join(' / ')} is added. The brand's PLC parts are listed in the catalog for the design and the bill of materials.</p>
      )}
      <p className="text-xs text-steel-500">{CATALOG_GROUPS_NOTE} After changing brands, update the electrical design so it uses them.</p>
    </section>
  );
}
