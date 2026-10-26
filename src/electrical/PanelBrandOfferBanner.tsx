import { useProjectStore } from '../store/useProjectStore';
import { panelBrandOffer, panelCategoryLabel, withPanelBrand } from './panelBrandOffer';

/**
 * Offer, never automatic: "Use Siemens for panel parts too". onAccept gets the change to make: the page asks first
 * when a design exists (re-picking the parts replaces hand edits), then applies it and re-runs the design. "No thanks"
 * is remembered for this project.
 */
export default function PanelBrandOfferBanner({ specText, onAccept }: { specText: string; onAccept: (makerName: string, apply: () => void) => void }) {
  const plcId = useProjectStore((s) => s.plcId);
  const info = useProjectStore((s) => s.info);
  const setInfo = useProjectStore((s) => s.setInfo);
  const offer = panelBrandOffer(plcId, specText, info.vendors, info.brandOfferDismissed ?? []);
  if (!offer) return null;
  const accept = () => onAccept(offer.name, () => setInfo({ vendors: withPanelBrand(info.vendors, offer.vendor) }));
  const dismiss = () => setInfo({ brandOfferDismissed: [...new Set([...(info.brandOfferDismissed ?? []), offer.vendor])] });
  return (
    <section data-testid="panel-brand-offer" aria-label="Panel parts brand" className="mx-6 mt-3 rounded border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-steel-800">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1">
          {offer.from === 'plc' ? `The PLC is ${offer.name}` : `The machine description asks for a ${offer.name} PLC`}, but the panel parts (pushbuttons, contactors, breakers, power supply…) are AutomationDirect because no brand was chosen for them.
          <span className="text-steel-600"> Anything {offer.name} has no match for in the catalog stays AutomationDirect{offer.stillDefault.length > 0 ? ` (no ${offer.stillDefault.map(panelCategoryLabel).join(', ')} at all)` : ''}.</span>
        </span>
        <button onClick={accept} className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded hover:bg-brand-700">Use {offer.name} for panel parts too</button>
        <button onClick={dismiss} className="px-3 py-1.5 text-sm border border-steel-300 rounded hover:bg-white">No thanks</button>
      </div>
    </section>
  );
}
