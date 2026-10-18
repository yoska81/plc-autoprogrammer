/**
 * Does the machine have a touch panel? One rule for the HMI page, the stages, "Update all",
 * the design review and the deliverables.
 *
 * The project's panel is the equipment choice (useHmiStore.hmiPartNumber) and nothing else; an
 * HMI design's own hmiPartNumber only says which resolution its screens were laid out for. A
 * machine has no touch panel when the equipment was chosen with "No touch panel": screens left
 * from an earlier panel are then kept but not used (not regenerated, not exported). Before the
 * equipment is chosen the panel is simply not decided yet, which is not the same thing.
 */
import { useHmiStore } from '../store/useHmiStore';
import { useStageStore } from '../store/useStageStore';

/** True for a machine built without a touch panel (pushbuttons, selector and lamps only). */
export const noTouchPanel = (s: { equipmentChosen: boolean; hmiPartNumber: string | null | undefined }) => s.equipmentChosen && !s.hmiPartNumber;

/** noTouchPanel from the stores. */
export const noTouchPanelNow = () =>
  noTouchPanel({ equipmentChosen: Boolean(useStageStore.getState().sources.equipment), hmiPartNumber: useHmiStore.getState().hmiPartNumber });

/** noTouchPanel as a React hook. */
export function useNoTouchPanel(): boolean {
  const equipmentChosen = useStageStore((s) => Boolean(s.sources.equipment));
  const hmiPartNumber = useHmiStore((s) => s.hmiPartNumber);
  return noTouchPanel({ equipmentChosen, hmiPartNumber });
}

/** The HMI design that is in use: none on a machine without a touch panel (leftover screens are ignored). */
export const activeHmiDesign = () => (noTouchPanelNow() ? null : useHmiStore.getState().design);

/** activeHmiDesign as a React hook. */
export function useActiveHmiDesign() {
  const noHmi = useNoTouchPanel();
  const design = useHmiStore((s) => s.design);
  return noHmi ? null : design;
}

/** The project's touch panel part number: the design's panel, else the chosen one; null on a machine without a touch panel. */
const panelPart = (noHmi: boolean, s: { design: { hmiPartNumber: string } | null; hmiPartNumber: string }) => (noHmi ? null : s.design?.hmiPartNumber || s.hmiPartNumber || null);
export const projectPanelPartNow = () => panelPart(noTouchPanelNow(), useHmiStore.getState());
export function useProjectPanelPart(): string | null {
  const noHmi = useNoTouchPanel();
  return useHmiStore((s) => panelPart(noHmi, s));
}
