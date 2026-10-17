import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ShopRates } from './buildTime';

/**
 * The shop's own build-time rates and hourly labour rate, kept in this browser for every project
 * (they describe the shop, not the machine). Keys not set use the defaults in buildTime.ts.
 */
interface ShopRatesStore {
  rates: ShopRates;
  /** USD per hour; 0 = no labour cost shown. */
  hourlyRate: number;
  setRate: (key: string, value: number) => void;
  setHourlyRate: (value: number) => void;
  reset: () => void;
}

export const useShopRatesStore = create<ShopRatesStore>()(
  persist(
    (set) => ({
      rates: {},
      hourlyRate: 0,
      setRate: (key, value) => set((s) => ({ rates: { ...s.rates, [key]: value } })),
      setHourlyRate: (hourlyRate) => set({ hourlyRate }),
      reset: () => set({ rates: {}, hourlyRate: 0 }),
    }),
    { name: 'plc-shop-rates' },
  ),
);

/** Rates for exports outside React. */
export function shopRates(): { rates: ShopRates; hourlyRate: number } {
  const { rates, hourlyRate } = useShopRatesStore.getState();
  return { rates, hourlyRate };
}
