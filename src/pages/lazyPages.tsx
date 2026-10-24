import { createElement, lazy, type ComponentType } from 'react';

type Page = ComponentType & { preload: () => Promise<unknown> };

/**
 * A page as its own chunk, loaded when it is first opened. Once loaded it renders at once (no
 * Suspense step); `preload` loads it ahead (main.tsx loads the page of the start URL before the first
 * render, so a reload shows the page as one render, like before the split).
 */
function page(load: () => Promise<{ default: ComponentType }>): Page {
  let loaded: ComponentType | null = null;
  let pending: Promise<{ default: ComponentType }> | null = null;
  const preload = () => (pending ??= load().then((m) => { loaded = m.default; return m; }));
  const Lazy = lazy(preload);
  const P = (() => createElement(loaded ?? Lazy)) as unknown as Page;
  P.preload = preload;
  return P;
}

/** Every page: the app starts with the shell and the stores only. */
export const IOPage = page(() => import('../pages/IOPage.tsx'));
export const ProgramPage = page(() => import('../plc/pages/ProgramPage.tsx'));
export const ExportPage = page(() => import('../pages/ExportPage.tsx'));
export const SettingsPage = page(() => import('../pages/SettingsPage.tsx'));
export const ProjectDataPage = page(() => import('../pages/ProjectDataPage.tsx'));
export const PlcSetupPage = page(() => import('../plc/pages/PlcSetupPage.tsx'));
export const PrintPage = page(() => import('../plc/pages/PrintPage.tsx'));
export const ImportPage = page(() => import('../pages/ImportPage.tsx'));
export const ElectricalPage = page(() => import('../pages/ElectricalPage.tsx'));
export const PrintElectricalPage = page(() => import('../pages/PrintElectricalPage.tsx'));
export const SpecPage = page(() => import('../pages/SpecPage.tsx'));
export const HmiPage = page(() => import('../pages/HmiPage.tsx'));
export const ReviewPage = page(() => import('../review/ReviewPage.tsx'));
export const SimulatePage = page(() => import('../plc/pages/SimulatePage.tsx'));
export const FlowPage = page(() => import('../plc/flow/FlowPage.tsx'));
export const OnlinePage = page(() => import('../online/OnlinePage.tsx'));
export const EquipmentPage = page(() => import('../pages/EquipmentPage.tsx'));
export const NewProjectPage = page(() => import('../pages/NewProjectPage.tsx'));
export const SourcingPage = page(() => import('../pages/SourcingPage.tsx'));
export const EngineerPage = page(() => import('../pages/EngineerPage.tsx'));
export const CommissioningPage = page(() => import('../commissioning/CommissioningPage.tsx'));
export const RedlinesPage = page(() => import('../redlines/RedlinesPage.tsx'));
export const TestCardPage = page(() => import('../pages/TestCardPage.tsx'));

/** The page of a route path ('/io', '/electrical?tab=cabinet', '#/hmi'). */
const BY_PATH: Record<string, Page> = { '': SpecPage, 'io': IOPage, 'program': ProgramPage, 'export': ExportPage, 'settings': SettingsPage, 'project': ProjectDataPage, 'plc': PlcSetupPage, 'print': PrintPage, 'import': ImportPage, 'electrical': ElectricalPage, 'print-electrical': PrintElectricalPage, 'spec': SpecPage, 'hmi': HmiPage, 'review': ReviewPage, 'simulate': SimulatePage, 'flow': FlowPage, 'online': OnlinePage, 'equipment': EquipmentPage, 'new': NewProjectPage, 'sourcing': SourcingPage, 'engineer': EngineerPage, 'commissioning': CommissioningPage, 'redlines': RedlinesPage, 'upgrade': ImportPage, 'test-card': TestCardPage };
export const preloadRoute = (path: string): Promise<unknown> => BY_PATH[path.replace(/^#?\/?/, '').split(/[/?#]/)[0]]?.preload() ?? Promise.resolve();

/**
 * After start-up, load every page's chunk one by one while the browser is idle, so the first visit to
 * a page doesn't wait for its code (the start stays fast: nothing is loaded before the first paint).
 */
export function preloadPagesWhenIdle(): void {
  const queue = Object.values(BY_PATH);
  const next = () => {
    const p = queue.shift();
    if (!p) return;
    void p.preload().catch(() => {}).then(() => idle(next));
  };
  const idle = (cb: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 200));
  setTimeout(() => idle(next), 1500);
}
