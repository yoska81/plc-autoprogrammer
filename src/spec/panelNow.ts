/**
 * The project's touch panel: the equipment choice (useHmiStore.hmiPartNumber) and nothing else. A design left
 * from an earlier panel only says what resolution its screens were laid out for. Same rule as Dev 5's
 * src/hmi/projectPanel.ts (same names): switch these imports to it once both branches are in integration.
 */
import { useStageStore } from '../store/useStageStore';
import { useHmiStore } from '../store/useHmiStore';

/** Equipment chosen with "No touch panel" (not just "equipment not chosen yet"). */
export function noTouchPanelNow(): boolean {
  return Boolean(useStageStore.getState().sources.equipment) && !useHmiStore.getState().hmiPartNumber;
}

/** The panel the electrical design draws: null with no touch panel. */
export function projectPanelPartNow(): string | null {
  const h = useHmiStore.getState();
  return noTouchPanelNow() ? null : h.design?.hmiPartNumber || h.hmiPartNumber || null;
}

export function useProjectPanelPart(): string | null {
  const chosen = useStageStore((s) => Boolean(s.sources.equipment));
  return useHmiStore((s) => (chosen && !s.hmiPartNumber ? null : s.design?.hmiPartNumber || s.hmiPartNumber || null));
}
