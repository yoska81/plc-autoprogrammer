import { useMemo } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useIOStore } from '../store/useIOStore';
import { useProgramStore } from '../store/useProgramStore';
import { getCpu, getProfile } from './profiles';
import { resolveAddresses } from './profile';
import { ioCapacity, moduleSlots } from './modules';

/** Selected PLC, CPU and the project's I/O resolved to PLC addresses. */
export function usePlc() {
  const { plcId, cpuId, modules } = useProjectStore();
  const { projectIO } = useIOStore();
  const tags = useProgramStore((s) => s.ladder.tags);

  return useMemo(() => {
    const profile = getProfile(plcId);
    const cpu = getCpu(profile, cpuId);
    const slots = moduleSlots(modules);
    const addresses = resolveAddresses(profile, cpu, projectIO, slots);
    const ioAddressSet = new Set([...addresses.values()].filter(Boolean));
    // Labels shown under addresses in the ladder: I/O descriptions, then tag nicknames.
    const labels = new Map<string, string>();
    for (const t of tags) labels.set(t.address, t.nickname);
    for (const p of projectIO) {
      const a = addresses.get(p.id);
      if (a && p.description) labels.set(a, p.description);
    }
    return { profile, cpu, io: projectIO, addresses, ioAddressSet, labels, modules: slots, capacity: ioCapacity(cpu, slots) };
  }, [plcId, cpuId, modules, projectIO, tags]);
}
