import type { ProjectSnapshot } from './collect';
import { moduleSlots } from '../plc/core/modules';

/** HMI tags passed to the PLC exporters (so the program declares and names them). */
export const hmiExtraTags = (p: ProjectSnapshot) => (p.hmi?.tags ?? []).map((t) => ({ address: t.address, nickname: t.name, comment: `HMI: ${t.description}` }));

/** What the PLC exporters get; the HMI tag list uses the same, so the names match the files. */
export function exportContext(p: ProjectSnapshot) {
  const header = `${p.projectName} — ${p.profile.name} ${p.cpu.id}`;
  return { io: p.io, addresses: p.addresses, labels: p.labels, header, extraTags: hmiExtraTags(p), cpuId: p.cpu.id, modules: moduleSlots(p.modules), projectName: p.projectName };
}
