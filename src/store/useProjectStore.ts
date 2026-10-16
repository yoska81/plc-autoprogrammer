import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProjectStore {
  /** Selected PLC profile id (see src/plc/profiles). */
  plcId: string;
  cpuId: string;
  setPlc: (plcId: string, cpuId: string) => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      plcId: 'click',
      cpuId: '',
      setPlc: (plcId, cpuId) => set({ plcId, cpuId }),
    }),
    { name: 'plc-project-store' }
  )
);
