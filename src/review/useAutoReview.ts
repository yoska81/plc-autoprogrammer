import { useEffect } from 'react';
import { useSpecStore } from '../store/useSpecStore';
import { useIOStore } from '../store/useIOStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useHmiStore } from '../store/useHmiStore';
import { useProgramStore } from '../store/useProgramStore';
import { useProjectStore } from '../store/useProjectStore';
import { useStageStore } from '../store/useStageStore';
import { refreshChecks } from './actions';

const DEBOUNCE_MS = 400;

/**
 * Re-run the deterministic design checks (no AI) whenever any stage changes —
 * spec, I/O, equipment/project data, electrical, HMI, program — and once on start.
 * Mounted once by the app shell.
 */
export function useAutoReview() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        try { refreshChecks(); } catch (e) { console.warn('Design review checks failed', e); }
      }, DEBOUNCE_MS);
    };
    run();
    const unsubs = [useSpecStore, useIOStore, useElectricalStore, useHmiStore, useProgramStore, useProjectStore, useStageStore]
      .map((s) => (s as { subscribe: (l: () => void) => () => void }).subscribe(run));
    return () => { if (timer) clearTimeout(timer); unsubs.forEach((u) => u()); };
  }, []);
}
