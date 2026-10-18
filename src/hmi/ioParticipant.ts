/**
 * The HMI follows I/O address changes (src/plc/core/ioChange.ts): Dev 5's remapHmiDesign moves every binding,
 * tag and alarm with its point; an element on a deleted point is unbound and marked. hmiUsesOf feeds the
 * "delete this I/O point?" confirmation; Undo puts the design back.
 */
import { registerIoParticipant } from '../plc/core/ioChange';
import { useHmiStore } from '../store/useHmiStore';
import { hmiUsesOf, remapHmiDesign } from './ioRemap';

registerIoParticipant({
  name: 'HMI',
  apply: (r, describe) => {
    const d = useHmiStore.getState().design;
    if (!d) return [];
    const { design, notes } = remapHmiDesign(d, r, describe);
    if (design !== d) useHmiStore.setState({ design });
    return notes.map((n) => `HMI: ${n}`);
  },
  usesOf: (address) => hmiUsesOf(useHmiStore.getState().design, address),
  snapshot: () => {
    const design = useHmiStore.getState().design;
    return () => useHmiStore.setState({ design });
  },
});
