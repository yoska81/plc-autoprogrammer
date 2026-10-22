/**
 * "Send to PLC software", the one button on the Program page: which flow puts the program into the maker's
 * software for the project's PLC (a bridge of the Windows desktop app), and, where there is none, what to do
 * instead, in plain words. The flows: src/plc/ui/SendToTia.tsx, SendToClick.tsx, SendToCodesys.tsx,
 * SendToStudio5000.tsx; the bridges: tools/*-bridge.
 */

/** The bridges of the desktop app (window.isaDesktop.tia / click / codesys / studio5000). */
export type SendRoute = 'tia' | 'click' | 'codesys' | 'studio5000';

export const SEND_ROUTES: Record<string, SendRoute> = {
  'siemens-s7': 'tia',
  click: 'click',
  'generic-st': 'codesys',
  logix: 'studio5000',
};

/** The maker's software, as the user knows it. */
const SOFTWARE: Record<string, string> = {
  'siemens-s7': 'TIA Portal',
  click: 'CLICK Programming Software',
  'generic-st': 'CODESYS',
  logix: 'Studio 5000',
  micro800: 'Connected Components Workbench',
  'unitronics-unistream': 'UniLogic',
  'unitronics-vision': 'VisiLogic',
  'yaskawa-mp': 'MPE720',
};

export const sendRoute = (profileId: string): SendRoute | null => SEND_ROUTES[profileId] ?? null;

export function softwareFor(profileId: string, vendor: string): string {
  return SOFTWARE[profileId] ?? `the ${vendor} programming software`;
}

/**
 * Why there is no Send for this project here, and what to do instead (null: the flow opens).
 * `bridges`: the bridges this desktop app has (none: the web version).
 */
export function noSendAdvice(p: { profileId: string; vendor: string; readOnly?: boolean }, bridges: ReadonlySet<SendRoute> | null): string | null {
  const software = softwareFor(p.profileId, p.vendor);
  if (p.readOnly) return 'This program stays on the machine\'s own controller, read only: choose the PLC to move it to first (Import › PLC program).';
  const route = sendRoute(p.profileId);
  if (!route) return `${software[0].toUpperCase()}${software.slice(1)} has no way for another program to put a program into it, so the app cannot send it there. Press Load into PLC instead: it gives you the files and the steps to do it in ${software}.`;
  if (!bridges) return `Sending to ${software} works in the ISA Auto Programmer desktop app for Windows, on the PC where ${software} is installed. Here, press Load into PLC for the files and the steps.`;
  if (!bridges.has(route)) return `This version of the desktop app cannot send to ${software} yet: update ISA Auto Programmer. Meanwhile, press Load into PLC for the files and the steps.`;
  return null;
}

/** The first line of an error: a message of several lines (one the bridge did not expect) is in the log in full. */
export function firstLine(message: string): string {
  return message.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? message;
}
