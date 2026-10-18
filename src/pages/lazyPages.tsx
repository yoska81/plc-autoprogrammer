import { lazy } from 'react';

/** Every page as its own chunk, loaded when it is first opened: the app starts with the shell and the stores only. */
export const IOPage = lazy(() => import('../pages/IOPage.tsx'));
export const ProgramPage = lazy(() => import('../plc/pages/ProgramPage.tsx'));
export const ExportPage = lazy(() => import('../pages/ExportPage.tsx'));
export const SettingsPage = lazy(() => import('../pages/SettingsPage.tsx'));
export const ProjectDataPage = lazy(() => import('../pages/ProjectDataPage.tsx'));
export const PlcSetupPage = lazy(() => import('../plc/pages/PlcSetupPage.tsx'));
export const PrintPage = lazy(() => import('../plc/pages/PrintPage.tsx'));
export const ImportPage = lazy(() => import('../pages/ImportPage.tsx'));
export const ElectricalPage = lazy(() => import('../pages/ElectricalPage.tsx'));
export const PrintElectricalPage = lazy(() => import('../pages/PrintElectricalPage.tsx'));
export const SpecPage = lazy(() => import('../pages/SpecPage.tsx'));
export const HmiPage = lazy(() => import('../pages/HmiPage.tsx'));
export const ReviewPage = lazy(() => import('../review/ReviewPage.tsx'));
export const SimulatePage = lazy(() => import('../plc/pages/SimulatePage.tsx'));
export const OnlinePage = lazy(() => import('../online/OnlinePage.tsx'));
export const EquipmentPage = lazy(() => import('../pages/EquipmentPage.tsx'));
export const NewProjectPage = lazy(() => import('../pages/NewProjectPage.tsx'));
