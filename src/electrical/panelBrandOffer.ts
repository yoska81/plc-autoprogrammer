/**
 * "Use Siemens for panel parts too": a project whose PLC (or the PLC its description names) is from a maker that
 * also sells panel parts, while the panel parts come from the default brand because nobody chose one. The Electrical
 * page offers to switch the panel parts to the PLC's maker; it never switches on its own.
 */
import { PLC_PROFILES } from '../plc/core/profiles';
import { requestedProfiles, vendorOf } from '../spec/brand';
import { fallbackCategories, groupsOf, normalizePreference, vendorById, type VendorPreference } from './catalogs';
import type { CatalogCategory, VendorId } from './types';

export interface PanelBrandOffer {
  vendor: VendorId;
  name: string;
  /** Where the maker comes from: the project's PLC, or the machine description (no PLC of that maker chosen yet). */
  from: 'plc' | 'description';
  /** Panel-part categories the maker does not offer: they stay with the default brand. */
  stillDefault: CatalogCategory[];
}

const PANEL_LABEL: Partial<Record<CatalogCategory, string>> = {
  disconnect: 'disconnects', breaker: 'breakers', fuse: 'fuses', powerSupply: 'power supplies', contactor: 'contactors', overload: 'overloads',
  motorProtector: 'motor protectors', relay: 'relays', safetyRelay: 'safety relays', terminal: 'terminals', terminalAccessory: 'terminal accessories',
  pushbutton: 'pushbuttons', estop: 'E-stops', pilotLight: 'pilot lights', selector: 'selector switches', stackLight: 'stack lights',
  dinRail: 'DIN rail', wireDuct: 'wire duct', groundBar: 'ground bars', fan: 'fans',
};
export const panelCategoryLabel = (c: CatalogCategory) => PANEL_LABEL[c] ?? c;

/**
 * The offer, or null: when the panel brand was chosen (any choice is kept), the maker is the default brand, the
 * maker sells no panel parts, or the user said no to this maker.
 */
export function panelBrandOffer(plcId: string, specText: string, saved: Partial<VendorPreference> | undefined, dismissed: readonly string[] = []): PanelBrandOffer | null {
  if (saved?.panel?.length) return null;
  const profile = PLC_PROFILES.find((p) => p.id === plcId);
  let maker = profile ? vendorOf(profile) : '';
  let from: PanelBrandOffer['from'] = 'plc';
  if (!maker || maker === 'automationdirect') {
    const named = requestedProfiles(specText, []).map(vendorOf).find((v) => v && v !== 'automationdirect');
    maker = named ?? '';
    from = 'description';
  }
  if (!maker || maker === 'automationdirect' || dismissed.includes(maker)) return null;
  const vendor = maker as VendorId;
  if (!groupsOf(vendor).includes('panel')) return null;
  const next = normalizePreference({ ...saved, panel: [vendor] });
  const stillDefault = fallbackCategories(next).filter((c) => c in PANEL_LABEL);
  return { vendor, name: vendorById(vendor)?.name ?? vendor, from, stillDefault };
}

/** The saved preference with the panel parts from the offer's maker (every other group as it was). */
export const withPanelBrand = (saved: Partial<VendorPreference> | undefined, vendor: VendorId): Partial<VendorPreference> => ({ ...saved, panel: [vendor] });
