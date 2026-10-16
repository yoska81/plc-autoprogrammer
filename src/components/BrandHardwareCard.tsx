import { getPart } from '../electrical/catalog';
import { ALL_PARTS, VENDORS } from '../electrical/catalogs';
import { useVendorPreference } from '../store/useProjectStore';
import type { Need } from '../plc/core/fit';
import { hmiCompatible, platformFit, platformsOf, suggestModules } from '../plc/core/platforms';

const th = 'text-left font-medium text-steel-500 px-3 py-1.5 border-b border-steel-200 bg-steel-50';
const td = 'px-3 py-1.5 border-b border-steel-100 align-top';

/** "2 x 2085-IQ16, 2085-OB16" */
function moduleText(mods: string[]): string {
  const counts = new Map<string, number>();
  for (const m of mods) counts.set(m, (counts.get(m) ?? 0) + 1);
  return [...counts].map(([m, n]) => (n > 1 ? `${n} x ${m}` : m)).join(', ');
}

/**
 * The preferred PLC brands' hardware for this machine, from the verified
 * catalogs: each CPU with the expansion modules it would need, whether it
 * fits (same reasons as the CLICK chooser), and which touch panels can talk
 * to it. A comparison for quotes; the program is still written for CLICK
 * until programming support for the brand is added.
 */
export default function BrandHardwareCard({ need }: { need: Need }) {
  const pref = useVendorPreference();
  const plcVendors = pref.plc.filter((v) => v !== 'automationdirect');
  const platforms = platformsOf(plcVendors);
  if (!platforms.length) return null;
  const hmiVendors = pref.hmi.filter((v) => v !== 'automationdirect');
  const hmis = ALL_PARTS.filter((p) => p.category === 'hmi' && (hmiVendors as string[]).includes(p.vendor ?? 'automationdirect') && p.ratings.sizeIn !== undefined);
  return (
    <section className="bg-white border border-steel-200" aria-label="Preferred PLC brands for this machine">
      <div className="px-3 py-2 bg-[#e9edef] border-b border-steel-200">
        <h4 className="text-xs font-semibold text-steel-700">{plcVendors.map((v) => VENDORS.find((x) => x.id === v)?.name).join(' / ')} hardware for this machine</h4>
        <p className="text-[11px] text-steel-600">From the verified catalogs: the expansion modules each CPU would need for {need.digitalInputs} inputs / {need.digitalOutputs} outputs{need.analogInputs || need.analogOutputs ? ` / ${need.analogInputs} analog in / ${need.analogOutputs} analog out` : ''}. For comparison and quotes — the program is still written for the CLICK selection below.</p>
      </div>
      {platforms.map((pl) => (
        <div key={pl.id} className="border-b border-steel-200 last:border-b-0">
          <div className="px-3 pt-2 text-sm font-semibold text-steel-800">{pl.name} <span className="font-normal text-xs text-steel-500">· {pl.protocols.join(' / ')}</span></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>{['CPU', 'Expansion modules needed', 'Fits this machine?'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {pl.cpus.map((c) => {
                  const mods = suggestModules(pl, c, need);
                  const f = platformFit(pl, c, mods, need);
                  return (
                    <tr key={c} className={f.ok ? '' : 'text-steel-400 bg-steel-50/60'} data-cpu={c}>
                      <td className={td}><div className="font-mono">{c}</div><div className="text-xs text-steel-500">{getPart(c)?.description}</div></td>
                      <td className={`${td} font-mono text-xs`}>{mods.length ? moduleText(mods) : <span className="font-sans text-steel-500">none (built-in I/O)</span>}</td>
                      <td className={`${td} text-xs`}>{f.ok ? <span className="text-green-700">Yes · {f.spareIn} in / {f.spareOut} out spare</span> : f.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hmis.length > 0 && (
            <p className="px-3 py-1.5 text-xs text-steel-600">Touch panels: {hmis.map((h) => {
              const c = hmiCompatible(pl, h);
              return <span key={h.partNumber} className={`mr-3 ${c.ok ? '' : 'text-steel-400 line-through'}`} title={c.reason ?? 'Can talk to this PLC'}>{h.partNumber} ({h.ratings.sizeIn}")</span>;
            })}</p>
          )}
          <p className="px-3 pb-2 text-xs text-steel-500">{pl.notes}</p>
        </div>
      ))}
    </section>
  );
}
